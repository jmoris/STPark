<?php

namespace App\Http\Controllers;

use App\Models\Operator;
use App\Models\OperatorAssignment;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class OperatorController extends Controller
{
    /**
     * Listar operadores
     */
    public function index(Request $request): JsonResponse
    {
        $query = Operator::with(['operatorAssignments.sector', 'operatorAssignments.street']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $operators = $query->orderBy('name')->get();

        return response()->json([
            'success' => true,
            'data' => $operators
        ]);
    }

    /**
     * Crear operador
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'rut' => 'required|string|unique:operators,rut',
            'status' => 'in:ACTIVE,INACTIVE',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $operator = Operator::create([
            'name' => $request->name,
            'rut' => $request->rut,
            'status' => $request->status ?? 'ACTIVE',
        ]);

        return response()->json([
            'success' => true,
            'data' => $operator,
            'message' => 'Operador creado exitosamente'
        ], 201);
    }

    /**
     * Obtener operador por ID
     */
    public function show(int $id): JsonResponse
    {
        try {
            $operator = Operator::with([
                'operatorAssignments.sector',
                'operatorAssignments.street',
                'parkingSessions',
                'sales'
            ])->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $operator
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Operador no encontrado'
            ], 404);
        }
    }

    /**
     * Actualizar operador
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'rut' => 'required|string|unique:operators,rut,' . $id,
            'status' => 'in:ACTIVE,INACTIVE',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $operator = Operator::findOrFail($id);
            
            $operator->update([
                'name' => $request->name,
                'rut' => $request->rut,
                'status' => $request->status,
            ]);

            return response()->json([
                'success' => true,
                'data' => $operator,
                'message' => 'Operador actualizado exitosamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Operador no encontrado'
            ], 404);
        }
    }

    /**
     * Asignar operador a sector/calle
     */
    public function assign(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'sector_id' => 'required|exists:sectors,id',
            'street_id' => 'nullable|exists:streets,id',
            'valid_from' => 'required|date',
            'valid_to' => 'nullable|date|after:valid_from',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $operator = Operator::findOrFail($id);

            $assignment = OperatorAssignment::create([
                'operator_id' => $id,
                'sector_id' => $request->sector_id,
                'street_id' => $request->street_id,
                'valid_from' => $request->valid_from,
                'valid_to' => $request->valid_to,
            ]);

            return response()->json([
                'success' => true,
                'data' => $assignment->load(['sector', 'street']),
                'message' => 'Asignación creada exitosamente'
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al asignar operador: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener sectores asignados al operador
     */
    public function assignments(int $id): JsonResponse
    {
        try {
            $operator = Operator::findOrFail($id);
            
            $assignments = $operator->operatorAssignments()
                                  ->with(['sector', 'street'])
                                  ->where('valid_from', '<=', now())
                                  ->where(function($query) {
                                      $query->whereNull('valid_to')
                                            ->orWhere('valid_to', '>=', now());
                                  })
                                  ->get();

            return response()->json([
                'success' => true,
                'data' => $assignments
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Operador no encontrado'
            ], 404);
        }
    }
}
