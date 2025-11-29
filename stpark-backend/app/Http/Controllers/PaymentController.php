<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Models\Sale;
use App\Models\ParkingSession;
use App\Models\Debt;
use App\Models\AuditLog;
use App\Services\PaymentService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class PaymentController extends Controller
{
    public function __construct(
        private PaymentService $paymentService
    ) {}

    /**
     * Procesar pago desde caja
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'sale_id' => 'nullable|exists:sales,id',
            'session_id' => 'nullable|exists:parking_sessions,id',
            'method' => 'required|in:CASH,CARD,WEBPAY,TRANSFER',
            'amount' => 'required|numeric|min:0.01',
            'cashier_operator_id' => 'required|exists:operators,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $payment = $this->paymentService->processPayment(
                $request->sale_id,
                $request->session_id,
                $request->method,
                $request->amount,
                $request->cashier_operator_id,
                $request->device_id,
                $request->cash_drawer_ref
            );

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => $payment->load(['sale', 'parkingSession']),
                'message' => 'Pago procesado exitosamente'
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al procesar pago: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Webhook para pagos de Webpay
     */
    public function webhook(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'transaction_id' => 'required|string',
            'session_id' => 'required|exists:parking_sessions,id',
            'amount' => 'required|numeric|min:0.01',
            'status' => 'required|in:COMPLETED,FAILED,CANCELLED',
            'provider_ref' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $payment = $this->paymentService->processWebpayWebhook(
                $request->transaction_id,
                $request->session_id,
                $request->amount,
                $request->status,
                $request->provider_ref
            );

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => $payment,
                'message' => 'Webhook procesado exitosamente'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al procesar webhook: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Listar pagos con filtros
     */
    public function index(Request $request): JsonResponse
    {
        $query = Payment::with([
            'sale', 
            'parkingSession.sector', 
            'parkingSession.street', 
            'parkingSession.operator'
        ]);

        // Filtros
        if ($request->filled('sale_id')) {
            $query->where('sale_id', $request->sale_id);
        }

        if ($request->filled('session_id')) {
            $query->where('session_id', $request->session_id);
        }

        if ($request->filled('method')) {
            $query->where('method', $request->method);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        // Ordenamiento
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');
        
        // Validar campos permitidos para ordenamiento
        $allowedSortFields = ['id', 'amount', 'method', 'status', 'created_at'];
        if (!in_array($sortBy, $allowedSortFields)) {
            $sortBy = 'created_at';
        }
        
        // Validar dirección de ordenamiento
        $sortOrder = strtolower($sortOrder) === 'asc' ? 'asc' : 'desc';
        
        $query->orderBy($sortBy, $sortOrder);

        $perPage = $request->get('per_page', 15);
        $payments = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'data' => $payments->items(),
                'current_page' => $payments->currentPage(),
                'last_page' => $payments->lastPage(),
                'per_page' => $payments->perPage(),
                'total' => $payments->total(),
                'from' => $payments->firstItem(),
                'to' => $payments->lastItem(),
            ]
        ]);
    }

    /**
     * Obtener pago por ID
     */
    public function show(int $id): JsonResponse
    {
        try {
            $payment = Payment::with([
                'sale', 
                'parkingSession.sector', 
                'parkingSession.street', 
                'parkingSession.operator'
            ])->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $payment
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Pago no encontrado'
            ], 404);
        }
    }

    /**
     * Obtener resumen de pagos por operador
     */
    public function summaryByOperator(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'operator_id' => 'required|exists:operators,id',
            'date_from' => 'required|date',
            'date_to' => 'required|date|after_or_equal:date_from',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $summary = $this->paymentService->getOperatorSummary(
                $request->operator_id,
                $request->date_from,
                $request->date_to
            );

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
