<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PricingRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'profile_id',
        'rule_type',
        'start_min',
        'end_min',
        'price_per_min',
        'fixed_price',
        'days_of_week',
        'start_time',
        'end_time',
        'priority',
        'min_duration_minutes',
        'max_duration_minutes',
        'is_active',
        'daily_max_amount',
        'min_amount',
        'min_amount_is_base'
    ];

    protected $casts = [
        'start_time' => 'string',
        'end_time' => 'string',
        'price_per_min' => 'decimal:2',
        'fixed_price' => 'decimal:2',
        'days_of_week' => 'array',
        'daily_max_amount' => 'decimal:2',
        'min_amount' => 'decimal:2',
        'is_active' => 'boolean',
        'min_amount_is_base' => 'boolean',
    ];
    
    /**
     * Accessor para obtener start_time como string de hora
     */
    public function getStartTimeAttribute($value)
    {
        if ($value === null) {
            return null;
        }
        
        // Si ya es string, devolverlo
        if (is_string($value)) {
            return $value;
        }
        
        // Si es un objeto DateTime/Carbon, formatear como hora
        if ($value instanceof \DateTime || $value instanceof \Carbon\Carbon) {
            return $value->format('H:i:s');
        }
        
        return $value;
    }
    
    /**
     * Accessor para obtener end_time como string de hora
     */
    public function getEndTimeAttribute($value)
    {
        if ($value === null) {
            return null;
        }
        
        // Si ya es string, devolverlo
        if (is_string($value)) {
            return $value;
        }
        
        // Si es un objeto DateTime/Carbon, formatear como hora
        if ($value instanceof \DateTime || $value instanceof \Carbon\Carbon) {
            return $value->format('H:i:s');
        }
        
        return $value;
    }

    /**
     * Relación con el perfil de precios
     */
    public function pricingProfile(): BelongsTo
    {
        return $this->belongsTo(PricingProfile::class, 'profile_id');
    }

    /**
     * Obtener el precio por minuto formateado
     */
    public function getFormattedPricePerMinute(): ?string
    {
        return $this->price_per_min ? '$' . number_format($this->price_per_min, 0, ',', '.') . '/min' : null;
    }

    /**
     * Obtener el precio fijo formateado
     */
    public function getFormattedFixedPrice(): ?string
    {
        return $this->fixed_price ? '$' . number_format($this->fixed_price, 0, ',', '.') : null;
    }

    /**
     * Verificar si la regla está activa
     */
    public function isActive(): bool
    {
        return $this->is_active;
    }

    /**
     * Obtener el monto mínimo formateado
     */
    public function getFormattedMinAmount(): ?string
    {
        return $this->min_amount ? '$' . number_format($this->min_amount, 0, ',', '.') : null;
    }

    /**
     * Obtener el monto máximo diario formateado
     */
    public function getFormattedDailyMaxAmount(): ?string
    {
        return $this->daily_max_amount ? '$' . number_format($this->daily_max_amount, 0, ',', '.') : null;
    }
}