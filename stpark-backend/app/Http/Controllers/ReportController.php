<?php

namespace App\Http\Controllers;

use App\Models\ParkingSession;
use App\Models\Payment;
use App\Models\Debt;
use App\Models\Operator;
use App\Models\Sector;
use App\Models\Shift;
use App\Models\PricingProfile;
use App\Models\PricingRule;
use App\Models\CarWash;
use App\Models\Settings;
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

    private function isCarWashEnabled(): bool
    {
        try {
            $setting = Settings::where('key', 'general')->first();
            $cfg = $setting?->value;
            return (bool) ($cfg['car_wash_enabled'] ?? false);
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * Obtiene el horario de trabajo basado en los perfiles de precios del tenant
     * Retorna un array con 'start_hour' y 'end_hour' en formato HH:mm
     * Si end_hour es menor que start_hour, significa que cruza medianoche
     */
    private function getWorkingHoursFromPricingProfiles(): array
    {
        // Obtener todos los sectores del tenant
        $sectors = Sector::where('is_active', true)->get();
        
        if ($sectors->isEmpty()) {
            // Si no hay sectores, usar horario por defecto (00:00 a 23:59)
            return ['start_hour' => '00:00', 'end_hour' => '23:59'];
        }
        
        $earliestStart = null;
        $latestEnd = null;
        
        // Obtener todos los perfiles de precios activos
        $pricingProfiles = PricingProfile::whereIn('sector_id', $sectors->pluck('id'))
            ->where('is_active', true)
            ->get();
        
        if ($pricingProfiles->isEmpty()) {
            // Si no hay perfiles, usar horario por defecto
            return ['start_hour' => '00:00', 'end_hour' => '23:59'];
        }
        
        // Obtener todas las reglas activas de los perfiles
        $pricingRules = PricingRule::whereIn('profile_id', $pricingProfiles->pluck('id'))
            ->where('is_active', true)
            ->whereNotNull('start_time')
            ->whereNotNull('end_time')
            ->get();
        
        if ($pricingRules->isEmpty()) {
            // Si no hay reglas con horarios, usar horario por defecto
            return ['start_hour' => '00:00', 'end_hour' => '23:59'];
        }
        
        // Encontrar la hora de inicio más temprana y la hora de fin más tardía
        foreach ($pricingRules as $rule) {
            $startTime = $rule->start_time;
            $endTime = $rule->end_time;
            
            // Normalizar formato (asegurar HH:mm:ss)
            if (strlen($startTime) == 5) {
                $startTime .= ':00';
            }
            if (strlen($endTime) == 5) {
                $endTime .= ':00';
            }
            
            // Extraer solo hora y minuto (HH:mm)
            $startHour = substr($startTime, 0, 5);
            $endHour = substr($endTime, 0, 5);
            
            // Convertir a minutos desde medianoche para comparar
            $startMinutes = $this->timeToMinutes($startHour);
            $endMinutes = $this->timeToMinutes($endHour);
            
            // Si end_hour es menor que start_hour, significa que cruza medianoche
            // En ese caso, end_hour realmente es del día siguiente
            if ($endMinutes < $startMinutes) {
                // Cruza medianoche: end_hour es del día siguiente
                $endMinutes += 24 * 60; // Agregar 24 horas
            }
            
            // Actualizar earliestStart y latestEnd
            if ($earliestStart === null || $startMinutes < $earliestStart) {
                $earliestStart = $startMinutes;
            }
            
            if ($latestEnd === null || $endMinutes > $latestEnd) {
                $latestEnd = $endMinutes;
            }
        }
        
        // Convertir de vuelta a formato HH:mm
        $startHour = $this->minutesToTime($earliestStart);
        
        // Si latestEnd es >= 24 horas, significa que cruza medianoche
        if ($latestEnd >= 24 * 60) {
            $latestEnd -= 24 * 60;
        }
        $endHour = $this->minutesToTime($latestEnd);
        
        return [
            'start_hour' => $startHour,
            'end_hour' => $endHour
        ];
    }

    /**
     * Convierte una hora en formato HH:mm a minutos desde medianoche
     */
    private function timeToMinutes(string $time): int
    {
        list($hours, $minutes) = explode(':', $time);
        return (int)$hours * 60 + (int)$minutes;
    }

    /**
     * Convierte minutos desde medianoche a formato HH:mm
     */
    private function minutesToTime(int $minutes): string
    {
        $hours = floor($minutes / 60);
        $mins = $minutes % 60;
        return sprintf('%02d:%02d', $hours, $mins);
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

        $supportedMethods = [Payment::METHOD_CASH, Payment::METHOD_CARD];

        // Ingresos de estacionamiento: SOLO pagos completados CASH/CARD por paid_at,
        // y sólo sesiones completadas. Esto evita ruido (WEBPAY/TRANSFER) no funcional.
        $parkingPaymentsBase = Payment::completed()
            ->whereIn('method', $supportedMethods)
            ->whereBetween('paid_at', [$dateFrom, $dateTo])
            ->whereHas('parkingSession', function ($q) use ($request) {
                $q->where('status', 'COMPLETED');

                if ($request->filled('sector_id')) {
                    $q->where('sector_id', $request->sector_id);
                }

                if ($request->filled('operator_id')) {
                    // Sesiones cerradas por el operador (operator_out_id), con fallback a operator_in_id
                    $operatorId = $request->operator_id;
                    $q->where(function ($qq) use ($operatorId) {
                        $qq->where('operator_out_id', $operatorId)
                            ->orWhere(function ($subQ) use ($operatorId) {
                                $subQ->whereNull('operator_out_id')
                                    ->where('operator_in_id', $operatorId);
                            });
                    });
                }
            });

        $parkingCashAmount = (clone $parkingPaymentsBase)
            ->where('method', Payment::METHOD_CASH)
            ->sum('amount');

        $parkingCardAmount = (clone $parkingPaymentsBase)
            ->where('method', Payment::METHOD_CARD)
            ->sum('amount');

        $parkingTotalAmount = (float) $parkingCashAmount + (float) $parkingCardAmount;

        // Safety net: monto en métodos no soportados (NO se suma a totales)
        $parkingOtherAmount = Payment::completed()
            ->whereNotIn('method', $supportedMethods)
            ->whereBetween('paid_at', [$dateFrom, $dateTo])
            ->whereHas('parkingSession', function ($q) use ($request) {
                $q->where('status', 'COMPLETED');

                if ($request->filled('sector_id')) {
                    $q->where('sector_id', $request->sector_id);
                }

                if ($request->filled('operator_id')) {
                    $operatorId = $request->operator_id;
                    $q->where(function ($qq) use ($operatorId) {
                        $qq->where('operator_out_id', $operatorId)
                            ->orWhere(function ($subQ) use ($operatorId) {
                                $subQ->whereNull('operator_out_id')
                                    ->where('operator_in_id', $operatorId);
                            });
                    });
                }
            })
            ->sum('amount');

        // Sesiones incluidas: sólo aquellas con pagos CASH/CARD en el rango
        $parkingSessionIds = (clone $parkingPaymentsBase)
            ->whereNotNull('session_id')
            ->distinct()
            ->pluck('session_id');

        $sessions = ParkingSession::with([
            'sector',
            'operator',
            'operatorOut',
            'payments' => function ($q) use ($supportedMethods, $dateFrom, $dateTo) {
                $q->where('status', Payment::STATUS_COMPLETED)
                    ->whereIn('method', $supportedMethods)
                    ->whereBetween('paid_at', [$dateFrom, $dateTo]);
            }
        ])
            ->whereIn('id', $parkingSessionIds)
            ->orderBy('started_at', 'desc')
            ->get();

        // Autolavado: payment_type 'cash'|'card'
        $carWashesBase = CarWash::query()
            ->where('status', 'PAID')
            ->whereBetween('paid_at', [$dateFrom, $dateTo]);

        if ($request->filled('sector_id')) {
            $carWashesBase->whereHas('session', function ($q) use ($request) {
                $q->where('sector_id', $request->sector_id);
            });
        }

        if ($request->filled('operator_id')) {
            $operatorId = $request->operator_id;
            $carWashesBase->where(function ($q) use ($operatorId) {
                $q->where('cashier_operator_id', $operatorId)
                    ->orWhere('operator_id', $operatorId);
            });
        }

        $washCashTotal = (clone $carWashesBase)
            ->where('payment_type', 'cash')
            ->sum('amount');

        $washCardTotal = (clone $carWashesBase)
            ->where('payment_type', 'card')
            ->sum('amount');

        $washTotalAmount = (float) $washCashTotal + (float) $washCardTotal;

        // Totales generales (CASH + CARD únicamente)
        $totalCashAmount = (float) $parkingCashAmount + (float) $washCashTotal;
        $totalCardAmount = (float) $parkingCardAmount + (float) $washCardTotal;
        $totalAmount = (float) $totalCashAmount + (float) $totalCardAmount;

        $summary = [
            'period' => [
                'from' => $request->date_from,
                'to' => $request->date_to,
            ],
            'total_sales' => $sessions->count(),
            'total_amount' => $totalAmount,
            'cash_amount' => $totalCashAmount,
            'card_amount' => $totalCardAmount,
            'other_amount' => (float) $parkingOtherAmount,
            'parking' => [
                'cash_amount' => (float) $parkingCashAmount,
                'card_amount' => (float) $parkingCardAmount,
                'total_amount' => (float) $parkingTotalAmount,
                'other_amount' => (float) $parkingOtherAmount,
            ],
            'car_wash' => [
                'cash_amount' => (float) $washCashTotal,
                'card_amount' => (float) $washCardTotal,
                'total_amount' => (float) $washTotalAmount,
            ],
            'by_method' => [
                Payment::METHOD_CASH => [
                    'total' => (float) $totalCashAmount,
                    'parking_total' => (float) $parkingCashAmount,
                    'car_wash_total' => (float) $washCashTotal,
                ],
                Payment::METHOD_CARD => [
                    'total' => (float) $totalCardAmount,
                    'parking_total' => (float) $parkingCardAmount,
                    'car_wash_total' => (float) $washCardTotal,
                ],
            ],
            'by_sector' => $sessions->groupBy('sector.name')->map(function($group) {
                $groupTotal = 0.0;
                foreach ($group as $session) {
                    $groupTotal += (float) $session->payments->sum('amount');
                }
                return [
                    'count' => $group->count(),
                    'total' => $groupTotal,
                ];
            }),
            'by_operator' => $sessions->groupBy('operator.name')->map(function($group) {
                $groupTotal = 0.0;
                foreach ($group as $session) {
                    $groupTotal += (float) $session->payments->sum('amount');
                }
                return [
                    'count' => $group->count(),
                    'total' => $groupTotal,
                ];
            }),
            'daily_breakdown' => $sessions->groupBy(function($session) {
                return $session->started_at->format('Y-m-d');
            })->map(function($group) {
                $groupTotal = 0.0;
                foreach ($group as $session) {
                    $groupTotal += (float) $session->payments->sum('amount');
                }
                return [
                    'count' => $group->count(),
                    'total' => $groupTotal,
                ];
            }),
            'sessions' => $sessions->map(function($session) {
                $sessionTotal = (float) $session->payments->sum('amount');
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
        
        $supportedMethods = [Payment::METHOD_CASH, Payment::METHOD_CARD];

        // Calcular totales de ventas (solo CASH/CARD completados)
        $totalAmount = 0.0;
        $cashAmount = 0.0;
        $cardAmount = 0.0;
        
        foreach ($sessionsForSales as $session) {
            foreach ($session->payments as $payment) {
                if ($payment->status !== Payment::STATUS_COMPLETED) {
                    continue;
                }

                if (!in_array($payment->method, $supportedMethods, true)) {
                    continue;
                }

                $totalAmount += (float) $payment->amount;
                
                if ($payment->method === Payment::METHOD_CASH) {
                    $cashAmount += (float) $payment->amount;
                } elseif ($payment->method === Payment::METHOD_CARD) {
                    $cardAmount += (float) $payment->amount;
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
            $sessionTotal = 0.0;
            $sessionCash = 0.0;
            $sessionCard = 0.0;
            
            foreach ($session->payments as $payment) {
                if ($payment->status !== Payment::STATUS_COMPLETED) {
                    continue;
                }

                if (!in_array($payment->method, $supportedMethods, true)) {
                    continue;
                }

                $sessionTotal += (float) $payment->amount;
                
                if ($payment->method === Payment::METHOD_CASH) {
                    $sessionCash += (float) $payment->amount;
                } elseif ($payment->method === Payment::METHOD_CARD) {
                    $sessionCard += (float) $payment->amount;
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
     * Filtra las sesiones basándose en la fecha seleccionada y el horario de trabajo
     * determinado por los perfiles de precios del tenant
     */
    public function dashboard(Request $request): JsonResponse
    {
        $date = $request->get('date', now()->format('Y-m-d'));
        
        // Obtener horario de trabajo desde los perfiles de precios
        $workingHours = $this->getWorkingHoursFromPricingProfiles();
        $startHour = $workingHours['start_hour'];
        $endHour = $workingHours['end_hour'];
        
        // Parsear la fecha seleccionada
        $dateCarbon = Carbon::parse($date);
        
        // Construir rango de fechas basado en el horario de trabajo
        // Si end_hour < start_hour, significa que cruza medianoche
        $startMinutes = $this->timeToMinutes($startHour);
        $endMinutes = $this->timeToMinutes($endHour);
        $crossesMidnight = $endMinutes < $startMinutes;
        
        // Fecha/hora de inicio: fecha seleccionada + hora de inicio
        $periodStart = $dateCarbon->copy();
        list($startH, $startM) = explode(':', $startHour);
        $periodStart->setTime((int)$startH, (int)$startM, 0);
        
        // Fecha/hora de fin: si cruza medianoche, es del día siguiente
        $periodEnd = $dateCarbon->copy();
        list($endH, $endM) = explode(':', $endHour);
        if ($crossesMidnight) {
            // Cruza medianoche: agregar un día
            $periodEnd->addDay()->setTime((int)$endH, (int)$endM, 59);
        } else {
            // Mismo día
            $periodEnd->setTime((int)$endH, (int)$endM, 59);
        }
        
        // Sesiones activas que comenzaron dentro del período de trabajo
        $activeSessions = ParkingSession::active()
                                      ->where('started_at', '>=', $periodStart)
                                      ->where('started_at', '<=', $periodEnd)
                                      ->with(['sector', 'street'])
                                      ->get();

        // Obtener todos los turnos del día seleccionado (abiertos y cerrados, excluyendo cancelados)
        // Esto asegura que los totales del dashboard coincidan con la suma de los turnos individuales
        $todayShifts = Shift::whereDate('opened_at', $dateCarbon->format('Y-m-d'))
                            ->whereIn('status', [Shift::STATUS_OPEN, Shift::STATUS_CLOSED])
                            ->get();
        
        $todayShiftIds = $todayShifts->pluck('id')->toArray();

        // Obtener todas las ventas que tienen pagos en los turnos de hoy
        $salesWithPaymentsInShifts = [];
        if (!empty($todayShiftIds)) {
            $salesWithPaymentsInShifts = DB::table('payments')
                ->whereIn('shift_id', $todayShiftIds)
                ->where('status', 'COMPLETED')
                ->whereNotNull('sale_id')
                ->distinct()
                ->pluck('sale_id')
                ->toArray();
        }

        // De esas ventas, identificar cuáles están completamente pagadas
        $closedSalesIds = [];
        if (!empty($salesWithPaymentsInShifts)) {
            $closedSalesIds = DB::table('sales')
                ->select('sales.id')
                ->whereIn('sales.id', $salesWithPaymentsInShifts)
                ->join('payments', 'sales.id', '=', 'payments.sale_id')
                ->where('payments.status', 'COMPLETED')
                ->groupBy('sales.id', 'sales.total')
                ->havingRaw('SUM(payments.amount) >= sales.total')
                ->pluck('sales.id')
                ->toArray();
        }

        // Obtener todos los pagos completados de los turnos de hoy
        $todayPayments = collect();
        $todaySalesTotal = 0;
        $todaySalesBySector = [];
        $todaySessionsCount = 0;
        
        if (!empty($todayShiftIds)) {
            // Obtener pagos de sesiones de estacionamiento y ventas cerradas
            $payments = Payment::whereIn('shift_id', $todayShiftIds)
                ->where('status', 'COMPLETED')
                ->where(function($query) use ($closedSalesIds) {
                    // Incluir pagos de sesiones de estacionamiento
                    $query->whereNotNull('session_id')
                          // O pagos de ventas cerradas (completamente pagadas)
                          ->orWhere(function($subQuery) use ($closedSalesIds) {
                              $subQuery->whereNotNull('sale_id');
                              if (!empty($closedSalesIds)) {
                                  $subQuery->whereIn('sale_id', $closedSalesIds);
                              } else {
                                  // Si no hay ventas cerradas, excluir pagos de ventas
                                  $subQuery->whereRaw('1 = 0');
                              }
                          });
                })
                ->with(['parkingSession.sector', 'sale'])
                ->get();

            $todayPayments = $payments;

            // Contar sesiones únicas de estacionamiento
            $uniqueSessionIds = $payments->whereNotNull('session_id')
                ->pluck('session_id')
                ->unique()
                ->count();
            $todaySessionsCount = $uniqueSessionIds;

            // Calcular totales por sector
            foreach ($payments as $payment) {
                $sectorName = null;
                
                // Intentar obtener el sector desde la sesión de estacionamiento
                if ($payment->session_id && $payment->parkingSession && $payment->parkingSession->sector) {
                    $sectorName = $payment->parkingSession->sector->name;
                }
                // Si no hay sesión, intentar obtener el sector desde la venta
                elseif ($payment->sale_id && $payment->sale && $payment->sale->parkingSession && $payment->sale->parkingSession->sector) {
                    $sectorName = $payment->sale->parkingSession->sector->name;
                }

                if ($sectorName) {
                    if (!isset($todaySalesBySector[$sectorName])) {
                        $todaySalesBySector[$sectorName] = ['count' => 0, 'total' => 0];
                    }
                    $todaySalesBySector[$sectorName]['count']++;
                    $todaySalesBySector[$sectorName]['total'] += (float) $payment->amount;
                }

                $todaySalesTotal += (float) $payment->amount;
            }
        }

        // Deudas pendientes (mantener todas, no filtrar por período)
        $pendingDebts = Debt::pending()->get();

        // Lavados de autos de los turnos de hoy (filtrados por shift_id en lugar de performed_at)
        $todayCarWashes = collect();
        $carWashesTotal = 0;
        $carWashesCount = 0;
        $carWashesPendingCount = 0;
        $carWashesCashTotal = 0;
        $carWashesCardTotal = 0;

        if (!empty($todayShiftIds)) {
            $todayCarWashes = CarWash::whereIn('shift_id', $todayShiftIds)
                ->with(['carWashType'])
                ->get();

            // Estadísticas de lavados de autos
            $carWashesTotal = $todayCarWashes->where('status', 'PAID')->sum('amount');
            $carWashesCount = $todayCarWashes->where('status', 'PAID')->count();
            $carWashesPendingCount = $todayCarWashes->where('status', 'PENDING')->count();
            
            // Usar payment_type si está disponible, si no usar approval_code como fallback
            $carWashesCashTotal = $todayCarWashes->where('status', 'PAID')
                ->filter(function($carWash) {
                    return $carWash->payment_type === 'cash' || 
                           ($carWash->payment_type === null && $carWash->approval_code === null);
                })
                ->sum('amount');
            
            $carWashesCardTotal = $todayCarWashes->where('status', 'PAID')
                ->filter(function($carWash) {
                    return $carWash->payment_type === 'card' || 
                           ($carWash->payment_type === null && $carWash->approval_code !== null);
                })
                ->sum('amount');
        }

        // Sesiones activas por hora dentro del horario de trabajo
        $hourlyData = [];
        
        // Determinar el rango de horas a mostrar
        $startHourInt = (int)explode(':', $startHour)[0];
        $endHourInt = (int)explode(':', $endHour)[0];
        
        if ($crossesMidnight) {
            // Si cruza medianoche, mostrar desde startHour hasta 23 y luego de 0 hasta endHour
            // Horas del día seleccionado (desde startHour hasta 23:59)
            for ($hour = $startHourInt; $hour < 24; $hour++) {
                $hourStart = $dateCarbon->copy()->setTime($hour, 0, 0);
                
                $activeCount = ParkingSession::where('started_at', '>=', $periodStart)
                    ->where('started_at', '<=', $periodEnd)
                    ->where('started_at', '<=', $hourStart)
                    ->where(function($query) use ($hourStart) {
                        $query->whereNull('ended_at')
                              ->orWhere('ended_at', '>', $hourStart);
                    })
                    ->count();
                
                $hourlyData[] = [
                    'hour' => $hour,
                    'count' => $activeCount
                ];
            }
            
            // Horas del día siguiente (desde 00:00 hasta endHour)
            $nextDay = $dateCarbon->copy()->addDay();
            for ($hour = 0; $hour <= $endHourInt; $hour++) {
                $hourStart = $nextDay->copy()->setTime($hour, 0, 0);
                
                $activeCount = ParkingSession::where('started_at', '>=', $periodStart)
                    ->where('started_at', '<=', $periodEnd)
                    ->where('started_at', '<=', $hourStart)
                    ->where(function($query) use ($hourStart) {
                        $query->whereNull('ended_at')
                              ->orWhere('ended_at', '>', $hourStart);
                    })
                    ->count();
                
                // Para el día siguiente, mostrar la hora como 24+hour para mantener continuidad
                // pero en el frontend se mostrará como 00, 01, 02, etc.
                $hourlyData[] = [
                    'hour' => $hour,
                    'count' => $activeCount
                ];
            }
        } else {
            // Mismo día, mostrar desde startHour hasta endHour
            for ($hour = $startHourInt; $hour <= $endHourInt; $hour++) {
                $hourStart = $dateCarbon->copy()->setTime($hour, 0, 0);
                
                $activeCount = ParkingSession::where('started_at', '>=', $periodStart)
                    ->where('started_at', '<=', $periodEnd)
                    ->where('started_at', '<=', $hourStart)
                    ->where(function($query) use ($hourStart) {
                        $query->whereNull('ended_at')
                              ->orWhere('ended_at', '>', $hourStart);
                    })
                    ->count();
                
                $hourlyData[] = [
                    'hour' => $hour,
                    'count' => $activeCount
                ];
            }
        }

        $dashboard = [
            'date' => $date,
            'active_sessions' => [
                'count' => $activeSessions->count(),
                'sessions' => $activeSessions,
            ],
            'sessions_by_hour' => $hourlyData,
            'today_sales' => [
                'count' => $todaySessionsCount,
                'total_amount' => $todaySalesTotal,
                'by_sector' => $todaySalesBySector,
            ],
            'today_payments' => [
                'count' => $todayPayments->count(),
                'total_amount' => $todaySalesTotal, // Usar el total calculado previamente para consistencia
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
            'car_washes' => [
                'total_amount' => $carWashesTotal,
                'count' => $carWashesCount,
                'pending_count' => $carWashesPendingCount,
                'cash_total' => $carWashesCashTotal,
                'card_total' => $carWashesCardTotal,
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

        $mode = $request->get('mode', 'summary');
        if (!in_array($mode, ['summary', 'full'], true)) {
            $mode = 'summary';
        }

        $supportedMethods = [Payment::METHOD_CASH, Payment::METHOD_CARD];
        $carWashEnabled = $this->isCarWashEnabled();
        $includeWashes = $request->boolean('include_washes', true);
        if (!$carWashEnabled) {
            $includeWashes = false;
        }

        $parkingPaymentsBase = Payment::completed()
            ->whereIn('method', $supportedMethods)
            ->whereBetween('paid_at', [$dateFrom, $dateTo])
            ->whereHas('parkingSession', function ($q) use ($request) {
                $q->where('status', 'COMPLETED');

                if ($request->filled('sector_id')) {
                    $q->where('sector_id', $request->sector_id);
                }

                if ($request->filled('operator_id')) {
                    $operatorId = $request->operator_id;
                    $q->where(function ($qq) use ($operatorId) {
                        $qq->where('operator_out_id', $operatorId)
                            ->orWhere(function ($subQ) use ($operatorId) {
                                $subQ->whereNull('operator_out_id')
                                    ->where('operator_in_id', $operatorId);
                            });
                    });
                }
            });

        $parkingCashAmount = (clone $parkingPaymentsBase)
            ->where('method', Payment::METHOD_CASH)
            ->sum('amount');

        $parkingCardAmount = (clone $parkingPaymentsBase)
            ->where('method', Payment::METHOD_CARD)
            ->sum('amount');

        $parkingTotalAmount = (float) $parkingCashAmount + (float) $parkingCardAmount;

        $parkingOtherAmount = Payment::completed()
            ->whereNotIn('method', $supportedMethods)
            ->whereBetween('paid_at', [$dateFrom, $dateTo])
            ->whereHas('parkingSession', function ($q) use ($request) {
                $q->where('status', 'COMPLETED');

                if ($request->filled('sector_id')) {
                    $q->where('sector_id', $request->sector_id);
                }

                if ($request->filled('operator_id')) {
                    $operatorId = $request->operator_id;
                    $q->where(function ($qq) use ($operatorId) {
                        $qq->where('operator_out_id', $operatorId)
                            ->orWhere(function ($subQ) use ($operatorId) {
                                $subQ->whereNull('operator_out_id')
                                    ->where('operator_in_id', $operatorId);
                            });
                    });
                }
            })
            ->sum('amount');

        $parkingSessionIds = (clone $parkingPaymentsBase)
            ->whereNotNull('session_id')
            ->distinct()
            ->pluck('session_id');

        $sessions = ParkingSession::with([
            'sector',
            'operator',
            'operatorOut',
            'payments' => function ($q) use ($supportedMethods, $dateFrom, $dateTo) {
                $q->where('status', Payment::STATUS_COMPLETED)
                    ->whereIn('method', $supportedMethods)
                    ->whereBetween('paid_at', [$dateFrom, $dateTo]);
            }
        ])
            ->whereIn('id', $parkingSessionIds)
            ->orderBy('started_at', 'desc')
            ->get();

        $washCashTotal = 0;
        $washCardTotal = 0;
        if ($includeWashes) {
            // Lavado de autos: payment_type 'cash'|'card'
            $carWashesBase = CarWash::query()
                ->where('status', 'PAID')
                ->whereBetween('paid_at', [$dateFrom, $dateTo]);

            if ($request->filled('sector_id')) {
                $carWashesBase->whereHas('session', function ($q) use ($request) {
                    $q->where('sector_id', $request->sector_id);
                });
            }

            if ($request->filled('operator_id')) {
                $operatorId = $request->operator_id;
                $carWashesBase->where(function ($q) use ($operatorId) {
                    $q->where('cashier_operator_id', $operatorId)
                        ->orWhere('operator_id', $operatorId);
                });
            }

            $washCashTotal = (clone $carWashesBase)
                ->where('payment_type', 'cash')
                ->sum('amount');

            $washCardTotal = (clone $carWashesBase)
                ->where('payment_type', 'card')
                ->sum('amount');
        }

        $washTotalAmount = (float) $washCashTotal + (float) $washCardTotal;

        $cashAmount = (float) $parkingCashAmount + (float) $washCashTotal;
        $cardAmount = (float) $parkingCardAmount + (float) $washCardTotal;
        $totalAmount = (float) $cashAmount + (float) $cardAmount;

        // "Generado por": en API REST no hay sesión; intentar resolver por token (Sanctum)
        $generatedByName = null;
        if ($request->user()) {
            $generatedByName = $request->user()->name ?? null;
        } else {
            $bearer = $request->bearerToken();
            if ($bearer) {
                try {
                    $pat = \Laravel\Sanctum\PersonalAccessToken::findToken($bearer);
                    $tokenable = $pat?->tokenable;
                    if ($tokenable && isset($tokenable->name)) {
                        $generatedByName = $tokenable->name;
                    }
                } catch (\Throwable $e) {
                    // Silencioso: si no se puede resolver, cae en "Sistema"
                }
            }
        }
        
        $includeSessions = $request->boolean('include_sessions');
        $sessionsLimit = $request->filled('sessions_limit') ? (int) $request->input('sessions_limit') : null;
        if ($sessionsLimit !== null) {
            $sessionsLimit = max(50, min(5000, $sessionsLimit));
        }

        $sessionDetails = [];
        if ($includeSessions) {
            foreach ($sessions as $session) {
                $sessionTotal = (float) $session->payments->sum('amount');
                
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

            if ($sessionsLimit !== null) {
                $sessionDetails = array_slice($sessionDetails, 0, $sessionsLimit);
            }
        }

        $summary = [
            'meta' => [
                'include_sessions' => $includeSessions,
                'sessions_limit_used' => $sessionsLimit,
                'generated_by' => $generatedByName,
                'car_wash_enabled' => $carWashEnabled,
                'include_washes' => $includeWashes,
            ],
            'period' => [
                'from' => $request->date_from,
                'to' => $request->date_to,
            ],
            'mode' => $mode,
            'total_sales' => $sessions->count(),
            'total_amount' => $totalAmount,
            'cash_amount' => $cashAmount,
            'card_amount' => $cardAmount,
            'other_amount' => (float) $parkingOtherAmount,
            'parking_cash' => (float) $parkingCashAmount,
            'parking_card' => (float) $parkingCardAmount,
            'parking_total' => (float) $parkingTotalAmount,
            'wash_cash' => (float) $washCashTotal,
            'wash_card' => (float) $washCardTotal,
            'wash_total' => (float) $washTotalAmount,
            'parking' => [
                'cash_amount' => (float) $parkingCashAmount,
                'card_amount' => (float) $parkingCardAmount,
                'total_amount' => (float) $parkingTotalAmount,
                'other_amount' => (float) $parkingOtherAmount,
            ],
            'car_wash' => [
                'cash_amount' => (float) $washCashTotal,
                'card_amount' => (float) $washCardTotal,
                'total_amount' => (float) $washTotalAmount,
            ],
            'by_method' => [
                Payment::METHOD_CASH => [
                    'total' => (float) $cashAmount,
                    'parking_total' => (float) $parkingCashAmount,
                    'car_wash_total' => (float) $washCashTotal,
                ],
                Payment::METHOD_CARD => [
                    'total' => (float) $cardAmount,
                    'parking_total' => (float) $parkingCardAmount,
                    'car_wash_total' => (float) $washCardTotal,
                ],
            ],
            'sessions_detail' => $sessionDetails,
            'by_sector' => $sessions->groupBy('sector.name')->map(function($group) {
                $groupTotal = 0.0;
                foreach ($group as $session) {
                    $groupTotal += (float) $session->payments->sum('amount');
                }
                return [
                    'count' => $group->count(),
                    'total' => $groupTotal,
                ];
            }),
            'by_operator' => $sessions->groupBy('operator.name')->map(function($group) {
                $groupTotal = 0.0;
                foreach ($group as $session) {
                    $groupTotal += (float) $session->payments->sum('amount');
                }
                return [
                    'count' => $group->count(),
                    'total' => $groupTotal,
                ];
            }),
        ];

        if ($mode === 'full') {
            $hourly = $sessions->groupBy(function ($s) {
                return \Carbon\Carbon::parse($s->started_at)->format('H');
            })->map(function ($group) {
                return [
                    'count' => $group->count(),
                    'total' => $group->sum(function ($s) {
                        return (float) $s->payments->sum('amount');
                    }),
                ];
            })->sortKeys();

            $peakHour = $hourly->sortByDesc('count')->keys()->first();

            $paymentMethods = [
                'cash' => (float) $cashAmount,
                'card' => (float) $cardAmount,
            ];

            $averageTicket = $sessions->count() > 0 ? ((float) $totalAmount / (float) $sessions->count()) : 0;

            $summary['hourly'] = $hourly;
            $summary['peak_hour'] = $peakHour;
            $summary['payment_methods'] = $paymentMethods;
            $summary['average_ticket'] = $averageTicket;
        }

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

        $includeDebtsDetail = $request->boolean('include_debts_detail');

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
        if ($includeDebtsDetail) {
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
        }

        $summary = [
            'meta' => [
                'include_debts_detail' => $includeDebtsDetail,
            ],
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

        $includeSessionsDetail = $request->boolean('include_sessions_detail');

        $data = $responseData['data'];
        $data['meta'] = $data['meta'] ?? [];
        $data['meta']['include_sessions_detail'] = $includeSessionsDetail;

        if (!$includeSessionsDetail) {
            $data['sessions_detail'] = [];
        }

        // Lavado de autos (si está habilitado para el tenant)
        $carWashEnabled = $this->isCarWashEnabled();
        $data['meta']['car_wash_enabled'] = $carWashEnabled;

        if ($carWashEnabled) {
            [$dateFrom, $dateTo] = $this->normalizeDateRange($request->date_from, $request->date_to);
            $operatorId = (int) $request->operator_id;

            $carWashesBase = CarWash::query()
                ->where('status', 'PAID')
                ->whereBetween('paid_at', [$dateFrom, $dateTo])
                ->where(function ($q) use ($operatorId) {
                    $q->where('cashier_operator_id', $operatorId)
                        ->orWhere('operator_id', $operatorId);
                });

            $washCash = (clone $carWashesBase)->where('payment_type', 'cash')->sum('amount');
            $washCard = (clone $carWashesBase)->where('payment_type', 'card')->sum('amount');
            $washTotal = (float) $washCash + (float) $washCard;

            $data['car_wash'] = [
                'cash_amount' => (float) $washCash,
                'card_amount' => (float) $washCard,
                'total_amount' => (float) $washTotal,
            ];

            // Mantener trazabilidad de parking y sumar lavado al total del PDF
            $data['parking'] = $data['parking'] ?? [
                'cash_amount' => (float) ($data['cash_amount'] ?? 0),
                'card_amount' => (float) ($data['card_amount'] ?? 0),
                'total_amount' => (float) ($data['total_amount'] ?? 0),
            ];

            $data['cash_amount'] = (float) ($data['parking']['cash_amount'] ?? 0) + (float) $washCash;
            $data['card_amount'] = (float) ($data['parking']['card_amount'] ?? 0) + (float) $washCard;
            $data['total_amount'] = (float) ($data['cash_amount'] ?? 0) + (float) ($data['card_amount'] ?? 0);
        } else {
            $data['car_wash'] = [
                'cash_amount' => 0.0,
                'card_amount' => 0.0,
                'total_amount' => 0.0,
            ];
            $data['parking'] = $data['parking'] ?? [
                'cash_amount' => (float) ($data['cash_amount'] ?? 0),
                'card_amount' => (float) ($data['card_amount'] ?? 0),
                'total_amount' => (float) ($data['total_amount'] ?? 0),
            ];
        }

        $pdf = Pdf::loadView('reports.operator', ['data' => $data]);
        return $pdf->download('reporte-operador-' . $data['operator']['name'] . '-' . now()->format('Y-m-d') . '.pdf');
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
