<?php

namespace App\Http\Controllers;

use App\Models\Sector;
use App\Services\PlanLimitService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class SectorController extends Controller
{
    /**
     * Listar sectores
     */
    public function index(Request $request): JsonResponse
    {
        $query = Sector::with([
            'streets', 
            'operators' => function($query) {
                $query->wherePivot('valid_to', '>=', now())
                      ->orWhereNull('valid_to');
            },
            'parkingSessions' => function($query) {
                $query->whereNull('ended_at'); // Solo sesiones activas
            }
        ]);

        // Aplicar filtros
        if ($request->filled('name')) {
            $query->where('name', 'like', '%' . $request->name . '%');
        }

        if ($request->filled('is_private') && $request->get('is_private') !== 'undefined') {
            $query->where('is_private', $request->boolean('is_private'));
        }

        // Nota: Sector no tiene campo is_active, solo is_private

        // Aplicar paginación
        $perPage = $request->get('per_page', 10);
        $sectors = $query->orderBy('name')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'data' => $sectors->items(),
                'current_page' => $sectors->currentPage(),
                'last_page' => $sectors->lastPage(),
                'per_page' => $sectors->perPage(),
                'total' => $sectors->total(),
                'from' => $sectors->firstItem(),
                'to' => $sectors->lastItem(),
            ]
        ]);
    }

    /**
     * Crear sector
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'is_private' => 'boolean',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Validar límite de sectores según el plan
        $limitCheck = PlanLimitService::canCreateSector();
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

        $sector = Sector::create([
            'name' => $request->name,
            'description' => $request->description,
            'is_private' => $request->boolean('is_private', false),
            'is_active' => $request->boolean('is_active', true),
        ]);

        return response()->json([
            'success' => true,
            'data' => $sector,
            'message' => 'Sector creado exitosamente'
        ], 201);
    }

    /**
     * Obtener sector por ID
     */
    public function show(int $id): JsonResponse
    {
        try {
            $sector = Sector::with(['streets', 'pricingProfiles'])
                           ->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $sector
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Sector no encontrado'
            ], 404);
        }
    }

    /**
     * Actualizar sector
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'is_private' => 'boolean',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $sector = Sector::findOrFail($id);
            
            $sector->update([
                'name' => $request->name,
                'description' => $request->description,
                'is_private' => $request->boolean('is_private', $sector->is_private),
                'is_active' => $request->boolean('is_active', $sector->is_active),
            ]);

            return response()->json([
                'success' => true,
                'data' => $sector,
                'message' => 'Sector actualizado exitosamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Sector no encontrado'
            ], 404);
        }
    }

    /**
     * Obtener calles de un sector
     */
    public function streets(int $id): JsonResponse
    {
        try {
            $sector = Sector::findOrFail($id);
            $streets = $sector->streets()->orderBy('name')->get();

            return response()->json([
                'success' => true,
                'data' => $streets
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Sector no encontrado'
            ], 404);
        }
    }

    /**
     * Eliminar sector
     */
    public function destroy(int $id): JsonResponse
    {
        try {
            $sector = Sector::findOrFail($id);
            $sector->delete();

            return response()->json([
                'success' => true,
                'message' => 'Sector eliminado exitosamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Sector no encontrado'
            ], 404);
        }
    }
}
