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
        // Obtener IDs de ventas que tienen pagos en este turno
        $salesWithPaymentsInShift = DB::table('payments')
            ->where('shift_id', $shift->id)
            ->where('status', 'COMPLETED')
            ->whereNotNull('sale_id')
            ->distinct()
            ->pluck('sale_id')
            ->toArray();

        // De esas ventas, obtener solo las que están completamente pagadas
        // Una venta está completamente pagada cuando la suma de TODOS sus pagos completados >= total de la venta
        $closedSalesIds = [];
        if (!empty($salesWithPaymentsInShift)) {
            $closedSalesIds = DB::table('sales')
                ->select('sales.id')
                ->join('payments as sale_payments', 'sales.id', '=', 'sale_payments.sale_id')
                ->where('sale_payments.status', 'COMPLETED')
                ->whereIn('sales.id', $salesWithPaymentsInShift)
                ->groupBy('sales.id', 'sales.total')
                ->havingRaw('SUM(sale_payments.amount) >= sales.total')
                ->pluck('id')
                ->toArray();
        }

        // Cobros por método - solo de ventas cerradas (completamente pagadas)
        $paymentsByMethod = DB::table('payments')
            ->where('payments.shift_id', $shift->id)
            ->where('payments.status', 'COMPLETED')
            ->whereNotNull('payments.sale_id');
        
        if (!empty($closedSalesIds)) {
            $paymentsByMethod->whereIn('payments.sale_id', $closedSalesIds);
        } else {
            // Si no hay ventas cerradas, no hay pagos que mostrar
            $paymentsByMethod->whereRaw('1 = 0'); // Condición que nunca se cumple
        }
        
        $paymentsByMethod = $paymentsByMethod
            ->select('payments.method', DB::raw('SUM(payments.amount) as collected'), DB::raw('COUNT(*) as count'))
            ->groupBy('payments.method')
            ->get()
            ->keyBy('method');

        // Efectivo cobrado - solo de ventas cerradas (completamente pagadas)
        $cashCollectedQuery = DB::table('payments')
            ->where('payments.shift_id', $shift->id)
            ->where('payments.method', 'CASH')
            ->where('payments.status', 'COMPLETED')
            ->whereNotNull('payments.sale_id');
        
        if (!empty($closedSalesIds)) {
            $cashCollectedQuery->whereIn('payments.sale_id', $closedSalesIds);
        } else {
            $cashCollectedQuery->whereRaw('1 = 0'); // Condición que nunca se cumple
        }
        
        $cashCollected = (float) $cashCollectedQuery->sum('payments.amount');

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

        // Cantidad de tickets (ventas cerradas - completamente pagadas)
        $ticketsCountQuery = DB::table('sales')
            ->join('payments', 'sales.id', '=', 'payments.sale_id')
            ->where('payments.shift_id', $shift->id)
            ->where('payments.status', 'COMPLETED');
        
        if (!empty($closedSalesIds)) {
            $ticketsCountQuery->whereIn('sales.id', $closedSalesIds);
        } else {
            $ticketsCountQuery->whereRaw('1 = 0'); // Condición que nunca se cumple
        }
        
        $ticketsCount = $ticketsCountQuery
            ->distinct('sales.id')
            ->count('sales.id');

        // Total de ventas cerradas (completamente pagadas)
        $salesTotalQuery = DB::table('sales')
            ->join('payments', 'sales.id', '=', 'payments.sale_id')
            ->where('payments.shift_id', $shift->id)
            ->where('payments.status', 'COMPLETED');
        
        if (!empty($closedSalesIds)) {
            $salesTotalQuery->whereIn('sales.id', $closedSalesIds);
        } else {
            $salesTotalQuery->whereRaw('1 = 0'); // Condición que nunca se cumple
        }
        
        $salesTotal = (float) $salesTotalQuery
            ->distinct('sales.id')
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

