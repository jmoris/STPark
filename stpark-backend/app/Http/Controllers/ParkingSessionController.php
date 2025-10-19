<?php

namespace App\Http\Controllers;

use App\Models\ParkingSession;
use App\Models\Sector;
use App\Models\Street;
use App\Models\Operator;
use App\Models\AuditLog;
use App\Services\PricingService;
use App\Services\ParkingSessionService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ParkingSessionController extends Controller
{
    public function __construct(
        private PricingService $pricingService,
        private ParkingSessionService $sessionService
    ) {}

    /**
     * Crear nueva sesión de estacionamiento (check-in)
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'plate' => 'required|string|max:10',
            'sector_id' => 'required|exists:sectors,id',
            'street_id' => 'nullable|exists:streets,id',
            'operator_id' => 'required|exists:operators,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $session = $this->sessionService->createSession(
                $request->plate,
                $request->sector_id,
                $request->street_id,
                $request->operator_id
            );

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => $session->load(['sector', 'street', 'operatorIn']),
                'message' => 'Sesión de estacionamiento creada exitosamente'
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al crear sesión: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener cotización para una sesión
     */
    public function quote(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'ended_at' => 'required|date|after:now',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $session = ParkingSession::findOrFail($id);
            
            if (!$session->isActive()) {
                return response()->json([
                    'success' => false,
                    'message' => 'La sesión no está activa'
                ], 400);
            }

            $quote = $this->pricingService->calculateQuote(
                $session,
                $request->ended_at
            );

            return response()->json([
                'success' => true,
                'data' => $quote
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al calcular cotización: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Confirmar salida de vehículo (check-out)
     */
    public function checkout(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'ended_at' => 'required|date|after:now',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $session = $this->sessionService->checkoutSession(
                $id,
                $request->ended_at
            );

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => $session->load(['sector', 'street', 'operatorIn', 'sale']),
                'message' => 'Checkout realizado exitosamente'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error en checkout: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener sesión por ID
     */
    public function show(int $id): JsonResponse
    {
        try {
            $session = ParkingSession::with([
                'sector', 
                'street', 
                'operatorIn', 
                'sale.payments',
                'debts'
            ])->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $session
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Sesión no encontrada'
            ], 404);
        }
    }

    /**
     * Listar sesiones con filtros
     */
    public function index(Request $request): JsonResponse
    {
        $query = ParkingSession::with(['sector', 'street', 'operatorIn']);

        // Filtros
        if ($request->filled('plate')) {
            $query->where('plate', 'like', '%' . $request->plate . '%');
        }

        if ($request->filled('sector_id')) {
            $query->where('sector_id', $request->sector_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('operator_id')) {
            $query->where('operator_in_id', $request->operator_id);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('started_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('started_at', '<=', $request->date_to);
        }

        $sessions = $query->orderBy('started_at', 'desc')
                         ->paginate($request->get('per_page', 15));

        return response()->json([
            'success' => true,
            'data' => $sessions
        ]);
    }

    /**
     * Cancelar sesión
     */
    public function cancel(int $id): JsonResponse
    {
        try {
            DB::beginTransaction();

            $session = $this->sessionService->cancelSession($id);

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => $session,
                'message' => 'Sesión cancelada exitosamente'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al cancelar sesión: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener sesiones activas por placa y sector
     */
    public function activeByPlate(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'plate' => 'required|string',
            'sector_id' => 'required|exists:sectors,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $session = ParkingSession::active()
            ->byPlate($request->plate)
            ->bySector($request->sector_id)
            ->with(['sector', 'street', 'operatorIn'])
            ->first();

        return response()->json([
            'success' => true,
            'data' => $session
        ]);
    }
}
