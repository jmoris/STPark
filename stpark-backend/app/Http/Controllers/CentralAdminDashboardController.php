<?php

namespace App\Http\Controllers;

use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class CentralAdminDashboardController extends Controller
{
    /**
     * Obtener estadísticas del dashboard de administración central
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function dashboard(Request $request): JsonResponse
    {
        try {
            // Validar que el usuario sea administrador central
            $user = $request->user();
            // Aceptar tanto true como 1 (valor numérico desde la base de datos)
            if (!$user || ($user->is_central_admin !== true && $user->is_central_admin !== 1)) {
                return response()->json([
                    'success' => false,
                    'message' => 'No autorizado. Solo administradores centrales pueden acceder a esta información.'
                ], 403);
            }

            // Obtener parámetros de fecha (año y mes)
            $year = $request->input('year', date('Y'));
            $month = $request->input('month', date('m'));

            // Validar parámetros
            $year = (int) $year;
            $month = (int) $month;

            if ($month < 1 || $month > 12) {
                return response()->json([
                    'success' => false,
                    'message' => 'Mes inválido. Debe estar entre 1 y 12.'
                ], 400);
            }

            // Total de tenants
            $totalTenants = Tenant::count();

            // Tenants registrados en el mes seleccionado
            $startOfMonth = Carbon::create($year, $month, 1)->startOfMonth();
            $endOfMonth = Carbon::create($year, $month, 1)->endOfMonth();
            
            $tenantsThisMonth = Tenant::whereBetween('created_at', [$startOfMonth, $endOfMonth])->count();

            // Datos mensuales de los últimos 12 meses
            $monthlyData = $this->getMonthlyData($year, $month);

            return response()->json([
                'success' => true,
                'data' => [
                    'total' => $totalTenants,
                    'registeredThisMonth' => $tenantsThisMonth,
                    'monthlyData' => $monthlyData
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener los datos del dashboard: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener datos mensuales de los últimos 12 meses
     *
     * @param int $year
     * @param int $month
     * @return array
     */
    private function getMonthlyData(int $year, int $month): array
    {
        $monthlyData = [];
        $currentDate = Carbon::create($year, $month, 1);
        
        // Obtener los últimos 12 meses desde el mes seleccionado
        for ($i = 11; $i >= 0; $i--) {
            $targetDate = $currentDate->copy()->subMonths($i);
            $startOfMonth = $targetDate->copy()->startOfMonth();
            $endOfMonth = $targetDate->copy()->endOfMonth();
            
            $count = Tenant::whereBetween('created_at', [$startOfMonth, $endOfMonth])->count();
            
            $monthlyData[] = [
                'month' => $targetDate->format('Y-m'),
                'count' => $count
            ];
        }

        return $monthlyData;
    }
}
