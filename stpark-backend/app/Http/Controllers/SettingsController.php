<?php

namespace App\Http\Controllers;

use App\Models\Settings;
use Illuminate\Http\Request;

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
            'currency' => 'CLP',
            'timezone' => 'America/Santiago',
            'language' => 'es'
        ];
        
        if (!$setting) {
            \Log::info('Settings: No se encontró configuración general, usando valores por defecto');
            return response()->json([
                'success' => true,
                'data' => $defaultConfig
            ]);
        }
        
        // Obtener el valor raw de la base de datos para debugging
        $rawValue = $setting->getRawOriginal('value');
        \Log::info('Settings: Valor raw de la base de datos', [
            'raw_value' => $rawValue,
            'raw_type' => gettype($rawValue)
        ]);
        
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
                'data' => $defaultConfig
            ]);
        }
        
        // Usar el valor de la base de datos como base, solo completar campos faltantes con valores por defecto
        $finalConfig = [
            'name' => !empty($config['name']) ? $config['name'] : $defaultConfig['name'],
            'currency' => !empty($config['currency']) ? $config['currency'] : $defaultConfig['currency'],
            'timezone' => !empty($config['timezone']) ? $config['timezone'] : $defaultConfig['timezone'],
            'language' => !empty($config['language']) ? $config['language'] : $defaultConfig['language']
        ];
        
        \Log::info('Settings: Configuración general obtenida', [
            'name_from_db' => $config['name'] ?? 'NO EXISTE',
            'name_final' => $finalConfig['name'],
            'currency' => $finalConfig['currency'],
            'timezone' => $finalConfig['timezone'],
            'language' => $finalConfig['language']
        ]);
        
        return response()->json([
            'success' => true,
            'data' => $finalConfig
        ]);
    }

    /**
     * Guardar la configuración general
     */
    public function saveGeneral(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'currency' => 'required|string|max:10',
            'timezone' => 'required|string|max:50',
            'language' => 'required|string|max:10'
        ]);

        \Log::info('Settings: Guardando configuración general', [
            'name' => $validated['name'],
            'currency' => $validated['currency'],
            'timezone' => $validated['timezone'],
            'language' => $validated['language']
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
