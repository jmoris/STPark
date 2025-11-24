<?php

namespace App\Services;

use App\Models\PricingProfile;
use App\Models\PricingRule;
use App\Models\Sector;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class PricingService
{
    /**
     * Calcular el precio para una sesión de estacionamiento
     * 
     * @param int $sectorId ID del sector
     * @param int|null $streetId ID de la calle (opcional)
     * @param float $durationMinutes Duración en minutos (para compatibilidad con código existente)
     * @param string|Carbon|null $startedAt Fecha y hora de inicio de la sesión (opcional)
     * @param string|Carbon|null $endedAt Fecha y hora de fin de la sesión (opcional)
     */
    public function calculatePrice(int $sectorId, ?int $streetId, float $durationMinutes, $startedAt = null, $endedAt = null): array
    {
        $sector = Sector::findOrFail($sectorId);
        
        // Obtener el perfil de precios activo para el sector
        $pricingProfile = PricingProfile::where('sector_id', $sectorId)
            ->where('is_active', true)
            ->first();

        if (!$pricingProfile) {
            throw new \Exception('No hay perfil de precios activo para este sector');
        }

        // Obtener las reglas de precios activas
        $pricingRules = PricingRule::where('profile_id', $pricingProfile->id)
            ->where('is_active', true)
            ->orderBy('priority', 'asc')
            ->orderBy('start_time')
            ->get();

        if ($pricingRules->isEmpty()) {
            throw new \Exception('No hay reglas de precios configuradas');
        }

        // Si se proporcionan startedAt y endedAt, calcular basándose en horarios
        if ($startedAt && $endedAt) {
            return $this->calculatePriceByTimeRange($sectorId, $streetId, $startedAt, $endedAt, $pricingProfile, $pricingRules);
        }

        // Si no se proporcionan horarios, usar la lógica antigua (retrocompatibilidad)
        return $this->calculatePriceByDuration($sectorId, $streetId, $durationMinutes, $pricingProfile, $pricingRules);
    }

    /**
     * Calcular precio basándose en rangos horarios de las reglas
     */
    private function calculatePriceByTimeRange(int $sectorId, ?int $streetId, $startedAt, $endedAt, $pricingProfile, $pricingRules): array
    {
        // Parsear started_at: si viene como string ISO con 'Z' (UTC), 
        // interpretar los componentes como hora local de America/Santiago
        // Esto es porque el frontend/envío puede marcar como UTC pero realmente representa la hora local
        if ($startedAt instanceof Carbon) {
            $startTime = $startedAt->copy()->setTimezone('America/Santiago');
        } elseif (is_string($startedAt) && (str_ends_with($startedAt, 'Z') || str_contains($startedAt, '+00:00'))) {
            // Extraer componentes de la fecha UTC pero crear en America/Santiago
            $parsedDate = Carbon::parse($startedAt, 'UTC');
            $startTime = Carbon::create(
                $parsedDate->year,
                $parsedDate->month,
                $parsedDate->day,
                $parsedDate->hour,
                $parsedDate->minute,
                $parsedDate->second,
                'America/Santiago'
            );
        } else {
            $startTime = Carbon::parse($startedAt)->setTimezone('America/Santiago');
        }

        // Parsear ended_at: si viene como string ISO con 'Z' (UTC), 
        // interpretar los componentes como hora local de America/Santiago
        if ($endedAt instanceof Carbon) {
            $endTime = $endedAt->copy()->setTimezone('America/Santiago');
        } elseif (is_string($endedAt) && (str_ends_with($endedAt, 'Z') || str_contains($endedAt, '+00:00'))) {
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
        } else {
            $endTime = Carbon::parse($endedAt)->setTimezone('America/Santiago');
        }
        
        $durationMinutes = $startTime->diffInMinutes($endTime);
        
        $breakdown = [];
        $totalAmount = 0;
        $dailyMaxAmount = $this->getDailyMaxAmount($pricingRules);
        
        // Identificar la primera regla que aplica al horario de entrada
        $firstRule = $this->findRuleAtTime($startTime, $pricingRules);
        $minAmountApplied = false;
        $minDurationUsed = 0;
        $minAmountValue = null;
        
        // Si la primera regla tiene tarifa mínima base, preparar para aplicarla
        if ($firstRule && $firstRule->min_amount_is_base && $firstRule->min_amount) {
            $minDurationUsed = $firstRule->min_duration_minutes ?? 0;
            $minAmountValue = $firstRule->min_amount;
        }
        
        // PASO 1: Aplicar tiempo mínimo una vez al inicio si existe
        $remainingMinutes = $durationMinutes;
        if ($minDurationUsed > 0 && $minAmountValue && $durationMinutes >= $minDurationUsed) {
            // Aplicar el monto mínimo por el tiempo mínimo
            $totalAmount += $minAmountValue;
            $minAmountApplied = true;
            $remainingMinutes = $durationMinutes - $minDurationUsed;
            
            Log::info('Aplicando tiempo mínimo al inicio', [
                'min_duration' => $minDurationUsed,
                'min_amount' => $minAmountValue,
                'total_duration' => $durationMinutes,
                'remaining_minutes' => $remainingMinutes
            ]);
        }
        
        // PASO 2: Distribuir los minutos restantes entre las reglas según sus horarios
        // Primero calcular cuántos minutos corresponden a cada regla
        $ruleMinutes = [];
        foreach ($pricingRules as $rule) {
            $minutes = $this->calculateMinutesInRule($startTime, $endTime, $rule);
            if ($minutes > 0) {
                $ruleMinutes[$rule->id] = [
                    'rule' => $rule,
                    'total_minutes' => $minutes
                ];
            }
        }
        
        // PASO 3: Descontar el tiempo mínimo de los minutos de las reglas
        // Distribuir el tiempo mínimo proporcionalmente entre las reglas que aplican
        $remainingMinDuration = $minDurationUsed;
        foreach ($ruleMinutes as $ruleId => $ruleData) {
            $rule = $ruleData['rule'];
            $totalRuleMinutes = $ruleData['total_minutes'];
            
            // Si todavía hay tiempo mínimo por descontar
            if ($remainingMinDuration > 0 && $totalRuleMinutes > 0) {
                // Descontar el tiempo mínimo de esta regla
                $minutesToDiscount = min($totalRuleMinutes, $remainingMinDuration);
                $ruleMinutes[$ruleId]['minutes_to_charge'] = max(0, $totalRuleMinutes - $minutesToDiscount);
                $remainingMinDuration -= $minutesToDiscount;
                
                Log::info('Descontando tiempo mínimo de regla', [
                    'rule_name' => $rule->name,
                    'total_minutes' => $totalRuleMinutes,
                    'minutes_discounted' => $minutesToDiscount,
                    'minutes_to_charge' => $ruleMinutes[$ruleId]['minutes_to_charge'],
                    'remaining_min_duration' => $remainingMinDuration
                ]);
            } else {
                // No hay tiempo mínimo pendiente, cobrar todos los minutos
                $ruleMinutes[$ruleId]['minutes_to_charge'] = $totalRuleMinutes;
            }
        }
        
        // PASO 4: Calcular el costo para cada regla con los minutos restantes
        foreach ($ruleMinutes as $ruleId => $ruleData) {
            $rule = $ruleData['rule'];
            $minutesToCharge = $ruleData['minutes_to_charge'];
            
            if ($minutesToCharge > 0) {
                $ruleAmount = $this->calculateRuleAmount($rule, $minutesToCharge);
                $minAmount = $rule->min_amount;
                
                // Aplicar monto mínimo tradicional si existe (solo si no es tarifa base)
                if ($minAmount && !$rule->min_amount_is_base && $ruleAmount < $minAmount) {
                    $ruleAmount = $minAmount;
                }
                
                $breakdown[] = [
                    'rule_name' => $rule->name,
                    'minutes' => $minutesToCharge,
                    'rate_per_minute' => $rule->price_per_min,
                    'amount' => $ruleAmount,
                    'base_amount' => $ruleAmount,
                    'min_amount' => $minAmount,
                    'daily_max_amount' => null,
                    'final_amount' => $ruleAmount,
                    'min_amount_applied' => false,
                    'daily_max_applied' => false
                ];
                
                $totalAmount += $ruleAmount;
                
                Log::info('Calculando costo para regla', [
                    'rule_name' => $rule->name,
                    'minutes_to_charge' => $minutesToCharge,
                    'amount' => $ruleAmount
                ]);
            }
        }
        
        // Si se aplicó tiempo mínimo, agregarlo al breakdown
        if ($minAmountApplied && $minDurationUsed > 0) {
            // Insertar al inicio del breakdown
            array_unshift($breakdown, [
                'rule_name' => $firstRule->name,
                'minutes' => $minDurationUsed,
                'rate_per_minute' => $firstRule->price_per_min,
                'amount' => $minAmountValue,
                'base_amount' => $minAmountValue,
                'min_amount' => $minAmountValue,
                'daily_max_amount' => null,
                'final_amount' => $minAmountValue,
                'min_amount_applied' => true,
                'daily_max_applied' => false
            ]);
        }
        
        // Si no se aplicó ninguna regla, usar la lógica antigua como fallback
        if (empty($breakdown)) {
            Log::warning('No se aplicaron reglas basadas en horarios, usando fallback', [
                'started_at' => $startTime->toDateTimeString(),
                'ended_at' => $endTime->toDateTimeString()
            ]);
            return $this->calculatePriceByDuration($sectorId, $streetId, $durationMinutes, $pricingProfile, $pricingRules);
        }
        
        // Aplicar máximo diario global si existe
        $dailyMaxApplied = false;
        if ($dailyMaxAmount && $totalAmount > $dailyMaxAmount) {
            $totalAmount = $dailyMaxAmount;
            $dailyMaxApplied = true;
        }
        
        return [
            'total' => $totalAmount,
            'breakdown' => $breakdown,
            'duration_minutes' => $durationMinutes,
            'pricing_profile' => $pricingProfile->name,
            'min_amount_applied' => $minAmountApplied,
            'daily_max_applied' => $dailyMaxApplied
        ];
    }

    /**
     * Calcular precio basándose solo en duración (lógica antigua para compatibilidad)
     */
    private function calculatePriceByDuration(int $sectorId, ?int $streetId, float $durationMinutes, $pricingProfile, $pricingRules): array
    {
        // Encontrar la regla aplicable basada en la duración
        $applicableRule = $this->findApplicableRule($pricingRules, $durationMinutes);
        
        if (!$applicableRule) {
            throw new \Exception('No se encontró una regla aplicable para la duración especificada');
        }

        // Redondear los minutos hacia arriba para evitar decimales
        $roundedMinutes = ceil($durationMinutes);
        
        // Calcular el monto base (sin aplicar mínimos/máximos)
        $baseAmountCalculated = $this->calculateRuleAmount($applicableRule, $roundedMinutes);
        
        // Aplicar monto mínimo si existe
        $minAmount = $applicableRule->min_amount;
        $baseAmount = $baseAmountCalculated;
        
        // Si min_amount_is_base está activo, aplicar lógica especial
        if ($applicableRule->min_amount_is_base && $minAmount) {
            $minDuration = $applicableRule->min_duration_minutes ?? 0;
            
            Log::info('Aplicando lógica de monto mínimo como base', [
                'min_amount_is_base' => $applicableRule->min_amount_is_base,
                'min_amount' => $minAmount,
                'min_duration' => $minDuration,
                'rounded_minutes' => $roundedMinutes,
                'price_per_min' => $applicableRule->price_per_min
            ]);
            
            if ($roundedMinutes <= $minDuration) {
                // Si no supera el tiempo mínimo, cobrar solo el monto mínimo
                $baseAmount = $minAmount;
                Log::info('No supera tiempo mínimo, cobrando solo monto mínimo', ['amount' => $baseAmount]);
            } else {
                // Si supera el tiempo mínimo, cobrar monto mínimo + minutos adicionales
                $extraMinutes = $roundedMinutes - $minDuration;
                $pricePerMin = (float) $applicableRule->price_per_min;
                $baseAmount = $minAmount + ($extraMinutes * $pricePerMin);
                Log::info('Supera tiempo mínimo, calculando adicionales', [
                    'extra_minutes' => $extraMinutes,
                    'price_per_min' => $pricePerMin,
                    'additional_amount' => ($extraMinutes * $pricePerMin),
                    'total_amount' => $baseAmount
                ]);
            }
        } elseif ($minAmount && $baseAmount < $minAmount) {
            // Lógica tradicional: aplicar monto mínimo si el calculado es menor
            $baseAmount = $minAmount;
            Log::info('Aplicando lógica tradicional de monto mínimo', ['amount' => $baseAmount]);
        }
        
        // Aplicar monto máximo diario si existe
        $dailyMaxAmount = $applicableRule->daily_max_amount;
        if ($dailyMaxAmount && $baseAmount > $dailyMaxAmount) {
            $baseAmount = $dailyMaxAmount;
        }
        
        $breakdown = [
            [
                'rule_name' => $applicableRule->name,
                'minutes' => $roundedMinutes, // Usar minutos redondeados
                'rate_per_minute' => $applicableRule->price_per_min,
                'amount' => $baseAmount, // Campo que espera el frontend
                'base_amount' => $baseAmountCalculated,
                'min_amount' => $minAmount,
                'daily_max_amount' => $dailyMaxAmount,
                'final_amount' => $baseAmount,
                'min_amount_applied' => $minAmount && $baseAmount == $minAmount,
                'daily_max_applied' => $dailyMaxAmount && $baseAmount == $dailyMaxAmount
            ]
        ];

        return [
            'total' => $baseAmount,
            'breakdown' => $breakdown,
            'duration_minutes' => $durationMinutes,
            'pricing_profile' => $pricingProfile->name,
            'min_amount_applied' => $minAmount && $baseAmount == $minAmount,
            'daily_max_applied' => $dailyMaxAmount && $baseAmount == $dailyMaxAmount
        ];
    }

    /**
     * Encontrar la regla que aplica a un momento específico
     */
    private function findRuleAtTime(Carbon $time, $pricingRules): ?PricingRule
    {
        $timeOfDay = $time->format('H:i:s');
        $dayOfWeek = $time->dayOfWeek; // 0 = domingo, 6 = sábado
        
        foreach ($pricingRules as $rule) {
            if (!$rule->start_time || !$rule->end_time) {
                continue;
            }
            
            // Verificar días de la semana si están configurados
            if ($rule->days_of_week && is_array($rule->days_of_week) && !empty($rule->days_of_week)) {
                if (!in_array($dayOfWeek, $rule->days_of_week)) {
                    continue;
                }
            }
            
            $ruleStartTime = is_string($rule->start_time) ? $rule->start_time : 
                (($rule->start_time instanceof \DateTime || $rule->start_time instanceof \Carbon\Carbon) 
                    ? $rule->start_time->format('H:i:s') : (string) $rule->start_time);
            $ruleEndTime = is_string($rule->end_time) ? $rule->end_time : 
                (($rule->end_time instanceof \DateTime || $rule->end_time instanceof \Carbon\Carbon) 
                    ? $rule->end_time->format('H:i:s') : (string) $rule->end_time);
            
            // Normalizar formato
            if (strlen($ruleStartTime) == 5) {
                $ruleStartTime .= ':00';
            }
            if (strlen($ruleEndTime) == 5) {
                $ruleEndTime .= ':00';
            }
            
            // Verificar si el tiempo está dentro del rango de la regla
            // Nota: end_time es exclusivo (no incluye ese momento)
            $timeInRange = false;
            
            if ($ruleStartTime <= $ruleEndTime) {
                // Rango normal (no cruza medianoche)
                // El tiempo debe ser >= start_time y < end_time
                $timeInRange = ($timeOfDay >= $ruleStartTime && $timeOfDay < $ruleEndTime);
            } else {
                // Rango que cruza medianoche (ej: 18:00 a 03:00)
                // El tiempo debe ser >= start_time (hasta 23:59:59) O < end_time (desde 00:00:00)
                $timeInRange = ($timeOfDay >= $ruleStartTime || $timeOfDay < $ruleEndTime);
            }
            
            if ($timeInRange) {
                Log::info('Regla encontrada para tiempo', [
                    'time' => $time->format('Y-m-d H:i:s'),
                    'rule_name' => $rule->name,
                    'rule_start' => $ruleStartTime,
                    'rule_end' => $ruleEndTime
                ]);
                return $rule;
            }
        }
        
        // Si no se encuentra ninguna regla específica, retornar la primera por prioridad
        return $pricingRules->first();
    }

    /**
     * Calcular cuántos minutos de la sesión caen dentro del horario de una regla
     */
    private function calculateMinutesInRule(Carbon $sessionStart, Carbon $sessionEnd, PricingRule $rule): int
    {
        // Si la regla no tiene horario definido, no aplica
        if (!$rule->start_time || !$rule->end_time) {
            return 0;
        }
        
        // Obtener el horario de la regla como strings
        $rawStartTime = $rule->getAttributes()['start_time'] ?? $rule->start_time;
        $rawEndTime = $rule->getAttributes()['end_time'] ?? $rule->end_time;
        
        // Convertir a string en formato HH:mm:ss
        $ruleStartTimeStr = is_string($rawStartTime) ? $rawStartTime : 
            (($rawStartTime instanceof \DateTime || $rawStartTime instanceof \Carbon\Carbon) 
                ? $rawStartTime->format('H:i:s') : (string) $rawStartTime);
        $ruleEndTimeStr = is_string($rawEndTime) ? $rawEndTime : 
            (($rawEndTime instanceof \DateTime || $rawEndTime instanceof \Carbon\Carbon) 
                ? $rawEndTime->format('H:i:s') : (string) $rawEndTime);
        
        // Normalizar formato (asegurar que tenga segundos)
        if (strlen($ruleStartTimeStr) == 5) {
            $ruleStartTimeStr .= ':00';
        }
        if (strlen($ruleEndTimeStr) == 5) {
            $ruleEndTimeStr .= ':00';
        }
        
        // Determinar si la regla cruza medianoche
        $ruleStartHour = (int) substr($ruleStartTimeStr, 0, 2);
        $ruleStartMin = (int) substr($ruleStartTimeStr, 3, 2);
        $ruleEndHour = (int) substr($ruleEndTimeStr, 0, 2);
        $ruleEndMin = (int) substr($ruleEndTimeStr, 3, 2);
        $ruleCrossesMidnight = ($ruleEndHour < $ruleStartHour || ($ruleEndHour == $ruleStartHour && $ruleEndMin < $ruleStartMin));
        
        $totalMinutes = 0;
        $startDay = $sessionStart->copy()->startOfDay();
        $endDay = $sessionEnd->copy()->startOfDay();
        $currentDay = $startDay->copy();
        
        // Iterar por cada día desde el inicio hasta el fin de la sesión (inclusive)
        do {
            // Verificar días de la semana si están configurados
            $dayOfWeek = $currentDay->dayOfWeek; // 0 = domingo, 6 = sábado
            if ($rule->days_of_week && is_array($rule->days_of_week) && !empty($rule->days_of_week)) {
                if (!in_array($dayOfWeek, $rule->days_of_week)) {
                    $currentDay->addDay();
                    continue;
                }
            }
            
            // Determinar el periodo de la sesión en este día
            if ($currentDay->isSameDay($sessionStart) && $currentDay->isSameDay($sessionEnd)) {
                $sessionPeriodStart = $sessionStart->copy();
                $sessionPeriodEnd = $sessionEnd->copy();
            } elseif ($currentDay->isSameDay($sessionStart)) {
                $sessionPeriodStart = $sessionStart->copy();
                $sessionPeriodEnd = $currentDay->copy()->endOfDay();
            } elseif ($currentDay->isSameDay($sessionEnd)) {
                $sessionPeriodStart = $currentDay->copy()->startOfDay();
                $sessionPeriodEnd = $sessionEnd->copy();
            } else {
                $sessionPeriodStart = $currentDay->copy()->startOfDay();
                $sessionPeriodEnd = $currentDay->copy()->endOfDay();
            }
            
            if ($ruleCrossesMidnight) {
                // La regla cruza medianoche: considerar la parte que termina en este día (del día anterior)
                // y la parte que comienza en este día
                
                // Parte 1: Continuación de la regla del día anterior (00:00 hasta ruleEnd)
                $ruleEndFromPrevious = $currentDay->copy()->setTimeFromTimeString($ruleEndTimeStr);
                $intersectionStart1 = $sessionPeriodStart->copy()->max($currentDay->copy()->startOfDay());
                $intersectionEnd1 = $sessionPeriodEnd->copy()->min($ruleEndFromPrevious);
                
                if ($intersectionStart1->lt($intersectionEnd1)) {
                    $minutes1 = (int) round($intersectionStart1->diffInMinutes($intersectionEnd1));
                    if ($minutes1 > 0) {
                        $totalMinutes += $minutes1;
                    }
                }
                
                // Parte 2: Regla que comienza en este día (ruleStart hasta medianoche del día siguiente)
                $ruleStartThisDay = $currentDay->copy()->setTimeFromTimeString($ruleStartTimeStr);
                $ruleEndThisDay = $currentDay->copy()->addDay()->setTimeFromTimeString($ruleEndTimeStr);
                $intersectionStart2 = $sessionPeriodStart->copy()->max($ruleStartThisDay);
                $intersectionEnd2 = $sessionPeriodEnd->copy()->min($ruleEndThisDay);
                
                if ($intersectionStart2->lt($intersectionEnd2)) {
                    $minutes2 = (int) round($intersectionStart2->diffInMinutes($intersectionEnd2));
                    if ($minutes2 > 0) {
                        $totalMinutes += $minutes2;
                    }
                }
            } else {
                // La regla no cruza medianoche: comportamiento normal
                $ruleStart = $currentDay->copy()->setTimeFromTimeString($ruleStartTimeStr);
                $ruleEnd = $currentDay->copy()->setTimeFromTimeString($ruleEndTimeStr);
                
                $intersectionStart = $sessionPeriodStart->copy()->max($ruleStart);
                $intersectionEnd = $sessionPeriodEnd->copy()->min($ruleEnd);
                
                if ($intersectionStart->lt($intersectionEnd)) {
                    $dayMinutes = (int) round($intersectionStart->diffInMinutes($intersectionEnd));
                    if ($dayMinutes > 0) {
                        $totalMinutes += $dayMinutes;
                    }
                }
            }
            
            $currentDay->addDay();
        } while ($currentDay->lte($endDay));
        
        return $totalMinutes;
    }

    /**
     * Encontrar la regla aplicable basada en la duración
     */
    private function findApplicableRule($pricingRules, float $durationMinutes): ?PricingRule
    {
        foreach ($pricingRules as $rule) {
            // Verificar si la duración está dentro del rango de la regla
            $minDuration = $rule->min_duration_minutes ?? 0;
            $maxDuration = $rule->max_duration_minutes ?? PHP_INT_MAX;
            
            if ($durationMinutes >= $minDuration && $durationMinutes <= $maxDuration) {
                return $rule;
            }
        }
        
        // Si no se encuentra una regla específica, usar la regla con mayor prioridad
        return $pricingRules->first();
    }

    /**
     * Calcular el monto para una regla específica
     */
    private function calculateRuleAmount(PricingRule $rule, float $minutes): float
    {
        // Convertir price_per_min a float para asegurar el cálculo correcto
        $pricePerMin = (float) $rule->price_per_min;
        $amount = $minutes * $pricePerMin;
        
        // Aplicar precio fijo si existe y es mayor que 0
        if ($rule->fixed_price && $rule->fixed_price > 0) {
            $amount = (float) $rule->fixed_price;
        }
        
        return $amount;
    }

    /**
     * Obtener cotización estimada para una duración específica
     */
    public function getEstimatedQuote(int $sectorId, ?int $streetId, int $estimatedMinutes): array
    {
        return $this->calculatePrice($sectorId, $streetId, $estimatedMinutes);
    }

    /**
     * Verificar si hay reglas de precios configuradas para un sector
     */
    public function hasPricingRules(int $sectorId): bool
    {
        $pricingProfile = PricingProfile::where('sector_id', $sectorId)
            ->where('is_active', true)
            ->first();

        if (!$pricingProfile) {
            return false;
        }

        return PricingRule::where('profile_id', $pricingProfile->id)
            ->where('is_active', true)
            ->exists();
    }

    /**
     * Obtener el máximo diario de las reglas de precios
     */
    private function getDailyMaxAmount($pricingRules): ?float
    {
        $maxAmount = null;
        
        foreach ($pricingRules as $rule) {
            if ($rule->daily_max_amount && $rule->daily_max_amount > 0) {
                if ($maxAmount === null || $rule->daily_max_amount < $maxAmount) {
                    $maxAmount = $rule->daily_max_amount;
                }
            }
        }
        
        return $maxAmount;
    }

    /**
     * Aplicar el máximo diario al breakdown
     */
    private function applyDailyMaxToBreakdown(array &$breakdown, float $dailyMaxAmount): void
    {
        $originalTotal = 0;
        foreach ($breakdown as $item) {
            $originalTotal += $item['amount'];
        }
        
        if ($originalTotal > $dailyMaxAmount) {
            // Agregar una entrada al breakdown indicando que se aplicó el límite
            $breakdown[] = [
                'rule_name' => 'Límite máximo diario aplicado',
                'minutes' => 0,
                'rate_per_minute' => 0,
                'amount' => $dailyMaxAmount - $originalTotal,
                'daily_max_amount' => $dailyMaxAmount,
                'is_daily_max_adjustment' => true
            ];
        }
    }

    /**
     * Redondear un monto a múltiplos de un valor específico
     */
    private function roundToMultipleOf(float $amount, float $multiple): int
    {
        // Redondear hacia arriba al múltiplo más cercano
        return (int) ceil($amount / $multiple) * $multiple;
    }

}