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
            'max_capacity' => 0, // Capacidad máxima de vehículos en el estacionamiento
            'car_wash_enabled' => false, // Configuración de módulo de lavado de autos (solo lectura para usuarios, solo administradores pueden cambiar)
            'car_wash_payment_deferred' => false // Permitir pago posterior del lavado de autos (solo visible si car_wash_enabled está activo)
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
            'car_wash_enabled' => isset($config['car_wash_enabled']) ? (bool) $config['car_wash_enabled'] : $defaultConfig['car_wash_enabled'],
            'car_wash_payment_deferred' => isset($config['car_wash_payment_deferred']) ? (bool) $config['car_wash_payment_deferred'] : $defaultConfig['car_wash_payment_deferred'],
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
            'max_capacity' => 'nullable|integer|min:0',
            'car_wash_payment_deferred' => 'nullable|boolean' // Permitir que el usuario modifique este campo
            // pos_tuu, boleta_electronica y car_wash_enabled NO se incluyen aquí - solo pueden ser modificados por administradores directamente en la BD
        ]);

        // Obtener la configuración actual para preservar campos de solo lectura
        $currentSetting = Settings::where('key', 'general')->first();
        $currentConfig = $currentSetting ? $currentSetting->value : [];
        
        // Log del valor ANTES de preservar
        \Log::info('Settings: Valores ANTES de preservar', [
            'car_wash_enabled_en_currentConfig' => isset($currentConfig['car_wash_enabled']) ? ($currentConfig['car_wash_enabled'] ? 'true' : 'false') : 'NO_EXISTE',
            'car_wash_payment_deferred_en_request' => $request->has('car_wash_payment_deferred') ? ($request->input('car_wash_payment_deferred') ? 'true' : 'false') : 'NO_ENVIADO',
        ]);
        
        // SIEMPRE preservar pos_tuu, boleta_electronica y car_wash_enabled del valor actual (NO permitir que usuarios lo cambien)
        // Estos valores nunca deben cambiar desde aquí, solo desde la base de datos central
        $validated['pos_tuu'] = isset($currentConfig['pos_tuu']) ? (bool) $currentConfig['pos_tuu'] : false;
        $validated['boleta_electronica'] = isset($currentConfig['boleta_electronica']) ? (bool) $currentConfig['boleta_electronica'] : false;
        
        // IMPORTANTE: car_wash_enabled SIEMPRE se preserva del valor actual, NUNCA del request
        $preservedCarWashEnabled = isset($currentConfig['car_wash_enabled']) ? (bool) $currentConfig['car_wash_enabled'] : false;
        $validated['car_wash_enabled'] = $preservedCarWashEnabled;
        
        // car_wash_payment_deferred viene en la petición y puede ser modificado por el usuario
        // Si no viene, preservar el valor actual
        if (!isset($validated['car_wash_payment_deferred'])) {
            $validated['car_wash_payment_deferred'] = isset($currentConfig['car_wash_payment_deferred']) ? (bool) $currentConfig['car_wash_payment_deferred'] : false;
        } else {
            // Convertir a boolean explícitamente
            $validated['car_wash_payment_deferred'] = (bool) $validated['car_wash_payment_deferred'];
        }
        
        // Si max_capacity no viene en la petición, preservar el valor actual o usar 0 por defecto
        if (!isset($validated['max_capacity'])) {
            $validated['max_capacity'] = isset($currentConfig['max_capacity']) ? (int) $currentConfig['max_capacity'] : 0;
        } else {
            $validated['max_capacity'] = (int) $validated['max_capacity'];
        }

        \Log::info('Settings: Guardando configuración general', [
            'name' => $validated['name'],
            'language' => $validated['language'],
            'pos_tuu' => ($validated['pos_tuu'] ? 'true' : 'false') . ' (preservado, no modificable por usuarios)',
            'boleta_electronica' => ($validated['boleta_electronica'] ? 'true' : 'false') . ' (preservado, no modificable por usuarios)',
            'car_wash_enabled' => ($validated['car_wash_enabled'] ? 'true' : 'false') . ' (preservado de BD, NO modificado)',
            'car_wash_payment_deferred' => ($validated['car_wash_payment_deferred'] ? 'true' : 'false') . ' (modificado por usuario)',
            'max_capacity' => $validated['max_capacity'],
            'car_wash_enabled_preservado_de' => $preservedCarWashEnabled ? 'true' : 'false'
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
