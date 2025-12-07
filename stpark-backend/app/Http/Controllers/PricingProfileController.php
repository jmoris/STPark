<?php

namespace App\Http\Controllers;

use App\Models\PricingProfile;
use App\Models\PricingRule;
use App\Services\PlanLimitService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;

class PricingProfileController extends Controller
{
    /**
     * Listar perfiles de precios con filtros
     */
    public function index(Request $request): JsonResponse
    {
        $query = PricingProfile::with(['sector', 'pricingRules']);

        // Filtros
        if ($request->filled('sector_id')) {
            $query->where('sector_id', $request->sector_id);
        }

        if ($request->filled('name')) {
            $query->where('name', 'like', '%' . $request->name . '%');
        }

        if ($request->filled('is_active') && $request->get('is_active') !== 'undefined') {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $perPage = $request->get('per_page', 10);
        $profiles = $query->orderBy('active_from', 'desc')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'data' => $profiles->items(),
                'current_page' => $profiles->currentPage(),
                'last_page' => $profiles->lastPage(),
                'per_page' => $profiles->perPage(),
                'total' => $profiles->total(),
                'from' => $profiles->firstItem(),
                'to' => $profiles->lastItem(),
            ]
        ]);
    }

    /**
     * Crear nuevo perfil de precios
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'sector_id' => 'required|exists:sectors,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'active_from' => 'required|date',
            'active_to' => 'nullable|date|after:active_from',
            'is_active' => 'boolean',
        ]);

        $validated['is_active'] = $validated['is_active'] ?? true;

        // Validar límite de perfiles de precios según el plan
        $limitCheck = PlanLimitService::canCreatePricingProfile();
        if (!$limitCheck['allowed']) {
            return response()->json([
                'success' => false,
                'message' => $limitCheck['message'],
                'error_code' => 'PLAN_LIMIT_EXCEEDED',
                'data' => [
                    'current' => $limitCheck['current'] ?? 0,
                    'limit' => $limitCheck['limit'] ?? 0
                ]
            ], 403);
        }

        $profile = PricingProfile::create($validated);

        return response()->json([
            'success' => true,
            'data' => $profile->load(['sector', 'pricingRules']),
            'message' => 'Perfil de precios creado exitosamente'
        ], 201);
    }

    /**
     * Mostrar perfil específico
     */
    public function show(int $id): JsonResponse
    {
        try {
            $profile = PricingProfile::with(['sector', 'pricingRules'])
                ->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $profile
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Perfil de precios no encontrado'
            ], 404);
        }
    }

    /**
     * Actualizar perfil de precios
     */
    public function update(Request $request, int $id): JsonResponse
    {
        try {
            $profile = PricingProfile::findOrFail($id);

            $validated = $request->validate([
                'sector_id' => 'sometimes|required|exists:sectors,id',
                'name' => 'sometimes|required|string|max:255',
                'description' => 'nullable|string',
                'active_from' => 'sometimes|required|date',
                'active_to' => 'nullable|date|after:active_from',
                'is_active' => 'boolean',
            ]);

            $profile->update($validated);

            return response()->json([
                'success' => true,
                'data' => $profile->load(['sector', 'pricingRules']),
                'message' => 'Perfil de precios actualizado exitosamente'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Perfil de precios no encontrado'
            ], 404);
        }
    }

    /**
     * Eliminar perfil de precios
     */
    public function destroy(int $id): JsonResponse
    {
        try {
            $profile = PricingProfile::findOrFail($id);
            
            // Contar reglas asociadas para el mensaje
            $rulesCount = $profile->pricingRules()->count();
            
            // Eliminar primero todas las reglas de precios asociadas
            if ($rulesCount > 0) {
                $profile->pricingRules()->delete();
            }

            // Luego eliminar el perfil
            $profile->delete();

            $message = 'Perfil de precios eliminado exitosamente';
            if ($rulesCount > 0) {
                $message .= " junto con {$rulesCount} regla" . ($rulesCount > 1 ? 's' : '') . " de precios asociada" . ($rulesCount > 1 ? 's' : '');
            }

            return response()->json([
                'success' => true,
                'message' => $message
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Perfil de precios no encontrado'
            ], 404);
        }
    }

    /**
     * Activar/desactivar perfil
     */
    public function toggleStatus(int $id): JsonResponse
    {
        try {
            $profile = PricingProfile::findOrFail($id);
            $profile->update(['is_active' => !$profile->is_active]);

            return response()->json([
                'success' => true,
                'data' => $profile,
                'message' => 'Estado del perfil actualizado exitosamente'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Perfil de precios no encontrado'
            ], 404);
        }
    }
}