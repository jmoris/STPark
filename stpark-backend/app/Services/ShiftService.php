<?php

namespace App\Services;

use App\Models\Shift;
use App\Models\ShiftOperation;
use App\Models\Operator;
use App\Models\User;
use App\Models\Settings;
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

        // Efectivo cobrado de sesiones de estacionamiento - todos los pagos en efectivo completados de este turno
        // Incluir pagos de sesiones de estacionamiento y pagos de ventas cerradas
        $parkingCashCollected = (float) DB::table('payments')
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

        // Verificar si el módulo de lavado de autos está habilitado
        $carWashEnabled = false;
        $settings = Settings::where('key', 'general')->first();
        if ($settings && isset($settings->value['car_wash_enabled'])) {
            $carWashEnabled = (bool) $settings->value['car_wash_enabled'];
        }

        // Total de lavados de autos pagados en este turno (solo si el módulo está habilitado)
        $carWashesTotal = 0;
        $carWashesCount = 0;
        $carWashesCashTotal = 0;
        $carWashesCardTotal = 0;

        if ($carWashEnabled) {
            $carWashesTotal = (float) DB::table('car_washes')
                ->where('shift_id', $shift->id)
                ->where('status', 'PAID')
                ->sum('amount');

            $carWashesCount = (int) DB::table('car_washes')
                ->where('shift_id', $shift->id)
                ->where('status', 'PAID')
                ->count();

            // Efectivo cobrado de lavados de autos (lavados sin approval_code se consideran efectivo)
            // Si tiene approval_code, es tarjeta; si no, es efectivo
            $carWashesCashTotal = (float) DB::table('car_washes')
                ->where('shift_id', $shift->id)
                ->where('status', 'PAID')
                ->whereNull('approval_code')
                ->sum('amount');

            $carWashesCardTotal = (float) DB::table('car_washes')
                ->where('shift_id', $shift->id)
                ->where('status', 'PAID')
                ->whereNotNull('approval_code')
                ->sum('amount');

            // Agregar lavados de autos a payments_by_method
            // Lavados en efectivo (sin approval_code)
            if ($carWashesCashTotal > 0) {
                $carWashesCashCount = (int) DB::table('car_washes')
                    ->where('shift_id', $shift->id)
                    ->where('status', 'PAID')
                    ->whereNull('approval_code')
                    ->count();
                
                if (isset($paymentsByMethod['CASH'])) {
                    $paymentsByMethod['CASH']->collected += $carWashesCashTotal;
                    $paymentsByMethod['CASH']->count += $carWashesCashCount;
                } else {
                    $paymentsByMethod['CASH'] = (object) [
                        'method' => 'CASH',
                        'collected' => $carWashesCashTotal,
                        'count' => $carWashesCashCount,
                    ];
                }
            }

            // Lavados con tarjeta (con approval_code)
            if ($carWashesCardTotal > 0) {
                $carWashesCardCount = (int) DB::table('car_washes')
                    ->where('shift_id', $shift->id)
                    ->where('status', 'PAID')
                    ->whereNotNull('approval_code')
                    ->count();
                
                if (isset($paymentsByMethod['CARD'])) {
                    $paymentsByMethod['CARD']->collected += $carWashesCardTotal;
                    $paymentsByMethod['CARD']->count += $carWashesCardCount;
                } else {
                    $paymentsByMethod['CARD'] = (object) [
                        'method' => 'CARD',
                        'collected' => $carWashesCardTotal,
                        'count' => $carWashesCardCount,
                    ];
                }
            }
        }

        // Efectivo cobrado total (sesiones + lavados si está habilitado)
        $cashCollected = $parkingCashCollected + $carWashesCashTotal;

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

        // Cantidad de tickets - contar sesiones de estacionamiento únicas con pagos completados en este turno
        $ticketsCount = (int) DB::table('payments')
            ->where('shift_id', $shift->id)
            ->where('status', 'COMPLETED')
            ->whereNotNull('session_id')
            ->selectRaw('COUNT(DISTINCT session_id) as count')
            ->first()
            ->count ?? 0;

        // Total vendido de sesiones de estacionamiento - todos los pagos completados de este turno
        // Incluir pagos de sesiones de estacionamiento y pagos de ventas cerradas
        $parkingSalesTotal = (float) DB::table('payments')
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
            ->sum('amount');

        // Total vendido (sesiones + lavados si está habilitado)
        $salesTotal = $parkingSalesTotal + $carWashesTotal;

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
            'parking_sales_total' => $parkingSalesTotal,
            'car_washes_total' => $carWashesTotal,
            'car_washes_count' => $carWashesCount,
            'car_washes_cash_total' => $carWashesCashTotal,
            'car_washes_card_total' => $carWashesCardTotal,
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

