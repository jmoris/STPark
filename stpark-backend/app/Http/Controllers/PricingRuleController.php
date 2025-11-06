<?php

namespace App\Http\Controllers;

use App\Models\PricingRule;
use App\Models\PricingProfile;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class PricingRuleController extends Controller
{
    /**
     * Listar reglas de precios
     */
    public function index(Request $request): JsonResponse
    {
        $query = PricingRule::with(['pricingProfile.sector']);

        // Filtros
        if ($request->filled('profile_id')) {
            $query->where('profile_id', $request->profile_id);
        }

        if ($request->filled('rule_type')) {
            $query->where('rule_type', $request->rule_type);
        }

        if ($request->filled('is_active') && $request->get('is_active') !== 'undefined') {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $perPage = $request->get('per_page', 10);
        $rules = $query->orderBy('priority')->orderBy('id')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'data' => $rules->items(),
                'current_page' => $rules->currentPage(),
                'last_page' => $rules->lastPage(),
                'per_page' => $rules->perPage(),
                'total' => $rules->total(),
                'from' => $rules->firstItem(),
                'to' => $rules->lastItem(),
            ]
        ]);
    }

    /**
     * Crear nueva regla de precios
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'profile_id' => 'required|exists:pricing_profiles,id',
            'name' => 'required|string|max:255',
            'rule_type' => 'required|in:TIME_BASED,FIXED,GRADUATED',
            'start_min' => 'nullable|integer|min:0',
            'end_min' => 'nullable|integer|min:0|gt:start_min',
            'min_duration_minutes' => 'required|integer|min:0',
            'max_duration_minutes' => 'nullable|integer|min:0|gt:min_duration_minutes',
            'daily_max_amount' => 'nullable|numeric|min:0',
            'min_amount' => 'nullable|numeric|min:0',
            'min_amount_is_base' => 'nullable|boolean',
            'price_per_minute' => 'nullable|numeric|min:0|required_if:rule_type,TIME_BASED',
            'price_per_min' => 'nullable|numeric|min:0', // Agregar validación para price_per_min
            'fixed_price' => 'nullable|numeric|min:0|required_if:rule_type,FIXED',
            'days_of_week' => 'nullable|array',
            'days_of_week.*' => 'integer|min:0|max:6',
            'start_time' => 'nullable|date_format:H:i',
            'end_time' => 'nullable|date_format:H:i',
            'priority' => 'integer|min:0',
            'is_active' => 'boolean',
        ]);

        $validated['is_active'] = $validated['is_active'] ?? true;
        $validated['priority'] = $validated['priority'] ?? 0;

        // Mapear price_per_minute a price_per_min para compatibilidad con la base de datos
        if (isset($validated['price_per_minute'])) {
            $validated['price_per_min'] = $validated['price_per_minute'];
            unset($validated['price_per_minute']);
        }

        $rule = PricingRule::create($validated);

        return response()->json([
            'success' => true,
            'data' => $rule->load(['pricingProfile.sector']),
            'message' => 'Regla de precios creada exitosamente'
        ], 201);
    }

    /**
     * Mostrar regla específica
     */
    public function show(int $id): JsonResponse
    {
        try {
            $rule = PricingRule::with(['pricingProfile.sector'])
                ->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $rule
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Regla de precios no encontrada'
            ], 404);
        }
    }

    /**
     * Actualizar regla de precios
     */
    public function update(Request $request, int $id): JsonResponse
    {
        try {
            $rule = PricingRule::findOrFail($id);

            $validated = $request->validate([
                'profile_id' => 'sometimes|required|exists:pricing_profiles,id',
                'name' => 'sometimes|required|string|max:255',
                'rule_type' => 'sometimes|required|in:TIME_BASED,FIXED,GRADUATED',
                'start_min' => 'nullable|integer|min:0',
                'end_min' => 'nullable|integer|min:0|gt:start_min',
                'min_duration_minutes' => 'sometimes|required|integer|min:0',
                'max_duration_minutes' => 'nullable|integer|min:0|gt:min_duration_minutes',
                'daily_max_amount' => 'nullable|numeric|min:0',
                'min_amount' => 'nullable|numeric|min:0',
                'min_amount_is_base' => 'nullable|boolean',
                'price_per_minute' => 'nullable|numeric|min:0',
                'price_per_min' => 'nullable|numeric|min:0', // Agregar validación para price_per_min
                'fixed_price' => 'nullable|numeric|min:0',
                'days_of_week' => 'nullable|array',
                'days_of_week.*' => 'integer|min:0|max:6',
                'start_time' => 'nullable|date_format:H:i',
                'end_time' => 'nullable|date_format:H:i',
                'priority' => 'integer|min:0',
                'is_active' => 'boolean',
            ]);

            // Mapear price_per_minute a price_per_min para compatibilidad con la base de datos
            if (isset($validated['price_per_minute'])) {
                $validated['price_per_min'] = $validated['price_per_minute'];
                unset($validated['price_per_minute']);
            }

            $rule->update($validated);

            return response()->json([
                'success' => true,
                'data' => $rule->load(['pricingProfile.sector']),
                'message' => 'Regla de precios actualizada exitosamente'
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Regla de precios no encontrada'
            ], 404);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'errors' => $e->errors(),
                'message' => 'Error de validación'
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error interno: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Eliminar regla de precios
     */
    public function destroy(int $id): JsonResponse
    {
        try {
            $rule = PricingRule::findOrFail($id);
            $rule->delete();

            return response()->json([
                'success' => true,
                'message' => 'Regla de precios eliminada exitosamente'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Regla de precios no encontrada'
            ], 404);
        }
    }

    /**
     * Activar/desactivar regla
     */
    public function toggleStatus(int $id): JsonResponse
    {
        try {
            $rule = PricingRule::findOrFail($id);
            $rule->update(['is_active' => !$rule->is_active]);

            return response()->json([
                'success' => true,
                'data' => $rule,
                'message' => 'Estado de la regla actualizado exitosamente'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Regla de precios no encontrada'
            ], 404);
        }
    }

    /**
     * Obtener reglas por perfil de precios
     */
    public function getByProfile(int $profileId): JsonResponse
    {
        try {
            $rules = PricingRule::where('profile_id', $profileId)
                ->orderBy('priority', 'asc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $rules
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener reglas del perfil: ' . $e->getMessage()
            ], 500);
        }
    }
}