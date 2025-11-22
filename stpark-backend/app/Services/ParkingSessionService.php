<?php

namespace App\Services;

use App\Models\ParkingSession;
use App\Models\Debt;
use App\Models\Sector;
use App\Models\Street;
use App\Models\Operator;
use App\Services\PricingService;
use App\Services\CurrentShiftService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ParkingSessionService
{
    protected $pricingService;
    protected $currentShiftService;

    public function __construct(
        PricingService $pricingService,
        CurrentShiftService $currentShiftService
    )
    {
        $this->pricingService = $pricingService;
        $this->currentShiftService = $currentShiftService;
    }

    /**
     * Crear nueva sesión de estacionamiento
     */
    public function createSession(string $plate, int $sectorId, int $streetId, int $operatorId): ParkingSession
    {
        // Verificar si ya existe una sesión activa para esta placa en el mismo sector
        $activeSession = ParkingSession::where('plate', $plate)
            ->where('sector_id', $sectorId)
            ->where('status', 'ACTIVE')
            ->first();

        if ($activeSession) {
            throw new \Exception('Ya existe una sesión activa para esta placa en este sector');
        }

        // Verificar si el operador tiene un turno abierto
        $shift = $this->currentShiftService->get($operatorId, null);
        
        if (!$shift) {
            throw new \Exception('NO_SHIFT_OPEN');
        }

        // Crear la sesión
        $session = ParkingSession::create([
            'plate' => strtoupper($plate),
            'sector_id' => $sectorId,
            'street_id' => $streetId,
            'operator_in_id' => $operatorId,
            'started_at' => Carbon::now('America/Santiago'),
            'status' => 'ACTIVE'
        ]);

        return $session->load(['sector', 'street', 'operator']);
    }

    /**
     * Crear sesión con verificación de deudas
     */
    public function createSessionWithDebtCheck(string $plate, int $sectorId, int $streetId, int $operatorId): array
    {
        // Verificar deudas pendientes
        $pendingDebts = Debt::where('plate', strtoupper($plate))
            ->where('status', 'PENDING')
            ->sum('amount');

        // Crear la sesión
        $session = $this->createSession($plate, $sectorId, $streetId, $operatorId);

        return [
            'session' => $session,
            'pending_debts' => $pendingDebts,
            'has_pending_debts' => $pendingDebts > 0
        ];
    }

    /**
     * Obtener sesión activa por placa
     */
    public function getActiveSessionByPlate(string $plate): ?ParkingSession
    {
        return ParkingSession::where('plate', strtoupper($plate))
            ->whereNull('ended_at')
            ->with(['sector', 'street', 'operator'])
            ->first();
    }

    /**
     * Obtener cotización para una sesión
     */
    public function getQuote(int $sessionId, array $params = []): array
    {
        $session = ParkingSession::findOrFail($sessionId);
        
        if ($session->ended_at) {
            throw new \Exception('La sesión ya ha terminado');
        }

        // Parsear started_at: Laravel guarda timestamps en UTC pero representan hora local
        // Si viene de la BD como UTC, extraer componentes y crear en America/Santiago
        $startTimeRaw = $session->started_at;
        if ($startTimeRaw instanceof Carbon) {
            // Si ya es Carbon, verificar su timezone
            if ($startTimeRaw->timezone->getName() === 'UTC' || $startTimeRaw->timezone->getName() === '+00:00') {
                // Extraer componentes y crear en America/Santiago (sin conversión)
                $startTime = Carbon::create(
                    $startTimeRaw->year,
                    $startTimeRaw->month,
                    $startTimeRaw->day,
                    $startTimeRaw->hour,
                    $startTimeRaw->minute,
                    $startTimeRaw->second,
                    'America/Santiago'
                );
            } else {
                $startTime = $startTimeRaw->copy()->setTimezone('America/Santiago');
            }
        } else {
            // Si es string, parsear y manejar como UTC pero crear en America/Santiago
            $parsedStart = Carbon::parse($startTimeRaw, 'UTC');
            $startTime = Carbon::create(
                $parsedStart->year,
                $parsedStart->month,
                $parsedStart->day,
                $parsedStart->hour,
                $parsedStart->minute,
                $parsedStart->second,
                'America/Santiago'
            );
        }
        
        // Parsear ended_at: si viene como string ISO con 'Z' (UTC), 
        // interpretar los componentes como hora local de America/Santiago
        // Esto es porque el frontend envía new Date().toISOString() que marca como UTC
        // pero realmente representa la hora local
        if (isset($params['ended_at'])) {
            $endedAt = $params['ended_at'];
            if (is_string($endedAt) && (str_ends_with($endedAt, 'Z') || str_contains($endedAt, '+00:00'))) {
                // Extraer componentes de la fecha UTC pero crear en America/Santiago
                $parsedDate = Carbon::parse($endedAt, 'UTC');
                $endTime = Carbon::create(
                    $parsedDate->year,
                    $parsedDate->month,
                    $parsedDate->day,
                    $parsedDate->hour,
                    $parsedDate->minute,
                    $parsedDate->second,
                    'America/Santiago'
                );
            } elseif (is_string($endedAt)) {
                // Si no es UTC, parsear y establecer timezone
                $endTime = Carbon::parse($endedAt)->setTimezone('America/Santiago');
            } else {
                // Si ya es un objeto Carbon, asegurar timezone
                $endTime = $endedAt instanceof Carbon 
                    ? $endedAt->copy()->setTimezone('America/Santiago')
                    : Carbon::parse($endedAt)->setTimezone('America/Santiago');
            }
        } else {
            $endTime = Carbon::now('America/Santiago');
        }
        
        // Calcular duración: ambas fechas deben estar en el mismo timezone
        $duration = $startTime->diffInMinutes($endTime);

        $quote = $this->pricingService->calculatePrice(
            $session->sector_id,
            $session->street_id,
            $duration,
            $startTime,
            $endTime
        );

        // Aplicar descuento si se proporciona código
        $discountAmount = 0;
        if (isset($params['discount_code']) && !empty($params['discount_code'])) {
            // Aquí se podría implementar la lógica de descuentos
            // Por ahora, simulamos un descuento del 10%
            $discountAmount = $quote['total'] * 0.1;
        }

        $netAmount = $quote['total'] - $discountAmount;

        return [
            'session_id' => $sessionId,
            'started_at' => $session->started_at,
            'ended_at' => $endTime->toISOString(),
            'duration_minutes' => $duration,
            'gross_amount' => $quote['total'],
            'discount_amount' => $discountAmount,
            'net_amount' => $netAmount,
            'pricing_profile' => $quote['pricing_profile'] ?? 'Perfil por defecto',
            'breakdown' => $quote['breakdown'] ?? []
        ];
    }

    /**
     * Realizar checkout de una sesión
     */
    public function checkout(int $sessionId, string $paymentMethod, float $amount, string|Carbon $endedAt, ?string $approvalCode = null, ?int $operatorOutId = null): array
    {
        $session = ParkingSession::findOrFail($sessionId);
        
        if ($session->ended_at) {
            throw new \Exception('La sesión ya ha terminado');
        }

        DB::beginTransaction();

        try {
            // Parsear ended_at: si viene como string ISO con 'Z' (UTC), 
            // interpretar los componentes como hora local de America/Santiago
            // Esto es porque el frontend envía new Date().toISOString() que marca como UTC
            // pero realmente representa la hora local
            if (is_string($endedAt) && (str_ends_with($endedAt, 'Z') || str_contains($endedAt, '+00:00'))) {
                // Extraer componentes de la fecha UTC pero crear en America/Santiago
                $parsedDate = Carbon::parse($endedAt, 'UTC');
                $endTime = Carbon::create(
                    $parsedDate->year,
                    $parsedDate->month,
                    $parsedDate->day,
                    $parsedDate->hour,
                    $parsedDate->minute,
                    $parsedDate->second,
                    'America/Santiago'
                );
            } elseif (is_string($endedAt)) {
                // Si no es UTC, parsear y establecer timezone
                $endTime = Carbon::parse($endedAt)->setTimezone('America/Santiago');
            } else {
                // Si ya es un objeto Carbon, asegurar timezone
                $endTime = $endedAt instanceof Carbon 
                    ? $endedAt->copy()->setTimezone('America/Santiago')
                    : Carbon::parse($endedAt)->setTimezone('America/Santiago');
            }
            
            // Actualizar la sesión con el objeto Carbon (Laravel lo guardará correctamente)
            // Guardar el operador que hizo el checkout (operator_out_id)
            $session->update([
                'ended_at' => $endTime,
                'status' => 'COMPLETED',
                'operator_out_id' => $operatorOutId
            ]);

            // Calcular el precio real
            // Parsear started_at: Laravel guarda timestamps en UTC pero representan hora local
            $startTimeRaw = $session->started_at;
            if ($startTimeRaw instanceof Carbon) {
                // Si ya es Carbon, verificar su timezone
                if ($startTimeRaw->timezone->getName() === 'UTC' || $startTimeRaw->timezone->getName() === '+00:00') {
                    // Extraer componentes y crear en America/Santiago (sin conversión)
                    $startTime = Carbon::create(
                        $startTimeRaw->year,
                        $startTimeRaw->month,
                        $startTimeRaw->day,
                        $startTimeRaw->hour,
                        $startTimeRaw->minute,
                        $startTimeRaw->second,
                        'America/Santiago'
                    );
                } else {
                    $startTime = $startTimeRaw->copy()->setTimezone('America/Santiago');
                }
            } else {
                // Si es string, parsear y manejar como UTC pero crear en America/Santiago
                $parsedStart = Carbon::parse($startTimeRaw, 'UTC');
                $startTime = Carbon::create(
                    $parsedStart->year,
                    $parsedStart->month,
                    $parsedStart->day,
                    $parsedStart->hour,
                    $parsedStart->minute,
                    $parsedStart->second,
                    'America/Santiago'
                );
            }
            $duration = $startTime->diffInMinutes($endTime);

            $quote = $this->pricingService->calculatePrice(
                $session->sector_id,
                $session->street_id,
                $duration,
                $startTime,
                $endTime
            );

            $result = [
                'session' => $session->load(['sector', 'street', 'operator', 'operatorOut', 'payments']),
                'quote' => $quote
            ];

            // Si el monto pagado es 0, crear deuda automáticamente
            if ($amount == 0 && $quote['total'] > 0) {
                // Crear deuda por el monto que corresponde
                $debt = Debt::create([
                    'plate' => $session->plate,
                    'session_id' => $session->id,
                    'origin' => 'SESSION',
                    'principal_amount' => $quote['total'],
                    'status' => 'PENDING',
                    'created_at' => Carbon::now('America/Santiago')
                ]);

                $result['debt'] = $debt;
                $result['message'] = 'Sesión cerrada sin pago. Deuda creada automáticamente.';
            } else {
                // Obtener turno actual del operador que hace el checkout (no del que recibió el vehículo)
                // IMPORTANTE: Si no se proporciona operatorOutId, lanzar error para evitar asociar pagos al operador incorrecto
                if (!$operatorOutId) {
                    throw new \Exception('El operador que hace el checkout es requerido para asociar el pago al turno correcto');
                }
                
                $shift = $this->currentShiftService->get($operatorOutId, null);
                
                // Si el operador que hace el checkout no tiene turno abierto, lanzar error
                if (!$shift) {
                    throw new \Exception('El operador que hace el checkout no tiene un turno abierto. Por favor, abre un turno antes de procesar el checkout.');
                }
                
                // Crear el pago normal asociado al turno del operador que hace el checkout
                $payment = $session->payments()->create([
                    'amount' => $amount,
                    'method' => $paymentMethod,
                    'status' => 'COMPLETED',
                    'paid_at' => Carbon::now('America/Santiago'),
                    'approval_code' => $approvalCode,
                    'shift_id' => $shift->id, // Siempre asociar al turno del operador que hace el checkout
                ]);

                // Registrar operación en el turno
                \App\Models\ShiftOperation::create([
                    'shift_id' => $shift->id,
                    'kind' => \App\Models\ShiftOperation::KIND_ADJUSTMENT,
                    'amount' => $amount,
                    'at' => Carbon::now('America/Santiago'),
                    'ref_id' => $payment->id,
                    'ref_type' => 'payment',
                    'notes' => "Pago {$paymentMethod} por {$amount}",
                ]);

                $result['payment'] = $payment;
                $result['message'] = 'Checkout procesado exitosamente';
            }

            DB::commit();
            return $result;

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Cancelar sesión
     */
    public function cancelSession(int $sessionId): ParkingSession
    {
        $session = ParkingSession::findOrFail($sessionId);
        
        if ($session->ended_at) {
            throw new \Exception('La sesión ya ha terminado');
        }

        $session->update([
            'ended_at' => Carbon::now('America/Santiago'),
            'status' => 'CANCELLED'
        ]);

        return $session->load(['sector', 'street', 'operator']);
    }

    /**
     * Forzar checkout sin pago
     */
    public function forceCheckoutWithoutPayment(int $sessionId, string|Carbon $endedAt): array
    {
        $session = ParkingSession::findOrFail($sessionId);
        
        if ($session->ended_at) {
            throw new \Exception('La sesión ya ha terminado');
        }

        DB::beginTransaction();

        try {
            // Parsear ended_at: si viene como string ISO con 'Z' (UTC), 
            // interpretar los componentes como hora local de America/Santiago
            if (is_string($endedAt) && (str_ends_with($endedAt, 'Z') || str_contains($endedAt, '+00:00'))) {
                // Extraer componentes de la fecha UTC pero crear en America/Santiago
                $parsedDate = Carbon::parse($endedAt, 'UTC');
                $endTime = Carbon::create(
                    $parsedDate->year,
                    $parsedDate->month,
                    $parsedDate->day,
                    $parsedDate->hour,
                    $parsedDate->minute,
                    $parsedDate->second,
                    'America/Santiago'
                );
            } elseif (is_string($endedAt)) {
                // Si no es UTC, parsear y establecer timezone
                $endTime = Carbon::parse($endedAt)->setTimezone('America/Santiago');
            } else {
                // Si ya es un objeto Carbon, asegurar timezone
                $endTime = $endedAt instanceof Carbon 
                    ? $endedAt->copy()->setTimezone('America/Santiago')
                    : Carbon::parse($endedAt)->setTimezone('America/Santiago');
            }
            
            // Actualizar la sesión con el objeto Carbon (Laravel lo guardará correctamente)
            $session->update([
                'ended_at' => $endTime,
                'status' => 'FORCED_CHECKOUT'
            ]);

            // Calcular el precio
            // Parsear started_at: Laravel guarda timestamps en UTC pero representan hora local
            $startTimeRaw = $session->started_at;
            if ($startTimeRaw instanceof Carbon) {
                // Si ya es Carbon, verificar su timezone
                if ($startTimeRaw->timezone->getName() === 'UTC' || $startTimeRaw->timezone->getName() === '+00:00') {
                    // Extraer componentes y crear en America/Santiago (sin conversión)
                    $startTime = Carbon::create(
                        $startTimeRaw->year,
                        $startTimeRaw->month,
                        $startTimeRaw->day,
                        $startTimeRaw->hour,
                        $startTimeRaw->minute,
                        $startTimeRaw->second,
                        'America/Santiago'
                    );
                } else {
                    $startTime = $startTimeRaw->copy()->setTimezone('America/Santiago');
                }
            } else {
                // Si es string, parsear y manejar como UTC pero crear en America/Santiago
                $parsedStart = Carbon::parse($startTimeRaw, 'UTC');
                $startTime = Carbon::create(
                    $parsedStart->year,
                    $parsedStart->month,
                    $parsedStart->day,
                    $parsedStart->hour,
                    $parsedStart->minute,
                    $parsedStart->second,
                    'America/Santiago'
                );
            }
            $duration = $startTime->diffInMinutes($endTime);

            $quote = $this->pricingService->calculatePrice(
                $session->sector_id,
                $session->street_id,
                $duration,
                $startTime,
                $endTime
            );

            // Crear deuda
            $debt = Debt::create([
                'plate' => $session->plate,
                'amount' => $quote['total'],
                'description' => 'Deuda por estacionamiento no pagado',
                'status' => 'PENDING',
                'created_at' => Carbon::now('America/Santiago')
            ]);

            DB::commit();

            return [
                'session' => $session->load(['sector', 'street', 'operator']),
                'debt' => $debt,
                'quote' => $quote
            ];

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Verificar deudas pendientes por placa
     */
    public function checkPendingDebtsForPlate(string $plate): array
    {
        $debts = Debt::where('plate', strtoupper($plate))
            ->where('status', 'PENDING')
            ->get();

        $totalAmount = $debts->sum('amount');

        return [
            'plate' => strtoupper($plate),
            'has_debts' => $debts->count() > 0,
            'total_amount' => $totalAmount,
            'debts' => $debts
        ];
    }
}