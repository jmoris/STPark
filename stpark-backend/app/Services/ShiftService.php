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
        // Primero, obtener todas las ventas que tienen pagos en este turno
        $salesWithPaymentsInShift = DB::table('payments')
            ->where('shift_id', $shift->id)
            ->where('status', 'COMPLETED')
            ->whereNotNull('sale_id')
            ->distinct()
            ->pluck('sale_id')
            ->toArray();

        // De esas ventas, identificar cuáles están completamente pagadas
        // Una venta está completamente pagada cuando la suma de TODOS sus pagos completados >= total de la venta
        $closedSalesIds = [];
        if (!empty($salesWithPaymentsInShift)) {
            $closedSalesIds = DB::table('sales')
                ->select('sales.id')
                ->whereIn('sales.id', $salesWithPaymentsInShift)
                ->join('payments', 'sales.id', '=', 'payments.sale_id')
                ->where('payments.status', 'COMPLETED')
                ->groupBy('sales.id', 'sales.total')
                ->havingRaw('SUM(payments.amount) >= sales.total')
                ->pluck('sales.id')
                ->toArray();
        }

        // Cobros por método - todos los pagos completados de este turno
        // Incluir pagos de ventas (sale_id) y pagos de sesiones de estacionamiento (session_id)
        $paymentsByMethod = DB::table('payments')
            ->where('shift_id', $shift->id)
            ->where('status', 'COMPLETED')
            ->where(function($query) use ($closedSalesIds) {
                // Incluir pagos de sesiones de estacionamiento
                $query->whereNotNull('session_id')
                      // O pagos de ventas cerradas (completamente pagadas)
                      ->orWhere(function($subQuery) use ($closedSalesIds) {
                          $subQuery->whereNotNull('sale_id');
                          if (!empty($closedSalesIds)) {
                              $subQuery->whereIn('sale_id', $closedSalesIds);
                          } else {
                              // Si no hay ventas cerradas, excluir pagos de ventas
                              $subQuery->whereRaw('1 = 0');
                          }
                      });
            })
            ->select('method', DB::raw('SUM(amount) as collected'), DB::raw('COUNT(*) as count'))
            ->groupBy('method')
            ->get()
            ->keyBy('method');

        // Efectivo cobrado - todos los pagos en efectivo completados de este turno
        // Incluir pagos de sesiones de estacionamiento y pagos de ventas cerradas
        $cashCollected = (float) DB::table('payments')
            ->where('shift_id', $shift->id)
            ->where('method', 'CASH')
            ->where('status', 'COMPLETED')
            ->where(function($query) use ($closedSalesIds) {
                // Incluir pagos de sesiones de estacionamiento
                $query->whereNotNull('session_id')
                      // O pagos de ventas cerradas (completamente pagadas)
                      ->orWhere(function($subQuery) use ($closedSalesIds) {
                          $subQuery->whereNotNull('sale_id');
                          if (!empty($closedSalesIds)) {
                              $subQuery->whereIn('sale_id', $closedSalesIds);
                          } else {
                              // Si no hay ventas cerradas, excluir pagos de ventas
                              $subQuery->whereRaw('1 = 0');
                          }
                      });
            })
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

        // Cantidad de tickets (ventas cerradas) - solo contar ventas que tienen pagos en este turno
        // Usar DISTINCT para evitar duplicados si una venta tiene múltiples pagos en el mismo turno
        $ticketsCount = 0;
        if (!empty($closedSalesIds)) {
            $ticketsCount = DB::table('sales')
                ->join('payments', 'sales.id', '=', 'payments.sale_id')
                ->where('payments.shift_id', $shift->id)
                ->where('payments.status', 'COMPLETED')
                ->whereIn('sales.id', $closedSalesIds)
                ->distinct('sales.id')
                ->count('sales.id');
        }

        // Total de ventas cerradas - sumar los montos de los pagos de este turno que pertenecen a ventas cerradas
        // Esto representa el monto total cobrado en este turno de ventas cerradas
        // Al sumar entre turnos, cada pago se cuenta solo una vez (en su turno), evitando duplicados
        $salesTotal = 0;
        if (!empty($closedSalesIds)) {
            $salesTotal = (float) DB::table('payments')
                ->where('shift_id', $shift->id)
                ->where('status', 'COMPLETED')
                ->whereNotNull('sale_id')
                ->whereIn('sale_id', $closedSalesIds)
                ->sum('amount');
        }

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

