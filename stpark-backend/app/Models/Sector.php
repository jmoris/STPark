<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sector extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'is_private',
    ];

    protected $casts = [
        'is_private' => 'boolean',
    ];

    /**
     * Relación con calles
     */
    public function streets(): HasMany
    {
        return $this->hasMany(Street::class);
    }

    /**
     * Relación con perfiles de precios
     */
    public function pricingProfiles(): HasMany
    {
        return $this->hasMany(PricingProfile::class);
    }

    /**
     * Relación con sesiones de estacionamiento
     */
    public function parkingSessions(): HasMany
    {
        return $this->hasMany(ParkingSession::class);
    }

    /**
     * Relación con asignaciones de operadores
     */
    public function operatorAssignments(): HasMany
    {
        return $this->hasMany(OperatorAssignment::class);
    }

    /**
     * Obtener operadores asignados a este sector
     */
    public function operators()
    {
        return $this->belongsToMany(Operator::class, 'operator_assignments')
                    ->withPivot(['street_id', 'valid_from', 'valid_to'])
                    ->withTimestamps();
    }
}
