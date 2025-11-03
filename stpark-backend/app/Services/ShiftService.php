<?php

namespace App\Services;

use App\Models\Shift;
use App\Models\ShiftOperation;
use App\Models\Operator;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ShiftService
{
    public function __construct(
        private CurrentShiftService $currentShiftService
    ) {}

    /**
     * Abrir un nuevo turno
     */
    public function open(
        int $operatorId,
        float $openingFloat,
        ?int $sectorId = null,
        ?string $deviceId = null,
        ?int $createdById = null,
        ?string $notes = null
    ): Shift {
        // Verificar que no haya un turno abierto para este operador y dispositivo
        $existingShift = $this->currentShiftService->get($operatorId, $deviceId);
        
        if ($existingShift) {
            throw new \Exception('Ya existe un turno abierto para este operador y dispositivo');
        }

        DB::beginTransaction();

        try {
            $shift = Shift::create([
                'operator_id' => $operatorId,
                'sector_id' => $sectorId,
                'device_id' => $deviceId,
                'opening_float' => $openingFloat,
                'opened_at' => now(),
                'status' => Shift::STATUS_OPEN,
                'notes' => $notes,
                'created_by' => $createdById,
            ]);

            // Registrar operación de apertura
            ShiftOperation::create([
                'shift_id' => $shift->id,
                'kind' => ShiftOperation::KIND_OPEN,
                'amount' => $openingFloat,
                'at' => now(),
                'notes' => 'Apertura de turno',
            ]);

            DB::commit();

            // Limpiar caché
            $this->currentShiftService->forget($operatorId, $deviceId);

            return $shift->load(['operator', 'sector', 'creator']);

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Calcular totales del turno
     */
    public function calculateTotals(Shift $shift): array
    {
        // Cobros por método
        $paymentsByMethod = DB::table('payments')
            ->where('shift_id', $shift->id)
            ->where('status', 'COMPLETED')
            ->select('method', DB::raw('SUM(amount) as collected'), DB::raw('COUNT(*) as count'))
            ->groupBy('method')
            ->get()
            ->keyBy('method');

        // Efectivo cobrado
        $cashCollected = (float) DB::table('payments')
            ->where('shift_id', $shift->id)
            ->where('method', 'CASH')
            ->where('status', 'COMPLETED')
            ->sum('amount');

        // Retiros
        $withdrawals = (float) DB::table('cash_adjustments')
            ->where('shift_id', $shift->id)
            ->where('type', 'WITHDRAWAL')
            ->sum('amount');

        // Depósitos
        $deposits = (float) DB::table('cash_adjustments')
            ->where('shift_id', $shift->id)
            ->where('type', 'DEPOSIT')
            ->sum('amount');

        // Efectivo esperado
        $cashExpected = $shift->opening_float + $cashCollected - $withdrawals + $deposits;

        // Cantidad de tickets (ventas)
        $ticketsCount = DB::table('sales')
            ->join('payments', 'sales.id', '=', 'payments.sale_id')
            ->where('payments.shift_id', $shift->id)
            ->where('payments.status', 'COMPLETED')
            ->distinct('sales.id')
            ->count('sales.id');

        // Total de ventas
        $salesTotal = (float) DB::table('sales')
            ->join('payments', 'sales.id', '=', 'payments.sale_id')
            ->where('payments.shift_id', $shift->id)
            ->where('payments.status', 'COMPLETED')
            ->sum('sales.total');

        return [
            'opening_float' => (float) $shift->opening_float,
            'cash_collected' => $cashCollected,
            'cash_withdrawals' => $withdrawals,
            'cash_deposits' => $deposits,
            'cash_expected' => $cashExpected,
            'cash_declared' => $shift->closing_declared_cash,
            'cash_over_short' => $shift->cash_over_short,
            'tickets_count' => $ticketsCount,
            'sales_total' => $salesTotal,
            'payments_by_method' => $paymentsByMethod->map(function ($item) {
                return [
                    'method' => $item->method,
                    'collected' => (float) $item->collected,
                    'count' => (int) $item->count,
                ];
            })->values(),
        ];
    }
}

