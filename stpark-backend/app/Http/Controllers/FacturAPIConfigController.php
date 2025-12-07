<?php

namespace App\Http\Controllers;

use App\Models\FacturAPIConfig;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class FacturAPIConfigController extends Controller
{
    /**
     * Obtener configuración de FacturAPI
     * Solo accesible para administradores centrales
     */
    public function get(Request $request): JsonResponse
    {
        $user = $request->user();
        // Aceptar tanto true como 1 (valor numérico desde la base de datos)
        if (!$user || ($user->is_central_admin !== true && $user->is_central_admin !== 1)) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        // Obtener configuración desde la base de datos
        $configModel = FacturAPIConfig::getConfig();
        
        $config = [
            'environment' => $configModel->environment,
            'dev_token' => $configModel->dev_token, // Se desencripta automáticamente por el accessor
            'prod_token' => $configModel->prod_token, // Se desencripta automáticamente por el accessor
        ];

        return response()->json([
            'success' => true,
            'data' => $config
        ]);
    }

    /**
     * Guardar configuración de FacturAPI
     * Solo accesible para administradores centrales
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        // Aceptar tanto true como 1 (valor numérico desde la base de datos)
        if (!$user || ($user->is_central_admin !== true && $user->is_central_admin !== 1)) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'environment' => 'required|in:dev,prod',
            'dev_token' => 'required|string',
            'prod_token' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Obtener o crear la configuración
            $configModel = FacturAPIConfig::getConfig();
            
            // Actualizar los valores (se encriptan automáticamente por los mutators)
            $configModel->environment = $request->environment;
            $configModel->dev_token = $request->dev_token;
            $configModel->prod_token = $request->prod_token;
            $configModel->save();

            // Recargar el modelo para obtener los valores actualizados
            $configModel->refresh();

            // Retornar la configuración (se desencripta automáticamente por los accessors)
            $config = [
                'environment' => $configModel->environment,
                'dev_token' => $configModel->dev_token,
                'prod_token' => $configModel->prod_token,
            ];

            return response()->json([
                'success' => true,
                'data' => $config,
                'message' => 'Configuración guardada exitosamente'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al guardar configuración: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener configuración activa de FacturAPI (para uso interno)
     * Retorna el endpoint y token según el ambiente configurado
     */
    public static function getActiveConfig(): array
    {
        // Obtener configuración desde la base de datos
        $configModel = FacturAPIConfig::getConfig();
        
        $environment = $configModel->environment ?? 'dev';
        
        $endpoints = [
            'dev' => 'https://dev.facturapi.cl/api',
            'prod' => 'https://prod.facturapi.cl/api'
        ];

        // Los tokens se desencriptan automáticamente por los accessors del modelo
        $tokens = [
            'dev' => $configModel->dev_token ?? '',
            'prod' => $configModel->prod_token ?? ''
        ];

        return [
            'environment' => $environment,
            'endpoint' => $endpoints[$environment],
            'token' => $tokens[$environment]
        ];
    }
}
