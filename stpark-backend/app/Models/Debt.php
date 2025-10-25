<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Builder;

class Debt extends Model
{
    use HasFactory;

    protected $fillable = [
        'plate',
        'session_id',
        'origin',
        'principal_amount',
        'status',
        'settled_at',
        'created_at'
    ];

    protected $casts = [
        'principal_amount' => 'decimal:2',
        'created_at' => 'datetime',
        'settled_at' => 'datetime',
    ];

    /**
     * Scope para buscar deudas por placa
     */
    public function scopeByPlate($query, string $plate)
    {
        return $query->where('plate', strtoupper($plate));
    }

    /**
     * Relación con los pagos
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * Relación con la sesión de estacionamiento (si existe)
     */
    public function parkingSession()
    {
        return $this->belongsTo(ParkingSession::class, 'session_id');
    }

    /**
     * Verificar si la deuda está pendiente
     */
    public function isPending(): bool
    {
        return $this->status === 'PENDING';
    }

    /**
     * Verificar si la deuda está liquidada
     */
    public function isSettled(): bool
    {
        return $this->status === 'SETTLED';
    }

    /**
     * Obtener el estado formateado
     */
    public function getStatusText(): string
    {
        return match($this->status) {
            'PENDING' => 'Pendiente',
            'SETTLED' => 'Liquidada',
            'CANCELLED' => 'Cancelada',
            default => 'Desconocido'
        };
    }

    /**
     * Obtener el monto pendiente de la deuda
     */
    public function getPendingAmount(): float
    {
        if ($this->isSettled()) {
            return 0;
        }
        
        return (float) $this->principal_amount;
    }

    /**
     * Scope para deudas pendientes
     */
    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', 'PENDING');
    }

    /**
     * Scope para deudas liquidadas
     */
    public function scopeSettled(Builder $query): Builder
    {
        return $query->where('status', 'SETTLED');
    }

    /**
     * Scope para deudas canceladas
     */
    public function scopeCancelled(Builder $query): Builder
    {
        return $query->where('status', 'CANCELLED');
    }
}