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
use Barryvdh\DomPDF\Facade\Pdf;

class ReportController extends Controller
{
    /**
     * Normaliza las fechas para los filtros de búsqueda
     * Establece date_from a 00:00:00 y date_to a 23:59:59
     */
    private function normalizeDateRange($dateFrom, $dateTo): array
    {
        $from = Carbon::parse($dateFrom)->startOfDay();
        $to = Carbon::parse($dateTo)->endOfDay();
        
        return [$from, $to];
    }

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

        // Normalizar fechas: date_from a 00:00:00 y date_to a 23:59:59
        [$dateFrom, $dateTo] = $this->normalizeDateRange($request->date_from, $request->date_to);

        // Usar ParkingSession completadas en lugar de Sale
        // Filtrar por operator_out_id para mostrar sesiones cerradas por el operador
        $query = ParkingSession::with(['sector', 'operator', 'operatorOut', 'payments'])
                    ->where('status', 'COMPLETED')
                    ->whereBetween('started_at', [$dateFrom, $dateTo]);

        if ($request->filled('sector_id')) {
            $query->where('sector_id', $request->sector_id);
        }

        if ($request->filled('operator_id')) {
            // Usar operator_out_id para obtener sesiones cerradas por el operador
            // Si no hay operator_out_id, usar operator_in_id como fallback (sesiones antiguas)
            $query->where(function($q) use ($request) {
                $q->where('operator_out_id', $request->operator_id)
                  ->orWhere(function($subQ) use ($request) {
                      $subQ->whereNull('operator_out_id')
                           ->where('operator_in_id', $request->operator_id);
                  });
            });
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

        // Normalizar fechas: date_from a 00:00:00 y date_to a 23:59:59
        [$dateFrom, $dateTo] = $this->normalizeDateRange($request->date_from, $request->date_to);

        $query = Payment::with(['parkingSession.sector', 'parkingSession.operator'])
                       ->whereBetween('created_at', [$dateFrom, $dateTo]);

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

        // Normalizar fechas: date_from a 00:00:00 y date_to a 23:59:59
        [$dateFrom, $dateTo] = $this->normalizeDateRange($request->date_from, $request->date_to);

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
        $query->whereBetween('created_at', [$dateFrom, $dateTo]);

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

        // Normalizar fechas: date_from a 00:00:00 y date_to a 23:59:59
        [$dateFrom, $dateTo] = $this->normalizeDateRange($request->date_from, $request->date_to);

        $operator = Operator::findOrFail($request->operator_id);

        // Sesiones donde el operador hizo checkout (operator_out_id) o creó la sesión (operator_in_id)
        // Priorizar operator_out_id para cierres de turno correctos
        $sessions = ParkingSession::where(function($query) use ($request) {
                        $query->where('operator_out_id', $request->operator_id)
                              ->orWhere(function($subQuery) use ($request) {
                                  $subQuery->whereNull('operator_out_id')
                                           ->where('operator_in_id', $request->operator_id);
                              });
                    })
                                 ->whereBetween('started_at', [$dateFrom, $dateTo])
                                 ->with(['sector', 'street', 'operator', 'operatorOut'])
                                 ->get();

        // Obtener sesiones con pagos para calcular ventas (usar operator_out_id para cierres correctos)
        $sessionsForSales = ParkingSession::where(function($query) use ($request) {
                        $query->where('operator_out_id', $request->operator_id)
                              ->orWhere(function($subQuery) use ($request) {
                                  $subQuery->whereNull('operator_out_id')
                                           ->where('operator_in_id', $request->operator_id);
                              });
                    })
                                 ->whereBetween('started_at', [$dateFrom, $dateTo])
                                 ->where('status', 'COMPLETED')
                                 ->with(['sector', 'payments', 'operator', 'operatorOut'])
                                 ->get();
        
        // Calcular totales de ventas
        $totalAmount = 0;
        $cashAmount = 0;
        $cardAmount = 0;
        
        foreach ($sessionsForSales as $session) {
            foreach ($session->payments as $payment) {
                if ($payment->status === 'COMPLETED') {
                    $totalAmount += (float) $payment->amount;
                    
                    if ($payment->method === 'CASH') {
                        $cashAmount += (float) $payment->amount;
                    } else {
                        $cardAmount += (float) $payment->amount;
                    }
                }
            }
        }

        // Obtener deudas liquidadas del operador
        $settledDebtsQuery = Debt::with(['parkingSession.sector', 'parkingSession.operator', 'payments'])
                                 ->whereHas('parkingSession', function($q) use ($request) {
                                     $q->where('operator_in_id', $request->operator_id);
                                 })
                                 ->where('status', 'SETTLED');

        $settledDebtsQuery->whereBetween('updated_at', [$dateFrom, $dateTo]);

        $settledDebts = $settledDebtsQuery->orderBy('updated_at', 'desc')->get();

        $debtsDetail = [];
        foreach ($settledDebts as $debt) {
            $debtsDetail[] = [
                'id' => $debt->id,
                'plate' => $debt->parkingSession ? $debt->parkingSession->plate : 'N/A',
                'sector' => $debt->parkingSession && $debt->parkingSession->sector ? $debt->parkingSession->sector->name : 'N/A',
                'principal_amount' => $debt->principal_amount,
                'status' => $debt->status,
                'created_at' => $debt->created_at,
                'settled_at' => $debt->updated_at,
            ];
        }

        // Detalle de sesiones de venta
        $sessionDetails = [];
        foreach ($sessionsForSales as $session) {
            $sessionTotal = 0;
            $sessionCash = 0;
            $sessionCard = 0;
            
            foreach ($session->payments as $payment) {
                if ($payment->status === 'COMPLETED') {
                    $sessionTotal += (float) $payment->amount;
                    
                    if ($payment->method === 'CASH') {
                        $sessionCash += (float) $payment->amount;
                    } else {
                        $sessionCard += (float) $payment->amount;
                    }
                }
            }
            
            if ($sessionTotal > 0) {
                $durationMinutes = $session->started_at && $session->ended_at 
                    ? \Carbon\Carbon::parse($session->started_at)->diffInMinutes(\Carbon\Carbon::parse($session->ended_at))
                    : 0;
                
                $hours = floor((int)$durationMinutes / 60);
                $minutes = (int)$durationMinutes % 60;
                $durationFormatted = $hours > 0 ? "{$hours}h {$minutes}m" : "{$minutes}m";
                
                $sessionDetails[] = [
                    'operator' => $session->operator ? $session->operator->name : 'N/A',
                    'started_at' => $session->started_at,
                    'ended_at' => $session->ended_at,
                    'duration' => $durationFormatted,
                    'amount' => $sessionTotal,
                    'cash' => $sessionCash,
                    'card' => $sessionCard,
                ];
            }
        }

        $summary = [
            'operator' => $operator,
            'period' => [
                'from' => $request->date_from,
                'to' => $request->date_to,
            ],
            'total_sales' => $sessionsForSales->count(),
            'total_amount' => $totalAmount,
            'cash_amount' => $cashAmount,
            'card_amount' => $cardAmount,
            'sessions_detail' => $sessionDetails,
            'by_sector' => $sessionsForSales->groupBy('sector.name')->map(function($group) {
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
            // Deudas liquidadas
            'total_debts' => $settledDebts->count(),
            'debts_total_amount' => $settledDebts->sum('principal_amount'),
            'debts_detail' => $debtsDetail,
            'debts_by_status' => $settledDebts->groupBy('status')->map(function($group) {
                return [
                    'count' => $group->count(),
                    'total' => $group->sum('principal_amount'),
                ];
            }),
            'debts_by_sector' => $settledDebts->groupBy('parkingSession.sector.name')->map(function($group) {
                return [
                    'count' => $group->count(),
                    'total' => $group->sum('principal_amount'),
                ];
            }),
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

        // Normalizar fechas: date_from a 00:00:00 y date_to a 23:59:59
        [$dateFrom, $dateTo] = $this->normalizeDateRange($request->date_from, $request->date_to);

        // Traer todas las sesiones independiente del estado
        $query = ParkingSession::with(['sector', 'operator', 'payments'])
                    ->whereBetween('started_at', [$dateFrom, $dateTo]);

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

    /**
     * Generar PDF de Reporte de Ventas
     */
    public function salesReportPdf(Request $request)
    {
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

        // Normalizar fechas: date_from a 00:00:00 y date_to a 23:59:59
        [$dateFrom, $dateTo] = $this->normalizeDateRange($request->date_from, $request->date_to);

        $query = ParkingSession::with(['sector', 'operator', 'payments'])
                    ->where('status', 'COMPLETED')
                    ->whereBetween('started_at', [$dateFrom, $dateTo]);

        if ($request->filled('sector_id')) {
            $query->where('sector_id', $request->sector_id);
        }

        if ($request->filled('operator_id')) {
            $query->where('operator_in_id', $request->operator_id);
        }

        $sessions = $query->orderBy('started_at', 'desc')->get();

        $totalAmount = 0;
        $cashAmount = 0;
        $cardAmount = 0;
        
        $sessionDetails = [];
        
        foreach ($sessions as $session) {
            $sessionTotal = 0;
            $sessionCash = 0;
            $sessionCard = 0;
            
            foreach ($session->payments as $payment) {
                if ($payment->status === 'COMPLETED') {
                    $sessionTotal += (float) $payment->amount;
                    $totalAmount += (float) $payment->amount;
                    
                    if ($payment->method === 'CASH') {
                        $sessionCash += (float) $payment->amount;
                        $cashAmount += (float) $payment->amount;
                    } else {
                        $sessionCard += (float) $payment->amount;
                        $cardAmount += (float) $payment->amount;
                    }
                }
            }
            
            if ($sessionTotal > 0) {
                $durationMinutes = $session->started_at && $session->ended_at 
                    ? \Carbon\Carbon::parse($session->started_at)->diffInMinutes(\Carbon\Carbon::parse($session->ended_at))
                    : 0;
                
                $hours = floor((int)$durationMinutes / 60);
                $minutes = (int)$durationMinutes % 60;
                $durationFormatted = $hours > 0 ? "{$hours}h {$minutes}m" : "{$minutes}m";
                
                $sessionDetails[] = [
                    'operator' => $session->operator ? $session->operator->name : 'N/A',
                    'plate' => $session->plate,
                    'started_at' => $session->started_at,
                    'ended_at' => $session->ended_at,
                    'duration' => $durationFormatted,
                    'amount' => $sessionTotal,
                ];
            }
        }

        $summary = [
            'period' => [
                'from' => $request->date_from,
                'to' => $request->date_to,
            ],
            'total_sales' => $sessions->count(),
            'total_amount' => $totalAmount,
            'cash_amount' => $cashAmount,
            'card_amount' => $cardAmount,
            'sessions_detail' => $sessionDetails,
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
        ];

        $pdf = Pdf::loadView('reports.sales', ['data' => $summary]);
        return $pdf->download('reporte-ventas-' . now()->format('Y-m-d') . '.pdf');
    }

    /**
     * Generar PDF de Reporte de Deudas
     */
    public function debtsReportPdf(Request $request)
    {
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

        // Normalizar fechas: date_from a 00:00:00 y date_to a 23:59:59
        [$dateFrom, $dateTo] = $this->normalizeDateRange($request->date_from, $request->date_to);

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

        $query->whereBetween('created_at', [$dateFrom, $dateTo]);

        $debts = $query->orderBy('created_at', 'desc')->get();

        $debtsDetail = [];
        foreach ($debts as $debt) {
            $debtsDetail[] = [
                'id' => $debt->id,
                'plate' => $debt->parkingSession ? $debt->parkingSession->plate : 'N/A',
                'sector' => $debt->parkingSession && $debt->parkingSession->sector ? $debt->parkingSession->sector->name : 'N/A',
                'principal_amount' => $debt->principal_amount,
                'status' => $debt->status,
                'created_at' => $debt->created_at,
            ];
        }

        $summary = [
            'period' => [
                'from' => $request->date_from,
                'to' => $request->date_to,
            ],
            'total_debts' => $debts->count(),
            'total_amount' => $debts->sum('principal_amount'),
            'debts_detail' => $debtsDetail,
            'by_status' => $debts->groupBy('status')->map(function($group) {
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
        ];

        $pdf = Pdf::loadView('reports.debts', ['data' => $summary]);
        return $pdf->download('reporte-deudas-' . now()->format('Y-m-d') . '.pdf');
    }

    /**
     * Generar PDF de Reporte por Operador
     */
    public function operatorReportPdf(Request $request)
    {
        // Reutilizar el mismo método que genera el JSON
        $response = $this->operatorReport($request);
        $responseData = json_decode($response->getContent(), true);
        
        if (!$responseData['success']) {
            return response()->json(['errors' => 'Error generating report'], 422);
        }

        $pdf = Pdf::loadView('reports.operator', ['data' => $responseData['data']]);
        return $pdf->download('reporte-operador-' . $responseData['data']['operator']['name'] . '-' . now()->format('Y-m-d') . '.pdf');
    }

    /**
     * Generar PDF de Reporte de Sesiones
     */
    public function sessionsReportPdf(Request $request)
    {
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

        // Normalizar fechas: date_from a 00:00:00 y date_to a 23:59:59
        [$dateFrom, $dateTo] = $this->normalizeDateRange($request->date_from, $request->date_to);

        $query = ParkingSession::with(['sector', 'operator', 'payments'])
                    ->whereBetween('started_at', [$dateFrom, $dateTo]);

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
        ];

        $pdf = Pdf::loadView('reports.sessions', ['data' => $summary]);
        return $pdf->download('reporte-sesiones-' . now()->format('Y-m-d') . '.pdf');
    }
}
