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

        // Sesiones completadas dentro del período de trabajo
        $todaySessions = ParkingSession::where('status', 'COMPLETED')
                                      ->where('started_at', '>=', $periodStart)
                                      ->where('started_at', '<=', $periodEnd)
                                      ->with(['sector', 'payments'])
                                      ->get();

        // Calcular total de ventas del período (suma de payments completados)
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

        // Pagos de sesiones creadas dentro del período de trabajo (turnos de hoy)
        // Solo incluir pagos de turnos que fueron creados hoy, no pagos creados hoy de turnos anteriores
        $todayPayments = collect();
        foreach ($todaySessions as $session) {
            foreach ($session->payments as $payment) {
                if ($payment->status === 'COMPLETED') {
                    $todayPayments->push($payment);
                }
            }
        }

        // Deudas pendientes (mantener todas, no filtrar por período)
        $pendingDebts = Debt::pending()->get();

        // Lavados de autos del período (filtrados por performed_at)
        $todayCarWashes = CarWash::where('performed_at', '>=', $periodStart)
            ->where('performed_at', '<=', $periodEnd)
            ->with(['carWashType'])
            ->get();

        // Estadísticas de lavados de autos
        $carWashesTotal = $todayCarWashes->where('status', 'PAID')->sum('amount');
        $carWashesCount = $todayCarWashes->where('status', 'PAID')->count();
        $carWashesPendingCount = $todayCarWashes->where('status', 'PENDING')->count();
        $carWashesCashTotal = $todayCarWashes->where('status', 'PAID')->whereNull('approval_code')->sum('amount');
        $carWashesCardTotal = $todayCarWashes->where('status', 'PAID')->whereNotNull('approval_code')->sum('amount');

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
