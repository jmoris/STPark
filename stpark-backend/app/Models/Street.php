<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Street extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'sector_id',
        'address_number',
        'address_type',
        'block_range',
        'is_specific_address',
        'is_active'
    ];

    protected $casts = [
        'is_specific_address' => 'boolean',
        'is_active' => 'boolean',
    ];

    protected $appends = [
        'full_address',
    ];

    /**
     * Relación con el sector
     */
    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
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
            ->withPivot(['sector_id', 'valid_from', 'valid_to'])
            ->withTimestamps();
    }

    /**
     * Verificar si la calle está activa
     */
    public function isActive(): bool
    {
        return $this->is_active;
    }

    /**
     * Verificar si es una dirección específica
     */
    public function isSpecificAddress(): bool
    {
        return $this->is_specific_address;
    }

    /**
     * Verificar si es una calle completa
     */
    public function isFullStreet(): bool
    {
        return !$this->is_specific_address;
    }

    /**
     * Obtener la dirección completa
     */
    public function getFullAddressAttribute(): string
    {
        if ($this->is_specific_address) {
            return $this->name . ' ' . $this->address_number;
        }
        
        if ($this->block_range) {
            return $this->name . ' (Cuadras ' . $this->block_range . ')';
        }
        
        return $this->name;
    }

    /**
     * Obtener el tipo de dirección formateado
     */
    public function getAddressTypeText(): string
    {
        return match($this->address_type) {
            'STREET' => 'Calle',
            'ADDRESS' => 'Dirección',
            default => 'Desconocido'
        };
    }

    /**
     * Obtener el estado formateado
     */
    public function getStatusText(): string
    {
        return $this->is_active ? 'Activa' : 'Inactiva';
    }
}