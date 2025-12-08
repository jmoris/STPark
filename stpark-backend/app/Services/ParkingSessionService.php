<?php

namespace App\Services;

use App\Models\ParkingSession;
use App\Models\Debt;
use App\Models\Sector;
use App\Models\Street;
use App\Models\Operator;
use App\Services\PricingService;
use App\Services\CurrentShiftService;
use App\Services\PlanLimitService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ParkingSessionService
{
    protected $pricingService;
    protected $currentShiftService;

    public function __construct(
        PricingService $pricingService,
        CurrentShiftService $currentShiftService
    )
    {
        $this->pricingService = $pricingService;
        $this->currentShiftService = $currentShiftService;
    }

    /**
     * Crear nueva sesión de estacionamiento
     */
    public function createSession(string $plate, int $sectorId, int $streetId, int $operatorId, bool $isFullDay = false): ParkingSession
    {
        // Verificar límite de sesiones mensuales según el plan
        $limitCheck = PlanLimitService::canCreateSession();
        if (!$limitCheck['allowed']) {
            throw new \Exception($limitCheck['message']);
        }

        // Verificar si ya existe una sesión activa para esta placa en el mismo sector
        $activeSession = ParkingSession::where('plate', $plate)
            ->where('sector_id', $sectorId)
            ->where('status', 'ACTIVE')
            ->first();

        if ($activeSession) {
            throw new \Exception('Ya existe una sesión activa para esta placa en este sector');
        }

        // Verificar si el operador tiene un turno abierto
        $shift = $this->currentShiftService->get($operatorId, null);
        
        if (!$shift) {
            throw new \Exception('NO_SHIFT_OPEN');
        }

        // Crear la sesión
        $session = ParkingSession::create([
            'plate' => strtoupper($plate),
            'sector_id' => $sectorId,
            'street_id' => $streetId,
            'operator_in_id' => $operatorId,
            'started_at' => Carbon::now('America/Santiago'),
            'status' => 'ACTIVE',
            'is_full_day' => $isFullDay
        ]);

        return $session->load(['sector', 'street', 'operator']);
    }

    /**
     * Crear sesión con verificación de deudas
     */
    public function createSessionWithDebtCheck(string $plate, int $sectorId, int $streetId, int $operatorId, bool $isFullDay = false): array
    {
        // Verificar deudas pendientes
        $pendingDebts = Debt::where('plate', strtoupper($plate))
            ->where('status', 'PENDING')
            ->sum('amount');

        // Crear la sesión
        $session = $this->createSession($plate, $sectorId, $streetId, $operatorId, $isFullDay);

        return [
            'session' => $session,
            'pending_debts' => $pendingDebts,
            'has_pending_debts' => $pendingDebts > 0
        ];
    }

    /**
     * Obtener sesión activa por placa
     */
    public function getActiveSessionByPlate(string $plate): ?ParkingSession
    {
        return ParkingSession::where('plate', strtoupper($plate))
            ->whereNull('ended_at')
            ->with(['sector', 'street', 'operator'])
            ->first();
    }

    /**
     * Obtener cotización para una sesión
     */
    public function getQuote(int $sessionId, array $params = []): array
    {
        $session = ParkingSession::findOrFail($sessionId);
        
        if ($session->ended_at) {
            throw new \Exception('La sesión ya ha terminado');
        }

        // Si es sesión por día completo, usar la tarifa máxima del perfil de precios
        if ($session->is_full_day) {
            $maxDailyAmount = $this->pricingService->getMaxDailyAmount($session->sector_id);
            
            if ($maxDailyAmount === null) {
                throw new \Exception('No se encontró una tarifa máxima diaria configurada para este sector');
            }

            return [
                'session_id' => $sessionId,
                'started_at' => $session->started_at,
                'ended_at' => Carbon::now('America/Santiago')->toISOString(),
                'duration_minutes' => 0,
                'gross_amount' => $maxDailyAmount,
                'discount_amount' => 0,
                'net_amount' => $maxDailyAmount,
                'pricing_profile' => 'Tarifa máxima diaria',
                'breakdown' => [
                    [
                        'rule_name' => 'Día Completo',
                        'minutes' => 0,
                        'rate_per_minute' => 0,
                        'amount' => $maxDailyAmount,
                        'base_amount' => $maxDailyAmount,
                        'min_amount' => null,
                        'daily_max_amount' => $maxDailyAmount,
                        'final_amount' => $maxDailyAmount,
                        'min_amount_applied' => false,
                        'daily_max_applied' => true
                    ]
                ],
                'is_full_day' => true
            ];
        }

        // Parsear started_at: Laravel guarda timestamps en UTC en la BD
        // Cuando se creó la sesión con Carbon::now('America/Santiago'), Laravel lo convirtió a UTC
        // Entonces al leer, debemos convertir de UTC a America/Santiago
        $startTime = Carbon::parse($session->started_at, 'UTC')->setTimezone('America/Santiago');
        
        // Parsear ended_at: el frontend envía new Date().toISOString() que convierte la hora local a UTC
        // Entonces debemos parsear como UTC y convertir a America/Santiago
        if (isset($params['ended_at'])) {
            $endedAt = $params['ended_at'];
            if (is_string($endedAt)) {
                // Parsear como UTC y convertir a America/Santiago
                $endTime = Carbon::parse($endedAt, 'UTC')->setTimezone('America/Santiago');
            } else {
                // Si ya es un objeto Carbon, asegurar timezone
                $endTime = $endedAt instanceof Carbon 
                    ? $endedAt->copy()->setTimezone('America/Santiago')
                    : Carbon::parse($endedAt)->setTimezone('America/Santiago');
            }
        } else {
            $endTime = Carbon::now('America/Santiago');
        }
        
        // Calcular duración: ambas fechas deben estar en el mismo timezone
        $duration = $startTime->diffInMinutes($endTime);

        $quote = $this->pricingService->calculatePrice(
            $session->sector_id,
            $session->street_id,
            $duration,
            $startTime,
            $endTime
        );

        // Aplicar descuento si se proporciona código
        $discountAmount = 0;
        if (isset($params['discount_code']) && !empty($params['discount_code'])) {
            // Aquí se podría implementar la lógica de descuentos
            // Por ahora, simulamos un descuento del 10%
            $discountAmount = $quote['total'] * 0.1;
        }

        $netAmount = $quote['total'] - $discountAmount;

        return [
            'session_id' => $sessionId,
            'started_at' => $session->started_at,
            'ended_at' => $endTime->toISOString(),
            'duration_minutes' => $duration,
            'gross_amount' => $quote['total'],
            'discount_amount' => $discountAmount,
            'net_amount' => $netAmount,
            'pricing_profile' => $quote['pricing_profile'] ?? 'Perfil por defecto',
            'breakdown' => $quote['breakdown'] ?? [],
            'is_full_day' => false
        ];
    }

    /**
     * Realizar checkout de una sesión
     */
    public function checkout(int $sessionId, string $paymentMethod, float $amount, string|Carbon $endedAt, ?string $approvalCode = null, ?int $operatorOutId = null): array
    {
        $session = ParkingSession::findOrFail($sessionId);
        
        if ($session->ended_at) {
            throw new \Exception('La sesión ya ha terminado');
        }

        DB::beginTransaction();

        try {
            // Parsear ended_at: el frontend envía new Date().toISOString() que convierte la hora local a UTC
            // Entonces debemos parsear como UTC y convertir a America/Santiago
            if (is_string($endedAt)) {
                // Parsear como UTC y convertir a America/Santiago
                $endTime = Carbon::parse($endedAt, 'UTC')->setTimezone('America/Santiago');
            } else {
                // Si ya es un objeto Carbon, asegurar timezone
                $endTime = $endedAt instanceof Carbon 
                    ? $endedAt->copy()->setTimezone('America/Santiago')
                    : Carbon::parse($endedAt)->setTimezone('America/Santiago');
            }
            
            // Parsear started_at: Laravel guarda timestamps en UTC en la BD
            // Cuando se creó la sesión con Carbon::now('America/Santiago'), Laravel lo convirtió a UTC
            // Entonces al leer, debemos convertir de UTC a America/Santiago
            $startTime = Carbon::parse($session->started_at, 'UTC')->setTimezone('America/Santiago');

            // Calcular el precio real
            // Si es sesión por día completo, usar la tarifa máxima del perfil de precios
            if ($session->is_full_day) {
                $maxDailyAmount = $this->pricingService->getMaxDailyAmount($session->sector_id);
                
                if ($maxDailyAmount === null) {
                    throw new \Exception('No se encontró una tarifa máxima diaria configurada para este sector');
                }

                $quote = [
                    'total' => $maxDailyAmount,
                    'breakdown' => [
                        [
                            'rule_name' => 'Día Completo',
                            'minutes' => 0,
                            'rate_per_minute' => 0,
                            'amount' => $maxDailyAmount,
                            'base_amount' => $maxDailyAmount,
                            'min_amount' => null,
                            'daily_max_amount' => $maxDailyAmount,
                            'final_amount' => $maxDailyAmount,
                            'min_amount_applied' => false,
                            'daily_max_applied' => true
                        ]
                    ],
                    'duration_minutes' => 0,
                    'pricing_profile' => 'Tarifa máxima diaria'
                ];
            } else {
                $duration = $startTime->diffInMinutes($endTime);

                $quote = $this->pricingService->calculatePrice(
                    $session->sector_id,
                    $session->street_id,
                    $duration,
                    $startTime,
                    $endTime
                );
            }

            // Calcular valores para guardar en la sesión
            $grossAmount = $quote['total'];
            $discountAmount = 0; // Se puede calcular si hay descuento
            $netAmount = $grossAmount - $discountAmount;
            $secondsTotal = isset($quote['duration_minutes']) ? $quote['duration_minutes'] * 60 : $startTime->diffInSeconds($endTime);

            // Actualizar la sesión con todos los valores calculados
            $session->update([
                'ended_at' => $endTime,
                'status' => 'COMPLETED',
                'operator_out_id' => $operatorOutId,
                'seconds_total' => $secondsTotal,
                'gross_amount' => $grossAmount,
                'discount_amount' => $discountAmount,
                'net_amount' => $netAmount
            ]);

            $result = [
                'session' => $session->load(['sector', 'street', 'operator', 'operatorOut', 'payments']),
                'quote' => $quote
            ];

            // Si el monto pagado es 0, crear deuda automáticamente
            if ($amount == 0 && $quote['total'] > 0) {
                // Crear deuda por el monto que corresponde
                $debt = Debt::create([
                    'plate' => $session->plate,
                    'session_id' => $session->id,
                    'origin' => 'SESSION',
                    'principal_amount' => $quote['total'],
                    'status' => 'PENDING',
                    'created_at' => Carbon::now('America/Santiago')
                ]);

                $result['debt'] = $debt;
                $result['message'] = 'Sesión cerrada sin pago. Deuda creada automáticamente.';
            } else {
                // Obtener turno actual del operador que hace el checkout (no del que recibió el vehículo)
                // IMPORTANTE: Si no se proporciona operatorOutId, lanzar error para evitar asociar pagos al operador incorrecto
                if (!$operatorOutId) {
                    throw new \Exception('El operador que hace el checkout es requerido para asociar el pago al turno correcto');
                }
                
                $shift = $this->currentShiftService->get($operatorOutId, null);
                
                // Si el operador que hace el checkout no tiene turno abierto, lanzar error
                if (!$shift) {
                    throw new \Exception('El operador que hace el checkout no tiene un turno abierto. Por favor, abre un turno antes de procesar el checkout.');
                }
                
                // Crear el pago normal asociado al turno del operador que hace el checkout
                $payment = $session->payments()->create([
                    'amount' => $amount,
                    'method' => $paymentMethod,
                    'status' => 'COMPLETED',
                    'paid_at' => Carbon::now('America/Santiago'),
                    'approval_code' => $approvalCode,
                    'shift_id' => $shift->id, // Siempre asociar al turno del operador que hace el checkout
                ]);

                // Registrar operación en el turno
                \App\Models\ShiftOperation::create([
                    'shift_id' => $shift->id,
                    'kind' => \App\Models\ShiftOperation::KIND_ADJUSTMENT,
                    'amount' => $amount,
                    'at' => Carbon::now('America/Santiago'),
                    'ref_id' => $payment->id,
                    'ref_type' => 'payment',
                    'notes' => "Pago {$paymentMethod} por {$amount}",
                ]);

                $result['payment'] = $payment;
                $result['message'] = 'Checkout procesado exitosamente';
            }

            DB::commit();
            return $result;

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Cancelar sesión
     */
    public function cancelSession(int $sessionId): ParkingSession
    {
        $session = ParkingSession::findOrFail($sessionId);
        
        if ($session->ended_at) {
            throw new \Exception('La sesión ya ha terminado');
        }

        $session->update([
            'ended_at' => Carbon::now('America/Santiago'),
            'status' => 'CANCELLED'
        ]);

        return $session->load(['sector', 'street', 'operator']);
    }

    /**
     * Forzar checkout sin pago
     */
    public function forceCheckoutWithoutPayment(int $sessionId, string|Carbon $endedAt): array
    {
        $session = ParkingSession::findOrFail($sessionId);
        
        if ($session->ended_at) {
            throw new \Exception('La sesión ya ha terminado');
        }

        DB::beginTransaction();

        try {
            // Parsear ended_at: si viene como string ISO con 'Z' (UTC), 
            // interpretar los componentes como hora local de America/Santiago
            if (is_string($endedAt) && (str_ends_with($endedAt, 'Z') || str_contains($endedAt, '+00:00'))) {
                // Extraer componentes de la fecha UTC pero crear en America/Santiago
                $parsedDate = Carbon::parse($endedAt, 'UTC');
                $endTime = Carbon::create(
                    $parsedDate->year,
                    $parsedDate->month,
                    $parsedDate->day,
                    $parsedDate->hour,
                    $parsedDate->minute,
                    $parsedDate->second,
                    'America/Santiago'
                );
            } elseif (is_string($endedAt)) {
                // Si no es UTC, parsear y establecer timezone
                $endTime = Carbon::parse($endedAt)->setTimezone('America/Santiago');
            } else {
                // Si ya es un objeto Carbon, asegurar timezone
                $endTime = $endedAt instanceof Carbon 
                    ? $endedAt->copy()->setTimezone('America/Santiago')
                    : Carbon::parse($endedAt)->setTimezone('America/Santiago');
            }
            
            // Actualizar la sesión con el objeto Carbon (Laravel lo guardará correctamente)
            $session->update([
                'ended_at' => $endTime,
                'status' => 'FORCED_CHECKOUT'
            ]);

            // Calcular el precio
            // Parsear started_at: Laravel guarda timestamps en UTC en la BD
            // Cuando se creó la sesión con Carbon::now('America/Santiago'), Laravel lo convirtió a UTC
            // Entonces al leer, debemos convertir de UTC a America/Santiago
            $startTime = Carbon::parse($session->started_at, 'UTC')->setTimezone('America/Santiago');
            $duration = $startTime->diffInMinutes($endTime);

            $quote = $this->pricingService->calculatePrice(
                $session->sector_id,
                $session->street_id,
                $duration,
                $startTime,
                $endTime
            );

            // Crear deuda
            $debt = Debt::create([
                'plate' => $session->plate,
                'amount' => $quote['total'],
                'description' => 'Deuda por estacionamiento no pagado',
                'status' => 'PENDING',
                'created_at' => Carbon::now('America/Santiago')
            ]);

            DB::commit();

            return [
                'session' => $session->load(['sector', 'street', 'operator']),
                'debt' => $debt,
                'quote' => $quote
            ];

        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Verificar deudas pendientes por placa
     */
    public function checkPendingDebtsForPlate(string $plate): array
    {
        $debts = Debt::where('plate', strtoupper($plate))
            ->where('status', 'PENDING')
            ->get();

        $totalAmount = $debts->sum('amount');

        return [
            'plate' => strtoupper($plate),
            'has_debts' => $debts->count() > 0,
            'total_amount' => $totalAmount,
            'debts' => $debts
        ];
    }
}