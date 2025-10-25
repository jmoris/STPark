<?php

namespace App\Http\Controllers;

use App\Models\Operator;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class AuthController extends Controller
{
    /**
     * Login del operador con email y PIN
     */
    public function login(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
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
            // Buscar operador por email
            $operator = Operator::where('email', $request->email)
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
            return response()->json([
                'success' => false,
                'message' => 'Error interno del servidor',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Verificar token del operador
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
            // Decodificar token simple
            $decoded = base64_decode(str_replace('Bearer ', '', $token));
            $parts = explode(':', $decoded);
            
            if (count($parts) !== 2) {
                throw new \Exception('Token inválido');
            }

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
                'data' => $operator
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Token inválido'
            ], 401);
        }
    }

    /**
     * Logout del operador
     */
    public function logout(Request $request): JsonResponse
    {
        // Para este sistema simple, el logout solo confirma que se cerró la sesión
        return response()->json([
            'success' => true,
            'message' => 'Sesión cerrada exitosamente'
        ]);
    }
}