<?php

namespace App\Http\Controllers;

use App\Models\Tenant;
use App\Models\Plan;
use App\Models\User;
use App\Models\Settings;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class TenantController extends Controller
{
    /**
     * Verificar si el usuario tiene permisos de administración central
     */
    private function checkCentralAdminAccess(): bool
    {
        $user = Auth::user();
        // Aceptar tanto true como 1 (valor numérico desde la base de datos)
        return $user && ($user->is_central_admin === true || $user->is_central_admin === 1);
    }

    /**
     * Listar tenants
     */
    public function index(Request $request): JsonResponse
    {
        // Verificar permisos
        if (!$this->checkCentralAdminAccess()) {
            return response()->json([
                'success' => false,
                'message' => 'No tiene permisos para acceder a esta funcionalidad'
            ], 403);
        }

        $query = Tenant::with(['plan.feature'])
            ->withCount('users');

        // Aplicar filtros
        if ($request->filled('name')) {
            $query->where(function($q) use ($request) {
                // BaseTenant maneja automáticamente el acceso a campos en JSON data
                // Podemos usar where directamente ya que el modelo tiene accessors/mutators
                // Para PostgreSQL, usamos la sintaxis JSON de Eloquent
                $q->whereRaw("data->>'name' ILIKE ?", ['%' . $request->name . '%'])
                  ->orWhere('id', 'like', '%' . $request->name . '%');
            });
        }

        if ($request->filled('plan_id')) {
            $query->where('plan_id', $request->plan_id);
        }

        // Aplicar ordenamiento
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');
        
        $allowedSortFields = ['id', 'name', 'created_at', 'users_count'];
        if (in_array($sortBy, $allowedSortFields)) {
            $query->orderBy($sortBy, $sortOrder);
        } else {
            $query->orderBy('created_at', 'desc');
        }

        // Aplicar paginación
        $perPage = $request->get('per_page', 10);
        $tenants = $query->paginate($perPage);

        // Formatear respuesta y agregar información de sesiones mensuales
        $formattedTenants = $tenants->getCollection()->map(function ($tenant) {
            // Obtener límite de sesiones del plan
            $maxSessions = null;
            if ($tenant->plan && $tenant->plan->relationLoaded('feature') && $tenant->plan->feature) {
                $maxSessions = $tenant->plan->feature->max_sessions;
            }

            // Contar sesiones del mes actual
            $currentMonthSessions = 0;
            try {
                tenancy()->initialize($tenant);
                
                // Obtener inicio y fin del mes actual en timezone America/Santiago
                // Luego convertir a UTC para comparar con los timestamps almacenados en la BD
                $now = Carbon::now('America/Santiago');
                $startOfMonth = $now->copy()->startOfMonth()->utc();
                $endOfMonth = $now->copy()->endOfMonth()->utc();

                // Contar sesiones del mes actual
                $currentMonthSessions = DB::table('parking_sessions')
                    ->whereBetween('started_at', [$startOfMonth, $endOfMonth])
                    ->count();
                    
                tenancy()->end();
            } catch (\Exception $e) {
                Log::warning('Error obteniendo sesiones mensuales del tenant: ' . $e->getMessage(), [
                    'tenant_id' => $tenant->id
                ]);
                try {
                    tenancy()->end();
                } catch (\Exception $e2) {
                    // Ignorar
                }
            }

            return [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'plan_id' => $tenant->plan_id,
                'plan' => $tenant->plan ? [
                    'id' => $tenant->plan->id,
                    'name' => $tenant->plan->name
                ] : null,
                'rut' => $tenant->rut,
                'razon_social' => $tenant->razon_social,
                'giro' => $tenant->giro,
                'direccion' => $tenant->direccion,
                'comuna' => $tenant->comuna,
                'dias_credito' => $tenant->dias_credito,
                'correo_intercambio' => $tenant->correo_dte,
                'facturapi_environment' => $tenant->facturapi_environment,
                'facturapi_token' => $tenant->facturapi_token ? '***' : null, // Ocultar token por seguridad
                'created_at' => $tenant->created_at ? $tenant->created_at->toISOString() : null,
                'updated_at' => $tenant->updated_at ? $tenant->updated_at->toISOString() : null,
                'users_count' => $tenant->users_count ?? 0,
                'sessions_count' => $currentMonthSessions,
                'max_sessions' => $maxSessions
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'data' => $formattedTenants,
                'current_page' => $tenants->currentPage(),
                'last_page' => $tenants->lastPage(),
                'per_page' => $tenants->perPage(),
                'total' => $tenants->total(),
                'from' => $tenants->firstItem(),
                'to' => $tenants->lastItem(),
            ]
        ]);
    }

    /**
     * Crear tenant
     */
    public function store(Request $request): JsonResponse
    {
        // Verificar permisos
        if (!$this->checkCentralAdminAccess()) {
            return response()->json([
                'success' => false,
                'message' => 'No tiene permisos para acceder a esta funcionalidad'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'id' => 'required|string|min:2|max:255|regex:/^[a-z0-9_-]+$/|unique:tenants,id',
            'name' => 'required|string|min:2|max:255',
            'plan_id' => 'required|integer|exists:plans,id',
            'user' => 'required|array',
            'user.name' => 'required|string|min:2|max:255',
            'user.email' => 'required|email|max:255',
            'user.password' => 'required|string|min:6',
            'rut' => 'nullable|string|max:20',
            'razon_social' => 'nullable|string|max:255',
            'giro' => 'nullable|string|max:255',
            'direccion' => 'nullable|string|max:255',
            'comuna' => 'nullable|string|max:100',
            'dias_credito' => 'nullable|integer|min:0',
            'correo_intercambio' => 'nullable|email|max:255',
            'facturapi_environment' => 'nullable|in:dev,prod',
            'facturapi_token' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            // Verificar que el plan existe y está activo
            $plan = Plan::findOrFail($request->plan_id);
            if ($plan->status !== 'ACTIVE') {
                return response()->json([
                    'success' => false,
                    'message' => 'El plan seleccionado no está activo'
                ], 422);
            }

            // Crear el tenant (esto dispara el evento TenantCreated que crea la BD, migra y seedea)
            // Como shouldBeQueued es false, se ejecuta sincrónicamente
            $tenant = Tenant::create([
                'id' => strtolower(trim($request->id)),
                'name' => trim($request->name),
                'plan_id' => $request->plan_id,
                'rut' => $request->filled('rut') ? trim($request->rut) : null,
                'razon_social' => $request->filled('razon_social') ? trim($request->razon_social) : null,
                'giro' => $request->filled('giro') ? trim($request->giro) : null,
                'direccion' => $request->filled('direccion') ? trim($request->direccion) : null,
                'comuna' => $request->filled('comuna') ? trim($request->comuna) : null,
                'dias_credito' => $request->filled('dias_credito') ? (int) $request->dias_credito : 0,
                'correo_dte' => $request->filled('correo_intercambio') ? trim($request->correo_intercambio) : null,
                'facturapi_environment' => $request->filled('facturapi_environment') ? trim($request->facturapi_environment) : null,
                'facturapi_token' => $request->filled('facturapi_token') ? trim($request->facturapi_token) : null,
            ]);

            // El evento TenantCreated ya ejecutó CreateDatabase, MigrateDatabase y SeedDatabase
            // Ahora inicializamos el tenancy para crear el usuario principal
            tenancy()->initialize($tenant);

            try {
                // Crear el usuario principal en la base de datos del tenant
                $tenantUser = \App\Models\User::create([
                    'name' => trim($request->user['name']),
                    'email' => strtolower(trim($request->user['email'])),
                    'password' => Hash::make($request->user['password']),
                    'is_central_admin' => false,
                ]);

                // Finalizar el contexto del tenant antes de hacer commit
                tenancy()->end();

                // Crear un usuario en el sistema central y asociarlo con el tenant
                // Este usuario será el usuario principal del tenant
                $centralUser = Auth::user();
                
                // Crear usuario en el sistema central para asociarlo con el tenant
                $centralSystemUser = \App\Models\User::create([
                    'name' => trim($request->user['name']),
                    'email' => strtolower(trim($request->user['email'])),
                    'password' => Hash::make($request->user['password']),
                    'is_central_admin' => false,
                ]);

                // Asociar el usuario del sistema central con el tenant
                $tenant->users()->attach($centralSystemUser->id);
                
                // Si el usuario actual es admin central, también asociarlo
                if ($centralUser && $centralUser->is_central_admin) {
                    $tenant->users()->syncWithoutDetaching([$centralUser->id]);
                }

                DB::commit();

                // Recargar el tenant con la relación de plan y contar usuarios
                $tenant->load('plan');
                $tenant->loadCount('users');
                $usersCount = $tenant->users_count ?? 0;

                return response()->json([
                    'success' => true,
                    'message' => 'Estacionamiento creado exitosamente',
                    'data' => [
                        'id' => $tenant->id,
                        'name' => $tenant->name,
                        'plan_id' => $tenant->plan_id,
                        'plan' => $tenant->plan ? [
                            'id' => $tenant->plan->id,
                            'name' => $tenant->plan->name
                        ] : null,
                        'rut' => $tenant->rut,
                        'razon_social' => $tenant->razon_social,
                        'giro' => $tenant->giro,
                        'direccion' => $tenant->direccion,
                        'comuna' => $tenant->comuna,
                'dias_credito' => $tenant->dias_credito,
                'correo_intercambio' => $tenant->correo_dte,
                'facturapi_environment' => $tenant->facturapi_environment,
                'facturapi_token' => $tenant->facturapi_token ? '***' : null, // Ocultar token por seguridad
                'created_at' => $tenant->created_at->toISOString(),
                'users_count' => $usersCount
            ]
        ], 201);

            } catch (\Exception $e) {
                tenancy()->end();
                throw $e;
            }

        } catch (\Illuminate\Database\QueryException $e) {
            DB::rollBack();
            Log::error('Error creando tenant: ' . $e->getMessage());
            
            if (str_contains($e->getMessage(), 'Duplicate entry')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Ya existe un estacionamiento con ese ID'
                ], 422);
            }

            return response()->json([
                'success' => false,
                'message' => 'Error al crear el estacionamiento: ' . $e->getMessage()
            ], 500);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error creando tenant: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Error al crear el estacionamiento: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener tenant por ID
     */
    public function show(string $id): JsonResponse
    {
        // Verificar permisos
        if (!$this->checkCentralAdminAccess()) {
            return response()->json([
                'success' => false,
                'message' => 'No tiene permisos para acceder a esta funcionalidad'
            ], 403);
        }

        $tenant = Tenant::with('plan')
            ->withCount('users')
            ->find($id);

        if (!$tenant) {
            return response()->json([
                'success' => false,
                'message' => 'Estacionamiento no encontrado'
            ], 404);
        }

        // Obtener settings del tenant
        $settings = [
            'name' => 'STPark - Sistema de Estacionamientos',
            'pos_tuu' => false,
            'boleta_electronica' => false,
            'max_capacity' => 0
        ];
        
        try {
            tenancy()->initialize($tenant);
            $settingsModel = Settings::where('key', 'general')->first();
            if ($settingsModel) {
                // El modelo Settings tiene un cast a 'array', así que value ya viene como array
                $dbSettings = $settingsModel->value;
                
                // Asegurarse de que sea un array
                if (is_array($dbSettings)) {
                    // Actualizar solo los campos que existen en la BD, manteniendo los valores por defecto para los que no existen
                    $settings = array_merge($settings, $dbSettings);
                } else {
                    // Si no es array, intentar decodificar desde el atributo raw
                    $rawValue = $settingsModel->getAttributes()['value'] ?? null;
                    if ($rawValue) {
                        $decoded = json_decode($rawValue, true);
                        if (is_array($decoded)) {
                            $settings = array_merge($settings, $decoded);
                        }
                    }
                }
                
                Log::info('Settings obtenidos del tenant', [
                    'tenant_id' => $tenant->id,
                    'settings' => $settings,
                    'is_array' => is_array($settings)
                ]);
            } else {
                Log::info('No se encontraron settings para el tenant, usando valores por defecto', ['tenant_id' => $tenant->id]);
            }
            tenancy()->end();
        } catch (\Exception $e) {
            Log::warning('Error obteniendo settings del tenant: ' . $e->getMessage(), [
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage()
            ]);
            try {
                tenancy()->end();
            } catch (\Exception $e2) {
                // Ignorar
            }
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'plan_id' => $tenant->plan_id,
                'plan' => $tenant->plan ? [
                    'id' => $tenant->plan->id,
                    'name' => $tenant->plan->name
                ] : null,
                'rut' => $tenant->rut,
                'razon_social' => $tenant->razon_social,
                'giro' => $tenant->giro,
                'direccion' => $tenant->direccion,
                'comuna' => $tenant->comuna,
                'dias_credito' => $tenant->dias_credito,
                'correo_intercambio' => $tenant->correo_dte,
                'facturapi_environment' => $tenant->facturapi_environment,
                'facturapi_token' => $tenant->facturapi_token, // En show se puede mostrar el token completo para edición
                'created_at' => $tenant->created_at ? $tenant->created_at->toISOString() : null,
                'updated_at' => $tenant->updated_at ? $tenant->updated_at->toISOString() : null,
                'users_count' => $tenant->users_count ?? 0,
                'settings' => $settings
            ]
        ]);
    }

    /**
     * Actualizar tenant
     */
    public function update(Request $request, string $id): JsonResponse
    {
        // Verificar permisos
        if (!$this->checkCentralAdminAccess()) {
            return response()->json([
                'success' => false,
                'message' => 'No tiene permisos para acceder a esta funcionalidad'
            ], 403);
        }

        $tenant = Tenant::find($id);

        if (!$tenant) {
            return response()->json([
                'success' => false,
                'message' => 'Estacionamiento no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|min:2|max:255',
            'plan_id' => 'sometimes|integer|exists:plans,id',
            'settings' => 'sometimes|array',
            'settings.name' => 'sometimes|string|max:255',
            'settings.pos_tuu' => 'sometimes|boolean',
            'settings.boleta_electronica' => 'sometimes|boolean',
            'settings.max_capacity' => 'sometimes|integer|min:0',
            'rut' => 'nullable|string|max:20',
            'razon_social' => 'nullable|string|max:255',
            'giro' => 'nullable|string|max:255',
            'direccion' => 'nullable|string|max:255',
            'comuna' => 'nullable|string|max:100',
            'dias_credito' => 'nullable|integer|min:0',
            'correo_intercambio' => 'nullable|email|max:255',
            'facturapi_environment' => 'nullable|in:dev,prod',
            'facturapi_token' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $hasChanges = false;

            // Actualizar name solo si cambió
            if ($request->filled('name')) {
                $newName = trim($request->name);
                if ($tenant->name !== $newName) {
                    $tenant->name = $newName;
                    $hasChanges = true;
                }
            }

            // Actualizar plan_id solo si cambió
            if ($request->filled('plan_id')) {
                $newPlanId = (int) $request->plan_id;
                if ($tenant->plan_id !== $newPlanId) {
                    $plan = Plan::findOrFail($newPlanId);
                    if ($plan->status !== 'ACTIVE') {
                        DB::rollBack();
                        return response()->json([
                            'success' => false,
                            'message' => 'El plan seleccionado no está activo'
                        ], 422);
                    }
                    $tenant->plan_id = $newPlanId;
                    $hasChanges = true;
                }
            }

            // Actualizar campos de facturación solo si cambiaron
            if ($request->has('rut')) {
                $newRut = $request->filled('rut') ? trim($request->rut) : null;
                if ($tenant->rut !== $newRut) {
                    $tenant->rut = $newRut;
                    $hasChanges = true;
                }
            }
            if ($request->has('razon_social')) {
                $newRazonSocial = $request->filled('razon_social') ? trim($request->razon_social) : null;
                if ($tenant->razon_social !== $newRazonSocial) {
                    $tenant->razon_social = $newRazonSocial;
                    $hasChanges = true;
                }
            }
            if ($request->has('giro')) {
                $newGiro = $request->filled('giro') ? trim($request->giro) : null;
                if ($tenant->giro !== $newGiro) {
                    $tenant->giro = $newGiro;
                    $hasChanges = true;
                }
            }
            if ($request->has('direccion')) {
                $newDireccion = $request->filled('direccion') ? trim($request->direccion) : null;
                if ($tenant->direccion !== $newDireccion) {
                    $tenant->direccion = $newDireccion;
                    $hasChanges = true;
                }
            }
            if ($request->has('comuna')) {
                $newComuna = $request->filled('comuna') ? trim($request->comuna) : null;
                if ($tenant->comuna !== $newComuna) {
                    $tenant->comuna = $newComuna;
                    $hasChanges = true;
                }
            }
            if ($request->has('dias_credito')) {
                $newDiasCredito = $request->filled('dias_credito') ? (int) $request->dias_credito : 0;
                if ($tenant->dias_credito !== $newDiasCredito) {
                    $tenant->dias_credito = $newDiasCredito;
                    $hasChanges = true;
                }
            }
            if ($request->has('correo_intercambio')) {
                $newCorreoDte = $request->filled('correo_intercambio') ? trim($request->correo_intercambio) : null;
                if ($tenant->correo_dte !== $newCorreoDte) {
                    $tenant->correo_dte = $newCorreoDte;
                    $hasChanges = true;
                }
            }
            if ($request->has('facturapi_environment')) {
                $newFacturapiEnvironment = $request->filled('facturapi_environment') ? trim($request->facturapi_environment) : null;
                if ($tenant->facturapi_environment !== $newFacturapiEnvironment) {
                    $tenant->facturapi_environment = $newFacturapiEnvironment;
                    $hasChanges = true;
                }
            }
            if ($request->has('facturapi_token')) {
                $newFacturapiToken = $request->filled('facturapi_token') ? trim($request->facturapi_token) : null;
                // Solo actualizar si se proporciona un nuevo token (no vacío)
                if ($newFacturapiToken !== null && $newFacturapiToken !== '') {
                    if ($tenant->facturapi_token !== $newFacturapiToken) {
                        $tenant->facturapi_token = $newFacturapiToken;
                        $hasChanges = true;
                    }
                }
            }

            // Solo guardar si hubo cambios
            if ($hasChanges) {
                $tenant->save();
            }

            // Actualizar settings del tenant si se proporcionan
            if ($request->filled('settings')) {
                try {
                    tenancy()->initialize($tenant);
                    
                    $currentSetting = Settings::where('key', 'general')->first();
                    $currentConfig = $currentSetting ? $currentSetting->value : [];
                    
                    // Actualizar solo los campos proporcionados
                    $updatedConfig = array_merge($currentConfig, [
                        'name' => $request->input('settings.name', $currentConfig['name'] ?? 'STPark - Sistema de Estacionamientos'),
                        'pos_tuu' => $request->has('settings.pos_tuu') ? (bool) $request->input('settings.pos_tuu') : ($currentConfig['pos_tuu'] ?? false),
                        'boleta_electronica' => $request->has('settings.boleta_electronica') ? (bool) $request->input('settings.boleta_electronica') : ($currentConfig['boleta_electronica'] ?? false),
                        'max_capacity' => $request->has('settings.max_capacity') ? (int) $request->input('settings.max_capacity') : ($currentConfig['max_capacity'] ?? 0),
                    ]);
                    
                    // Preservar otros campos que puedan existir
                    if (isset($currentConfig['language'])) {
                        $updatedConfig['language'] = $currentConfig['language'];
                    }
                    if (isset($currentConfig['currency'])) {
                        $updatedConfig['currency'] = $currentConfig['currency'];
                    }
                    if (isset($currentConfig['timezone'])) {
                        $updatedConfig['timezone'] = $currentConfig['timezone'];
                    }
                    
                    Settings::updateOrCreate(
                        ['key' => 'general'],
                        ['value' => $updatedConfig]
                    );
                    
                    tenancy()->end();
                } catch (\Exception $e) {
                    tenancy()->end();
                    Log::error('Error actualizando settings del tenant: ' . $e->getMessage());
                    // No fallar la actualización del tenant si falla la actualización de settings
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Estacionamiento actualizado exitosamente',
                'data' => [
                    'id' => $tenant->id,
                    'name' => $tenant->name,
                    'plan_id' => $tenant->plan_id,
                    'plan' => $tenant->plan ? [
                        'id' => $tenant->plan->id,
                        'name' => $tenant->plan->name
                    ] : null,
                    'rut' => $tenant->rut,
                    'razon_social' => $tenant->razon_social,
                    'giro' => $tenant->giro,
                    'direccion' => $tenant->direccion,
                    'comuna' => $tenant->comuna,
                    'dias_credito' => $tenant->dias_credito,
                    'correo_intercambio' => $tenant->correo_dte,
                    'facturapi_environment' => $tenant->facturapi_environment,
                    'facturapi_token' => $tenant->facturapi_token ? '***' : null, // Ocultar token por seguridad
                    'created_at' => $tenant->created_at ? $tenant->created_at->toISOString() : null,
                    'updated_at' => $tenant->updated_at ? $tenant->updated_at->toISOString() : null,
                    'users_count' => $tenant->users_count ?? 0
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error actualizando tenant: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar el estacionamiento: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Eliminar tenant
     */
    public function destroy(string $id): JsonResponse
    {
        // Verificar permisos
        if (!$this->checkCentralAdminAccess()) {
            return response()->json([
                'success' => false,
                'message' => 'No tiene permisos para acceder a esta funcionalidad'
            ], 403);
        }

        $tenant = Tenant::find($id);

        if (!$tenant) {
            return response()->json([
                'success' => false,
                'message' => 'Estacionamiento no encontrado'
            ], 404);
        }

        try {
            // El evento TenantDeleted se encargará de eliminar la base de datos
            $tenant->delete();

            return response()->json([
                'success' => true,
                'message' => 'Estacionamiento eliminado exitosamente'
            ]);

        } catch (\Exception $e) {
            Log::error('Error eliminando tenant: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar el estacionamiento'
            ], 500);
        }
    }
}

