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
        'name',
        'description',
        'sector_id',
        'is_active',
        'active_from',
        'active_to'
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'active_from' => 'datetime',
        'active_to' => 'datetime',
    ];

    /**
     * Relación con el sector
     */
    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
    }

    /**
     * Relación con las reglas de precios
     */
    public function pricingRules(): HasMany
    {
        return $this->hasMany(PricingRule::class, 'profile_id');
    }

    /**
     * Verificar si el perfil está activo
     */
    public function isActive(): bool
    {
        return $this->is_active;
    }

    /**
     * Activar el perfil
     */
    public function activate(): void
    {
        $this->update(['is_active' => true]);
    }

    /**
     * Desactivar el perfil
     */
    public function deactivate(): void
    {
        $this->update(['is_active' => false]);
    }
}