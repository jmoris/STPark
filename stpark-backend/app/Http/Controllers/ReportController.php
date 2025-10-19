<?php

namespace App\Http\Controllers;

use App\Models\ParkingSession;
use App\Models\Sale;
use App\Models\Payment;
use App\Models\Debt;
use App\Models\Operator;
use App\Models\Sector;
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
        $validator = Validator::make($request->all(), [
            'date_from' => 'required|date',
            'date_to' => 'required|date|after_or_equal:date_from',
            'sector_id' => 'nullable|exists:sectors,id',
            'operator_id' => 'nullable|exists:operators,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $query = Sale::with(['parkingSession.sector', 'cashierOperator', 'payments'])
                    ->whereBetween('created_at', [$request->date_from, $request->date_to]);

        if ($request->filled('sector_id')) {
            $query->whereHas('parkingSession', function($q) use ($request) {
                $q->where('sector_id', $request->sector_id);
            });
        }

        if ($request->filled('operator_id')) {
            $query->where('cashier_operator_id', $request->operator_id);
        }

        $sales = $query->orderBy('created_at', 'desc')->get();

        $summary = [
            'period' => [
                'from' => $request->date_from,
                'to' => $request->date_to,
            ],
            'total_sales' => $sales->count(),
            'total_amount' => $sales->sum('total'),
            'total_tax' => $sales->sum('tax'),
            'total_net' => $sales->sum('net'),
            'by_sector' => $sales->groupBy('parkingSession.sector.name')->map(function($group) {
                return [
                    'count' => $group->count(),
                    'total' => $group->sum('total'),
                ];
            }),
            'by_operator' => $sales->groupBy('cashierOperator.name')->map(function($group) {
                return [
                    'count' => $group->count(),
                    'total' => $group->sum('total'),
                ];
            }),
            'daily_breakdown' => $sales->groupBy(function($sale) {
                return $sale->created_at->format('Y-m-d');
            })->map(function($group) {
                return [
                    'count' => $group->count(),
                    'total' => $group->sum('total'),
                ];
            }),
            'sales' => $sales,
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
        $validator = Validator::make($request->all(), [
            'date_from' => 'required|date',
            'date_to' => 'required|date|after_or_equal:date_from',
            'method' => 'nullable|in:CASH,CARD,WEBPAY,TRANSFER',
            'operator_id' => 'nullable|exists:operators,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $query = Payment::with(['sale', 'parkingSession.sector'])
                       ->whereBetween('created_at', [$request->date_from, $request->date_to]);

        if ($request->filled('method')) {
            $query->where('method', $request->method);
        }

        if ($request->filled('operator_id')) {
            $query->whereHas('sale', function($q) use ($request) {
                $q->where('cashier_operator_id', $request->operator_id);
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
        $validator = Validator::make($request->all(), [
            'status' => 'nullable|in:PENDING,SETTLED,CANCELLED',
            'origin' => 'nullable|in:SESSION,FINE,MANUAL',
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date|after_or_equal:date_from',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $query = Debt::with(['parkingSession.sector', 'payments']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('origin')) {
            $query->where('origin', $request->origin);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        $debts = $query->orderBy('created_at', 'desc')->get();

        $summary = [
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
        $validator = Validator::make($request->all(), [
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

        // Ventas como cajero
        $sales = Sale::where('cashier_operator_id', $request->operator_id)
                    ->whereBetween('created_at', [$request->date_from, $request->date_to])
                    ->with(['parkingSession'])
                    ->get();

        // Pagos procesados
        $payments = Payment::whereHas('sale', function($q) use ($request) {
                           $q->where('cashier_operator_id', $request->operator_id);
                       })
                       ->whereBetween('created_at', [$request->date_from, $request->date_to])
                       ->get();

        $summary = [
            'operator' => $operator,
            'period' => [
                'from' => $request->date_from,
                'to' => $request->date_to,
            ],
            'sessions' => [
                'total' => $sessions->count(),
                'active' => $sessions->where('status', ParkingSession::STATUS_ACTIVE)->count(),
                'completed' => $sessions->where('status', ParkingSession::STATUS_CLOSED)->count(),
                'canceled' => $sessions->where('status', ParkingSession::STATUS_CANCELED)->count(),
                'by_sector' => $sessions->groupBy('sector.name')->map(function($group) {
                    return $group->count();
                }),
            ],
            'sales' => [
                'total' => $sales->count(),
                'total_amount' => $sales->sum('total'),
                'by_doc_type' => $sales->groupBy('doc_type')->map(function($group) {
                    return [
                        'count' => $group->count(),
                        'total' => $group->sum('total'),
                    ];
                }),
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
     * Dashboard con resumen general
     */
    public function dashboard(Request $request): JsonResponse
    {
        $date = $request->get('date', now()->format('Y-m-d'));
        
        // Sesiones activas
        $activeSessions = ParkingSession::active()
                                      ->whereDate('started_at', $date)
                                      ->with(['sector', 'street'])
                                      ->get();

        // Ventas del día
        $todaySales = Sale::whereDate('created_at', $date)->get();

        // Pagos del día
        $todayPayments = Payment::whereDate('created_at', $date)->get();

        // Deudas pendientes
        $pendingDebts = Debt::pending()->get();

        $dashboard = [
            'date' => $date,
            'active_sessions' => [
                'count' => $activeSessions->count(),
                'sessions' => $activeSessions,
            ],
            'today_sales' => [
                'count' => $todaySales->count(),
                'total_amount' => $todaySales->sum('total'),
                'by_sector' => $todaySales->groupBy('parkingSession.sector.name')->map(function($group) {
                    return [
                        'count' => $group->count(),
                        'total' => $group->sum('total'),
                    ];
                }),
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
