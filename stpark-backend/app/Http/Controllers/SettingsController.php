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
                'price_per_min' => 0,
                'min_amount' => 0,
                'daily_max_amount' => 0,
                'start_time' => '00:00',
                'end_time' => '23:59',
                'is_active' => true
            ]);
        }
        
        return response()->json($setting->value);
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
        
        if (!$setting) {
            return response()->json([
                'name' => 'STPark - Sistema de Estacionamientos',
                'currency' => 'CLP',
                'timezone' => 'America/Santiago',
                'language' => 'es'
            ]);
        }
        
        return response()->json($setting->value);
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

        $setting = Settings::updateOrCreate(
            ['key' => 'general'],
            ['value' => $validated]
        );

        return response()->json([
            'success' => true,
            'message' => 'Configuración guardada exitosamente',
            'data' => $setting->value
        ]);
    }
}
