<?php

namespace App\Http\Controllers;

use App\Models\Sector;
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
        $query = Sector::with(['streets']);

        if ($request->filled('is_private')) {
            $query->where('is_private', $request->boolean('is_private'));
        }

        $sectors = $query->orderBy('name')->get();

        return response()->json([
            'success' => true,
            'data' => $sectors
        ]);
    }

    /**
     * Crear sector
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'is_private' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $sector = Sector::create([
            'name' => $request->name,
            'is_private' => $request->boolean('is_private', false),
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
            'is_private' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $sector = Sector::findOrFail($id);
            
            $sector->update([
                'name' => $request->name,
                'is_private' => $request->boolean('is_private', $sector->is_private),
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
