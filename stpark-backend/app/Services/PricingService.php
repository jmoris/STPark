<?php

namespace App\Services;

use App\Models\ParkingSession;
use App\Models\PricingProfile;
use App\Models\PricingRule;
use App\Models\DiscountRule;
use Carbon\Carbon;

class PricingService
{
    /**
     * Calcular cotización para una sesión
     */
    public function calculateQuote(ParkingSession $session, string $endedAt): array
    {
        $startTime = Carbon::parse($session->started_at);
        $endTime = Carbon::parse($endedAt);
        
        $durationMinutes = $endTime->diffInMinutes($startTime);
        $dayOfWeek = $startTime->dayOfWeek;

        // Obtener perfil de precios activo para el sector
        $pricingProfile = $this->getActivePricingProfile($session->sector_id, $startTime);
        
        if (!$pricingProfile) {
            throw new \Exception('No hay perfil de precios activo para este sector');
        }

        // Calcular monto bruto
        $grossAmount = $this->calculateGrossAmount(
            $pricingProfile,
            $durationMinutes,
            $dayOfWeek,
            $startTime->format('H:i:s')
        );

        // Aplicar descuentos
        $discountAmount = $this->calculateDiscounts(
            $pricingProfile,
            $grossAmount,
            $durationMinutes,
            $dayOfWeek
        );

        $netAmount = max(0, $grossAmount - $discountAmount);

        return [
            'session_id' => $session->id,
            'started_at' => $session->started_at,
            'ended_at' => $endedAt,
            'duration_minutes' => $durationMinutes,
            'gross_amount' => $grossAmount,
            'discount_amount' => $discountAmount,
            'net_amount' => $netAmount,
            'pricing_profile' => $pricingProfile->name,
        ];
    }

    /**
     * Obtener perfil de precios activo
     */
    private function getActivePricingProfile(int $sectorId, Carbon $date): ?PricingProfile
    {
        return PricingProfile::where('sector_id', $sectorId)
            ->where('active_from', '<=', $date)
            ->where(function($query) use ($date) {
                $query->whereNull('active_to')
                      ->orWhere('active_to', '>=', $date);
            })
            ->orderBy('active_from', 'desc')
            ->first();
    }

    /**
     * Calcular monto bruto
     */
    private function calculateGrossAmount(
        PricingProfile $profile,
        int $durationMinutes,
        int $dayOfWeek,
        string $time
    ): float {
        $rules = $profile->pricingRules()
                        ->where(function($query) use ($dayOfWeek, $time) {
                            $query->whereJsonContains('days_of_week', $dayOfWeek)
                                  ->where(function($timeQuery) use ($time) {
                                      $timeQuery->whereNull('start_time')
                                                ->whereNull('end_time')
                                                ->orWhere(function($timeRange) use ($time) {
                                                    $timeRange->where('start_time', '<=', $time)
                                                             ->where('end_time', '>=', $time);
                                                });
                                  });
                        })
                        ->orderBy('priority')
                        ->get();

        $totalAmount = 0;

        foreach ($rules as $rule) {
            if ($this->ruleAppliesToDuration($rule, $durationMinutes)) {
                if ($rule->fixed_price) {
                    $totalAmount += $rule->fixed_price;
                } else {
                    $applicableMinutes = $this->getApplicableMinutes($rule, $durationMinutes);
                    $totalAmount += $applicableMinutes * $rule->price_per_min;
                }
            }
        }

        return $totalAmount;
    }

    /**
     * Verificar si la regla aplica a la duración
     */
    private function ruleAppliesToDuration(PricingRule $rule, int $durationMinutes): bool
    {
        if ($rule->start_min === null && $rule->end_min === null) {
            return true;
        }

        if ($rule->start_min !== null && $durationMinutes < $rule->start_min) {
            return false;
        }

        if ($rule->end_min !== null && $durationMinutes > $rule->end_min) {
            return false;
        }

        return true;
    }

    /**
     * Obtener minutos aplicables según la regla
     */
    private function getApplicableMinutes(PricingRule $rule, int $durationMinutes): int
    {
        if ($rule->start_min === null && $rule->end_min === null) {
            return $durationMinutes;
        }

        $start = $rule->start_min ?? 0;
        $end = $rule->end_min ?? $durationMinutes;

        return min($durationMinutes, $end) - $start;
    }

    /**
     * Calcular descuentos
     */
    private function calculateDiscounts(
        PricingProfile $profile,
        float $grossAmount,
        int $durationMinutes,
        int $dayOfWeek
    ): float {
        $rules = $profile->discountRules()
                        ->orderBy('priority')
                        ->get();

        $totalDiscount = 0;

        foreach ($rules as $rule) {
            $context = [
                'gross_amount' => $grossAmount,
                'minutes' => $durationMinutes,
                'day_of_week' => $dayOfWeek,
            ];

            if ($rule->applies($context)) {
                $discount = $this->calculateDiscountAmount($rule, $grossAmount);
                $totalDiscount += $discount;
            }
        }

        return min($totalDiscount, $grossAmount);
    }

    /**
     * Calcular monto de descuento
     */
    private function calculateDiscountAmount(DiscountRule $rule, float $grossAmount): float
    {
        switch ($rule->kind) {
            case 'PERCENTAGE':
                $discount = $grossAmount * ($rule->value / 100);
                break;
            case 'FIXED':
                $discount = $rule->value;
                break;
            default:
                $discount = 0;
        }

        if ($rule->max_amount && $discount > $rule->max_amount) {
            $discount = $rule->max_amount;
        }

        return $discount;
    }
}
