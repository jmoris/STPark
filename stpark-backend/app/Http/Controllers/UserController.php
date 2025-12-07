<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class UserController extends Controller
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
     * Listar usuarios
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

        $query = User::withCount('tenants');

        // Aplicar filtros
        if ($request->filled('name')) {
            $query->where('name', 'like', '%' . $request->name . '%');
        }

        if ($request->filled('email')) {
            $query->where('email', 'like', '%' . $request->email . '%');
        }

        if ($request->has('is_central_admin')) {
            $query->where('is_central_admin', $request->boolean('is_central_admin'));
        }

        // Aplicar ordenamiento
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');
        
        $allowedSortFields = ['id', 'name', 'email', 'created_at', 'tenants_count'];
        if (in_array($sortBy, $allowedSortFields)) {
            $query->orderBy($sortBy, $sortOrder);
        } else {
            $query->orderBy('created_at', 'desc');
        }

        // Aplicar paginación
        $perPage = $request->get('per_page', 10);
        $users = $query->paginate($perPage);

        // Formatear respuesta
        $formattedUsers = $users->getCollection()->map(function ($user) {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'is_central_admin' => (bool) ($user->is_central_admin ?? false),
                'created_at' => $user->created_at ? $user->created_at->toISOString() : null,
                'updated_at' => $user->updated_at ? $user->updated_at->toISOString() : null,
                'tenants_count' => $user->tenants_count ?? 0
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'data' => $formattedUsers,
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
                'from' => $users->firstItem(),
                'to' => $users->lastItem(),
            ]
        ]);
    }

    /**
     * Crear usuario
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
            'name' => 'required|string|min:2|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|min:6',
            'is_central_admin' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = User::create([
                'name' => trim($request->name),
                'email' => strtolower(trim($request->email)),
                'password' => Hash::make($request->password),
                'is_central_admin' => $request->boolean('is_central_admin', false),
            ]);

            $user->loadCount('tenants');

            return response()->json([
                'success' => true,
                'message' => 'Usuario creado exitosamente',
                'data' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'is_central_admin' => (bool) ($user->is_central_admin ?? false),
                    'created_at' => $user->created_at->toISOString(),
                    'tenants_count' => $user->tenants_count ?? 0
                ]
            ], 201);

        } catch (\Exception $e) {
            Log::error('Error creando usuario: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Error al crear el usuario: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener usuario por ID
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

        $user = User::with('tenants')
        ->withCount('tenants')
        ->find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario no encontrado'
            ], 404);
        }

        // Formatear tenants
        $formattedTenants = $user->tenants->map(function ($tenant) {
            return [
                'id' => $tenant->id,
                'name' => $tenant->name ?? $tenant->id
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'is_central_admin' => (bool) ($user->is_central_admin ?? false),
                'created_at' => $user->created_at ? $user->created_at->toISOString() : null,
                'updated_at' => $user->updated_at ? $user->updated_at->toISOString() : null,
                'tenants_count' => $user->tenants_count ?? 0,
                'tenants' => $formattedTenants
            ]
        ]);
    }

    /**
     * Actualizar usuario
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

        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|min:2|max:255',
            'email' => 'sometimes|email|max:255|unique:users,email,' . $id,
            'password' => 'sometimes|string|min:6',
            'is_central_admin' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            if ($request->filled('name')) {
                $user->name = trim($request->name);
            }

            if ($request->filled('email')) {
                $user->email = strtolower(trim($request->email));
            }

            if ($request->filled('password')) {
                $user->password = Hash::make($request->password);
            }

            if ($request->has('is_central_admin')) {
                $user->is_central_admin = $request->boolean('is_central_admin');
            }

            $user->save();
            $user->loadCount('tenants');

            return response()->json([
                'success' => true,
                'message' => 'Usuario actualizado exitosamente',
                'data' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'is_central_admin' => (bool) ($user->is_central_admin ?? false),
                    'created_at' => $user->created_at ? $user->created_at->toISOString() : null,
                    'updated_at' => $user->updated_at ? $user->updated_at->toISOString() : null,
                    'tenants_count' => $user->tenants_count ?? 0
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error actualizando usuario: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar el usuario: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Eliminar usuario
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

        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario no encontrado'
            ], 404);
        }

        // No permitir eliminar el usuario actual
        if ($user->id === Auth::id()) {
            return response()->json([
                'success' => false,
                'message' => 'No puede eliminar su propio usuario'
            ], 422);
        }

        try {
            // Eliminar relaciones con tenants
            $user->tenants()->detach();
            
            $user->delete();

            return response()->json([
                'success' => true,
                'message' => 'Usuario eliminado exitosamente'
            ]);

        } catch (\Exception $e) {
            Log::error('Error eliminando usuario: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar el usuario'
            ], 500);
        }
    }

    /**
     * Asignar usuario a estacionamiento(s)
     */
    public function assignToTenants(Request $request, string $id): JsonResponse
    {
        // Verificar permisos
        if (!$this->checkCentralAdminAccess()) {
            return response()->json([
                'success' => false,
                'message' => 'No tiene permisos para acceder a esta funcionalidad'
            ], 403);
        }

        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'tenant_ids' => 'required|array',
            'tenant_ids.*' => 'required|string|exists:tenants,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Sincronizar las relaciones (agregar nuevas sin eliminar las existentes)
            $user->tenants()->syncWithoutDetaching($request->tenant_ids);

            $user->load('tenants');
            $user->loadCount('tenants');

            // Formatear tenants
            $formattedTenants = $user->tenants->map(function ($tenant) {
                return [
                    'id' => $tenant->id,
                    'name' => $tenant->name ?? $tenant->id
                ];
            });

            return response()->json([
                'success' => true,
                'message' => 'Usuario asignado a estacionamiento(s) exitosamente',
                'data' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'tenants_count' => $user->tenants_count ?? 0,
                    'tenants' => $formattedTenants
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error asignando usuario a tenants: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Error al asignar usuario a estacionamiento(s): ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remover usuario de estacionamiento(s)
     */
    public function removeFromTenants(Request $request, string $id): JsonResponse
    {
        // Verificar permisos
        if (!$this->checkCentralAdminAccess()) {
            return response()->json([
                'success' => false,
                'message' => 'No tiene permisos para acceder a esta funcionalidad'
            ], 403);
        }

        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'tenant_ids' => 'required|array',
            'tenant_ids.*' => 'required|string|exists:tenants,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Remover las relaciones
            $user->tenants()->detach($request->tenant_ids);

            $user->loadCount('tenants');

            return response()->json([
                'success' => true,
                'message' => 'Usuario removido de estacionamiento(s) exitosamente',
                'data' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'tenants_count' => $user->tenants_count ?? 0
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error removiendo usuario de tenants: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Error al remover usuario de estacionamiento(s): ' . $e->getMessage()
            ], 500);
        }
    }
}
