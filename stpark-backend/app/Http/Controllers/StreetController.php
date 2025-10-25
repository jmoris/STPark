<?php

namespace App\Http\Controllers;

use App\Models\Street;
use App\Models\Sector;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class StreetController extends Controller
{
    /**
     * Listar calles
     */
    public function index(Request $request): JsonResponse
    {
        $query = Street::with(['sector']);

        // Aplicar filtros
        if ($request->filled('sector_id')) {
            $query->where('sector_id', $request->sector_id);
        }

        if ($request->filled('name')) {
            $query->where('name', 'like', '%' . $request->name . '%');
        }

        // Aplicar paginación
        $perPage = $request->get('per_page', 10);
        $streets = $query->orderBy('name')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'data' => $streets->items(),
                'current_page' => $streets->currentPage(),
                'last_page' => $streets->lastPage(),
                'per_page' => $streets->perPage(),
                'total' => $streets->total(),
                'from' => $streets->firstItem(),
                'to' => $streets->lastItem(),
            ]
        ]);
    }

    /**
     * Crear calle
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'sector_id' => 'required|exists:sectors,id',
            'name' => 'required|string|max:255',
            'address_number' => 'nullable|string|max:20',
            'address_type' => 'in:STREET,ADDRESS',
            'block_range' => 'nullable|string|max:50',
            'is_specific_address' => 'boolean',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $street = Street::create([
            'sector_id' => $request->sector_id,
            'name' => $request->name,
            'address_number' => $request->address_number,
            'address_type' => $request->address_type ?? 'STREET',
            'block_range' => $request->block_range,
            'is_specific_address' => $request->boolean('is_specific_address', false),
            'notes' => $request->notes,
        ]);

        return response()->json([
            'success' => true,
            'data' => $street->load('sector'),
            'message' => 'Calle creada exitosamente'
        ], 201);
    }

    /**
     * Obtener calle por ID
     */
    public function show(int $id): JsonResponse
    {
        try {
            $street = Street::with(['sector', 'parkingSessions', 'operatorAssignments'])
                           ->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $street
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Calle no encontrada'
            ], 404);
        }
    }

    /**
     * Actualizar calle
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'sector_id' => 'required|exists:sectors,id',
            'name' => 'required|string|max:255',
            'address_number' => 'nullable|string|max:20',
            'address_type' => 'in:STREET,ADDRESS',
            'block_range' => 'nullable|string|max:50',
            'is_specific_address' => 'boolean',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $street = Street::findOrFail($id);
            
            $street->update([
                'sector_id' => $request->sector_id,
                'name' => $request->name,
                'address_number' => $request->address_number,
                'address_type' => $request->address_type ?? 'STREET',
                'block_range' => $request->block_range,
                'is_specific_address' => $request->boolean('is_specific_address', false),
                'notes' => $request->notes,
            ]);

            return response()->json([
                'success' => true,
                'data' => $street->load('sector'),
                'message' => 'Calle actualizada exitosamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Calle no encontrada'
            ], 404);
        }
    }

    /**
     * Eliminar calle
     */
    public function destroy(int $id): JsonResponse
    {
        try {
            $street = Street::findOrFail($id);
            
            // Verificar si tiene sesiones de estacionamiento activas
            $activeSessions = $street->parkingSessions()
                                   ->whereNull('ended_at')
                                   ->count();
            
            if ($activeSessions > 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se puede eliminar la calle porque tiene sesiones de estacionamiento activas'
                ], 422);
            }

            $street->delete();

            return response()->json([
                'success' => true,
                'message' => 'Calle eliminada exitosamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Calle no encontrada'
            ], 404);
        }
    }
}
