<?php

namespace App\Http\Controllers;

use App\Models\CarWash;
use App\Models\CarWashType;
use App\Services\CurrentShiftService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class CarWashController extends Controller
{
    protected $currentShiftService;

    public function __construct(CurrentShiftService $currentShiftService)
    {
        $this->currentShiftService = $currentShiftService;
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

        $wash = CarWash::create([
            'plate' => strtoupper(trim((string) $request->get('plate'))),
            'car_wash_type_id' => $type->id,
            'session_id' => $request->get('session_id'),
            'operator_id' => $request->get('operator_id'),
            'status' => $status,
            'amount' => $type->price,
            'duration_minutes' => $type->duration_minutes,
            'performed_at' => $now,
            'paid_at' => $status === 'PAID' ? $now : null,
        ]);

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
        if ($request->filled('cashier_operator_id')) {
            $wash->cashier_operator_id = $request->get('cashier_operator_id');
            Log::info('CarWashController::update - Setting cashier_operator_id:', ['cashier_operator_id' => $request->get('cashier_operator_id')]);
        }
        if ($request->filled('shift_id')) {
            $wash->shift_id = $request->get('shift_id');
            Log::info('CarWashController::update - Setting shift_id:', ['shift_id' => $request->get('shift_id')]);
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


