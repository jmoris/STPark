<?php

namespace App\Http\Controllers;

use App\Models\Shift;
use App\Models\CashAdjustment;
use App\Services\ShiftService;
use App\Services\CloseShiftService;
use App\Services\CurrentShiftService;
use App\Services\ShiftReportService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class ShiftController extends Controller
{
    public function __construct(
        private ShiftService $shiftService,
        private CloseShiftService $closeShiftService,
        private CurrentShiftService $currentShiftService,
        private ShiftReportService $reportService
    ) {}

    /**
     * Abrir un nuevo turno
     */
    public function open(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'operator_id' => 'required|exists:operators,id',
            'opening_float' => 'required|numeric|min:0',
            'sector_id' => 'nullable|exists:sectors,id',
            'device_id' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de entrada inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $shift = $this->shiftService->open(
                $request->operator_id,
                $request->opening_float,
                $request->sector_id,
                $request->device_id,
                $request->user()?->id,
                $request->notes
            );

            return response()->json([
                'success' => true,
                'message' => 'Turno abierto exitosamente',
                'data' => $shift
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 409);
        }
    }

    /**
     * Obtener el turno actual del operador
     */
    public function current(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'operator_id' => 'required|exists:operators,id',
            'device_id' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de entrada inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        $shift = $this->currentShiftService->get(
            $request->operator_id,
            $request->device_id
        );

        if (!$shift) {
            return response()->json([
                'success' => false,
                'message' => 'No hay turno abierto',
                'data' => null
            ], 404);
        }

        $totals = $this->shiftService->calculateTotals($shift);

        return response()->json([
            'success' => true,
            'data' => [
                'shift' => $shift->load(['operator', 'sector', 'creator']),
                'totals' => $totals,
            ]
        ]);
    }

    /**
     * Cerrar un turno
     */
    public function close(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'closing_declared_cash' => 'required|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de entrada inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $shift = Shift::findOrFail($id);

            $result = $this->closeShiftService->close(
                $shift,
                $request->closing_declared_cash,
                $request->user()?->id,
                $request->notes
            );

            return response()->json([
                'success' => true,
                'message' => 'Turno cerrado exitosamente',
                'data' => $result
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 409);
        }
    }

    /**
     * Cancelar un turno
     */
    public function cancel(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de entrada inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $shift = Shift::findOrFail($id);

            $shift = $this->closeShiftService->cancel(
                $shift,
                $request->user()?->id,
                $request->notes
            );

            return response()->json([
                'success' => true,
                'message' => 'Turno cancelado exitosamente',
                'data' => $shift
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 409);
        }
    }

    /**
     * Registrar ajuste de caja (retiro o depósito)
     */
    public function adjustment(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'type' => 'required|in:WITHDRAWAL,DEPOSIT',
            'amount' => 'required|numeric|min:0.01',
            'reason' => 'nullable|string',
            'receipt_number' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de entrada inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $shift = Shift::findOrFail($id);

            if ($shift->status !== Shift::STATUS_OPEN) {
                return response()->json([
                    'success' => false,
                    'message' => 'El turno debe estar abierto'
                ], 409);
            }

            DB::beginTransaction();

            $adjustment = CashAdjustment::create([
                'shift_id' => $shift->id,
                'type' => $request->type,
                'amount' => $request->amount,
                'reason' => $request->reason,
                'receipt_number' => $request->receipt_number,
                'actor_id' => $shift->operator_id,
                'approved_by' => $request->user()?->id,
                'at' => now(),
            ]);

            // Registrar operación
            $shift->operations()->create([
                'kind' => $request->type === 'WITHDRAWAL' 
                    ? \App\Models\ShiftOperation::KIND_WITHDRAWAL 
                    : \App\Models\ShiftOperation::KIND_DEPOSIT,
                'amount' => $request->amount,
                'at' => now(),
                'ref_id' => $adjustment->id,
                'ref_type' => 'cash_adjustment',
                'notes' => $request->reason,
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Ajuste de caja registrado exitosamente',
                'data' => $adjustment->load(['actor', 'approver'])
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al registrar ajuste: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener reporte de turno
     */
    public function report(Request $request, string $id): JsonResponse|\Illuminate\Http\Response
    {
        try {
            $shift = Shift::with(['operator', 'sector', 'creator', 'closer', 'payments', 'cashAdjustments'])->findOrFail($id);
            
            $format = $request->query('format', 'json');

            return $this->reportService->generate($shift, $format);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Listar turnos con filtros
     */
    public function index(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'from' => 'nullable|date',
            'to' => 'nullable|date|after_or_equal:from',
            'operator_id' => 'nullable|exists:operators,id',
            'sector_id' => 'nullable|exists:sectors,id',
            'status' => 'nullable|in:OPEN,CLOSED,CANCELED',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de entrada inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        $query = Shift::with(['operator', 'sector', 'creator', 'closer']);

        if ($request->from) {
            $query->where('opened_at', '>=', $request->from);
        }

        if ($request->to) {
            $query->where('opened_at', '<=', $request->to . ' 23:59:59');
        }

        if ($request->operator_id) {
            $query->where('operator_id', $request->operator_id);
        }

        if ($request->sector_id) {
            $query->where('sector_id', $request->sector_id);
        }

        if ($request->status) {
            $query->where('status', $request->status);
        }

        // Ordenamiento
        $sortBy = $request->get('sort_by', 'opened_at');
        $sortOrder = $request->get('sort_order', 'desc');
        
        // Validar campos permitidos para ordenamiento
        $allowedSortFields = ['id', 'operator_id', 'sector_id', 'opened_at', 'closed_at', 'status', 'opening_float'];
        if (!in_array($sortBy, $allowedSortFields)) {
            $sortBy = 'opened_at';
        }
        
        // Validar dirección de ordenamiento
        $sortOrder = strtolower($sortOrder) === 'asc' ? 'asc' : 'desc';
        
        $query->orderBy($sortBy, $sortOrder);

        $perPage = $request->per_page ?? 15;
        $shifts = $query->paginate($perPage);

        // Agregar totales a cada turno
        $shifts->getCollection()->transform(function ($shift) {
            if ($shift->status === Shift::STATUS_CLOSED) {
                $shift->totals = $this->shiftService->calculateTotals($shift);
            }
            return $shift;
        });

        return response()->json([
            'success' => true,
            'data' => $shifts
        ]);
    }

    /**
     * Obtener un turno por ID
     */
    public function show(string $id): JsonResponse
    {
        try {
            $shift = Shift::with(['operator', 'sector', 'creator', 'closer', 'payments', 'cashAdjustments'])->findOrFail($id);

            $totals = $this->shiftService->calculateTotals($shift);

            return response()->json([
                'success' => true,
                'data' => [
                    'shift' => $shift,
                    'totals' => $totals,
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Turno no encontrado'
            ], 404);
        }
    }
}

