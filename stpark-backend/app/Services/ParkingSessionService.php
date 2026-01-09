<?php

namespace App\Services;

use App\Models\ParkingSession;
use App\Models\Debt;
use App\Models\Sector;
use App\Models\Street;
use App\Models\Operator;
use App\Models\Settings;
use App\Models\SessionDiscount;
use App\Services\PricingService;
use App\Services\CurrentShiftService;
use App\Services\PlanLimitService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

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
        // Usar diffInMinutes para obtener solo minutos completos (sin considerar segundos)
        // Esto asegura que solo se consideren los minutos completos para mayor precisión
        $duration = (int)$startTime->diffInMinutes($endTime); // Solo minutos completos, sin redondear

        $quote = $this->pricingService->calculatePrice(
            $session->sector_id,
            $session->street_id,
            $duration,
            $startTime,
            $endTime
        );

        // Log inicial de parámetros recibidos
        \Log::info('Quote calculation started', [
            'session_id' => $sessionId,
            'params_received' => $params,
            'duration_minutes' => $duration,
            'gross_amount' => $quote['total'],
        ]);
        
        // Aplicar descuento si se proporciona discount_id o discount_code
        $discountAmount = 0;
        $discountId = null;
        
        if (isset($params['discount_id']) && !empty($params['discount_id'])) {
            \Log::info('Discount ID received in params', ['discount_id' => $params['discount_id']]);
            $discount = SessionDiscount::find($params['discount_id']);
            
            if ($discount) {
                \Log::info('Discount found', [
                    'discount_id' => $discount->id,
                    'discount_name' => $discount->name,
                    'discount_type' => $discount->discount_type,
                    'is_valid' => $discount->isValid(),
                ]);
                
                if ($discount->isValid()) {
                    $discountId = $discount->id;
                    $discountAmount = $this->calculateDiscountAmount($discount, $quote['total'], $duration);
                    
                    // Log para debugging
                    \Log::info('Discount applied successfully', [
                        'discount_id' => $discount->id,
                        'discount_name' => $discount->name,
                        'discount_type' => $discount->discount_type,
                        'minute_value' => $discount->minute_value,
                        'value' => $discount->value,
                        'duration_minutes' => $duration,
                        'gross_amount' => $quote['total'],
                        'discount_amount' => $discountAmount,
                        'calculated_net_amount' => $quote['total'] - $discountAmount
                    ]);
                } else {
                    \Log::warning('Discount is not valid', ['discount_id' => $discount->id]);
                }
            } else {
                \Log::warning('Discount not found', ['discount_id' => $params['discount_id']]);
            }
        } elseif (isset($params['discount_code']) && !empty($params['discount_code'])) {
            \Log::info('Discount code received', ['discount_code' => $params['discount_code']]);
            // Buscar por código (si se implementa en el futuro)
            // Por ahora mantener compatibilidad con código de descuento antiguo
            $discountAmount = $quote['total'] * 0.1; // 10% de descuento por código
        } else {
            \Log::info('No discount provided in params');
        }

        $netAmount = max(0, $quote['total'] - $discountAmount);
        
        // Log final del resultado
        \Log::info('Quote calculation completed', [
            'session_id' => $sessionId,
            'gross_amount' => $quote['total'],
            'discount_amount' => $discountAmount,
            'net_amount' => $netAmount,
            'discount_id' => $discountId,
        ]);

        $result = [
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
        
        if ($discountId) {
            $result['discount_id'] = $discountId;
        }
        
        return $result;
    }

    /**
     * Calcular el monto de descuento según el tipo de descuento
     */
    private function calculateDiscountAmount(SessionDiscount $discount, float $grossAmount, int $durationMinutes): float
    {
        $discountAmount = 0;
        
        switch ($discount->discount_type) {
            case 'AMOUNT':
                // Descuento fijo
                $discountAmount = min($discount->value ?? 0, $grossAmount);
                break;
                
            case 'PERCENTAGE':
                // Descuento porcentual
                $percentage = ($discount->value ?? 0) / 100;
                $discountAmount = $grossAmount * $percentage;
                
                // Aplicar máximo si está definido
                if ($discount->max_amount && $discountAmount > $discount->max_amount) {
                    $discountAmount = $discount->max_amount;
                }
                break;
                
            case 'PRICING_PROFILE':
                // Perfil de precio: recalcular con valores personalizados
                // Aplica la misma lógica que los perfiles de precios
                if ($discount->minute_value) {
                    $minDurationUsed = $discount->minimum_duration ?? 0;
                    $minAmountValue = $discount->min_amount ?? null;
                    
                    $newAmount = 0;
                    
                    // Si hay duración mínima y monto mínimo, aplicar como base (similar a min_amount_is_base)
                    if ($minDurationUsed > 0 && $minAmountValue && $durationMinutes >= $minDurationUsed) {
                        // Aplicar el monto mínimo como base por el tiempo mínimo
                        $newAmount += (float)$minAmountValue;
                        
                        // Calcular minutos restantes después del tiempo mínimo
                        $remainingMinutes = $durationMinutes - $minDurationUsed;
                        
                        // Si hay minutos restantes, cobrarlos al precio por minuto
                        if ($remainingMinutes > 0) {
                            $newAmount += $remainingMinutes * (float)$discount->minute_value;
                        }
                        
                        \Log::info('PRICING_PROFILE discount calculation con duración mínima como base', [
                            'discount_id' => $discount->id,
                            'discount_name' => $discount->name,
                            'duration_minutes' => $durationMinutes,
                            'minimum_duration' => $minDurationUsed,
                            'min_amount' => $minAmountValue,
                            'remaining_minutes' => $remainingMinutes,
                            'minute_value' => $discount->minute_value,
                            'calculated_new_amount' => $newAmount,
                        ]);
                    } else if ($minDurationUsed > 0 && !$minAmountValue) {
                        // Solo hay duración mínima sin monto mínimo: usar como duración efectiva
                        $effectiveDuration = max($durationMinutes, $minDurationUsed);
                        $newAmount = $effectiveDuration * (float)$discount->minute_value;
                        
                        \Log::info('PRICING_PROFILE discount calculation con duración mínima forzada', [
                            'discount_id' => $discount->id,
                            'discount_name' => $discount->name,
                            'duration_minutes' => $durationMinutes,
                            'minimum_duration' => $minDurationUsed,
                            'effective_duration' => $effectiveDuration,
                            'minute_value' => $discount->minute_value,
                            'calculated_new_amount' => $newAmount,
                        ]);
                    } else {
                        // No hay duración mínima: calcular normalmente
                        $newAmount = $durationMinutes * (float)$discount->minute_value;
                        
                        // Aplicar monto mínimo tradicional si existe (solo si no hay duración mínima como base)
                        if ($minAmountValue && $newAmount < (float)$minAmountValue) {
                            $newAmount = (float)$minAmountValue;
                        }
                    }
                    
                    // El descuento es la diferencia entre el monto original y el nuevo
                    $discountAmount = max(0, $grossAmount - $newAmount);
                    
                    // Log detallado para debugging
                    \Log::info('PRICING_PROFILE discount calculation final', [
                        'discount_id' => $discount->id,
                        'discount_name' => $discount->name,
                        'duration_minutes' => $durationMinutes,
                        'minimum_duration' => $discount->minimum_duration,
                        'min_amount' => $discount->min_amount,
                        'minute_value' => $discount->minute_value,
                        'gross_amount' => $grossAmount,
                        'calculated_new_amount' => $newAmount,
                        'discount_amount' => $discountAmount,
                        'final_net_amount' => $grossAmount - $discountAmount,
                        'note' => 'For PRICING_PROFILE, net_amount should be newAmount, following same logic as pricing profiles'
                    ]);
                } else {
                    // Si no tiene minute_value configurado, lanzar error
                    throw new \Exception('El descuento de tipo PRICING_PROFILE debe tener minute_value configurado');
                }
                break;
        }
        
        // Asegurar que el descuento no sea mayor al monto total
        return min($discountAmount, $grossAmount);
    }

    /**
     * Realizar checkout de una sesión
     */
    public function checkout(int $sessionId, string $paymentMethod, float $amount, string|Carbon $endedAt, ?string $approvalCode = null, ?int $operatorOutId = null, ?int $discountId = null, ?string $discountCode = null): array
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
            $duration = 0; // Inicializar variable
            
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
                $duration = 0; // Para sesiones de día completo
            } else {
                // Calcular duración usando solo minutos completos (sin considerar segundos)
                $duration = (int)$startTime->diffInMinutes($endTime); // Solo minutos completos, sin redondear

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
            $discountAmount = 0;
            $discountIdToSave = null;
            
            // Aplicar descuento si se proporciona discount_id o discount_code
            if ($discountId) {
                $discount = SessionDiscount::find($discountId);
                if ($discount && $discount->isValid()) {
                    $discountIdToSave = $discount->id;
                    // Usar duration_minutes del quote si está disponible, sino usar $duration
                    $durationForDiscount = isset($quote['duration_minutes']) ? $quote['duration_minutes'] : $duration;
                    $discountAmount = $this->calculateDiscountAmount($discount, $grossAmount, $durationForDiscount);
                }
            } elseif ($discountCode) {
                // Buscar por código (si se implementa en el futuro)
                // Por ahora mantener compatibilidad con código de descuento antiguo
                $discountAmount = $grossAmount * 0.1; // 10% de descuento por código
            }
            
            $netAmount = max(0, $grossAmount - $discountAmount);
            
            // Log para debugging
            \Log::info('Checkout calculation', [
                'session_id' => $sessionId,
                'gross_amount' => $grossAmount,
                'discount_amount' => $discountAmount,
                'net_amount' => $netAmount,
                'amount_paid' => $amount,
                'discount_id' => $discountIdToSave,
                'duration' => $duration
            ]);
            // Calcular segundos totales basándose en minutos completos
            $secondsTotal = isset($quote['duration_minutes']) ? $quote['duration_minutes'] * 60 : $startTime->diffInMinutes($endTime) * 60;

            // Actualizar la sesión con todos los valores calculados
            // IMPORTANTE: net_amount es el monto que se debe cobrar (con descuento aplicado), NO el monto pagado
            // Asegurar que los valores sean numéricos y estén correctamente formateados
            $updateData = [
                'ended_at' => $endTime,
                'status' => 'COMPLETED',
                'operator_out_id' => $operatorOutId,
                'seconds_total' => $secondsTotal,
                'gross_amount' => (float)$grossAmount,
                'discount_amount' => (float)$discountAmount,
                'net_amount' => (float)$netAmount  // NUNCA usar $amount (monto pagado) aquí
            ];
            
            // Agregar discount_id si hay descuento aplicado
            if ($discountIdToSave) {
                $updateData['discount_id'] = $discountIdToSave;
            }
            
            // Log antes de actualizar
            \Log::info('About to update session', [
                'session_id' => $session->id,
                'update_data' => $updateData,
                'amount_paid' => $amount,
                'note' => 'net_amount should be calculated value, NOT amount paid'
            ]);
            
            // Actualizar usando update directo para evitar problemas con mutators/accessors
            $rowsAffected = DB::table('parking_sessions')
                ->where('id', $session->id)
                ->update($updateData);
            
            if ($rowsAffected === 0) {
                \Log::error('Failed to update session!', ['session_id' => $session->id]);
                throw new \Exception('Error al actualizar la sesión');
            }
            
            // Refrescar el modelo después del update directo
            $session->refresh();
            
            // Refrescar la sesión para asegurar que tenemos los valores actualizados
            $session->refresh();
            
            // Verificación explícita: si el net_amount guardado no coincide con el calculado, forzar actualización
            // Esto previene problemas de caché o valores desactualizados
            if (abs((float)$session->net_amount - $netAmount) > 0.01) {
                \Log::warning('Mismatch in net_amount detected, forcing update', [
                    'session_id' => $session->id,
                    'saved_net_amount' => $session->net_amount,
                    'calculated_net_amount' => $netAmount,
                    'difference' => abs((float)$session->net_amount - $netAmount)
                ]);
                
                // Forzar actualización directa en la base de datos
                DB::table('parking_sessions')
                    ->where('id', $session->id)
                    ->update([
                        'net_amount' => $netAmount,
                        'gross_amount' => $grossAmount,
                        'discount_amount' => $discountAmount
                    ]);
                
                $session->refresh();
            }
            
            // Verificación final: asegurar que los valores sean consistentes
            $finalNetAmount = (float)$session->net_amount;
            $finalGrossAmount = (float)$session->gross_amount;
            $finalDiscountAmount = (float)$session->discount_amount;
            $expectedNetAmount = $finalGrossAmount - $finalDiscountAmount;
            
            if (abs($finalNetAmount - $expectedNetAmount) > 0.01) {
                \Log::error('Inconsistency detected in session financial values', [
                    'session_id' => $session->id,
                    'gross_amount' => $finalGrossAmount,
                    'discount_amount' => $finalDiscountAmount,
                    'net_amount' => $finalNetAmount,
                    'expected_net_amount' => $expectedNetAmount,
                    'difference' => abs($finalNetAmount - $expectedNetAmount)
                ]);
                
                // Corregir automáticamente
                DB::table('parking_sessions')
                    ->where('id', $session->id)
                    ->update(['net_amount' => $expectedNetAmount]);
                
                $session->refresh();
            }

            // Recargar la sesión desde la base de datos para asegurar valores frescos
            $session->refresh();
            $session = ParkingSession::with(['sector', 'street', 'operator', 'operatorOut', 'payments', 'discount'])
                ->findOrFail($session->id);
            
            $result = [
                'session' => $session,
                'quote' => [
                    'gross_amount' => $grossAmount,
                    'discount_amount' => $discountAmount,
                    'net_amount' => $netAmount,
                    'duration_minutes' => $duration,
                    'breakdown' => $quote['breakdown'] ?? [],
                    'pricing_profile' => $quote['pricing_profile'] ?? 'Perfil por defecto'
                ]
            ];
            
            // Verificar que se guardó correctamente - log adicional
            // Leer directamente desde la base de datos para evitar problemas de caché
            $dbSession = DB::table('parking_sessions')
                ->where('id', $session->id)
                ->first(['id', 'gross_amount', 'discount_amount', 'net_amount']);
            
            \Log::info('Session after update', [
                'session_id' => $session->id,
                'model_net_amount' => $session->net_amount,
                'db_net_amount' => $dbSession->net_amount ?? 'N/A',
                'calculated_net_amount' => $netAmount,
                'model_gross_amount' => $session->gross_amount,
                'db_gross_amount' => $dbSession->gross_amount ?? 'N/A',
                'model_discount_amount' => $session->discount_amount,
                'db_discount_amount' => $dbSession->discount_amount ?? 'N/A',
                'amount_paid' => $amount
            ]);
            
            // Si hay diferencia entre modelo y BD, corregir
            if ($dbSession && abs((float)$dbSession->net_amount - $netAmount) > 0.01) {
                \Log::error('Database value mismatch detected!', [
                    'session_id' => $session->id,
                    'db_net_amount' => $dbSession->net_amount,
                    'calculated_net_amount' => $netAmount
                ]);
                
                DB::table('parking_sessions')
                    ->where('id', $session->id)
                    ->update(['net_amount' => $netAmount]);
                
                $session->refresh();
            }

            // Lógica para crear deuda o procesar pago:
            // - Si es CASH y amount == 0: crear deuda (no se recibió dinero)
            // - Si es CARD o TRANSFER y amount == 0: asumir que se pagó el netAmount completo
            //   (cuando se procesa con tarjeta, el monto se cobra exacto, no hay vuelto)
            if ($amount == 0 && $netAmount > 0) {
                // Para pagos con tarjeta o transferencia, si amount es 0, asumir que se pagó el monto completo
                // Esto puede pasar cuando no se envía amount_paid desde el frontend (comportamiento esperado)
                if ($paymentMethod === 'CARD' || $paymentMethod === 'TRANSFER') {
                    // Asumir que se pagó el netAmount completo
                    $amount = $netAmount;
                    \Log::info('Card/Transfer payment with amount=0, assuming full payment', [
                        'session_id' => $session->id,
                        'payment_method' => $paymentMethod,
                        'assumed_amount' => $amount,
                        'net_amount' => $netAmount,
                        'approval_code' => $approvalCode
                    ]);
                } else {
                    // Solo para CASH, crear deuda si no se recibió dinero
                    $debt = Debt::create([
                        'plate' => $session->plate,
                        'session_id' => $session->id,
                        'origin' => 'SESSION',
                        'principal_amount' => $netAmount, // Usar net_amount, no gross_amount
                        'status' => 'PENDING',
                        'created_at' => Carbon::now('America/Santiago')
                    ]);

                    $result['debt'] = $debt;
                    $result['message'] = 'Sesión cerrada sin pago. Deuda creada automáticamente.';
                    return $result;
                }
            }
            
            // Procesar el pago solo si amount > 0 (ya sea recibido o asumido para CARD/TRANSFER)
            if ($amount > 0 && $netAmount > 0) {
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
                // IMPORTANTE: El monto del pago debe ser el net_amount (monto a cobrar), NO el monto recibido
                // Si se recibió más dinero (vuelto), eso no se registra como parte del pago
                $paymentAmount = $netAmount; // Usar net_amount (monto a cobrar), no $amount (monto recibido)
                
                \Log::info('Creating payment', [
                    'session_id' => $session->id,
                    'payment_amount' => $paymentAmount,
                    'amount_received' => $amount,
                    'change' => $amount > $paymentAmount ? $amount - $paymentAmount : 0,
                    'note' => 'Payment amount should equal session net_amount, not received amount'
                ]);
                
                // Crear el pago directamente en la base de datos para evitar cualquier problema
                $paymentId = DB::table('payments')->insertGetId([
                    'session_id' => $session->id,
                    'amount' => $paymentAmount, // IMPORTANTE: Monto a cobrar (net_amount), NO monto recibido
                    'method' => $paymentMethod,
                    'status' => 'COMPLETED',
                    'paid_at' => Carbon::now('America/Santiago'),
                    'approval_code' => $approvalCode,
                    'shift_id' => $shift->id,
                    'created_at' => Carbon::now('America/Santiago'),
                    'updated_at' => Carbon::now('America/Santiago'),
                ]);
                
                // Cargar el pago creado
                $payment = \App\Models\Payment::find($paymentId);
                
                \Log::info('Payment created successfully', [
                    'payment_id' => $payment->id,
                    'payment_amount' => $payment->amount,
                    'session_net_amount' => $netAmount,
                    'amount_received' => $amount,
                    'match' => abs((float)$payment->amount - $netAmount) < 0.01 ? 'YES' : 'NO'
                ]);

                // Registrar operación en el turno con el monto correcto (net_amount)
                \App\Models\ShiftOperation::create([
                    'shift_id' => $shift->id,
                    'kind' => \App\Models\ShiftOperation::KIND_ADJUSTMENT,
                    'amount' => $paymentAmount, // Usar paymentAmount (net_amount), no $amount recibido
                    'at' => Carbon::now('America/Santiago'),
                    'ref_id' => $payment->id,
                    'ref_type' => 'payment',
                    'notes' => "Pago {$paymentMethod} por {$paymentAmount}" . ($amount > $paymentAmount ? " (recibido: {$amount}, vuelto: " . ($amount - $paymentAmount) . ")" : ""),
                ]);

                // Si el pago es en efectivo y la boleta electrónica está activada, enviar a facturapi
                // Usar paymentAmount (net_amount) para la facturación, no el monto recibido
                $facturapiData = null;
                if ($paymentMethod === 'CASH') {
                    $facturapiData = $this->sendElectronicReceiptToFacturAPI($session, $payment, $paymentAmount);
                }

                // Cargar el pago con sus relaciones
                $payment->refresh();
                
                // Verificar que el pago se guardó con el monto correcto (net_amount, no amount recibido)
                $dbPayment = DB::table('payments')->where('id', $payment->id)->first(['id', 'amount']);
                if ($dbPayment && abs((float)$dbPayment->amount - $paymentAmount) > 0.01) {
                    \Log::error('CRITICAL: Payment amount mismatch!', [
                        'payment_id' => $payment->id,
                        'db_amount' => $dbPayment->amount,
                        'expected_amount' => $paymentAmount,
                        'session_net_amount' => $netAmount,
                        'amount_received' => $amount
                    ]);
                    
                    // Corregir el pago en la base de datos
                    DB::table('payments')
                        ->where('id', $payment->id)
                        ->update(['amount' => $paymentAmount]);
                    
                    $payment->refresh();
                }
                
                \Log::info('Final payment verification', [
                    'payment_id' => $payment->id,
                    'payment_amount_in_db' => $dbPayment->amount ?? 'N/A',
                    'payment_amount_in_model' => $payment->amount,
                    'session_net_amount' => $netAmount,
                    'amount_received' => $amount,
                    'match' => $dbPayment && abs((float)$dbPayment->amount - $paymentAmount) < 0.01 ? 'CORRECT' : 'INCORRECT'
                ]);
                
                $result['payment'] = $payment;
                
                // Calcular y agregar vuelto si corresponde (solo para efectivo cuando amount_paid > net_amount)
                $change = 0;
                if ($paymentMethod === 'CASH' && $amount > $paymentAmount) {
                    $change = $amount - $paymentAmount;
                }
                $result['change'] = $change;
                $result['amount_received'] = $amount;
                $result['amount_charged'] = $paymentAmount; // net_amount que se cobró
                
                // Incluir todos los datos de FacturaPi en la respuesta si están disponibles
                if ($facturapiData) {
                    $result['payment']->ted = $facturapiData['ted'] ?? null;
                    $result['payment']->folio = $facturapiData['folio'] ?? null;
                    $result['payment']->tenant_rut = $facturapiData['tenantRut'] ?? null;
                    $result['payment']->tenant_razon_social = $facturapiData['tenantRazonSocial'] ?? null;
                    $result['payment']->tenant_giro = $facturapiData['tenantGiro'] ?? null;
                    $result['payment']->tenant_direccion = $facturapiData['tenantDireccion'] ?? null;
                    $result['payment']->tenant_comuna = $facturapiData['tenantComuna'] ?? null;
                    $result['payment']->iva_amount = $facturapiData['ivaAmount'] ?? null;
                    $result['payment']->sucsii = $facturapiData['sucsii'] ?? null;
                }
                $result['message'] = 'Checkout procesado exitosamente';
                
                // Verificación final después de crear el pago: asegurar que net_amount no cambió
                $session->refresh();
                if (abs((float)$session->net_amount - $netAmount) > 0.01) {
                    \Log::error('CRITICAL: net_amount changed after payment creation!', [
                        'session_id' => $session->id,
                        'net_amount_before_payment' => $netAmount,
                        'net_amount_after_payment' => $session->net_amount,
                        'amount_paid' => $amount,
                        'difference' => abs((float)$session->net_amount - $netAmount)
                    ]);
                    
                    // Forzar corrección inmediata
                    DB::table('parking_sessions')
                        ->where('id', $session->id)
                        ->update(['net_amount' => $netAmount]);
                    
                    $session->refresh();
                }
            }

            // Verificación final antes de commit
            $session->refresh();
            \Log::info('Final session values before commit', [
                'session_id' => $session->id,
                'net_amount' => $session->net_amount,
                'gross_amount' => $session->gross_amount,
                'discount_amount' => $session->discount_amount,
                'calculated_net_amount' => $netAmount
            ]);

            DB::commit();
            
            // Verificación final después de commit
            $session->refresh();
            \Log::info('Final session values after commit', [
                'session_id' => $session->id,
                'net_amount' => $session->net_amount,
                'gross_amount' => $session->gross_amount,
                'discount_amount' => $session->discount_amount
            ]);
            
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
            // Calcular duración usando solo minutos completos (sin considerar segundos)
            $duration = (int)$startTime->diffInMinutes($endTime); // Solo minutos completos, sin redondear

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

    /**
     * Enviar boleta electrónica a FacturAPI cuando el pago es en efectivo
     * Retorna un array con los datos de FacturaPi (ted, folio, tenantRut, ivaAmount, sucsii)
     */
    private function sendElectronicReceiptToFacturAPI(ParkingSession $session, $payment, float $amount): ?array
    {
        try {
            // Verificar si la boleta electrónica está activada en el tenant
            $setting = Settings::where('key', 'general')->first();
            $config = $setting ? $setting->value : [];
            $boletaElectronica = isset($config['boleta_electronica']) ? (bool) $config['boleta_electronica'] : false;

            if (!$boletaElectronica) {
                Log::info('Boleta electrónica no está activada para este tenant, no se enviará a FacturAPI');
                return null;
            }

            // Obtener información del tenant desde la conexión central
            $tenantId = tenant('id');
            if (!$tenantId) {
                Log::warning('No se pudo obtener el ID del tenant para enviar boleta electrónica');
                return null;
            }

            $centralConnection = config('tenancy.database.central_connection', 'central');
            $tenantRow = DB::connection($centralConnection)->table('tenants')
                ->where('id', $tenantId)
                ->first();

            if (!$tenantRow) {
                Log::warning('No se encontró el tenant para enviar boleta electrónica');
                return null;
            }

            // Los campos personalizados están en el JSON 'data'
            $tenantData = is_string($tenantRow->data) ? json_decode($tenantRow->data, true) : ($tenantRow->data ?? []);
            
            // Acceder a los campos desde el JSON data
            $facturapiEnvironment = $tenantData['facturapi_environment'] ?? null;
            $facturapiToken = $tenantData['facturapi_token'] ?? null;
            
            // También verificar campos directos por si acaso (aunque deberían estar en data)
            if (!$facturapiEnvironment && isset($tenantRow->facturapi_environment)) {
                $facturapiEnvironment = $tenantRow->facturapi_environment;
            }
            if (!$facturapiToken && isset($tenantRow->facturapi_token)) {
                $facturapiToken = $tenantRow->facturapi_token;
            }

            // Si el tenant no tiene configuración, usar la configuración global
            // IMPORTANTE: Terminar tenancy antes de acceder a la configuración global
            if (!$facturapiEnvironment || !$facturapiToken) {
                try {
                    tenancy()->end();
                    $facturapiConfig = \App\Http\Controllers\FacturAPIConfigController::getActiveConfig();
                    $facturapiEnvironment = $facturapiEnvironment ?? $facturapiConfig['environment'] ?? 'dev';
                    $facturapiToken = $facturapiToken ?? $facturapiConfig['token'] ?? '';
                    // Re-inicializar tenancy después de acceder a la configuración global
                    $tenantModel = \App\Models\Tenant::find($tenantId);
                    if ($tenantModel) {
                        tenancy()->initialize($tenantModel);
                    }
                } catch (\Exception $e) {
                    Log::warning('Error obteniendo configuración global de FacturAPI: ' . $e->getMessage());
                    // Intentar re-inicializar tenancy si falló
                    try {
                        $tenantModel = \App\Models\Tenant::find($tenantId);
                        if ($tenantModel) {
                            tenancy()->initialize($tenantModel);
                        }
                    } catch (\Exception $e2) {
                        // Ignorar
                    }
                }
            }

            if (empty($facturapiToken)) {
                Log::warning('Token de FacturAPI no configurado, no se puede enviar boleta electrónica');
                return null;
            }

            // Determinar endpoint según el ambiente
            $endpoints = [
                'dev' => 'https://dev.facturapi.cl/api',
                'prod' => 'https://prod.facturapi.cl/api'
            ];
            $facturapiEndpoint = $endpoints[$facturapiEnvironment] ?? $endpoints['dev'];

            // Validar que el tenant tenga los datos necesarios
            // Acceder a rut y razon_social desde el JSON data
            $tenantRut = $tenantData['rut'] ?? ($tenantRow->rut ?? null);
            $tenantRazonSocial = $tenantData['razon_social'] ?? ($tenantRow->razon_social ?? null);
            $tenantGiro = $tenantData['giro'] ?? ($tenantRow->giro ?? null);
            $tenantDireccion = $tenantData['direccion'] ?? ($tenantRow->direccion ?? null);
            $tenantComuna = $tenantData['comuna'] ?? ($tenantRow->comuna ?? null);
            
            if (empty($tenantRut) || empty($tenantRazonSocial)) {
                Log::warning('El tenant no tiene configurados los datos de facturación necesarios (RUT y Razón Social)');
                return null;
            }

            // Preparar datos de la boleta electrónica para FacturAPI
            // Tipo 39 = Boleta Electrónica
            // Nota: Las boletas en Chile NO tienen IVA, se envía el monto total directamente
            $tenantActeco = $tenantData['acteco'] ?? ($tenantRow->acteco ?? 561000);
            
            $facturapiData = [
                'contribuyente' => $tenantRut,
                'acteco' => $tenantActeco, // Código de actividad económica
                'tipo' => 39, // Tipo 39 = Boleta Electrónica
                'fecha' => null, // null para que FacturAPI genere la fecha automáticamente
                'sucursal' => null,
                'forma_pago' => 1, // 1 = Contado (efectivo)
                'detalles' => [
                    [
                        'nombre' => 'Estacionamiento',
                        'unidad' => 'Und',
                        'precio' => $amount, // Monto total (las boletas no tienen IVA)
                        'cantidad' => 1,
                    ]
                ],
                'return_ted' => true,
            ];

            // Realizar llamada a FacturAPI
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $facturapiToken,
                'Content-Type' => 'application/json',
            ])->post($facturapiEndpoint . '/boletas', $facturapiData);

            // Verificar si la respuesta fue exitosa
            if (!$response->successful()) {
                $errorData = $response->json();
                Log::error('Error al emitir boleta electrónica en FacturAPI', [
                    'session_id' => $session->id,
                    'payment_id' => $payment->id,
                    'error' => $errorData['message'] ?? 'Error desconocido'
                ]);
                return null;
            }

            $responseData = $response->json();
            $ted = $responseData['ted'] ?? null;
            $folio = $responseData['folio'] ?? null;
            // El IVA está en totales.iva según la respuesta de FacturaPi
            $ivaAmount = $responseData['totales']['iva'] ?? 0;
            $sucsii = $responseData['sucsii'] ?? null;
            
            Log::info('Boleta electrónica emitida en FacturAPI', [
                'session_id' => $session->id,
                'payment_id' => $payment->id,
                'folio' => $folio ?? 'N/A',
                'ted' => $ted ? 'presente' : 'no presente',
                'iva_amount' => $ivaAmount,
                'sucsii' => $sucsii,
                'response' => $responseData
            ]);

            return [
                'ted' => $ted,
                'folio' => $folio,
                'tenantRut' => $tenantRut,
                'tenantRazonSocial' => $tenantRazonSocial,
                'tenantGiro' => $tenantGiro,
                'tenantDireccion' => $tenantDireccion,
                'tenantComuna' => $tenantComuna,
                'ivaAmount' => $ivaAmount,
                'sucsii' => $sucsii
            ];

        } catch (\Exception $e) {
            Log::error('Error al enviar boleta electrónica a FacturAPI', [
                'session_id' => $session->id,
                'payment_id' => $payment->id ?? null,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            // No lanzar excepción para que el checkout no falle si hay error en la boleta electrónica
            return null;
        }
    }
}