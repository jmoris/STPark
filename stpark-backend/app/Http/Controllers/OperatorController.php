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
        $query = Operator::with(['sectors', 'streets']);

        // Aplicar filtros
        if ($request->filled('name')) {
            $query->where('name', 'like', '%' . $request->name . '%');
        }

        if ($request->filled('status') && $request->get('status') !== 'undefined') {
            $query->where('status', $request->status);
        }

        if ($request->filled('sector') && $request->get('sector') !== 'undefined') {
            $query->whereHas('sectors', function($q) use ($request) {
                $q->where('sectors.id', $request->sector);
            });
        }

        // Aplicar paginación
        $perPage = $request->get('per_page', 10);
        $operators = $query->orderBy('name')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => [
                'data' => $operators->items(),
                'current_page' => $operators->currentPage(),
                'last_page' => $operators->lastPage(),
                'per_page' => $operators->perPage(),
                'total' => $operators->total(),
                'from' => $operators->firstItem(),
                'to' => $operators->lastItem(),
            ]
        ]);
    }

    /**
     * Obtener todos los operadores (sin paginación)
     */
    public function all(): JsonResponse
    {
        $operators = Operator::with(['sectors', 'streets'])
            ->where('status', 'ACTIVE')
            ->orderBy('name')
            ->get();

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
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:20',
            'pin' => 'nullable|string|size:6',
            'status' => 'in:ACTIVE,INACTIVE',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $operator = Operator::create([
            'name' => $request->name,
            'rut' => $request->rut,
            'email' => $request->email,
            'phone' => $request->phone,
            'pin' => $request->pin,
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
                'sectors',
                'streets',
                'parkingSessions'
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
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:20',
            'pin' => 'nullable|string|size:6',
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
                'email' => $request->email,
                'phone' => $request->phone,
                'pin' => $request->pin,
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
     * Elimina todas las asignaciones anteriores antes de crear la nueva
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

            // Eliminar todas las asignaciones anteriores del operador
            $deletedAssignments = OperatorAssignment::where('operator_id', $id)->delete();

            // Crear la nueva asignación
            $assignment = OperatorAssignment::create([
                'operator_id' => $id,
                'sector_id' => $request->sector_id,
                'street_id' => $request->street_id,
                'valid_from' => $request->valid_from,
                'valid_to' => $request->valid_to,
            ]);

            $message = 'Asignación creada exitosamente';
            if ($deletedAssignments > 0) {
                $message .= " (se eliminaron {$deletedAssignments} asignación" . ($deletedAssignments > 1 ? 'es' : '') . " anterior" . ($deletedAssignments > 1 ? 'es' : '') . ")";
            }

            return response()->json([
                'success' => true,
                'data' => $assignment->load(['sector', 'street']),
                'message' => $message
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al asignar operador: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Eliminar todas las asignaciones de un operador
     */
    public function removeAllAssignments(int $id): JsonResponse
    {
        try {
            $operator = Operator::findOrFail($id);

            // Eliminar todas las asignaciones del operador
            $deletedCount = OperatorAssignment::where('operator_id', $id)->delete();

            $message = 'Todas las asignaciones han sido eliminadas';
            if ($deletedCount > 0) {
                $message .= " ({$deletedCount} asignación" . ($deletedCount > 1 ? 'es' : '') . " eliminada" . ($deletedCount > 1 ? 's' : '') . ")";
            } else {
                $message = 'El operador no tenía asignaciones activas';
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'operator_id' => $id,
                    'deleted_assignments' => $deletedCount
                ],
                'message' => $message
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar asignaciones: ' . $e->getMessage()
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

    /**
     * Actualizar PIN del operador
     */
    public function updatePin(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'pin' => 'required|string|size:6',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $operator = Operator::findOrFail($id);
            
            $operator->update([
                'pin' => $request->pin,
            ]);

            return response()->json([
                'success' => true,
                'data' => $operator,
                'message' => 'PIN actualizado exitosamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Operador no encontrado'
            ], 404);
        }
    }

    /**
     * Actualizar perfil del operador
     */
    public function updateProfile(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'nullable|string|max:255',
            'pin' => 'nullable|string|size:6',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $operator = Operator::findOrFail($id);
            
            $updateData = [];
            
            // Solo actualizar nombre si está presente
            if ($request->filled('name')) {
                $updateData['name'] = $request->name;
            }
            
            // Solo actualizar PIN si está presente (no vacío)
            if ($request->filled('pin') && $request->pin !== '') {
                $updateData['pin'] = $request->pin;
            }
            
            if (count($updateData) > 0) {
                $operator->update($updateData);
            }

            return response()->json([
                'success' => true,
                'data' => $operator,
                'message' => 'Perfil actualizado exitosamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Operador no encontrado'
            ], 404);
        }
    }
}
