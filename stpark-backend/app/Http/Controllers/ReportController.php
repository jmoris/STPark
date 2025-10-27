<?php

namespace App\Http\Controllers;

use App\Models\ParkingSession;
use App\Models\Payment;
use App\Models\Debt;
use App\Models\Operator;
use App\Models\Sector;
use App\Helpers\DatabaseHelper;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;

class ReportController extends Controller
{
    /**
     * Reporte de ventas
     */
    public function salesReport(Request $request): JsonResponse
    {
        // Limpiar valores undefined
        $data = $request->all();
        if (isset($data['sector_id']) && $data['sector_id'] === 'undefined') {
            unset($data['sector_id']);
        }
        if (isset($data['operator_id']) && $data['operator_id'] === 'undefined') {
            unset($data['operator_id']);
        }

        $validator = Validator::make($data, [
            'date_from' => 'required|date',
            'date_to' => 'required|date|after_or_equal:date_from',
            'sector_id' => 'nullable|exists:sectors,id',
            'operator_id' => 'nullable|exists:operators,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Usar ParkingSession completadas en lugar de Sale
        $query = ParkingSession::with(['sector', 'operator', 'payments'])
                    ->where('status', 'COMPLETED')
                    ->whereBetween('started_at', [$request->date_from, $request->date_to]);

        if ($request->filled('sector_id')) {
            $query->where('sector_id', $request->sector_id);
        }

        if ($request->filled('operator_id')) {
            $query->where('operator_in_id', $request->operator_id);
        }

        $sessions = $query->orderBy('started_at', 'desc')->get();

        // Calcular totales manualmente
        $totalAmount = 0;
        foreach ($sessions as $session) {
            foreach ($session->payments as $payment) {
                if ($payment->status === 'COMPLETED') {
                    $totalAmount += (float) $payment->amount;
                }
            }
        }

        $summary = [
            'period' => [
                'from' => $request->date_from,
                'to' => $request->date_to,
            ],
            'total_sales' => $sessions->count(),
            'total_amount' => $totalAmount,
            'by_sector' => $sessions->groupBy('sector.name')->map(function($group) {
                $groupTotal = 0;
                foreach ($group as $session) {
                    foreach ($session->payments as $payment) {
                        if ($payment->status === 'COMPLETED') {
                            $groupTotal += (float) $payment->amount;
                        }
                    }
                }
                return [
                    'count' => $group->count(),
                    'total' => $groupTotal,
                ];
            }),
            'by_operator' => $sessions->groupBy('operator.name')->map(function($group) {
                $groupTotal = 0;
                foreach ($group as $session) {
                    foreach ($session->payments as $payment) {
                        if ($payment->status === 'COMPLETED') {
                            $groupTotal += (float) $payment->amount;
                        }
                    }
                }
                return [
                    'count' => $group->count(),
                    'total' => $groupTotal,
                ];
            }),
            'daily_breakdown' => $sessions->groupBy(function($session) {
                return $session->started_at->format('Y-m-d');
            })->map(function($group) {
                $groupTotal = 0;
                foreach ($group as $session) {
                    foreach ($session->payments as $payment) {
                        if ($payment->status === 'COMPLETED') {
                            $groupTotal += (float) $payment->amount;
                        }
                    }
                }
                return [
                    'count' => $group->count(),
                    'total' => $groupTotal,
                ];
            }),
            'sessions' => $sessions->map(function($session) {
                $sessionTotal = 0;
                foreach ($session->payments as $payment) {
                    if ($payment->status === 'COMPLETED') {
                        $sessionTotal += (float) $payment->amount;
                    }
                }
                return [
                    'id' => $session->id,
                    'plate' => $session->plate,
                    'sector' => $session->sector->name ?? null,
                    'operator' => $session->operator->name ?? null,
                    'started_at' => $session->started_at,
                    'ended_at' => $session->ended_at,
                    'duration_minutes' => $session->getDurationInMinutes(),
                    'duration_formatted' => $session->getFormattedDuration(),
                    'amount' => $sessionTotal,
                    'payments' => $session->payments->map(function($payment) {
                        return [
                            'method' => $payment->method,
                            'amount' => $payment->amount,
                            'status' => $payment->status,
                        ];
                    }),
                ];
            }),
        ];

        return response()->json([
            'success' => true,
            'data' => $summary
        ]);
    }

    /**
     * Reporte de pagos
     */
    public function paymentsReport(Request $request): JsonResponse
    {
        // Limpiar valores undefined
        $data = $request->all();
        if (isset($data['operator_id']) && $data['operator_id'] === 'undefined') {
            unset($data['operator_id']);
        }

        $validator = Validator::make($data, [
            'date_from' => 'required|date',
            'date_to' => 'required|date|after_or_equal:date_from',
            'method' => 'nullable|in:CASH,CARD,WEBPAY,TRANSFER',
            'operator_id' => 'nullable|exists:operators,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $query = Payment::with(['parkingSession.sector', 'parkingSession.operator'])
                       ->whereBetween('created_at', [$request->date_from, $request->date_to]);

        if ($request->filled('method')) {
            $query->where('method', $request->method);
        }

        if ($request->filled('operator_id')) {
            $query->whereHas('parkingSession', function($q) use ($request) {
                $q->where('operator_in_id', $request->operator_id);
            });
        }

        $payments = $query->orderBy('created_at', 'desc')->get();

        $summary = [
            'period' => [
                'from' => $request->date_from,
                'to' => $request->date_to,
            ],
            'total_payments' => $payments->count(),
            'total_amount' => $payments->sum('amount'),
            'by_method' => $payments->groupBy('method')->map(function($group) {
                return [
                    'count' => $group->count(),
                    'total' => $group->sum('amount'),
                ];
            }),
            'by_status' => $payments->groupBy('status')->map(function($group) {
                return [
                    'count' => $group->count(),
                    'total' => $group->sum('amount'),
                ];
            }),
            'daily_breakdown' => $payments->groupBy(function($payment) {
                return $payment->created_at->format('Y-m-d');
            })->map(function($group) {
                return [
                    'count' => $group->count(),
                    'total' => $group->sum('amount'),
                ];
            }),
            'payments' => $payments,
        ];

        return response()->json([
            'success' => true,
            'data' => $summary
        ]);
    }

    /**
     * Reporte de deudas
     */
    public function debtsReport(Request $request): JsonResponse
    {
        // Limpiar valores undefined
        $data = $request->all();
        if (isset($data['sector_id']) && $data['sector_id'] === 'undefined') {
            unset($data['sector_id']);
        }
        if (isset($data['operator_id']) && $data['operator_id'] === 'undefined') {
            unset($data['operator_id']);
        }

        $validator = Validator::make($data, [
            'date_from' => 'required|date',
            'date_to' => 'required|date|after_or_equal:date_from',
            'sector_id' => 'nullable|exists:sectors,id',
            'operator_id' => 'nullable|exists:operators,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $query = Debt::with(['parkingSession.sector', 'parkingSession.operator', 'payments']);

        if ($request->filled('sector_id')) {
            $query->whereHas('parkingSession', function($q) use ($request) {
                $q->where('sector_id', $request->sector_id);
            });
        }

        if ($request->filled('operator_id')) {
            $query->whereHas('parkingSession', function($q) use ($request) {
                $q->where('operator_in_id', $request->operator_id);
            });
        }

        // Filtrar por fecha con whereBetween
        if ($request->filled('date_from') && $request->filled('date_to')) {
            $query->whereBetween('created_at', [$request->date_from, $request->date_to]);
        }

        $debts = $query->orderBy('created_at', 'desc')->get();

        $summary = [
            'period' => [
                'from' => $request->date_from,
                'to' => $request->date_to,
            ],
            'total_debts' => $debts->count(),
            'total_amount' => $debts->sum('principal_amount'),
            'by_status' => $debts->groupBy('status')->map(function($group) {
                return [
                    'count' => $group->count(),
                    'total' => $group->sum('principal_amount'),
                ];
            }),
            'by_origin' => $debts->groupBy('origin')->map(function($group) {
                return [
                    'count' => $group->count(),
                    'total' => $group->sum('principal_amount'),
                ];
            }),
            'by_sector' => $debts->groupBy('parkingSession.sector.name')->map(function($group) {
                return [
                    'count' => $group->count(),
                    'total' => $group->sum('principal_amount'),
                ];
            }),
            'debts' => $debts,
        ];

        return response()->json([
            'success' => true,
            'data' => $summary
        ]);
    }

    /**
     * Reporte por operador
     */
    public function operatorReport(Request $request): JsonResponse
    {
        // Limpiar valores undefined
        $data = $request->all();
        
        $validator = Validator::make($data, [
            'operator_id' => 'required|exists:operators,id',
            'date_from' => 'required|date',
            'date_to' => 'required|date|after_or_equal:date_from',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $operator = Operator::findOrFail($request->operator_id);

        // Sesiones creadas por el operador
        $sessions = ParkingSession::where('operator_in_id', $request->operator_id)
                                 ->whereBetween('started_at', [$request->date_from, $request->date_to])
                                 ->with(['sector', 'street'])
                                 ->get();

        // Obtener sesiones con pagos para calcular ventas
        $sessionsForSales = ParkingSession::where('operator_in_id', $request->operator_id)
                                 ->whereBetween('started_at', [$request->date_from, $request->date_to])
                                 ->where('status', 'COMPLETED')
                                 ->with(['sector', 'payments'])
                                 ->get();
        
        // Calcular total de ventas
        $salesTotal = 0;
        foreach ($sessionsForSales as $session) {
            foreach ($session->payments as $payment) {
                if ($payment->status === 'COMPLETED') {
                    $salesTotal += (float) $payment->amount;
                }
            }
        }

        // Pagos del periodo
        $payments = Payment::whereBetween('created_at', [$request->date_from, $request->date_to])
                       ->get();

        $summary = [
            'operator' => $operator,
            'period' => [
                'from' => $request->date_from,
                'to' => $request->date_to,
            ],
            'sessions' => [
                'total' => $sessions->count(),
                'active' => $sessions->where('status', 'ACTIVE')->count(),
                'completed' => $sessions->where('status', 'COMPLETED')->count(),
                'canceled' => $sessions->where('status', 'CANCELLED')->count(),
                'by_sector' => $sessions->groupBy('sector.name')->map(function($group) {
                    return $group->count();
                }),
            ],
            'sales' => [
                'total' => $sessionsForSales->count(),
                'total_amount' => $salesTotal,
                'by_doc_type' => ['NORMAL' => ['count' => $sessionsForSales->count(), 'total' => $salesTotal]],
            ],
            'payments' => [
                'total' => $payments->count(),
                'total_amount' => $payments->sum('amount'),
                'by_method' => $payments->groupBy('method')->map(function($group) {
                    return [
                        'count' => $group->count(),
                        'total' => $group->sum('amount'),
                    ];
                }),
            ],
        ];

        return response()->json([
            'success' => true,
            'data' => $summary
        ]);
    }

    /**
     * Reporte de sesiones - Todas las sesiones del período
     */
    public function sessionsReport(Request $request): JsonResponse
    {
        // Limpiar valores undefined
        $data = $request->all();
        if (isset($data['sector_id']) && $data['sector_id'] === 'undefined') {
            unset($data['sector_id']);
        }
        if (isset($data['operator_id']) && $data['operator_id'] === 'undefined') {
            unset($data['operator_id']);
        }

        $validator = Validator::make($data, [
            'date_from' => 'required|date',
            'date_to' => 'required|date|after_or_equal:date_from',
            'sector_id' => 'nullable|exists:sectors,id',
            'operator_id' => 'nullable|exists:operators,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Traer todas las sesiones independiente del estado
        $query = ParkingSession::with(['sector', 'operator', 'payments'])
                    ->whereBetween('started_at', [$request->date_from, $request->date_to]);

        if ($request->filled('sector_id')) {
            $query->where('sector_id', $request->sector_id);
        }

        if ($request->filled('operator_id')) {
            $query->where('operator_in_id', $request->operator_id);
        }

        $sessions = $query->orderBy('started_at', 'desc')->get();

        $summary = [
            'period' => [
                'from' => $request->date_from,
                'to' => $request->date_to,
            ],
            'total_sessions' => $sessions->count(),
            'by_status' => $sessions->groupBy('status')->map(function($group) {
                return $group->count();
            }),
            'by_sector' => $sessions->groupBy('sector.name')->map(function($group) {
                return $group->count();
            }),
            'by_operator' => $sessions->groupBy('operator.name')->map(function($group) {
                return $group->count();
            }),
            'sessions' => $sessions->map(function($session) {
                $sessionTotal = 0;
                foreach ($session->payments as $payment) {
                    if ($payment->status === 'COMPLETED') {
                        $sessionTotal += (float) $payment->amount;
                    }
                }
                return [
                    'id' => $session->id,
                    'plate' => $session->plate,
                    'sector' => $session->sector->name ?? null,
                    'operator' => $session->operator->name ?? null,
                    'started_at' => $session->started_at,
                    'ended_at' => $session->ended_at,
                    'status' => $session->status,
                    'duration_minutes' => $session->getDurationInMinutes(),
                    'duration_formatted' => $session->getFormattedDuration(),
                    'amount' => $sessionTotal,
                ];
            }),
        ];

        return response()->json([
            'success' => true,
            'data' => $summary
        ]);
    }

    /**
     * Dashboard con resumen general
     */
    public function dashboard(Request $request): JsonResponse
    {
        $date = $request->get('date', now()->format('Y-m-d'));
        
        // Sesiones activas (independiente de la fecha de inicio)
        $activeSessions = ParkingSession::active()
                                      ->with(['sector', 'street'])
                                      ->get();

        // Sesiones completadas del día con sus pagos
        $todaySessions = ParkingSession::whereDate('started_at', $date)
                                      ->where('status', 'COMPLETED')
                                      ->with(['sector', 'payments'])
                                      ->get();

        // Calcular total de ventas del día (suma de payments completados)
        $todaySalesTotal = 0;
        $todaySalesBySector = [];
        
        foreach ($todaySessions as $session) {
            $sessionTotal = 0;
            foreach ($session->payments as $payment) {
                if ($payment->status === 'COMPLETED') {
                    $sessionTotal += (float) $payment->amount;
                    $todaySalesTotal += (float) $payment->amount;
                }
            }
            
            if ($sessionTotal > 0 && $session->sector) {
                $sectorName = $session->sector->name;
                if (!isset($todaySalesBySector[$sectorName])) {
                    $todaySalesBySector[$sectorName] = ['count' => 0, 'total' => 0];
                }
                $todaySalesBySector[$sectorName]['count']++;
                $todaySalesBySector[$sectorName]['total'] += $sessionTotal;
            }
        }

        // Pagos del día
        $todayPayments = Payment::whereDate('created_at', $date)->get();

        // Deudas pendientes
        $pendingDebts = Debt::pending()->get();

        // Sesiones por hora del día seleccionado usando DatabaseHelper
        $hourFunction = DatabaseHelper::getHourFunction('started_at');
        $dateCondition = DatabaseHelper::getDateComparisonFunction('started_at', $date);
        
        $sessionsByHour = DB::table('parking_sessions')
                           ->selectRaw("{$hourFunction} as hour, COUNT(*) as count")
                           ->whereRaw($dateCondition)
                           ->groupBy('hour')
                           ->orderBy('hour')
                           ->get()
                           ->keyBy('hour');

        // Crear array completo de 24 horas con datos
        $hourlyData = [];
        for ($hour = 0; $hour < 24; $hour++) {
            $hourlyData[] = [
                'hour' => $hour,
                'count' => $sessionsByHour->get($hour)->count ?? 0
            ];
        }

        $dashboard = [
            'date' => $date,
            'active_sessions' => [
                'count' => $activeSessions->count(),
                'sessions' => $activeSessions,
            ],
            'sessions_by_hour' => $hourlyData,
            'today_sales' => [
                'count' => $todaySessions->count(),
                'total_amount' => $todaySalesTotal,
                'by_sector' => $todaySalesBySector,
            ],
            'today_payments' => [
                'count' => $todayPayments->count(),
                'total_amount' => $todayPayments->sum('amount'),
                'by_method' => $todayPayments->groupBy('method')->map(function($group) {
                    return [
                        'count' => $group->count(),
                        'total' => $group->sum('amount'),
                    ];
                }),
            ],
            'pending_debts' => [
                'count' => $pendingDebts->count(),
                'total_amount' => $pendingDebts->sum('principal_amount'),
            ],
        ];

        return response()->json([
            'success' => true,
            'data' => $dashboard
        ]);
    }
}
