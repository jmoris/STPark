<?php

namespace App\Http\Controllers;

use App\Services\BancoCentralService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class UFController extends Controller
{
    protected $bancoCentralService;

    public function __construct(BancoCentralService $bancoCentralService)
    {
        $this->bancoCentralService = $bancoCentralService;
    }

    /**
     * Obtener el valor actual de la UF
     */
    public function getCurrentValue(): JsonResponse
    {
        try {
            $result = $this->bancoCentralService->getUFValue();

            if (!$result['success']) {
                return response()->json([
                    'success' => false,
                    'message' => $result['message'] ?? 'No se pudo obtener el valor de la UF',
                ], 500);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'value' => $result['value'],
                    'date' => $result['date'],
                    'series_id' => $result['series_id'],
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener el valor de la UF: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Obtener el valor de la UF para una fecha específica
     */
    public function getValueByDate(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'date' => 'required|date|date_format:Y-m-d',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $result = $this->bancoCentralService->getUFValue($request->date);

            if (!$result['success']) {
                return response()->json([
                    'success' => false,
                    'message' => $result['message'] ?? 'No se pudo obtener el valor de la UF para la fecha especificada',
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'value' => $result['value'],
                    'date' => $result['date'],
                    'series_id' => $result['series_id'],
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener el valor de UF: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Buscar series disponibles
     */
    public function searchSeries(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'frequency' => 'nullable|string|in:DAILY,WEEKLY,MONTHLY,QUARTERLY,SEMIANNUAL,ANNUAL',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $result = $this->bancoCentralService->searchSeries($request->frequency);

            return response()->json([
                'success' => $result['success'],
                'code' => $result['code'],
                'message' => $result['description'],
                'data' => [
                    'series' => $result['series'],
                    'series_infos' => $result['series_infos'],
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al buscar series: ' . $e->getMessage(),
            ], 500);
        }
    }
}
