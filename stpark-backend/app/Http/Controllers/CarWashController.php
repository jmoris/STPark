<?php

namespace App\Http\Controllers;

use App\Models\CarWash;
use App\Models\CarWashType;
use App\Models\ParkingSession;
use App\Models\Shift;
use App\Services\CurrentShiftService;
use App\Services\ParkingSessionService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class CarWashController extends Controller
{
    protected $currentShiftService;
    protected $parkingSessionService;

    public function __construct(
        CurrentShiftService $currentShiftService,
        ParkingSessionService $parkingSessionService
    )
    {
        $this->currentShiftService = $currentShiftService;
        $this->parkingSessionService = $parkingSessionService;
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->get('per_page', 15);
        $page = (int) $request->get('page', 1);

        $sortBy = $request->get('sort_by', 'performed_at');
        $sortOrder = strtolower((string) $request->get('sort_order', 'desc')) === 'asc' ? 'asc' : 'desc';

        $allowedSortFields = ['id', 'plate', 'status', 'amount', 'performed_at', 'created_at'];
        if (!in_array($sortBy, $allowedSortFields, true)) {
            $sortBy = 'performed_at';
        }

        $query = CarWash::with(['carWashType'])->orderBy($sortBy, $sortOrder);

        if ($request->filled('plate')) {
            $plate = strtolower((string) $request->get('plate'));
            $query->whereRaw('LOWER(plate) LIKE ?', ['%' . $plate . '%']);
        }

        if ($request->filled('status') && $request->get('status') !== '') {
            $query->where('status', $request->get('status'));
        }

        if ($request->filled('date_from')) {
            $dateFrom = Carbon::parse($request->get('date_from'))->startOfDay();
            $query->where('performed_at', '>=', $dateFrom);
        }

        if ($request->filled('date_to')) {
            $dateTo = Carbon::parse($request->get('date_to'))->endOfDay();
            $query->where('performed_at', '<=', $dateTo);
        }

        $washes = $query->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'success' => true,
            'data' => $washes->items(),
            'pagination' => [
                'current_page' => $washes->currentPage(),
                'last_page' => $washes->lastPage(),
                'per_page' => $washes->perPage(),
                'total' => $washes->total(),
                'from' => $washes->firstItem(),
                'to' => $washes->lastItem(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'plate' => 'required|string|max:10',
            'car_wash_type_id' => 'required|exists:car_wash_types,id',
            'status' => 'nullable|in:PENDING,PAID',
            'session_id' => 'nullable|exists:parking_sessions,id',
            'operator_id' => 'nullable|exists:operators,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Verificar si el operador tiene un turno abierto
        $operatorId = $request->get('operator_id');
        if ($operatorId) {
            $shift = $this->currentShiftService->get($operatorId, null);
            
            if (!$shift) {
                return response()->json([
                    'success' => false,
                    'error_code' => 'NO_SHIFT_OPEN',
                    'message' => 'El operador no tiene un turno abierto. Por favor, abre un turno antes de registrar lavados de autos.'
                ], 422);
            }
        }

        $type = CarWashType::findOrFail((int) $request->get('car_wash_type_id'));
        $status = $request->get('status', 'PENDING');

        $now = Carbon::now('America/Santiago');

        $plate = strtoupper(trim((string) $request->get('plate')));
        
        // Si se crea como PAID, obtener turno y asignar shift_id y cashier_operator_id
        $shiftId = null;
        $cashierOperatorId = null;
        
        if ($status === 'PAID' && $operatorId) {
            // Determinar el operador: priorizar cashier_operator_id del request si viene, sino usar operator_id
            $operatorIdForShift = $request->filled('cashier_operator_id') 
                ? $request->get('cashier_operator_id') 
                : $operatorId;
            
            // Intentar obtener el turno activo del operador
            $shift = $this->currentShiftService->get($operatorIdForShift, null);
            if ($shift) {
                // Verificar que el turno pertenece al operador correcto
                if ($shift->operator_id != $operatorIdForShift) {
                    Log::warning('CarWashController: El turno no pertenece al operador esperado', [
                        'operator_id_esperado' => $operatorIdForShift,
                        'operator_id_del_turno' => $shift->operator_id,
                        'shift_id' => $shift->id
                    ]);
                } else {
                    $shiftId = $shift->id;
                    $cashierOperatorId = $operatorIdForShift;
                    Log::info('CarWashController: Lavado creado como PAID - turno asignado correctamente', [
                        'car_wash_id' => null, // Aún no existe
                        'operator_id' => $operatorIdForShift,
                        'shift_id' => $shiftId,
                        'cashier_operator_id' => $cashierOperatorId,
                        'shift_operator_id' => $shift->operator_id
                    ]);
                }
            } else {
                Log::warning('CarWashController: Lavado creado como PAID pero no se encontró turno activo', [
                    'operator_id' => $operatorIdForShift
                ]);
            }
            
            // Si se proporcionan explícitamente en el request, usar esos valores (sobrescribir)
            // Pero validar que el shift_id pertenece al operador correcto
            if ($request->filled('shift_id')) {
                $requestedShiftId = $request->get('shift_id');
                $requestedShift = Shift::find($requestedShiftId);
                if ($requestedShift && $requestedShift->operator_id == $operatorIdForShift) {
                    $shiftId = $requestedShiftId;
                } else {
                    Log::warning('CarWashController: El shift_id proporcionado no pertenece al operador', [
                        'shift_id_proporcionado' => $requestedShiftId,
                        'operator_id_esperado' => $operatorIdForShift,
                        'operator_id_del_turno' => $requestedShift?->operator_id
                    ]);
                }
            }
            if ($request->filled('cashier_operator_id')) {
                $cashierOperatorId = $request->get('cashier_operator_id');
                // Si cambió el cashier_operator_id, verificar que el turno sea correcto
                if ($cashierOperatorId != $operatorIdForShift && $shiftId) {
                    $shift = Shift::find($shiftId);
                    if ($shift && $shift->operator_id != $cashierOperatorId) {
                        // Buscar el turno correcto del nuevo operador
                        $correctShift = $this->currentShiftService->get($cashierOperatorId, null);
                        if ($correctShift) {
                            $shiftId = $correctShift->id;
                            Log::info('CarWashController: Actualizado shift_id al turno correcto del operador', [
                                'operator_id' => $cashierOperatorId,
                                'shift_id' => $shiftId
                            ]);
                        }
                    }
                }
            }
        }
        
        $wash = CarWash::create([
            'plate' => $plate,
            'car_wash_type_id' => $type->id,
            'session_id' => $request->get('session_id'),
            'operator_id' => $request->get('operator_id'),
            'cashier_operator_id' => $cashierOperatorId,
            'shift_id' => $shiftId,
            'status' => $status,
            'amount' => $type->price,
            'duration_minutes' => $type->duration_minutes,
            'performed_at' => $now,
            'paid_at' => $status === 'PAID' ? $now : null,
            'approval_code' => $request->get('approval_code'),
        ]);

        // Buscar y cancelar sesiones activas con la misma patente
        // Esto es porque si un vehículo entra, se registra la sesión y luego quiere un lavado,
        // no se debe cobrar el estacionamiento
        try {
            $activeSessions = ParkingSession::where('plate', $plate)
                ->where('status', 'ACTIVE')
                ->whereNull('ended_at')
                ->get();

            $cancelledSessions = [];
            foreach ($activeSessions as $session) {
                try {
                    $this->parkingSessionService->cancelSession($session->id);
                    $cancelledSessions[] = $session->id;
                    Log::info('CarWashController: Sesión cancelada automáticamente al crear lavado', [
                        'session_id' => $session->id,
                        'plate' => $plate,
                        'car_wash_id' => $wash->id
                    ]);
                } catch (\Exception $e) {
                    Log::warning('CarWashController: Error al cancelar sesión', [
                        'session_id' => $session->id,
                        'plate' => $plate,
                        'error' => $e->getMessage()
                    ]);
                }
            }

            if (count($cancelledSessions) > 0) {
                Log::info('CarWashController: Sesiones canceladas automáticamente', [
                    'plate' => $plate,
                    'car_wash_id' => $wash->id,
                    'cancelled_sessions' => $cancelledSessions,
                    'total_cancelled' => count($cancelledSessions)
                ]);
            }
        } catch (\Exception $e) {
            // No fallar la creación del lavado si hay error al cancelar sesiones
            Log::error('CarWashController: Error al buscar/cancelar sesiones activas', [
                'plate' => $plate,
                'car_wash_id' => $wash->id,
                'error' => $e->getMessage()
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => $wash->load(['carWashType']),
            'message' => 'Lavado creado exitosamente',
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $wash = CarWash::findOrFail($id);

        Log::info('CarWashController::update - Request data:', $request->all());
        Log::info('CarWashController::update - CarWash ID:', ['id' => $id]);

        $validator = Validator::make($request->all(), [
            'status' => 'required|in:PENDING,PAID',
            'amount' => 'nullable|numeric|min:0',
            'cashier_operator_id' => 'nullable|exists:operators,id',
            'shift_id' => 'nullable|uuid|exists:shifts,id',
            'approval_code' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            Log::error('CarWashController::update - Validation failed:', $validator->errors()->toArray());
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $newStatus = $request->get('status');
        $now = Carbon::now('America/Santiago');

        $wash->status = $newStatus;
        $wash->paid_at = $newStatus === 'PAID' ? $now : null;
        
        // Actualizar campos adicionales si se proporcionan y no son null
        if ($request->filled('amount')) {
            $wash->amount = $request->get('amount');
            Log::info('CarWashController::update - Setting amount:', ['amount' => $request->get('amount')]);
        }
        
        // Si se actualiza a PAID, asegurar que siempre tenga shift_id y cashier_operator_id
        if ($newStatus === 'PAID') {
            // Determinar el operador que está realizando el pago:
            // 1. Prioridad: cashier_operator_id del request (operador que está pagando)
            // 2. Fallback: cashier_operator_id existente en el lavado
            // 3. Último recurso: operator_id original (solo si no hay cashier_operator_id)
            $operatorIdForShift = null;
            if ($request->filled('cashier_operator_id')) {
                // El operador que está realizando el pago viene en el request
                $operatorIdForShift = $request->get('cashier_operator_id');
            } elseif ($wash->cashier_operator_id) {
                // Ya existe un cashier_operator_id en el lavado
                $operatorIdForShift = $wash->cashier_operator_id;
            } elseif ($wash->operator_id) {
                // Usar el operator_id original como último recurso
                $operatorIdForShift = $wash->operator_id;
            }
            
            // Si tenemos un operador identificado, obtener su turno activo
            if ($operatorIdForShift) {
                // Si no se proporcionó shift_id en el request, obtenerlo del turno activo del operador
                if (!$request->filled('shift_id')) {
                    $shift = $this->currentShiftService->get($operatorIdForShift, null);
                    if ($shift) {
                        $wash->shift_id = $shift->id;
                        Log::info('CarWashController::update - Asignando shift_id automáticamente del turno activo del operador', [
                            'operator_id' => $operatorIdForShift,
                            'shift_id' => $shift->id,
                            'shift_operator_id' => $shift->operator_id
                        ]);
                        
                        // Verificar que el turno pertenece al operador correcto
                        if ($shift->operator_id != $operatorIdForShift) {
                            Log::warning('CarWashController::update - El turno no pertenece al operador esperado', [
                                'operator_id_esperado' => $operatorIdForShift,
                                'operator_id_del_turno' => $shift->operator_id,
                                'shift_id' => $shift->id
                            ]);
                        }
                    } else {
                        Log::warning('CarWashController::update - No se encontró turno activo para asignar shift_id', [
                            'operator_id' => $operatorIdForShift
                        ]);
                    }
                }
                
                // Si no se proporcionó cashier_operator_id en el request, asignarlo automáticamente
                if (!$request->filled('cashier_operator_id')) {
                    $wash->cashier_operator_id = $operatorIdForShift;
                    Log::info('CarWashController::update - Asignando cashier_operator_id automáticamente', [
                        'cashier_operator_id' => $operatorIdForShift
                    ]);
                }
            } else {
                Log::warning('CarWashController::update - No se pudo determinar el operador para asignar turno', [
                    'car_wash_id' => $wash->id,
                    'request_cashier_operator_id' => $request->get('cashier_operator_id'),
                    'wash_cashier_operator_id' => $wash->cashier_operator_id,
                    'wash_operator_id' => $wash->operator_id
                ]);
            }
        }
        
        // Si se proporcionan explícitamente en el request, usar esos valores (sobrescribir lo anterior)
        // Pero validar que el shift_id pertenezca al operador correcto
        if ($request->filled('cashier_operator_id')) {
            $requestedCashierOperatorId = $request->get('cashier_operator_id');
            $wash->cashier_operator_id = $requestedCashierOperatorId;
            Log::info('CarWashController::update - Setting cashier_operator_id desde request:', ['cashier_operator_id' => $requestedCashierOperatorId]);
            
            // Si se cambió el cashier_operator_id y hay un shift_id, verificar que el turno sea correcto
            if ($wash->shift_id) {
                $shift = Shift::find($wash->shift_id);
                if ($shift && $shift->operator_id != $requestedCashierOperatorId) {
                    // Buscar el turno correcto del nuevo operador
                    $correctShift = $this->currentShiftService->get($requestedCashierOperatorId, null);
                    if ($correctShift) {
                        $wash->shift_id = $correctShift->id;
                        Log::info('CarWashController::update - Actualizado shift_id al turno correcto del operador', [
                            'operator_id' => $requestedCashierOperatorId,
                            'shift_id' => $correctShift->id
                        ]);
                    } else {
                        Log::warning('CarWashController::update - El shift_id no pertenece al cashier_operator_id y no se encontró turno alternativo', [
                            'shift_id' => $wash->shift_id,
                            'cashier_operator_id' => $requestedCashierOperatorId,
                            'shift_operator_id' => $shift->operator_id
                        ]);
                    }
                }
            }
        }
        if ($request->filled('shift_id')) {
            $requestedShiftId = $request->get('shift_id');
            // Verificar que el turno pertenezca al operador correcto
            $requestedShift = Shift::find($requestedShiftId);
            $currentOperatorId = $wash->cashier_operator_id ?? $wash->operator_id;
            
            if ($requestedShift) {
                if ($requestedShift->operator_id == $currentOperatorId) {
                    $wash->shift_id = $requestedShiftId;
                    Log::info('CarWashController::update - Setting shift_id desde request (validado):', [
                        'shift_id' => $requestedShiftId,
                        'operator_id' => $currentOperatorId
                    ]);
                } else {
                    Log::warning('CarWashController::update - El shift_id proporcionado no pertenece al operador', [
                        'shift_id_proporcionado' => $requestedShiftId,
                        'operator_id_esperado' => $currentOperatorId,
                        'operator_id_del_turno' => $requestedShift->operator_id
                    ]);
                    // Intentar obtener el turno correcto del operador
                    if ($currentOperatorId) {
                        $correctShift = $this->currentShiftService->get($currentOperatorId, null);
                        if ($correctShift) {
                            $wash->shift_id = $correctShift->id;
                            Log::info('CarWashController::update - Usando turno correcto del operador en lugar del proporcionado', [
                                'shift_id_correcto' => $correctShift->id,
                                'operator_id' => $currentOperatorId
                            ]);
                        }
                    }
                }
            } else {
                Log::warning('CarWashController::update - El shift_id proporcionado no existe', [
                    'shift_id' => $requestedShiftId
                ]);
            }
        }
        if ($request->filled('approval_code')) {
            $wash->approval_code = $request->get('approval_code');
            Log::info('CarWashController::update - Setting approval_code:', ['approval_code' => $request->get('approval_code')]);
        }
        
        Log::info('CarWashController::update - CarWash before save:', [
            'cashier_operator_id' => $wash->cashier_operator_id,
            'shift_id' => $wash->shift_id,
            'approval_code' => $wash->approval_code,
        ]);
        
        $wash->save();
        
        $wash->refresh();
        Log::info('CarWashController::update - CarWash after save:', [
            'cashier_operator_id' => $wash->cashier_operator_id,
            'shift_id' => $wash->shift_id,
            'approval_code' => $wash->approval_code,
        ]);

        return response()->json([
            'success' => true,
            'data' => $wash->fresh()->load(['carWashType', 'cashierOperator', 'shift']),
            'message' => 'Lavado actualizado exitosamente',
        ]);
    }
}


