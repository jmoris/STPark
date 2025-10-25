<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\ParkingSession;
use App\Models\Debt;
use Carbon\Carbon;

class StatsController extends Controller
{
    /**
     * Obtener estadísticas del día (incluye sesiones activas históricas)
     */
    public function getDailyStats(): JsonResponse
    {
        try {
            $today = Carbon::today();
            $tomorrow = Carbon::tomorrow();

            // Vehículos activos históricos (todas las sesiones activas sin importar cuándo empezaron)
            $activeVehicles = ParkingSession::where('status', 'ACTIVE')
                ->count();

            // Vehículos finalizados del día (sesiones completadas hoy)
            $completedVehicles = ParkingSession::where('status', 'COMPLETED')
                ->whereDate('ended_at', $today)
                ->count();

            // Vehículos con deuda histórica (deudas pendientes de cualquier fecha)
            $vehiclesWithDebt = Debt::where('status', 'PENDING')
                ->distinct('plate')
                ->count();

            // Estadísticas adicionales
            $totalRevenue = ParkingSession::where('status', 'COMPLETED')
                ->whereDate('ended_at', $today)
                ->sum('gross_amount');

            $totalDebtAmount = Debt::where('status', 'PENDING')
                ->sum('principal_amount');

            $stats = [
                'date' => $today->format('Y-m-d'),
                'active_vehicles' => $activeVehicles,
                'completed_vehicles' => $completedVehicles,
                'vehicles_with_debt' => $vehiclesWithDebt,
                'total_revenue' => $totalRevenue,
                'total_debt_amount' => $totalDebtAmount,
                'summary' => [
                    'total_sessions_today' => $completedVehicles, // Solo sesiones completadas hoy
                    'active_sessions_historical' => $activeVehicles, // Sesiones activas históricas
                    'completion_rate' => $completedVehicles > 0 ? 
                        round(($completedVehicles / ($activeVehicles + $completedVehicles)) * 100, 1) : 0,
                ]
            ];

            return response()->json([
                'success' => true,
                'data' => $stats
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener estadísticas: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener estadísticas por rango de fechas
     */
    public function getStatsByDateRange(Request $request): JsonResponse
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        try {
            $startDate = Carbon::parse($request->start_date)->startOfDay();
            $endDate = Carbon::parse($request->end_date)->endOfDay();

            $activeVehicles = ParkingSession::where('status', 'ACTIVE')
                ->whereBetween('started_at', [$startDate, $endDate])
                ->count();

            $completedVehicles = ParkingSession::where('status', 'COMPLETED')
                ->whereBetween('ended_at', [$startDate, $endDate])
                ->count();

            $totalRevenue = ParkingSession::where('status', 'COMPLETED')
                ->whereBetween('ended_at', [$startDate, $endDate])
                ->sum('gross_amount');

            $stats = [
                'start_date' => $startDate->format('Y-m-d'),
                'end_date' => $endDate->format('Y-m-d'),
                'active_vehicles' => $activeVehicles,
                'completed_vehicles' => $completedVehicles,
                'total_revenue' => $totalRevenue,
                'summary' => [
                    'total_sessions' => $activeVehicles + $completedVehicles,
                    'completion_rate' => $completedVehicles > 0 ? 
                        round(($completedVehicles / ($activeVehicles + $completedVehicles)) * 100, 1) : 0,
                ]
            ];

            return response()->json([
                'success' => true,
                'data' => $stats
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener estadísticas: ' . $e->getMessage()
            ], 500);
        }
    }
}