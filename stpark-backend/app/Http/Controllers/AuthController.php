<?php

namespace App\Http\Controllers;

use App\Models\Operator;
use App\Models\User;
use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    /**
     * Login del operador con ID y PIN
     */
    public function operatorsLogin(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'operator_id' => 'required|integer',
            'pin' => 'required|string|size:6',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de entrada inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Buscar operador por ID
            $operator = Operator::where('id', $request->operator_id)
                ->where('status', 'ACTIVE')
                ->first();

            if (!$operator) {
                return response()->json([
                    'success' => false,
                    'message' => 'Credenciales inválidas'
                ], 401);
            }

            // Verificar PIN
            if ($operator->pin !== $request->pin) {
                return response()->json([
                    'success' => false,
                    'message' => 'Credenciales inválidas'
                ], 401);
            }

            // Cargar relaciones necesarias
            $operator->load(['sectors', 'streets']);

            return response()->json([
                'success' => true,
                'message' => 'Login exitoso',
                'data' => [
                    'operator' => $operator,
                    'token' => base64_encode($operator->id . ':' . time()) // Token simple para la app móvil
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error en login: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error interno del servidor',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Login de usuarios del tenant central con email y password
     */
    public function login(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string|min:6',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de entrada inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Intentar autenticar con email y password
            if (Auth::attempt($request->only('email', 'password'))) {
                $user = Auth::user();
                
                // Cargar los tenants asociados al usuario
                $user->load('tenants');
                
                Log::info('User tenants loaded:', ['tenants_count' => $user->tenants->count()]);
                Log::info('Tenants data:', ['tenants' => $user->tenants->toArray()]);
                
                // Crear token de Sanctum
                $token = $user->createToken('auth-token')->plainTextToken;
                
                $tenants = $user->tenants->map(function ($tenant) {
                    return [
                        'id' => $tenant->id,
                        'name' => $tenant->name ?? $tenant->id,
                        'domains' => $tenant->domains->pluck('domain'),
                    ];
                });
                
                Log::info('Tenants mapped:', ['tenants' => $tenants->toArray()]);
                
                return response()->json([
                    'success' => true,
                    'message' => 'Login exitoso',
                    'data' => [
                        'user' => [
                            'id' => $user->id,
                            'name' => $user->name,
                            'email' => $user->email,
                            'email_verified_at' => $user->email_verified_at,
                        ],
                        'tenants' => $tenants,
                        'token' => $token
                    ]
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Credenciales inválidas'
            ], 401);

        } catch (\Exception $e) {
            Log::error('Error en login de usuario: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error interno del servidor',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Verificar token (operador o usuario)
     */
    public function verify(Request $request): JsonResponse
    {
        $token = $request->header('Authorization');
        
        if (!$token) {
            return response()->json([
                'success' => false,
                'message' => 'Token no proporcionado'
            ], 401);
        }

        try {
            // Decodificar token
            $decoded = base64_decode(str_replace('Bearer ', '', $token));
            $parts = explode(':', $decoded);
            
            // Token de operador (2 partes: id:timestamp)
            if (count($parts) === 2) {
                $operatorId = $parts[0];
                $operator = Operator::where('id', $operatorId)
                    ->where('status', 'ACTIVE')
                    ->with(['sectors', 'streets'])
                    ->first();

                if (!$operator) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Operador no encontrado'
                    ], 401);
                }

                return response()->json([
                    'success' => true,
                    'data' => $operator,
                    'type' => 'operator'
                ]);
            }
            
            // Token de usuario (3 partes: id:timestamp:email)
            if (count($parts) === 3) {
                $userId = $parts[0];
                $user = User::where('id', $userId)->first();

                if (!$user) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Usuario no encontrado'
                    ], 401);
                }

                return response()->json([
                    'success' => true,
                    'data' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'email_verified_at' => $user->email_verified_at,
                    ],
                    'type' => 'user'
                ]);
            }

            throw new \Exception('Token inválido');

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Token inválido'
            ], 401);
        }
    }

    /**
     * Logout (operador o usuario)
     */
    public function logout(Request $request): JsonResponse
    {
        try {
            // Si el usuario está autenticado con Sanctum, revocar el token
            if ($request->user()) {
                $request->user()->currentAccessToken()->delete();
            }
            
            return response()->json([
                'success' => true,
                'message' => 'Sesión cerrada exitosamente'
            ]);
        } catch (\Exception $e) {
            Log::error('Error en logout: ' . $e->getMessage());
            return response()->json([
                'success' => true,
                'message' => 'Sesión cerrada exitosamente'
            ]);
        }
    }

    /**
     * Actualizar perfil del usuario
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario no autenticado'
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'nullable|string|max:255',
            'password' => 'nullable|string|min:6',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $updateData = [];
            
            // Solo actualizar nombre si está presente
            if ($request->filled('name')) {
                $updateData['name'] = $request->name;
            }
            
            // Solo actualizar contraseña si está presente (no vacía)
            if ($request->filled('password') && $request->password !== '') {
                $updateData['password'] = Hash::make($request->password);
            }
            
            if (count($updateData) > 0) {
                $user->update($updateData);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                ],
                'message' => 'Perfil actualizado exitosamente'
            ]);

        } catch (\Exception $e) {
            Log::error('Error actualizando perfil: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar perfil'
            ], 500);
        }
    }

    /**
     * Obtener listado de tenants asociados al usuario autenticado
     */
    public function getTenants(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario no autenticado'
                ], 401);
            }
            
            // Obtener los tenants asociados al usuario
            $tenants = $user->tenants()->get()->map(function ($tenant) {
                return [
                    'id' => $tenant->id,
                    'name' => $tenant->name ?? $tenant->id,
                    'domains' => $tenant->domains->pluck('domain'),
                ];
            });

            return response()->json([
                'success' => true,
                'message' => 'Lista de tenants obtenida exitosamente',
                'data' => [
                    'tenants' => $tenants,
                    'total' => $tenants->count()
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error al obtener lista de tenants: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error interno del servidor',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}