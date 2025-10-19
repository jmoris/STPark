<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DiscountRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'profile_id',
        'kind',
        'condition_json',
        'value',
        'max_amount',
        'priority',
    ];

    protected $casts = [
        'condition_json' => 'array',
        'value' => 'decimal:2',
        'max_amount' => 'decimal:2',
        'priority' => 'integer',
    ];

    /**
     * Relación con perfil de precios
     */
    public function pricingProfile(): BelongsTo
    {
        return $this->belongsTo(PricingProfile::class, 'profile_id');
    }

    /**
     * Verificar si la regla de descuento aplica según las condiciones
     */
    public function applies(array $context): bool
    {
        foreach ($this->condition_json as $condition => $value) {
            switch ($condition) {
                case 'min_amount':
                    if (($context['gross_amount'] ?? 0) < $value) {
                        return false;
                    }
                    break;
                case 'max_amount':
                    if (($context['gross_amount'] ?? 0) > $value) {
                        return false;
                    }
                    break;
                case 'min_minutes':
                    if (($context['minutes'] ?? 0) < $value) {
                        return false;
                    }
                    break;
                case 'max_minutes':
                    if (($context['gestures'] ?? 0) > $value) {
                        return false;
                    }
                    break;
                case 'day_of_week':
                    if (!in_array(($context['day_of_week'] ?? 0), (array)$value)) {
                        return false;
                    }
                    break;
            }
        }
        return true;
    }
}
