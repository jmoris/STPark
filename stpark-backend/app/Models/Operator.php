<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Operator extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'rut',
        'status',
    ];

    protected $casts = [
        'status' => 'string',
    ];

    /**
     * Relación con asignaciones
     */
    public function operatorAssignments(): HasMany
    {
        return $this->hasMany(OperatorAssignment::class);
    }

    /**
     * Relación con sesiones de estacionamiento (como operador de entrada)
     */
    public function parkingSessions(): HasMany
    {
        return $this->hasMany(ParkingSession::class, 'operator_in_id');
    }

    /**
     * Relación con ventas (como cajero)
     */
    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class, 'cashier_operator_id');
    }

    /**
     * Obtener sectores asignados
     */
    public function sectors()
    {
        return $this->belongsToMany(Sector::class, 'operator_assignments')
                    ->withPivot(['street_id', 'valid_from', 'valid_to'])
                    ->withTimestamps();
    }

    /**
     * Obtener calles asignadas
     */
    public function streets()
    {
        return $this->belongsToMany(Street::class, 'operator_assignments')
                    ->withPivot(['sector_id', 'valid_from', 'valid_to'])
                    ->withTimestamps();
    }

    /**
     * Verificar si el operador está activo
     */
    public function isActive(): bool
    {
        return $this->status === 'ACTIVE';
    }
}
