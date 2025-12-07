<?php

namespace App\Http\Controllers;

use App\Models\Plan;
use App\Models\PlanFeature;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;

class PlanController extends Controller
{
    /**
     * Verificar si el usuario tiene permisos de administración central
     */
    private function checkCentralAdminAccess(): bool
    {
        $user = Auth::user();
        return $user && $user->is_central_admin === true;
    }

    /**
     * Listar planes
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

        $query = Plan::with('feature');

        // Aplicar filtros
        if ($request->filled('name')) {
            $query->where('name', 'like', '%' . $request->name . '%');
        }

        if ($request->filled('status') && $request->get('status') !== 'undefined') {
            $query->where('status', $request->status);
        }

        // Aplicar paginación
        $perPage = $request->get('per_page', 10);
        $plans = $query->orderBy('name')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'data' => $plans->items(),
                'current_page' => $plans->currentPage(),
                'last_page' => $plans->lastPage(),
                'per_page' => $plans->perPage(),
                'total' => $plans->total(),
                'from' => $plans->firstItem(),
                'to' => $plans->lastItem(),
            ]
        ]);
    }

    /**
     * Crear plan
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
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'max_price_uf' => 'required|numeric|min:0',
            'status' => 'required|in:ACTIVE,INACTIVE,DISCONTINUED',
            'feature' => 'nullable|array',
            'feature.max_operators' => 'nullable|integer|min:0',
            'feature.max_streets' => 'nullable|integer|min:0',
            'feature.max_sectors' => 'nullable|integer|min:0',
            'feature.max_sessions' => 'nullable|integer|min:0',
            'feature.max_pricing_profiles' => 'nullable|integer|min:0',
            'feature.max_pricing_rules' => 'nullable|integer|min:0',
            'feature.includes_debt_management' => 'boolean',
            'feature.report_type' => 'nullable|in:BASIC,ADVANCED',
            'feature.support_type' => 'nullable|in:BASIC,PRIORITY',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $plan = Plan::create([
            'name' => $request->name,
            'description' => $request->description,
            'max_price_uf' => $request->max_price_uf,
            'status' => $request->status,
        ]);

        // Crear feature si se proporcionó
        if ($request->has('feature') && is_array($request->feature)) {
            PlanFeature::create([
                'plan_id' => $plan->id,
                'max_operators' => $request->feature['max_operators'] ?? null,
                'max_streets' => $request->feature['max_streets'] ?? null,
                'max_sectors' => $request->feature['max_sectors'] ?? null,
                'max_sessions' => $request->feature['max_sessions'] ?? null,
                'max_pricing_profiles' => $request->feature['max_pricing_profiles'] ?? null,
                'max_pricing_rules' => $request->feature['max_pricing_rules'] ?? null,
                'includes_debt_management' => $request->feature['includes_debt_management'] ?? false,
                'report_type' => $request->feature['report_type'] ?? 'BASIC',
                'support_type' => $request->feature['support_type'] ?? 'BASIC',
            ]);
        }

        $plan->load('feature');

        return response()->json([
            'success' => true,
            'data' => $plan,
            'message' => 'Plan creado exitosamente'
        ], 201);
    }

    /**
     * Obtener plan por ID
     */
    public function show(int $id): JsonResponse
    {
        // Verificar permisos
        if (!$this->checkCentralAdminAccess()) {
            return response()->json([
                'success' => false,
                'message' => 'No tiene permisos para acceder a esta funcionalidad'
            ], 403);
        }

        try {
            $plan = Plan::with('feature')->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $plan
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Plan no encontrado'
            ], 404);
        }
    }

    /**
     * Actualizar plan
     */
    public function update(Request $request, int $id): JsonResponse
    {
        // Verificar permisos
        if (!$this->checkCentralAdminAccess()) {
            return response()->json([
                'success' => false,
                'message' => 'No tiene permisos para acceder a esta funcionalidad'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'max_price_uf' => 'required|numeric|min:0',
            'status' => 'required|in:ACTIVE,INACTIVE,DISCONTINUED',
            'feature' => 'nullable|array',
            'feature.max_operators' => 'nullable|integer|min:0',
            'feature.max_streets' => 'nullable|integer|min:0',
            'feature.max_sectors' => 'nullable|integer|min:0',
            'feature.max_sessions' => 'nullable|integer|min:0',
            'feature.max_pricing_profiles' => 'nullable|integer|min:0',
            'feature.max_pricing_rules' => 'nullable|integer|min:0',
            'feature.includes_debt_management' => 'boolean',
            'feature.report_type' => 'nullable|in:BASIC,ADVANCED',
            'feature.support_type' => 'nullable|in:BASIC,PRIORITY',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $plan = Plan::findOrFail($id);
            
            $plan->update([
                'name' => $request->name,
                'description' => $request->description,
                'max_price_uf' => $request->max_price_uf,
                'status' => $request->status,
            ]);

            // Actualizar o crear feature
            if ($request->has('feature') && is_array($request->feature)) {
                $feature = PlanFeature::where('plan_id', $plan->id)->first();
                
                if ($feature) {
                    $feature->update([
                        'max_operators' => $request->feature['max_operators'] ?? null,
                        'max_streets' => $request->feature['max_streets'] ?? null,
                        'max_sectors' => $request->feature['max_sectors'] ?? null,
                        'max_sessions' => $request->feature['max_sessions'] ?? null,
                        'max_pricing_profiles' => $request->feature['max_pricing_profiles'] ?? null,
                        'max_pricing_rules' => $request->feature['max_pricing_rules'] ?? null,
                        'includes_debt_management' => $request->feature['includes_debt_management'] ?? false,
                        'report_type' => $request->feature['report_type'] ?? 'BASIC',
                        'support_type' => $request->feature['support_type'] ?? 'BASIC',
                    ]);
                } else {
                    PlanFeature::create([
                        'plan_id' => $plan->id,
                        'max_operators' => $request->feature['max_operators'] ?? null,
                        'max_streets' => $request->feature['max_streets'] ?? null,
                        'max_sectors' => $request->feature['max_sectors'] ?? null,
                        'max_sessions' => $request->feature['max_sessions'] ?? null,
                        'max_pricing_profiles' => $request->feature['max_pricing_profiles'] ?? null,
                        'max_pricing_rules' => $request->feature['max_pricing_rules'] ?? null,
                        'includes_debt_management' => $request->feature['includes_debt_management'] ?? false,
                        'report_type' => $request->feature['report_type'] ?? 'BASIC',
                        'support_type' => $request->feature['support_type'] ?? 'BASIC',
                    ]);
                }
            }

            $plan->load('feature');

            return response()->json([
                'success' => true,
                'data' => $plan,
                'message' => 'Plan actualizado exitosamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Plan no encontrado'
            ], 404);
        }
    }

    /**
     * Eliminar plan
     */
    public function destroy(int $id): JsonResponse
    {
        // Verificar permisos
        if (!$this->checkCentralAdminAccess()) {
            return response()->json([
                'success' => false,
                'message' => 'No tiene permisos para acceder a esta funcionalidad'
            ], 403);
        }

        try {
            $plan = Plan::findOrFail($id);
            $plan->delete();

            return response()->json([
                'success' => true,
                'message' => 'Plan eliminado exitosamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Plan no encontrado'
            ], 404);
        }
    }
}

