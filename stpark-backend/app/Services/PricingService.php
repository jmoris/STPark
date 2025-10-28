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
     */
    public function calculatePrice(int $sectorId, ?int $streetId, float $durationMinutes): array
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