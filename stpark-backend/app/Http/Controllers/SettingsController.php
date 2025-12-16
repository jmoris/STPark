<?php

namespace App\Http\Controllers;

use App\Models\Settings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SettingsController extends Controller
{
    /**
     * Obtener la configuración de precios por defecto
     */
    public function getDefaultPricing(Request $request)
    {
        $setting = Settings::where('key', 'default_pricing')->first();
        
        if (!$setting) {
            return response()->json([
                'success' => true,
                'data' => [
                    'price_per_min' => 0,
                    'min_amount' => 0,
                    'daily_max_amount' => 0,
                    'start_time' => '00:00',
                    'end_time' => '23:59',
                    'is_active' => true
                ]
            ]);
        }
        
        return response()->json([
            'success' => true,
            'data' => $setting->value
        ]);
    }

    /**
     * Guardar la configuración de precios por defecto
     */
    public function saveDefaultPricing(Request $request)
    {
        $validated = $request->validate([
            'price_per_min' => 'required|numeric|min:0',
            'min_amount' => 'required|numeric|min:0',
            'daily_max_amount' => 'required|numeric|min:0',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i',
            'is_active' => 'boolean'
        ]);

        $setting = Settings::updateOrCreate(
            ['key' => 'default_pricing'],
            ['value' => $validated]
        );

        return response()->json([
            'success' => true,
            'message' => 'Configuración guardada exitosamente',
            'data' => $setting->value
        ]);
    }

    /**
     * Obtener la configuración general
     */
    public function getGeneral(Request $request)
    {
        $setting = Settings::where('key', 'general')->first();
        
        // Valores por defecto
        $defaultConfig = [
            'name' => 'STPark - Sistema de Estacionamientos',
            'language' => 'es',
            'pos_tuu' => false, // Configuración de POS TUU (solo lectura para usuarios, solo administradores pueden cambiar)
            'boleta_electronica' => false, // Configuración de Boleta Electrónica (solo lectura para usuarios, solo administradores pueden cambiar)
            'max_capacity' => 0 // Capacidad máxima de vehículos en el estacionamiento
        ];
        
        // Obtener información del plan del tenant desde la conexión central
        $planName = 'Sin plan';
        try {
            $tenantId = tenant('id');
            if ($tenantId) {
                // Obtener el tenant desde la conexión central donde está la tabla de planes
                $centralConnection = config('tenancy.database.central_connection', 'central');
                $tenant = DB::connection($centralConnection)->table('tenants')
                    ->join('plans', 'tenants.plan_id', '=', 'plans.id')
                    ->where('tenants.id', $tenantId)
                    ->select('plans.name as plan_name')
                    ->first();
                
                if ($tenant && isset($tenant->plan_name)) {
                    $planName = $tenant->plan_name;
                }
            }
        } catch (\Exception $e) {
            \Log::warning('Settings: Error al obtener información del plan del tenant', ['error' => $e->getMessage()]);
        }
        
        if (!$setting) {
            \Log::info('Settings: No se encontró configuración general, usando valores por defecto');
            return response()->json([
                'success' => true,
                'data' => array_merge($defaultConfig, [
                    'plan_name' => $planName
                ])
            ]);
        }
        
        // Obtener el valor (ya viene como array por el cast del modelo)
        $config = $setting->value;
        
        \Log::info('Settings: Valor después del cast', [
            'value' => $config,
            'type' => gettype($config),
            'is_array' => is_array($config)
        ]);
        
        // Validar que el valor sea un array y tenga los campos requeridos
        if (!is_array($config)) {
            \Log::warning('Settings: La configuración general no es un array válido', [
                'value' => $config,
                'type' => gettype($config)
            ]);
            return response()->json([
                'success' => true,
                'data' => array_merge($defaultConfig, [
                    'plan_name' => $planName
                ])
            ]);
        }
        
        // Usar el valor de la base de datos como base, solo completar campos faltantes con valores por defecto
        $finalConfig = [
            'name' => !empty($config['name']) ? $config['name'] : $defaultConfig['name'],
            'language' => !empty($config['language']) ? $config['language'] : $defaultConfig['language'],
            'pos_tuu' => isset($config['pos_tuu']) ? (bool) $config['pos_tuu'] : $defaultConfig['pos_tuu'],
            'boleta_electronica' => isset($config['boleta_electronica']) ? (bool) $config['boleta_electronica'] : $defaultConfig['boleta_electronica'],
            'max_capacity' => isset($config['max_capacity']) ? (int) $config['max_capacity'] : $defaultConfig['max_capacity'],
            'plan_name' => $planName
        ];
        
        \Log::info('Settings: Configuración general obtenida', [
            'name_from_db' => $config['name'] ?? 'NO EXISTE',
            'name_final' => $finalConfig['name'],
            'language' => $finalConfig['language'],
            'plan_name' => $finalConfig['plan_name']
        ]);
        
        return response()->json([
            'success' => true,
            'data' => $finalConfig
        ]);
    }

    /**
     * Guardar la configuración general
     * NOTA: pos_tuu y boleta_electronica no se pueden cambiar desde aquí (solo administradores)
     */
    public function saveGeneral(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'language' => 'required|string|max:10',
            'max_capacity' => 'nullable|integer|min:0'
            // pos_tuu y boleta_electronica NO se incluyen aquí - solo pueden ser modificados por administradores directamente en la BD
        ]);

        // Obtener la configuración actual para preservar pos_tuu y boleta_electronica
        $currentSetting = Settings::where('key', 'general')->first();
        $currentConfig = $currentSetting ? $currentSetting->value : [];
        
        // Preservar pos_tuu y boleta_electronica del valor actual (no permitir que usuarios lo cambien)
        $validated['pos_tuu'] = isset($currentConfig['pos_tuu']) ? (bool) $currentConfig['pos_tuu'] : false;
        $validated['boleta_electronica'] = isset($currentConfig['boleta_electronica']) ? (bool) $currentConfig['boleta_electronica'] : false;
        
        // Si max_capacity no viene en la petición, preservar el valor actual o usar 0 por defecto
        if (!isset($validated['max_capacity'])) {
            $validated['max_capacity'] = isset($currentConfig['max_capacity']) ? (int) $currentConfig['max_capacity'] : 0;
        } else {
            $validated['max_capacity'] = (int) $validated['max_capacity'];
        }

        \Log::info('Settings: Guardando configuración general', [
            'name' => $validated['name'],
            'language' => $validated['language'],
            'pos_tuu' => $validated['pos_tuu'] . ' (preservado, no modificable por usuarios)',
            'boleta_electronica' => $validated['boleta_electronica'] . ' (preservado, no modificable por usuarios)'
        ]);

        $setting = Settings::updateOrCreate(
            ['key' => 'general'],
            ['value' => $validated]
        );

        // Refrescar el modelo para obtener el valor con el cast aplicado
        $setting->refresh();

        \Log::info('Settings: Configuración general guardada exitosamente', [
            'setting_id' => $setting->id,
            'value' => $setting->value
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Configuración guardada exitosamente',
            'data' => $setting->value
        ]);
    }
}
