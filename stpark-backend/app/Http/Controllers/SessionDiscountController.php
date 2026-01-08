<?php

namespace App\Http\Controllers;

use App\Models\SessionDiscount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SessionDiscountController extends Controller
{
    /**
     * Listar todos los descuentos
     */
    public function index(): JsonResponse
    {
        $discounts = SessionDiscount::orderBy('priority', 'desc')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $discounts
        ]);
    }

    /**
     * Obtener un descuento por ID
     */
    public function show(int $id): JsonResponse
    {
        $discount = SessionDiscount::find($id);

        if (!$discount) {
            return response()->json([
                'success' => false,
                'message' => 'Descuento no encontrado'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $discount
        ]);
    }

    /**
     * Crear un nuevo descuento
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'discount_type' => 'required|in:AMOUNT,PERCENTAGE,PRICING_PROFILE',
            'value' => 'nullable|numeric|min:0',
            'max_amount' => 'nullable|numeric|min:0',
            'minute_value' => 'nullable|numeric|min:0',
            'min_amount' => 'nullable|numeric|min:0',
            'is_active' => 'boolean',
            'priority' => 'integer|min:0',
            'valid_from' => 'nullable|date',
            'valid_until' => 'nullable|date|after_or_equal:valid_from',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        // Validar campos según el tipo de descuento
        $discountType = $request->input('discount_type');
        
        if ($discountType === 'AMOUNT' && !$request->has('value')) {
            return response()->json([
                'success' => false,
                'message' => 'El campo value es obligatorio para descuentos por monto'
            ], 422);
        }

        if ($discountType === 'PERCENTAGE' && !$request->has('value')) {
            return response()->json([
                'success' => false,
                'message' => 'El campo value es obligatorio para descuentos por porcentaje'
            ], 422);
        }

        if ($discountType === 'PRICING_PROFILE' && !$request->has('minute_value')) {
            return response()->json([
                'success' => false,
                'message' => 'El campo minute_value es obligatorio para perfiles de precio'
            ], 422);
        }

        $discount = SessionDiscount::create($request->all());

        return response()->json([
            'success' => true,
            'data' => $discount,
            'message' => 'Descuento creado exitosamente'
        ], 201);
    }

    /**
     * Actualizar un descuento
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $discount = SessionDiscount::find($id);

        if (!$discount) {
            return response()->json([
                'success' => false,
                'message' => 'Descuento no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'discount_type' => 'sometimes|required|in:AMOUNT,PERCENTAGE,PRICING_PROFILE',
            'value' => 'nullable|numeric|min:0',
            'max_amount' => 'nullable|numeric|min:0',
            'minute_value' => 'nullable|numeric|min:0',
            'min_amount' => 'nullable|numeric|min:0',
            'is_active' => 'boolean',
            'priority' => 'integer|min:0',
            'valid_from' => 'nullable|date',
            'valid_until' => 'nullable|date|after_or_equal:valid_from',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        // Validar campos según el tipo de descuento si se está cambiando
        $discountType = $request->input('discount_type', $discount->discount_type);
        
        if ($discountType === 'AMOUNT' && !$request->has('value') && !$discount->value) {
            return response()->json([
                'success' => false,
                'message' => 'El campo value es obligatorio para descuentos por monto'
            ], 422);
        }

        if ($discountType === 'PERCENTAGE' && !$request->has('value') && !$discount->value) {
            return response()->json([
                'success' => false,
                'message' => 'El campo value es obligatorio para descuentos por porcentaje'
            ], 422);
        }

        if ($discountType === 'PRICING_PROFILE' && !$request->has('minute_value') && !$discount->minute_value) {
            return response()->json([
                'success' => false,
                'message' => 'El campo minute_value es obligatorio para perfiles de precio'
            ], 422);
        }

        $discount->update($request->all());

        return response()->json([
            'success' => true,
            'data' => $discount->fresh(),
            'message' => 'Descuento actualizado exitosamente'
        ]);
    }

    /**
     * Eliminar un descuento
     */
    public function destroy(int $id): JsonResponse
    {
        $discount = SessionDiscount::find($id);

        if (!$discount) {
            return response()->json([
                'success' => false,
                'message' => 'Descuento no encontrado'
            ], 404);
        }

        $discount->delete();

        return response()->json([
            'success' => true,
            'message' => 'Descuento eliminado exitosamente'
        ]);
    }
}


