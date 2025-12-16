<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Tenant;
use App\Services\WebPayService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redirect;

class InvoiceController extends Controller
{
    public function __construct(
        private WebPayService $webPayService
    ) {}

    /**
     * Listar facturas con filtros
     * - Si es central admin: muestra todas las facturas
     * - Si es tenant: muestra solo las facturas del tenant actual
     * 
     * IMPORTANTE: Este método debe ejecutarse fuera del contexto de tenancy
     * para acceder a la base de datos central
     */
    public function index(Request $request): JsonResponse
    {
        // Desconectar de cualquier tenancy activo para usar la BD central
        tenancy()->end();
        
        $user = $request->user();
        $isCentralAdmin = $user && $user->is_central_admin;
        
        // Si viene de tenant, obtener el tenant_id del header
        $tenantId = null;
        if (!$isCentralAdmin && $request->header('X-Tenant')) {
            $tenantId = $request->header('X-Tenant');
        }
        
        // Construir query base en BD central
        $query = Invoice::with(['tenant', 'items']);

        // Si es tenant normal, filtrar solo sus facturas y solo estados UNPAID y PAID
        if ($tenantId) {
            $query->where('tenant_id', $tenantId)
                  ->whereIn('status', [Invoice::STATUS_UNPAID, Invoice::STATUS_PAID]);
        } else {
            // Si es administrador central, excluir facturas pendientes de revisión (se muestran en otra tabla)
            $query->where('status', '!=', Invoice::STATUS_PENDING_REVIEW);
        }

        // Filtros
        if ($request->filled('folio')) {
            $query->where('folio', 'like', '%' . $request->folio . '%');
        }

        if ($request->filled('client_name')) {
            $query->where('client_name', 'like', '%' . $request->client_name . '%');
        }

        if ($request->filled('client_rut')) {
            $query->where('client_rut', 'like', '%' . $request->client_rut . '%');
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('emission_date_from')) {
            $query->whereDate('emission_date', '>=', $request->emission_date_from);
        }

        if ($request->filled('emission_date_to')) {
            $query->whereDate('emission_date', '<=', $request->emission_date_to);
        }

        // Ordenamiento
        $sortBy = $request->get('sort_by', 'folio');
        $sortOrder = $request->get('sort_order', 'desc');
        
        // Validar campos permitidos para ordenamiento
        $allowedSortFields = ['id', 'folio', 'client_name', 'client_rut', 'emission_date', 'net_amount', 'iva_amount', 'total_amount', 'status', 'created_at'];
        if (!in_array($sortBy, $allowedSortFields)) {
            $sortBy = 'folio';
        }
        
        // Validar dirección de ordenamiento
        $sortOrder = strtolower($sortOrder) === 'asc' ? 'asc' : 'desc';
        
        $query->orderBy($sortBy, $sortOrder);

        // Paginación
        $perPage = $request->get('per_page', 15);
        if ($perPage > 1000) {
            $invoices = $query->get();
            // Agregar información del tenant si es central admin
            if ($isCentralAdmin) {
                $invoices->each(function ($invoice) {
                    if ($invoice->tenant) {
                        $invoice->setAttribute('tenant_name', $invoice->tenant->name);
                    } else {
                        $invoice->setAttribute('tenant_name', 'N/A');
                    }
                });
            }
            return response()->json([
                'success' => true,
                'data' => $invoices
            ]);
        }

        $invoices = $query->paginate($perPage);
        
        // Agregar información del tenant si es central admin
        if ($isCentralAdmin) {
            $invoices->getCollection()->transform(function ($invoice) {
                if ($invoice->tenant) {
                    $invoice->setAttribute('tenant_name', $invoice->tenant->name);
                } else {
                    $invoice->setAttribute('tenant_name', 'N/A');
                }
                return $invoice;
            });
        }

        return response()->json([
            'success' => true,
            'data' => $invoices
        ]);
    }

    /**
     * Obtener factura por ID
     */
    public function show(Request $request, int $id): JsonResponse
    {
        try {
            // Desconectar de cualquier tenancy activo para usar la BD central
            tenancy()->end();
            
            $user = $request->user();
            $isCentralAdmin = $user && $user->is_central_admin;
            
            // Si viene de tenant, obtener el tenant_id del header
            $tenantId = null;
            if (!$isCentralAdmin && $request->header('X-Tenant')) {
                $tenantId = $request->header('X-Tenant');
            }
            
            $query = Invoice::with(['tenant', 'items']);
            
            // Si es tenant normal, asegurar que la factura pertenece a su tenant
            if ($tenantId) {
                $query->where('tenant_id', $tenantId);
            }
            
            $invoice = $query->findOrFail($id);
            
            // Si es tenant normal, verificar que la factura tenga un estado permitido (UNPAID o PAID)
            if ($tenantId && !in_array($invoice->status, [Invoice::STATUS_UNPAID, Invoice::STATUS_PAID])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Factura no encontrada'
                ], 404);
            }
            
            // Agregar información del tenant si es central admin
            if ($isCentralAdmin) {
                if ($invoice->tenant) {
                    $invoice->setAttribute('tenant_name', $invoice->tenant->name);
                } else {
                    $invoice->setAttribute('tenant_name', 'N/A');
                }
            }

            return response()->json([
                'success' => true,
                'data' => $invoice
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Factura no encontrada'
            ], 404);
        }
    }

    /**
     * Crear factura
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'tenant_id' => 'required|string|exists:tenants,id',
            'client_name' => 'required|string|max:255',
            'client_rut' => 'required|string|max:20',
            'emission_date' => 'required|date',
            'net_amount' => 'required|numeric|min:0',
            'iva_amount' => 'required|numeric|min:0',
            'total_amount' => 'required|numeric|min:0',
            // El status no se acepta en el request, siempre será PENDING_REVIEW para nuevas facturas
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string|max:255',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.subtotal' => 'required|numeric|min:0',
            'items.*.notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            // Desconectar de cualquier tenancy activo para usar la BD central
            tenancy()->end();
            
            // Obtener tenant_id
            $tenantId = $request->tenant_id;

            DB::beginTransaction();

            // Crear la factura
            $invoiceData = $request->only([
                'client_name', 'client_rut', 'emission_date',
                'net_amount', 'iva_amount', 'total_amount', 'notes'
            ]);
            $invoiceData['tenant_id'] = $tenantId;
            
            // El folio se asigna cuando se emite en el SII
            // Si no viene en el request, se deja como null
            if (!$request->has('folio') || empty($request->folio)) {
                $invoiceData['folio'] = null;
            }
            
            // Todas las facturas nuevas se crean en estado PENDING_REVIEW
            $invoiceData['status'] = Invoice::STATUS_PENDING_REVIEW;
            
            $invoice = Invoice::create($invoiceData);

            // Crear los items de la factura
            if ($request->has('items') && is_array($request->items)) {
                foreach ($request->items as $itemData) {
                    $itemData['invoice_id'] = $invoice->id;
                    InvoiceItem::create($itemData);
                }
            }

            DB::commit();

            // Cargar la factura con relaciones
            $invoice->load(['tenant', 'items']);

            return response()->json([
                'success' => true,
                'data' => $invoice,
                'message' => 'Factura creada exitosamente'
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al crear factura: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Actualizar factura
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'folio' => 'sometimes|nullable|string|unique:invoices,folio,' . $id,
            'client_name' => 'sometimes|string|max:255',
            'client_rut' => 'sometimes|string|max:20',
            'emission_date' => 'sometimes|date',
            'net_amount' => 'sometimes|numeric|min:0',
            'iva_amount' => 'sometimes|numeric|min:0',
            'total_amount' => 'sometimes|numeric|min:0',
            'status' => 'sometimes|in:PENDING_REVIEW,UNPAID,PAID,OVERDUE,CANCELLED',
            'notes' => 'nullable|string',
            'items' => 'sometimes|array|min:1',
            'items.*.description' => 'required_with:items|string|max:255',
            'items.*.quantity' => 'required_with:items|integer|min:1',
            'items.*.unit_price' => 'required_with:items|numeric|min:0',
            'items.*.subtotal' => 'required_with:items|numeric|min:0',
            'items.*.notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            // Desconectar de cualquier tenancy activo para usar la BD central
            tenancy()->end();
            
            $user = $request->user();
            $isCentralAdmin = $user && $user->is_central_admin;
            
            // Si viene de tenant, obtener el tenant_id del header
            $tenantId = null;
            if (!$isCentralAdmin && $request->header('X-Tenant')) {
                $tenantId = $request->header('X-Tenant');
            }
            
            $query = Invoice::query();
            
            // Si es tenant normal, asegurar que la factura pertenece a su tenant
            if ($tenantId) {
                $query->where('tenant_id', $tenantId);
            }
            
            DB::beginTransaction();
            
            $invoice = $query->findOrFail($id);
            
            // Actualizar datos de la factura
            $invoiceData = $request->only([
                'folio', 'client_name', 'client_rut', 'emission_date',
                'net_amount', 'iva_amount', 'total_amount', 'status', 'notes'
            ]);
            $invoice->update($invoiceData);

            // Actualizar items si se envían
            if ($request->has('items') && is_array($request->items)) {
                // Eliminar items existentes
                $invoice->items()->delete();
                
                // Crear nuevos items
                foreach ($request->items as $itemData) {
                    $itemData['invoice_id'] = $invoice->id;
                    InvoiceItem::create($itemData);
                }
            }

            DB::commit();

            // Cargar la factura con relaciones
            $invoice->load(['tenant', 'items']);

            return response()->json([
                'success' => true,
                'data' => $invoice,
                'message' => 'Factura actualizada exitosamente'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar factura: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Eliminar factura
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        try {
            // Desconectar de cualquier tenancy activo para usar la BD central
            tenancy()->end();
            
            $user = $request->user();
            $isCentralAdmin = $user && $user->is_central_admin;
            
            // Si viene de tenant, obtener el tenant_id del header
            $tenantId = null;
            if (!$isCentralAdmin && $request->header('X-Tenant')) {
                $tenantId = $request->header('X-Tenant');
            }
            
            $query = Invoice::query();
            
            // Si es tenant normal, asegurar que la factura pertenece a su tenant
            if ($tenantId) {
                $query->where('tenant_id', $tenantId);
            }
            
            $invoice = $query->findOrFail($id);
            $invoice->delete();

            return response()->json([
                'success' => true,
                'message' => 'Factura eliminada exitosamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar factura: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Listar facturas pendientes de revisión
     * Solo accesible para administradores centrales
     */
    public function pending(Request $request): JsonResponse
    {
        // Desconectar de cualquier tenancy activo para usar la BD central
        tenancy()->end();
        
        $user = $request->user();
        // Aceptar tanto true como 1 (valor numérico desde la base de datos)
        if (!$user || ($user->is_central_admin !== true && $user->is_central_admin !== 1)) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }
        
        // Construir query base en BD central solo con facturas pendientes
        $query = Invoice::with(['tenant', 'items'])
            ->where('status', Invoice::STATUS_PENDING_REVIEW);

        // Filtros
        if ($request->filled('folio')) {
            $query->where('folio', 'like', '%' . $request->folio . '%');
        }

        if ($request->filled('client_name')) {
            $query->where('client_name', 'like', '%' . $request->client_name . '%');
        }

        if ($request->filled('client_rut')) {
            $query->where('client_rut', 'like', '%' . $request->client_rut . '%');
        }

        if ($request->filled('emission_date_from')) {
            $query->whereDate('emission_date', '>=', $request->emission_date_from);
        }

        if ($request->filled('emission_date_to')) {
            $query->whereDate('emission_date', '<=', $request->emission_date_to);
        }

        // Ordenamiento
        $sortBy = $request->get('sort_by', 'folio');
        $sortOrder = $request->get('sort_order', 'desc');
        
        // Validar campos permitidos para ordenamiento
        $allowedSortFields = ['id', 'folio', 'client_name', 'client_rut', 'emission_date', 'net_amount', 'iva_amount', 'total_amount', 'created_at'];
        if (!in_array($sortBy, $allowedSortFields)) {
            $sortBy = 'folio';
        }
        
        // Validar dirección de ordenamiento
        $sortOrder = strtolower($sortOrder) === 'asc' ? 'asc' : 'desc';
        
        $query->orderBy($sortBy, $sortOrder);

        // Paginación
        $perPage = $request->get('per_page', 15);
        if ($perPage > 1000) {
            $invoices = $query->get();
            $invoices->each(function ($invoice) {
                if ($invoice->tenant) {
                    $invoice->setAttribute('tenant_name', $invoice->tenant->name);
                } else {
                    $invoice->setAttribute('tenant_name', 'N/A');
                }
            });
            return response()->json([
                'success' => true,
                'data' => $invoices
            ]);
        }

        $invoices = $query->paginate($perPage);
        
        $invoices->getCollection()->transform(function ($invoice) {
            if ($invoice->tenant) {
                $invoice->setAttribute('tenant_name', $invoice->tenant->name);
            } else {
                $invoice->setAttribute('tenant_name', 'N/A');
            }
            return $invoice;
        });

        return response()->json([
            'success' => true,
            'data' => $invoices
        ]);
    }

    /**
     * Aceptar factura pendiente de revisión
     * Esto emitirá la factura en el SII y actualizará el estado
     */
    public function accept(Request $request, int $id): JsonResponse
    {
        try {
            // Desconectar de cualquier tenancy activo para usar la BD central
            tenancy()->end();
            
            $user = $request->user();
            if (!$user || !$user->is_central_admin) {
                return response()->json([
                    'success' => false,
                    'message' => 'No autorizado'
                ], 403);
            }
            
            $invoice = Invoice::with(['tenant', 'items'])->findOrFail($id);
            
            if ($invoice->status !== Invoice::STATUS_PENDING_REVIEW) {
                return response()->json([
                    'success' => false,
                    'message' => 'La factura no está pendiente de revisión'
                ], 400);
            }

            DB::beginTransaction();

            // Emitir factura en SII
            // TODO: Implementar llamada real al endpoint del SII
            // Por ahora simulamos la respuesta
            $siiResponse = $this->emitToSII($invoice);
            
            if (!$siiResponse['success']) {
                DB::rollBack();
                return response()->json([
                    'success' => false,
                    'message' => 'Error al emitir factura en SII: ' . ($siiResponse['message'] ?? 'Error desconocido')
                ], 500);
            }

            // Actualizar factura con datos del SII
            $invoice->update([
                'status' => Invoice::STATUS_UNPAID,
                'folio' => $siiResponse['folio'] ?? $invoice->folio,
                // Agregar otros campos que vengan del SII si es necesario
            ]);

            DB::commit();

            // Recargar factura con relaciones
            $invoice->refresh();
            $invoice->load(['tenant', 'items']);
            
            if ($invoice->tenant) {
                $invoice->setAttribute('tenant_name', $invoice->tenant->name);
            }

            return response()->json([
                'success' => true,
                'data' => $invoice,
                'message' => 'Factura aceptada y emitida exitosamente'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al aceptar factura: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Rechazar factura pendiente de revisión
     */
    public function reject(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'reason' => 'required|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            // Desconectar de cualquier tenancy activo para usar la BD central
            tenancy()->end();
            
            $user = $request->user();
            if (!$user || !$user->is_central_admin) {
                return response()->json([
                    'success' => false,
                    'message' => 'No autorizado'
                ], 403);
            }
            
            $invoice = Invoice::with(['tenant', 'items'])->findOrFail($id);
            
            if ($invoice->status !== Invoice::STATUS_PENDING_REVIEW) {
                return response()->json([
                    'success' => false,
                    'message' => 'La factura no está pendiente de revisión'
                ], 400);
            }

            // Actualizar notas con el motivo del rechazo y cambiar estado a CANCELADA
            $rejectionNote = "\n\n[RECHAZADA] " . now()->format('Y-m-d H:i:s') . " - Motivo: " . $request->reason;
            $invoice->update([
                'status' => Invoice::STATUS_CANCELLED,
                'notes' => ($invoice->notes ?? '') . $rejectionNote,
            ]);

            // Recargar factura con relaciones
            $invoice->refresh();
            $invoice->load(['tenant', 'items']);
            
            if ($invoice->tenant) {
                $invoice->setAttribute('tenant_name', $invoice->tenant->name);
            }

            return response()->json([
                'success' => true,
                'data' => $invoice,
                'message' => 'Factura rechazada exitosamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al rechazar factura: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Emitir factura en el SII usando FacturAPI
     * Este método se puede llamar directamente o se llama desde accept()
     */
    private function emitToSII(Invoice $invoice): array
    {
        try {
            // Obtener configuración activa de FacturAPI
            $config = \App\Http\Controllers\FacturAPIConfigController::getActiveConfig();
            
            if (empty($config['token'])) {
                return [
                    'success' => false,
                    'message' => 'Token de FacturAPI no configurado. Por favor configure FacturAPI en el panel de administración central.'
                ];
            }

            // Cargar el tenant con sus datos de facturación
            $invoice->load('tenant');
            $tenant = $invoice->tenant;

            if (!$tenant) {
                return [
                    'success' => false,
                    'message' => 'No se encontró el tenant asociado a la factura'
                ];
            }

            // Validar que el tenant tenga los datos necesarios
            if (empty($tenant->rut) || empty($tenant->razon_social)) {
                return [
                    'success' => false,
                    'message' => 'El tenant no tiene configurados los datos de facturación necesarios (RUT y Razón Social)'
                ];
            }

            // Preparar datos de la factura para FacturAPI según el formato requerido
            $facturapiData = [
                'contribuyente' => '77192227-9',
                'acteco' => 561000, // Código de actividad económica por defecto (puede ser configurable)
                'tipo' => 33, // Tipo 33 = Factura electrónica
                'fecha' => null, // null para que FacturAPI genere la fecha automáticamente
                'receptor' => [
                    'rut' => $invoice->client_rut,
                    'razon_social' => $invoice->client_name,
                    'giro' => $tenant->giro ?? '', // Usar el giro del tenant/cliente
                    'direccion' => $tenant->direccion ?? '',
                    'comuna' => $tenant->comuna ?? '',
                ],
                'sucursal' => null,
                'tipo_pago' => 2, // 2 = Crédito (según el ejemplo)
                'descuento' => 0,
                'detalles' => $invoice->items->map(function($item) {
                    return [
                        'nombre' => $item->description,
                        'unidad' => 'Und', // Unidad por defecto (puede ser configurable)
                        'precio' => $item->unit_price,
                        'cantidad' => $item->quantity,
                    ];
                })->toArray(),
                'referencias' => [],
                'correo_dte' => $tenant->correo_dte ?? '',
            ];

            // Realizar llamada a FacturAPI usando el cliente HTTP de Laravel
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $config['token'],
                'Content-Type' => 'application/json',
            ])->post($config['endpoint'] . '/documentos', $facturapiData);

            // Verificar si la respuesta fue exitosa
            if (!$response->successful()) {
                $errorData = $response->json();
                return [
                    'success' => false,
                    'message' => 'Error al emitir factura en FacturAPI: ' . ($errorData['message'] ?? 'Error desconocido')
                ];
            }

            $responseData = $response->json();
            Log::info('Factura emitida en FacturAPI: ' . json_encode($responseData));

            // Verificar que se recibió el folio
            if (!isset($responseData['folio'])) {
                return [
                    'success' => false,
                    'message' => 'Error al emitir factura en FacturAPI: No se recibió folio en la respuesta'
                ];
            }

            return [
                'success' => true,
                'folio' => $responseData['folio'],
                'message' => 'Factura emitida exitosamente en FacturAPI'
            ];
            
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Error al comunicarse con FacturAPI: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Registrar pago de factura
     * Solo disponible para administradores centrales
     */
    public function pay(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'paymentMethod' => 'required|in:CASH,TRANSFER,CARD',
            'paymentDate' => 'required|date',
            'reference' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            // Desconectar de cualquier tenancy activo para usar la BD central
            tenancy()->end();
            
            $user = $request->user();
            if (!$user || !$user->is_central_admin) {
                return response()->json([
                    'success' => false,
                    'message' => 'No autorizado'
                ], 403);
            }
            
            $invoice = Invoice::with(['tenant', 'items'])->findOrFail($id);
            
            if ($invoice->status !== Invoice::STATUS_UNPAID) {
                return response()->json([
                    'success' => false,
                    'message' => 'Solo se pueden pagar facturas impagas'
                ], 400);
            }

            DB::beginTransaction();

            // Actualizar factura con el pago
            $invoice->update([
                'status' => Invoice::STATUS_PAID,
                'payment_date' => $request->paymentDate,
                'notes' => ($invoice->notes ?? '') . "\n\n[PAGO REGISTRADO] " . now()->format('Y-m-d H:i:s') . 
                          " - Método: " . $this->getPaymentMethodLabel($request->paymentMethod) .
                          ($request->reference ? " - Referencia: " . $request->reference : '') .
                          ($request->notes ? " - Notas: " . $request->notes : '')
            ]);

            DB::commit();

            // Recargar factura con relaciones
            $invoice->refresh();
            $invoice->load(['tenant', 'items']);
            
            if ($invoice->tenant) {
                $invoice->setAttribute('tenant_name', $invoice->tenant->name);
            }

            return response()->json([
                'success' => true,
                'data' => $invoice,
                'message' => 'Pago registrado exitosamente'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al registrar pago: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener etiqueta del método de pago
     */
    private function getPaymentMethodLabel(string $method): string
    {
        return match($method) {
            'CASH' => 'Efectivo',
            'TRANSFER' => 'Transferencia',
            'CARD' => 'Tarjeta',
            default => $method
        };
    }

    /**
     * Iniciar pago de factura con WebPay Plus
     * Solo disponible para tenants (no central admin)
     */
    public function initiateWebPayPayment(Request $request, int $id): JsonResponse
    {
        try {
            // Desconectar de cualquier tenancy activo para usar la BD central
            tenancy()->end();
            
            $user = $request->user();
            $isCentralAdmin = $user && $user->is_central_admin;
            
            // Solo tenants pueden pagar sus facturas
            if ($isCentralAdmin) {
                return response()->json([
                    'success' => false,
                    'message' => 'Los administradores centrales no pueden pagar facturas con WebPay'
                ], 403);
            }

            // Obtener tenant_id del header
            $tenantId = $request->header('X-Tenant');
            if (!$tenantId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Tenant ID no proporcionado'
                ], 400);
            }
            
            $invoice = Invoice::with(['tenant', 'items'])->where('tenant_id', $tenantId)->findOrFail($id);
            
            // Verificar que la factura esté en estado UNPAID
            if ($invoice->status !== Invoice::STATUS_UNPAID) {
                return response()->json([
                    'success' => false,
                    'message' => 'Solo se pueden pagar facturas impagas'
                ], 400);
            }

            // Generar orden de compra única (buyOrder)
            // Formato: INV-{ID}-{TIMESTAMP} (máximo 26 caracteres según documentación)
            // Limitar timestamp para asegurar que no exceda 26 caracteres
            $timestamp = substr(time(), -8); // Últimos 8 dígitos del timestamp
            $buyOrder = 'INV-' . $invoice->id . '-' . $timestamp;
            
            // Asegurar que no exceda 26 caracteres
            if (strlen($buyOrder) > 26) {
                $buyOrder = substr($buyOrder, 0, 26);
            }
            
            // Generar ID de sesión único
            $sessionId = 'INVOICE-SESSION-' . $invoice->id . '-' . uniqid();
            
            // Monto a pagar (convertir a entero, ya que WebPay trabaja con centavos)
            // En Chile, el monto se envía en pesos chilenos como entero
            $amount = (int) round($invoice->total_amount);
            
            // URL de retorno (éxito o fallo)
            // Usar la ruta pública en /api/invoices (no /api/parking) ya que WebPay no envía headers
            $baseUrl = env('APP_URL', 'http://localhost:8000');
            // La ruta debe ser accesible sin autenticación ni tenant ya que viene de WebPay
            $returnUrl = $baseUrl . '/api/invoices/' . $invoice->id . '/webpay/return';

            // Crear transacción en WebPay
            $transaction = $this->webPayService->createTransaction(
                $buyOrder,
                $sessionId,
                $amount,
                $returnUrl
            );

            // Guardar el token y buyOrder en la base de datos para referencia posterior
            // Podrías crear una tabla webpay_transactions para esto, pero por ahora
            // lo guardamos temporalmente. En producción, deberías persistir esto.
            DB::beginTransaction();
            
            // Actualizar la factura con información del pago pendiente
            // Podrías agregar campos a la tabla invoices: webpay_token, webpay_buy_order
            // Por ahora, solo registramos en logs
            Log::info('WebPay payment initiated for invoice', [
                'invoice_id' => $invoice->id,
                'buy_order' => $buyOrder,
                'token' => $transaction->getToken(),
                'amount' => $amount
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => [
                    'token' => $transaction->getToken(),
                    'url' => $transaction->getUrl(),
                    'buy_order' => $buyOrder
                ],
                'message' => 'Transacción creada exitosamente'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error initiating WebPay payment', [
                'invoice_id' => $id,
                'error' => $e->getMessage()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error al iniciar pago con WebPay: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Manejar retorno de WebPay (éxito o fallo)
     * Esta es la URL a la que WebPay redirige después del pago
     * NOTA: Esta ruta debe ser accesible sin autenticación ya que viene de WebPay
     */
    public function handleWebPayReturn(Request $request, int $id)
    {
        try {
            // Desconectar de cualquier tenancy activo para usar la BD central
            tenancy()->end();
            
            // Primero obtener la factura para saber a qué tenant pertenece
            $invoice = Invoice::findOrFail($id);
            $tenantId = $invoice->tenant_id;
            
            // Inicializar el tenant manualmente si existe
            if ($tenantId) {
                try {
                    $tenant = \App\Models\Tenant::find($tenantId);
                    if ($tenant) {
                        tenancy()->initialize($tenant);
                    }
                } catch (\Exception $e) {
                    Log::warning('Could not initialize tenant for WebPay return', [
                        'tenant_id' => $tenantId,
                        'invoice_id' => $id,
                        'error' => $e->getMessage()
                    ]);
                }
            }
            
            $token = $request->input('token_ws');
            
            if (!$token) {
                // El usuario canceló o hubo un error
                $frontendUrl = env('FRONTEND_URL', 'http://localhost:4200');
                $commerceName = $invoice->tenant ? $invoice->tenant->name : 'STPark';
                $resultParams = http_build_query([
                    'status' => 'cancelled',
                    'invoice_id' => $invoice->id,
                    'commerce_name' => $commerceName,
                    'folio' => $invoice->folio ?? ''
                ]);
                return Redirect::to($frontendUrl . '/payment-result?' . $resultParams);
            }

            // Confirmar la transacción con WebPay
            $commitResponse = $this->webPayService->commitTransaction($token);
            
            // Verificar respuesta de WebPay
            $responseCode = $commitResponse->getResponseCode();
            $status = $commitResponse->getStatus();
            
            // Cargar relaciones de la factura
            $invoice->load(['tenant', 'items']);
            
            DB::beginTransaction();
            
            if ($status === 'AUTHORIZED' && $responseCode === 0) {
                // Pago exitoso
                // El monto viene en pesos chilenos como entero (no centavos)
                $amount = (float) $commitResponse->getAmount();
                
                // Verificar que el monto coincida con el de la factura (con tolerancia de redondeo)
                $invoiceAmount = (int) round($invoice->total_amount);
                if (abs($amount - $invoiceAmount) > 1) {
                    Log::warning('WebPay payment amount mismatch', [
                        'invoice_id' => $invoice->id,
                        'invoice_amount' => $invoiceAmount,
                        'webpay_amount' => $amount
                    ]);
                }
                
                // Obtener todos los datos de la respuesta de WebPay
                $buyOrder = $commitResponse->getBuyOrder();
                $authorizationCode = $commitResponse->getAuthorizationCode() ?? null;
                $paymentTypeCode = $commitResponse->getPaymentTypeCode() ?? null;
                $installmentsNumber = $commitResponse->getInstallmentsNumber() ?? 0;
                $transactionDate = $commitResponse->getTransactionDate() ?? now()->format('Y-m-d H:i:s');
                
                // Obtener número de tarjeta (últimos 4 dígitos)
                $last4Digits = null;
                try {
                    $cardNumber = $commitResponse->getCardNumber();
                    if ($cardNumber) {
                        // El SDK devuelve el número completo, extraer últimos 4 dígitos
                        $last4Digits = strlen($cardNumber) <= 4 ? $cardNumber : substr($cardNumber, -4);
                    }
                } catch (\Exception $e) {
                    Log::warning('Error getting card number', [
                        'error' => $e->getMessage()
                    ]);
                }
                
                // Determinar tipo de pago (Débito o Crédito)
                // VD = Redcompra (Débito), VP = Venta Prepago (Débito), VN = Venta Normal (Crédito), VC = Venta en cuotas (Crédito)
                $paymentType = 'N/A';
                if ($paymentTypeCode) {
                    $debitCodes = ['VD', 'VP'];
                    $paymentType = in_array($paymentTypeCode, $debitCodes) ? 'Débito' : 'Crédito';
                }
                
                // Obtener nombre del comercio (tenant)
                $commerceName = $invoice->tenant ? $invoice->tenant->name : 'STPark';
                
                // Actualizar factura
                $invoice->update([
                    'status' => Invoice::STATUS_PAID,
                    'payment_date' => now(),
                    'notes' => ($invoice->notes ?? '') . "\n\n[PAGO WEBPAY] " . now()->format('Y-m-d H:i:s') . 
                              " - Token: " . $token .
                              " - Orden de compra: " . $buyOrder .
                              " - Código de autorización: " . ($authorizationCode ?? 'N/A') .
                              " - Monto: $" . number_format($amount, 0, ',', '.') .
                              " - Tipo de pago: " . $paymentType .
                              " - Cuotas: " . $installmentsNumber .
                              " - Tarjeta: ****" . ($last4Digits ?? 'N/A')
                ]);

                Log::info('WebPay payment successful', [
                    'invoice_id' => $invoice->id,
                    'token' => $token,
                    'buy_order' => $buyOrder,
                    'authorization_code' => $authorizationCode,
                    'amount' => $amount,
                    'payment_type' => $paymentType,
                    'installments' => $installmentsNumber
                ]);

                DB::commit();

                // Construir descripción de bienes/servicios desde los items de la factura
                $description = 'Pago de factura';
                if ($invoice->folio) {
                    $description .= ' N° ' . $invoice->folio;
                }
                if ($invoice->items && $invoice->items->count() > 0) {
                    $itemDescriptions = $invoice->items->pluck('description')->toArray();
                    if (count($itemDescriptions) > 0) {
                        $description .= ' - ' . implode(', ', $itemDescriptions);
                    }
                }
                
                // Redirigir al frontend con todos los datos necesarios para la página de resultados
                $frontendUrl = env('FRONTEND_URL', 'http://localhost:4200');
                $resultParams = http_build_query([
                    'status' => 'success',
                    'invoice_id' => $invoice->id,
                    'buy_order' => $buyOrder,
                    'commerce_name' => $commerceName,
                    'amount' => $amount,
                    'currency' => 'CLP',
                    'authorization_code' => $authorizationCode ?? '',
                    'payment_date' => $transactionDate,
                    'payment_type' => $paymentType,
                    'installments' => $installmentsNumber,
                    'card_last4' => $last4Digits ?? '',
                    'folio' => $invoice->folio ?? '',
                    'description' => $description
                ]);
                return Redirect::to($frontendUrl . '/payment-result?' . $resultParams);
                
            } else {
                // Pago fallido
                $buyOrder = $commitResponse->getBuyOrder() ?? 'N/A';
                
                Log::warning('WebPay payment failed', [
                    'invoice_id' => $invoice->id,
                    'token' => $token,
                    'status' => $status,
                    'response_code' => $responseCode,
                    'buy_order' => $buyOrder
                ]);

                DB::commit();

                // Obtener nombre del comercio
                $commerceName = $invoice->tenant ? $invoice->tenant->name : 'STPark';
                
                // Redirigir al frontend con datos del fallo
                $frontendUrl = env('FRONTEND_URL', 'http://localhost:4200');
                $resultParams = http_build_query([
                    'status' => 'failed',
                    'invoice_id' => $invoice->id,
                    'buy_order' => $buyOrder,
                    'commerce_name' => $commerceName,
                    'response_code' => $responseCode,
                    'folio' => $invoice->folio ?? ''
                ]);
                return Redirect::to($frontendUrl . '/payment-result?' . $resultParams);
            }

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error handling WebPay return', [
                'invoice_id' => $id,
                'token' => $request->input('token_ws'),
                'error' => $e->getMessage()
            ]);
            
            // Intentar obtener la factura para mostrar información básica
            try {
                $invoice = Invoice::find($id);
                $commerceName = $invoice && $invoice->tenant ? $invoice->tenant->name : 'STPark';
                $folio = $invoice ? ($invoice->folio ?? '') : '';
            } catch (\Exception $ex) {
                $commerceName = 'STPark';
                $folio = '';
            }
            
            $frontendUrl = env('FRONTEND_URL', 'http://localhost:4200');
            $resultParams = http_build_query([
                'status' => 'error',
                'invoice_id' => $id,
                'commerce_name' => $commerceName,
                'folio' => $folio,
                'error_message' => 'Ocurrió un error al procesar la transacción'
            ]);
            return Redirect::to($frontendUrl . '/payment-result?' . $resultParams);
        }
    }
}
