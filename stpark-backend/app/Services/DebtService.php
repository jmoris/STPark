<?php

namespace App\Services;

use App\Models\Debt;
use App\Models\Sale;
use App\Models\Payment;
use App\Models\AuditLog;

class DebtService
{
    /**
     * Liquidar deuda
     */
    public function settleDebt(
        int $debtId,
        float $amount,
        string $method,
        int $cashierOperatorId
    ): Debt {
        $debt = Debt::findOrFail($debtId);

        if (!$debt->isPending()) {
            throw new \Exception('La deuda no está pendiente');
        }

        if ($amount > $debt->getPendingAmount()) {
            throw new \Exception('El monto excede la deuda pendiente');
        }

        // Crear venta si no existe
        if (!$debt->parkingSession || !$debt->parkingSession->sale) {
            $sale = Sale::create([
                'session_id' => $debt->session_id,
                'doc_type' => Sale::DOC_TYPE_BOILET,
                'net' => $amount,
                'tax' => 0,
                'total' => $amount,
                'issued_at' => null,
                'cashier_operator_id' => $cashierOperatorId,
            ]);
        }

        // Crear pago
        $payment = Payment::create([
            'sale_id' => $sale->id ?? $debt->parkingSession->sale->id,
            'session_id' => $debt->session_id,
            'method' => $method,
            'amount' => $amount,
            'paid_at' => now(),
            'status' => Payment::STATUS_COMPLETED,
        ]);

        // Actualizar deuda
        $debt->update([
            'settled_at' => now(),
            'status' => Debt::STATUS_SETTLED,
        ]);

        // Registrar auditoría
        AuditLog::log(
            $cashierOperatorId,
            'SETTLE',
            'debts',
            $debt->id,
            null,
            $debt->toArray()
        );

        return $debt->load(['payments']);
    }

    /**
     * Crear deuda manual
     */
    public function createManualDebt(
        string $plate,
        float $amount,
        string $origin,
        ?string $notes = null
    ): Debt {
        $debt = Debt::create([
            'plate' => strtoupper($plate),
            'origin' => $origin,
            'principal_amount' => $amount,
            'created_at' => now(),
            'status' => Debt::STATUS_PENDING,
        ]);

        // Registrar auditoría
        AuditLog::log(
            null, // Sistema
            'CREATE',
            'debts',
            $debt->id,
            null,
            $debt->toArray()
        );

        return $debt;
    }

    /**
     * Obtener resumen de deudas pendientes
     */
    public function getPendingSummary(): array
    {
        $debts = Debt::pending()->get();

        $summary = [
            'total_debts' => $debts->count(),
            'total_amount' => $debts->sum('principal_amount'),
            'by_origin' => $debts->groupBy('origin')->map(function($group) {
                return [
                    'count' => $group->count(),
                    'total' => $group->sum('principal_amount'),
                ];
            }),
            'by_plate' => $debts->groupBy('plate')->map(function($group) {
                return [
                    'count' => $group->count(),
                    'total' => $group->sum('principal_amount'),
                ];
            }),
            'oldest_debt' => $debts->min('created_at'),
            'newest_debt' => $debts->max('created_at'),
        ];

        return $summary;
    }

    /**
     * Obtener deudas por placa
     */
    public function getDebtsByPlate(string $plate): array
    {
        $debts = Debt::byPlate($plate)
                    ->with(['parkingSession', 'payments'])
                    ->orderBy('created_at', 'desc')
                    ->get();

        $summary = [
            'plate' => $plate,
            'total_debts' => $debts->count(),
            'pending_debts' => $debts->where('status', Debt::STATUS_PENDING)->count(),
            'settled_debts' => $debts->where('status', Debt::STATUS_SETTLED)->count(),
            'total_pending_amount' => $debts->where('status', Debt::STATUS_PENDING)->sum('principal_amount'),
            'debts' => $debts,
        ];

        return $summary;
    }
}
