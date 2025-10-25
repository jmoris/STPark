<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Operator extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'rut',
        'email',
        'phone',
        'pin',
        'status'
    ];

    /**
     * Relación con las asignaciones
     */
    public function operatorAssignments(): HasMany
    {
        return $this->hasMany(OperatorAssignment::class);
    }

    /**
     * Relación con las sesiones de estacionamiento
     */
    public function parkingSessions(): HasMany
    {
        return $this->hasMany(ParkingSession::class);
    }

    /**
     * Relación con los sectores asignados
     */
    public function sectors(): BelongsToMany
    {
        return $this->belongsToMany(Sector::class, 'operator_assignments')
            ->withPivot(['street_id', 'valid_from', 'valid_to'])
            ->withTimestamps();
    }

    /**
     * Relación con las calles asignadas
     */
    public function streets(): BelongsToMany
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

    /**
     * Verificar si el operador está inactivo
     */
    public function isInactive(): bool
    {
        return $this->status === 'INACTIVE';
    }

    /**
     * Obtener el estado formateado
     */
    public function getStatusText(): string
    {
        return match($this->status) {
            'ACTIVE' => 'Activo',
            'INACTIVE' => 'Inactivo',
            default => 'Desconocido'
        };
    }

    /**
     * Obtener el color del estado
     */
    public function getStatusColor(): string
    {
        return match($this->status) {
            'ACTIVE' => 'green',
            'INACTIVE' => 'red',
            default => 'gray'
        };
    }

    /**
     * Obtener el número de asignaciones
     */
    public function getAssignmentsCount(): int
    {
        return $this->sectors()->count() + $this->streets()->count();
    }

    /**
     * Obtener las asignaciones formateadas
     */
    public function getFormattedAssignments(): array
    {
        $assignments = [];
        
        foreach ($this->sectors as $sector) {
            $assignments[] = [
                'type' => 'Sector',
                'name' => $sector->name,
                'valid_from' => $sector->pivot->valid_from,
                'valid_to' => $sector->pivot->valid_to
            ];
        }
        
        foreach ($this->streets as $street) {
            $assignments[] = [
                'type' => 'Calle',
                'name' => $street->name,
                'valid_from' => $street->pivot->valid_from,
                'valid_to' => $street->pivot->valid_to
            ];
        }
        
        return $assignments;
    }
}