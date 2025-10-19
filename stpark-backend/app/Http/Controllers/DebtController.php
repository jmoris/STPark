<?php

namespace App\Http\Controllers;

use App\Models\Debt;
use App\Models\Sale;
use App\Models\Payment;
use App\Models\AuditLog;
use App\Services\DebtService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class DebtController extends Controller
{
    public function __construct(
        private DebtService $debtService
    ) {}

    /**
     * Listar deudas con filtros
     */
    public function index(Request $request): JsonResponse
    {
        $query = Debt::with(['parkingSession', 'payments']);

        // Filtros
        if ($request->filled('plate')) {
            $query->where('plate', 'like', '%' . $request->plate . '%');
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('origin')) {
            $query->where('origin', $request->origin);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        $debts = $query->orderBy('created_at', 'desc')
                      ->paginate($request->get('per_page', 15));

        return response()->json([
            'success' => true,
            'data' => $debts
        ]);
    }

    /**
     * Obtener deuda por ID
     */
    public function show(int $id): JsonResponse
    {
        try {
            $debt = Debt::with(['parkingSession', 'payments'])
                       ->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $debt
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Deuda no encontrada'
            ], 404);
        }
    }

    /**
     * Buscar deudas por placa
     */
    public function byPlate(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'plate' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $debts = Debt::byPlate($request->plate)
                    ->with(['parkingSession', 'payments'])
                    ->orderBy('created_at', 'desc')
                    ->get();

        return response()->json([
            'success' => true,
            'data' => $debts
        ]);
    }

    /**
     * Liquidar deuda
     */
    public function settle(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:0.01',
            'method' => 'required|in:CASH,CARD,TRANSFER',
            'cashier_operator_id' => 'required|exists:operators,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $debt = $this->debtService->settleDebt(
                $id,
                $request->amount,
                $request->method,
                $request->cashier_operator_id
            );

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => $debt->load(['parkingSession', 'payments']),
                'message' => 'Deuda liquidada exitosamente'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al liquidar deuda: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Crear deuda manual
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'plate' => 'required|string|max:10',
            'principal_amount' => 'required|numeric|min:0.01',
            'origin' => 'required|in:MANUAL,FINE',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $debt = $this->debtService->createManualDebt(
                $request->plate,
                $request->principal_amount,
                $request->origin,
                $request->notes
            );

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => $debt,
                'message' => 'Deuda creada exitosamente'
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al crear deuda: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener resumen de deudas pendientes
     */
    public function pendingSummary(): JsonResponse
    {
        try {
            $summary = $this->debtService->getPendingSummary();

            return response()->json([
                'success' => true,
                'data' => $summary
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener resumen: ' . $e->getMessage()
            ], 500);
        }
    }
}
