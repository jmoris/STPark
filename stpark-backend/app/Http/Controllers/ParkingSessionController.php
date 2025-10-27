<?php

namespace App\Http\Controllers;

use App\Models\ParkingSession;
use App\Services\ParkingSessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class ParkingSessionController extends Controller
{
    protected $sessionService;

    public function __construct(ParkingSessionService $sessionService)
    {
        $this->sessionService = $sessionService;
    }

    /**
     * Listar sesiones de estacionamiento
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $perPage = $request->get('per_page', 15);
            $page = $request->get('page', 1);
            
            $sessions = ParkingSession::with(['sector', 'street', 'operator', 'payments'])
                ->orderBy('created_at', 'desc')
                ->paginate($perPage, ['*'], 'page', $page);

            // Agregar campos calculados a cada sesión
            $sessionsData = collect($sessions->items())->map(function ($session) {
                $session->duration_minutes = $session->getCurrentDurationInMinutes();
                $session->duration_formatted = $session->getCurrentFormattedDuration();
                $session->total_paid = $session->getTotalPaid();
                $session->total_paid_formatted = $session->getFormattedTotalPaid();
                return $session;
            });

            return response()->json([
                'success' => true,
                'data' => $sessionsData,
                'pagination' => [
                    'current_page' => $sessions->currentPage(),
                    'last_page' => $sessions->lastPage(),
                    'per_page' => $sessions->perPage(),
                    'total' => $sessions->total(),
                    'from' => $sessions->firstItem(),
                    'to' => $sessions->lastItem(),
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al cargar sesiones: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Crear nueva sesión de estacionamiento
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'plate' => 'required|string|max:10',
            'sector_id' => 'required|exists:sectors,id',
            'street_id' => 'required|exists:streets,id',
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
                'data' => $session,
                'message' => 'Sesión creada exitosamente'
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
     * Obtener sesión por ID
     */
    public function show(int $id): JsonResponse
    {
        try {
            $session = ParkingSession::with(['sector', 'street', 'operator', 'payments'])
                ->findOrFail($id);

            // Agregar campos calculados
            $session->duration_minutes = $session->getCurrentDurationInMinutes();
            $session->duration_formatted = $session->getCurrentFormattedDuration();
            $session->total_paid = $session->getTotalPaid();
            $session->total_paid_formatted = $session->getFormattedTotalPaid();

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
     * Buscar sesión activa por placa
     */
    public function activeByPlate(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'plate' => 'required|string|max:10',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $session = $this->sessionService->getActiveSessionByPlate($request->plate);

            return response()->json([
                'success' => true,
                'data' => $session
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al buscar sesión: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener cotización para una sesión
     */
    public function quote(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'ended_at' => 'nullable|date',
            'discount_code' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $quote = $this->sessionService->getQuote($id, $request->all());

            return response()->json([
                'success' => true,
                'data' => $quote
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener cotización: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Realizar checkout de una sesión
     */
    public function checkout(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'payment_method' => 'required|in:CASH,CARD,TRANSFER',
            'amount' => 'required|numeric|min:0',
            'ended_at' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $endedAt = $request->ended_at ?? now()->toISOString();
            
            $result = $this->sessionService->checkout(
                $id,
                $request->payment_method,
                $request->amount,
                $endedAt
            );

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => $result,
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
     * Cancelar sesión
     */
    public function cancel(Request $request, int $id): JsonResponse
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
     * Forzar checkout sin pago (usuario se retira sin pagar)
     */
    public function forceCheckoutWithoutPayment(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'ended_at' => 'nullable|date|after:now',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $endedAt = $request->ended_at ?? now()->toISOString();
            
            $session = $this->sessionService->forceCheckoutWithoutPayment($id, $endedAt);

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => $session,
                'message' => 'Checkout forzado y deuda creada exitosamente'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error en checkout forzado: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Verificar deudas pendientes por placa
     */
    public function checkPendingDebts(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'plate' => 'required|string|max:10',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $debtCheck = $this->sessionService->checkPendingDebtsForPlate($request->plate);

            return response()->json([
                'success' => true,
                'data' => $debtCheck
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al verificar deudas: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Crear sesión con verificación de deudas
     */
    public function createSessionWithDebtCheck(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'plate' => 'required|string|max:10',
            'sector_id' => 'required|exists:sectors,id',
            'street_id' => 'required|exists:streets,id',
            'operator_id' => 'required|exists:operators,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $result = $this->sessionService->createSessionWithDebtCheck(
                $request->plate,
                $request->sector_id,
                $request->street_id,
                $request->operator_id
            );

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => $result,
                'message' => 'Sesión creada exitosamente'
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
     * Obtener todas las sesiones activas por operador (históricas)
     */
    public function activeByOperator(Request $request): JsonResponse
    {
        try {
            $operatorId = $request->get('operator_id');
            
            if (!$operatorId) {
                return response()->json([
                    'success' => false,
                    'message' => 'El ID del operador es requerido'
                ], 400);
            }

            // Logs de debug
            Log::info('Buscando todas las sesiones activas (históricas) para operador ID: ' . $operatorId);

            // Primero obtener todas las sesiones del operador para debug
            $allSessions = ParkingSession::with(['sector', 'street', 'operator'])
                ->where('operator_in_id', $operatorId)
                ->get();
                
            Log::info('Total de sesiones del operador: ' . $allSessions->count());
            foreach ($allSessions as $session) {
                Log::info('Sesión ID: ' . $session->id . ' - Started: ' . $session->started_at . ' - Ended: ' . $session->ended_at);
            }

            $sessions = ParkingSession::with(['sector', 'street', 'operator'])
                ->where('operator_in_id', $operatorId)
                ->whereNull('ended_at')
                ->orderBy('started_at', 'desc')
                ->get();

            Log::info('Sesiones activas encontradas: ' . $sessions->count());

            return response()->json([
                'success' => true,
                'data' => $sessions,
                'message' => 'Sesiones activas obtenidas exitosamente',
                'debug' => [
                    'operator_id' => $operatorId,
                    'total_sessions' => $allSessions->count(),
                    'active_sessions' => $sessions->count(),
                    'note' => 'Incluye todas las sesiones activas históricas del operador'
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error en activeByOperator: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener sesiones activas: ' . $e->getMessage()
            ], 500);
        }
    }
}