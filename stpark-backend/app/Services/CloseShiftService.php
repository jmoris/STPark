<?php

namespace App\Services;

use App\Models\Shift;
use App\Models\ShiftOperation;
use App\Models\User;
use App\Models\Operator;
use App\Models\AuditLog;
use Illuminate\Support\Facades\DB;

class CloseShiftService
{
    public function __construct(
        private ShiftService $shiftService,
        private CurrentShiftService $currentShiftService
    ) {}

    /**
     * Cerrar un turno
     */
    public function close(
        Shift $shift,
        float $closingDeclaredCash,
        ?int $closedById = null,
        ?string $notes = null
    ): array {
        if ($shift->status !== Shift::STATUS_OPEN) {
            throw new \Exception('El turno no está abierto');
        }

        DB::beginTransaction();

        try {
            // Calcular totales
            $totals = $this->shiftService->calculateTotals($shift);
            
            $cashExpected = $totals['cash_expected'];
            $cashOverShort = $closingDeclaredCash - $cashExpected;

            // Actualizar turno
            $shift->update([
                'closing_declared_cash' => $closingDeclaredCash,
                'cash_over_short' => $cashOverShort,
                'closed_at' => now(),
                'status' => Shift::STATUS_CLOSED,
                'closed_by' => $closedById,
                'notes' => $notes,
            ]);

            // Registrar operación de cierre
            ShiftOperation::create([
                'shift_id' => $shift->id,
                'kind' => ShiftOperation::KIND_CLOSE,
                'amount' => $closingDeclaredCash,
                'at' => now(),
                'notes' => "Cierre de turno. Efectivo esperado: {$cashExpected}, Declarado: {$closingDeclaredCash}, Diferencia: {$cashOverShort}",
            ]);

            // Registrar auditoría
            if ($closedById) {
                AuditLog::log(
                    $closedById,
                    'SHIFT_CLOSED',
                    'shifts',
                    $shift->id,
                    null,
                    [
                        'cash_expected' => $cashExpected,
                        'cash_declared' => $closingDeclaredCash,
                        'cash_over_short' => $cashOverShort,
                    ]
                );
            }

            DB::commit();

            // Limpiar caché
            $this->currentShiftService->forget($shift->operator_id, $shift->device_id);

            // Recalcular totales actualizados
            $totals = $this->shiftService->calculateTotals($shift);

            return [
                'shift' => $shift->load(['operator', 'sector', 'creator', 'closer']),
                'totals' => $totals,
                'cash_expected' => $cashExpected,
                'cash_over_short' => $cashOverShort,
            ];

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Cancelar un turno
     */
    public function cancel(
        Shift $shift,
        ?int $canceledById = null,
        ?string $notes = null
    ): Shift {
        if ($shift->status !== Shift::STATUS_OPEN) {
            throw new \Exception('Solo se pueden cancelar turnos abiertos');
        }

        DB::beginTransaction();

        try {
            $shift->update([
                'status' => Shift::STATUS_CANCELED,
                'closed_at' => now(),
                'closed_by' => $canceledById,
                'notes' => $notes,
            ]);

            // Registrar operación de cancelación
            ShiftOperation::create([
                'shift_id' => $shift->id,
                'kind' => ShiftOperation::KIND_ADJUSTMENT,
                'at' => now(),
                'notes' => 'Turno cancelado',
            ]);

            // Registrar auditoría
            if ($canceledById) {
                AuditLog::log(
                    $canceledById,
                    'SHIFT_CANCELED',
                    'shifts',
                    $shift->id,
                    null,
                    ['notes' => $notes]
                );
            }

            DB::commit();

            // Limpiar caché
            $this->currentShiftService->forget($shift->operator_id, $shift->device_id);

            return $shift->load(['operator', 'sector', 'creator', 'closer']);

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
}

