<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PricingProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'sector_id',
        'name',
        'active_from',
        'active_to',
    ];

    protected $casts = [
        'active_from' => 'datetime',
        'active_to' => 'datetime',
    ];

    /**
     * Relación con sector
     */
    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
    }

    /**
     * Relación con reglas de precios
     */
    public function pricingRules(): HasMany
    {
        return $this->hasMany(PricingRule::class, 'profile_id')
                    ->orderBy('priority');
    }

    /**
     * Relación con reglas de descuento
     */
    public function discountRules(): HasMany
    {
        return $this->hasMany(DiscountRule::class, 'profile_id')
                    ->orderBy('priority');
    }

    /**
     * Verificar si el perfil está activo
     */
    public function isActive(): bool
    {
        $now = now();
        return $this->active_from <= $now && 
               ($this->active_to === null || $this->active_to >= $now);
    }
}
