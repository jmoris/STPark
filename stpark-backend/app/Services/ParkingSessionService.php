<?php

namespace App\Services;

use App\Models\ParkingSession;
use App\Models\Operator;
use App\Models\Sale;
use App\Models\Debt;
use App\Models\AuditLog;
use App\Services\PricingService;
use Carbon\Carbon;

class ParkingSessionService
{
    public function __construct(
        private PricingService $pricingService
    ) {}

    /**
     * Crear nueva sesión de estacionamiento
     */
    public function createSession(
        string $plate,
        int $sectorId,
        ?int $streetId,
        int $operatorId
    ): ParkingSession {
        // Verificar que el operador esté asignado al sector/calle
        $this->validateOperatorAssignment($operatorId, $sectorId, $streetId);

        // Verificar que no exista sesión activa para la misma placa en el mismo sector
        $existingSession = ParkingSession::active()
            ->byPlate($plate)
            ->bySector($sectorId)
            ->first();

        if ($existingSession) {
            throw new \Exception('Ya existe una sesión activa para esta placa en este sector');
        }

        $session = ParkingSession::create([
            'plate' => strtoupper($plate),
            'sector_id' => $sectorId,
            'street_id' => $streetId,
            'operator_in_id' => $operatorId,
            'started_at' => now(),
            'status' => ParkingSession::STATUS_ACTIVE,
        ]);

        // Registrar auditoría
        AuditLog::log(
            $operatorId,
            'CREATE',
            'parking_sessions',
            $session->id,
            null,
            $session->toArray()
        );

        return $session;
    }

    /**
     * Procesar checkout de sesión
     */
    public function checkoutSession(int $sessionId, string $endedAt): ParkingSession
    {
        $session = ParkingSession::findOrFail($sessionId);

        if (!$session->isActive()) {
            throw new \Exception('La sesión no está activa');
        }

        // Calcular cotización
        $quote = $this->pricingService->calculateQuote($session, $endedAt);

        // Actualizar sesión
        $session->update([
            'ended_at' => $endedAt,
            'seconds_total' => $quote['duration_minutes'] * 60,
            'gross_amount' => $quote['gross_amount'],
            'discount_amount' => $quote['discount_amount'],
            'net_amount' => $quote['net_amount'],
            'status' => ParkingSession::STATUS_TO_PAY,
        ]);

        // Crear venta
        $sale = Sale::create([
            'session_id' => $session->id,
            'doc_type' => Sale::DOC_TYPE_BOILET,
            'net' => $quote['net_amount'],
            'tax' => 0, // Asumiendo que no hay impuestos
            'total' => $quote['net_amount'],
            'issued_at' => null, // Se emite cuando se paga
        ]);

        // Registrar auditoría
        AuditLog::log(
            $session->operator_in_id,
            'CHECKOUT',
            'parking_sessions',
            $session->id,
            null,
            $session->toArray()
        );

        return $session->load(['sale']);
    }

    /**
     * Cancelar sesión
     */
    public function cancelSession(int $sessionId): ParkingSession
    {
        $session = ParkingSession::findOrFail($sessionId);

        if ($session->isClosed()) {
            throw new \Exception('No se puede cancelar una sesión cerrada');
        }

        $session->update([
            'status' => ParkingSession::STATUS_CANCELED,
        ]);

        // Registrar auditoría
        AuditLog::log(
            $session->operator_in_id,
            'CANCEL',
            'parking_sessions',
            $session->id,
            null,
            $session->toArray()
        );

        return $session;
    }

    /**
     * Marcar sesión como pagada
     */
    public function markAsPaid(ParkingSession $session): void
    {
        $session->update([
            'status' => ParkingSession::STATUS_PAID,
        ]);

        // Verificar si hay venta asociada y marcarla como pagada
        if ($session->sale) {
            $session->sale->update([
                'issued_at' => now(),
            ]);
        }

        // Registrar auditoría
        AuditLog::log(
            $session->operator_in_id,
            'PAY',
            'parking_sessions',
            $session->id,
            null,
            $session->toArray()
        );
    }

    /**
     * Cerrar sesión
     */
    public function closeSession(ParkingSession $session): void
    {
        $session->update([
            'status' => ParkingSession::STATUS_CLOSED,
        ]);

        // Registrar auditoría
        AuditLog::log(
            $session->operator_in_id,
            'CLOSE',
            'parking_sessions',
            $session->id,
            null,
            $session->toArray()
        );
    }

    /**
     * Crear deuda si el pago es insuficiente
     */
    public function createDebtIfNeeded(ParkingSession $session, float $paidAmount): ?Debt
    {
        if ($paidAmount < $session->net_amount) {
            $debt = Debt::create([
                'plate' => $session->plate,
                'origin' => Debt::ORIGIN_SESSION,
                'principal_amount' => $session->net_amount - $paidAmount,
                'created_at' => now(),
                'status' => Debt::STATUS_PENDING,
                'session_id' => $session->id,
            ]);

            // Registrar auditoría
            AuditLog::log(
                $session->operator_in_id,
                'CREATE',
                'debts',
                $debt->id,
                null,
                $debt->toArray()
            );

            return $debt;
        }

        return null;
    }

    /**
     * Validar asignación de operador
     */
    private function validateOperatorAssignment(int $operatorId, int $sectorId, ?int $streetId): void
    {
        $operator = Operator::findOrFail($operatorId);

        if (!$operator->isActive()) {
            throw new \Exception('El operador no está activo');
        }

        $assignment = $operator->operatorAssignments()
            ->where('sector_id', $sectorId)
            ->where(function($query) use ($streetId) {
                if ($streetId) {
                    $query->where('street_id', $streetId)
                          ->orWhereNull('street_id');
                } else {
                    $query->whereNull('street_id');
                }
            })
            ->where('valid_from', '<=', now())
            ->where(function($query) {
                $query->whereNull('valid_to')
                      ->orWhere('valid_to', '>=', now());
            })
            ->first();

        if (!$assignment) {
            throw new \Exception('El operador no está asignado a este sector/calle');
        }
    }
}
