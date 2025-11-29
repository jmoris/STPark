<?php

namespace App\Http\Controllers;

use App\Models\Operator;
use App\Models\OperatorAssignment;
use App\Models\ParkingSession;
use App\Services\ParkingSessionService;
use Carbon\Carbon;
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
     * Listar sesiones de estacionamiento con filtros server-side
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $perPage = $request->get('per_page', 15);
            $page = $request->get('page', 1);
            
            // Construir query con filtros
            $query = ParkingSession::with(['sector', 'street', 'operator', 'payments']);

            // Filtro por placa (case-insensitive)
            if ($request->filled('plate')) {
                $plate = strtolower($request->get('plate'));
                $query->whereRaw('LOWER(plate) LIKE ?', ['%' . $plate . '%']);
            }

            // Filtro por sector
            if ($request->filled('sector_id')) {
                $query->where('sector_id', $request->get('sector_id'));
            }

            // Filtro por operador
            if ($request->filled('operator_id')) {
                $query->where('operator_in_id', $request->get('operator_id'));
            }

            // Filtro por estado
            if ($request->filled('status') && $request->get('status') !== '') {
                $query->where('status', $request->get('status'));
            }

            // Filtro por fecha desde
            if ($request->filled('date_from')) {
                $dateFrom = Carbon::parse($request->get('date_from'))->startOfDay();
                $query->where('started_at', '>=', $dateFrom);
            }

            // Filtro por fecha hasta
            if ($request->filled('date_to')) {
                $dateTo = Carbon::parse($request->get('date_to'))->endOfDay();
                $query->where('started_at', '<=', $dateTo);
            }

            // Ordenamiento
            $sortBy = $request->get('sort_by', 'started_at');
            $sortOrder = $request->get('sort_order', 'desc');
            
            // Validar campos permitidos para ordenamiento
            $allowedSortFields = ['id', 'plate', 'sector_id', 'street_id', 'operator_in_id', 'started_at', 'ended_at', 'seconds_total', 'net_amount', 'status', 'created_at'];
            if (!in_array($sortBy, $allowedSortFields)) {
                $sortBy = 'started_at';
            }
            
            // Validar dirección de ordenamiento
            $sortOrder = strtolower($sortOrder) === 'asc' ? 'asc' : 'desc';
            
            $query->orderBy($sortBy, $sortOrder);

            // Aplicar paginación
            $sessions = $query->paginate($perPage, ['*'], 'page', $page);

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
            'is_full_day' => 'nullable|boolean',
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
                $request->operator_id,
                $request->boolean('is_full_day', false)
            );

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => $session,
                'message' => 'Sesión creada exitosamente'
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            
            // Detectar si no hay turno abierto
            if ($e->getMessage() === 'NO_SHIFT_OPEN') {
                return response()->json([
                    'success' => false,
                    'error_code' => 'NO_SHIFT_OPEN',
                    'message' => 'El operador no tiene un turno abierto. Por favor, abre un turno antes de crear sesiones.'
                ], 422);
            }
            
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
            $session = ParkingSession::with(['sector', 'street', 'operator', 'operatorOut', 'payments'])
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
            'approval_code' => 'nullable|string|max:100',
            'operator_id' => 'required|exists:operators,id', // REQUERIDO: operador que hace el checkout
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            // Siempre usar la fecha actual del servidor en timezone America/Santiago
            // Ignorar ended_at del request para evitar problemas de conversión de timezone
            $endedAt = Carbon::now('America/Santiago');
            
            // IMPORTANTE: Usar SOLO el operador que hace el checkout, nunca el que abrió la sesión
            $result = $this->sessionService->checkout(
                $id,
                $request->payment_method,
                $request->amount,
                $endedAt,
                $request->approval_code,
                $request->operator_id // Operador que hace el checkout (REQUERIDO)
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

            // Siempre usar la fecha actual del servidor en timezone America/Santiago
            // Si se proporciona ended_at, parsearlo pero siempre usar la hora del servidor para consistencia
            $endedAt = Carbon::now('America/Santiago');
            
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
            'is_full_day' => 'nullable|boolean',
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
                $request->operator_id,
                $request->boolean('is_full_day', false)
            );

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => $result,
                'message' => 'Sesión creada exitosamente'
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            
            // Detectar si no hay turno abierto
            if ($e->getMessage() === 'NO_SHIFT_OPEN') {
                return response()->json([
                    'success' => false,
                    'error_code' => 'NO_SHIFT_OPEN',
                    'message' => 'El operador no tiene un turno abierto. Por favor, abre un turno antes de crear sesiones.'
                ], 422);
            }
            
            return response()->json([
                'success' => false,
                'message' => 'Error al crear sesión: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener todas las sesiones activas del sector asignado al operador
     * Incluye todas las sesiones activas del sector, no solo las creadas por este operador
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

            // Obtener el operador
            $operator = Operator::find($operatorId);
            
            if (!$operator) {
                return response()->json([
                    'success' => false,
                    'message' => 'Operador no encontrado'
                ], 404);
            }

            // Obtener los sectores asignados al operador
            // Usamos operator_assignments para obtener los sectores activos
            $now = Carbon::now();
            $sectorIds = OperatorAssignment::where('operator_id', $operatorId)
                ->where(function($query) use ($now) {
                    $query->whereNull('valid_from')
                        ->orWhere('valid_from', '<=', $now);
                })
                ->where(function($query) use ($now) {
                    $query->whereNull('valid_to')
                        ->orWhere('valid_to', '>=', $now);
                })
                ->whereNotNull('sector_id')
                ->pluck('sector_id')
                ->unique()
                ->toArray();

            Log::info('Buscando sesiones activas para operador ID: ' . $operatorId . ' en sectores: ' . implode(', ', $sectorIds));

            // Si el operador no tiene sectores asignados, retornar array vacío
            if (empty($sectorIds)) {
                Log::warning('Operador ID: ' . $operatorId . ' no tiene sectores asignados');
                return response()->json([
                    'success' => true,
                    'data' => [],
                    'message' => 'El operador no tiene sectores asignados'
                ]);
            }

            // Obtener todas las sesiones activas de los sectores asignados al operador
            // No filtramos por operator_in_id, para que vea todas las sesiones del sector
            $sessions = ParkingSession::with(['sector', 'street', 'operator'])
                ->whereIn('sector_id', $sectorIds)
                ->where('status', 'ACTIVE')
                ->whereNull('ended_at')
                ->orderBy('started_at', 'desc')
                ->get();

            Log::info('Sesiones activas encontradas en los sectores del operador: ' . $sessions->count());

            return response()->json([
                'success' => true,
                'data' => $sessions,
                'message' => 'Sesiones activas obtenidas exitosamente',
                'debug' => [
                    'operator_id' => $operatorId,
                    'sector_ids' => $sectorIds,
                    'active_sessions' => $sessions->count(),
                    'note' => 'Incluye todas las sesiones activas de los sectores asignados al operador'
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error en activeByOperator: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener sesiones activas: ' . $e->getMessage()
            ], 500);
        }
    }
}