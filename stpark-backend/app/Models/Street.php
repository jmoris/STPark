<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Street extends Model
{
    use HasFactory;

    protected $fillable = [
        'sector_id',
        'name',
        'notes',
    ];

    /**
     * Relación con sector
     */
    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
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
     * Obtener operadores asignados a esta calle
     */
    public function operators()
    {
        return $this->belongsToMany(Operator::class, 'operator_assignments')
                    ->withPivot(['sector_id', 'valid_from', 'valid_to'])
                    ->withTimestamps();
    }
}
