<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Sector extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'is_private',
        'is_active'
    ];

    protected $casts = [
        'is_private' => 'boolean',
        'is_active' => 'boolean',
    ];

    /**
     * Relación con las calles
     */
    public function streets(): HasMany
    {
        return $this->hasMany(Street::class);
    }

    /**
     * Relación con las sesiones de estacionamiento
     */
    public function parkingSessions(): HasMany
    {
        return $this->hasMany(ParkingSession::class);
    }

    /**
     * Relación con los operadores asignados
     */
    public function operators(): BelongsToMany
    {
        return $this->belongsToMany(Operator::class, 'operator_assignments')
            ->withPivot(['street_id', 'valid_from', 'valid_to'])
            ->withTimestamps();
    }

    /**
     * Relación con los perfiles de precios
     */
    public function pricingProfiles(): HasMany
    {
        return $this->hasMany(PricingProfile::class);
    }

    /**
     * Verificar si el sector está activo
     */
    public function isActive(): bool
    {
        return $this->is_active;
    }

    /**
     * Verificar si es un sector público
     */
    public function isPublic(): bool
    {
        return !$this->is_private;
    }

    /**
     * Verificar si es un sector privado
     */
    public function isPrivate(): bool
    {
        return $this->is_private;
    }

    /**
     * Obtener el tipo formateado
     */
    public function getTypeText(): string
    {
        return $this->is_private ? 'Privado' : 'Público';
    }

    /**
     * Obtener el estado formateado
     */
    public function getStatusText(): string
    {
        return $this->is_active ? 'Activo' : 'Inactivo';
    }
}