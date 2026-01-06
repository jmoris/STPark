<?php

namespace App\Http\Controllers;

use App\Models\CarWashType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CarWashTypeController extends Controller
{
    public function index(): JsonResponse
    {
        $types = CarWashType::orderBy('name')->get();

        return response()->json([
            'success' => true,
            'data' => $types,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'price' => 'required|numeric|min:0',
            'duration_minutes' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $type = CarWashType::create([
            'name' => trim((string) $request->get('name')),
            'price' => $request->get('price'),
            'duration_minutes' => $request->get('duration_minutes'),
            'is_active' => $request->boolean('is_active', true),
        ]);

        return response()->json([
            'success' => true,
            'data' => $type,
            'message' => 'Tipo de lavado creado exitosamente',
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $type = CarWashType::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'price' => 'required|numeric|min:0',
            'duration_minutes' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $type->update([
            'name' => trim((string) $request->get('name')),
            'price' => $request->get('price'),
            'duration_minutes' => $request->get('duration_minutes'),
            'is_active' => $request->has('is_active') ? (bool) $request->get('is_active') : $type->is_active,
        ]);

        return response()->json([
            'success' => true,
            'data' => $type->fresh(),
            'message' => 'Tipo de lavado actualizado exitosamente',
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $type = CarWashType::findOrFail($id);

        if ($type->carWashes()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'No se puede eliminar un tipo que ya tiene lavados asociados',
            ], 422);
        }

        $type->delete();

        return response()->json([
            'success' => true,
            'data' => null,
            'message' => 'Tipo de lavado eliminado exitosamente',
        ]);
    }
}


