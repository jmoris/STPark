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
        $startTime = Carbon::parse($startedAt);
        $endTime = Carbon::parse($endedAt);
        $durationMinutes = $startTime->diffInMinutes($endTime);
        
        $breakdown = [];
        $totalAmount = 0;
        $dailyMaxAmount = $this->getDailyMaxAmount($pricingRules);
        
        // Calcular minutos y costo para cada regla aplicable
        foreach ($pricingRules as $rule) {
            $minutes = $this->calculateMinutesInRule($startTime, $endTime, $rule);
            
            $startTimeStr = is_string($rule->start_time) ? $rule->start_time : ($rule->start_time ? $rule->start_time->format('H:i:s') : null);
            $endTimeStr = is_string($rule->end_time) ? $rule->end_time : ($rule->end_time ? $rule->end_time->format('H:i:s') : null);
            
            Log::info('Evaluando regla', [
                'rule_name' => $rule->name,
                'start_time' => $startTimeStr,
                'end_time' => $endTimeStr,
                'minutes_calculated' => $minutes,
                'session_start' => $startTime->format('Y-m-d H:i:s'),
                'session_end' => $endTime->format('Y-m-d H:i:s'),
                'rule_start_time_raw' => $rule->start_time,
                'rule_end_time_raw' => $rule->end_time,
                'rule_start_time_type' => gettype($rule->start_time),
                'rule_end_time_type' => gettype($rule->end_time)
            ]);
            
            if ($minutes > 0) {
                // NO verificar duración mínima aquí - la duración mínima se refiere a la duración total
                // de la sesión, no a los minutos dentro del horario de esta regla específica
                
                // Calcular el costo base para esta regla
                $baseAmountCalculated = $this->calculateRuleAmount($rule, $minutes);
                
                // Aplicar monto mínimo si existe (solo para esta regla específica)
                $minAmount = $rule->min_amount;
                $ruleAmount = $baseAmountCalculated;
                
                // Si min_amount_is_base está activo, aplicar lógica especial
                if ($rule->min_amount_is_base && $minAmount) {
                    $minDuration = $rule->min_duration_minutes ?? 0;
                    if ($minutes <= $minDuration) {
                        $ruleAmount = $minAmount;
                    } else {
                        $extraMinutes = $minutes - $minDuration;
                        $pricePerMin = (float) $rule->price_per_min;
                        $ruleAmount = $minAmount + ($extraMinutes * $pricePerMin);
                    }
                } elseif ($minAmount && $ruleAmount < $minAmount) {
                    // Solo aplicar mínimo si el monto calculado es menor
                    // Pero esto podría no tener sentido para reglas parciales
                    // $ruleAmount = $minAmount;
                }
                
                // NO aplicar máximo diario individualmente a cada regla
                // El máximo diario se aplica al total final
                
                $breakdown[] = [
                    'rule_name' => $rule->name,
                    'minutes' => $minutes,
                    'rate_per_minute' => $rule->price_per_min,
                    'amount' => $ruleAmount,
                    'base_amount' => $baseAmountCalculated,
                    'min_amount' => $minAmount,
                    'daily_max_amount' => null, // No aplicar por regla individual
                    'final_amount' => $ruleAmount,
                    'min_amount_applied' => $minAmount && $ruleAmount == $minAmount,
                    'daily_max_applied' => false
                ];
                
                $totalAmount += $ruleAmount;
            }
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
            'min_amount_applied' => false,
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
     * Calcular cuántos minutos de la sesión caen dentro del horario de una regla
     * Solución simplificada: para cada día que cubre la sesión, crear instancias del horario de la regla
     * y calcular la intersección directa con el periodo de la sesión
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
        
        $totalMinutes = 0;
        
        // Obtener todos los días que cubre la sesión (incluso si cruza medianoche)
        $startDay = $sessionStart->copy()->startOfDay();
        $endDay = $sessionEnd->copy()->startOfDay();
        
        // Iterar por cada día desde el inicio hasta el fin de la sesión
        $currentDay = $startDay->copy();
        
        // Usar lte() de Carbon para comparación correcta, y asegurar que incluimos el día siguiente
        do {
            // Crear instancias del horario de la regla para este día
            $ruleStart = $currentDay->copy()->setTimeFromTimeString($ruleStartTimeStr);
            $ruleEnd = $currentDay->copy()->setTimeFromTimeString($ruleEndTimeStr);
            
            // Determinar si la regla cruza medianoche (end_time < start_time)
            $ruleStartHour = (int) $ruleStart->format('H');
            $ruleStartMin = (int) $ruleStart->format('i');
            $ruleEndHour = (int) $ruleEnd->format('H');
            $ruleEndMin = (int) $ruleEnd->format('i');
            
            if ($ruleEndHour < $ruleStartHour || ($ruleEndHour == $ruleStartHour && $ruleEndMin < $ruleStartMin)) {
                // La regla cruza medianoche, el fin está al día siguiente
                $ruleEnd->addDay();
            }
            
            // Determinar el periodo de la sesión en este día
            $sessionPeriodStart = $currentDay->copy();
            $sessionPeriodEnd = $currentDay->copy()->endOfDay();
            
            if ($currentDay->isSameDay($sessionStart)) {
                $sessionPeriodStart = $sessionStart->copy();
            }
            if ($currentDay->isSameDay($sessionEnd)) {
                $sessionPeriodEnd = $sessionEnd->copy();
            } elseif ($sessionEnd->gt($currentDay->copy()->endOfDay())) {
                $sessionPeriodEnd = $currentDay->copy()->endOfDay();
            }
            
            // Calcular la intersección entre el periodo de la sesión y el horario de la regla
            $intersectionStart = $sessionPeriodStart->copy()->max($ruleStart);
            $intersectionEnd = $sessionPeriodEnd->copy()->min($ruleEnd);
            
            // Si hay intersección válida, calcular los minutos
            if ($intersectionStart->lt($intersectionEnd)) {
                $dayMinutes = (int) round($intersectionStart->diffInMinutes($intersectionEnd));
                $totalMinutes += $dayMinutes;
            }
            
            // Avanzar al siguiente día
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