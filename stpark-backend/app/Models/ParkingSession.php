<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Builder;

class ParkingSession extends Model
{
    use HasFactory;

    protected $table = 'parking_sessions';

    protected $fillable = [
        'plate',
        'sector_id',
        'street_id',
        'operator_in_id',
        'started_at',
        'ended_at',
        'status'
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    /**
     * Relación con el sector
     */
    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
    }

    /**
     * Relación con la calle
     */
    public function street(): BelongsTo
    {
        return $this->belongsTo(Street::class);
    }

    /**
     * Relación con el operador
     */
    public function operator(): BelongsTo
    {
        return $this->belongsTo(Operator::class, 'operator_in_id');
    }

    /**
     * Relación con los pagos
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class, 'session_id');
    }

    /**
     * Verificar si la sesión está activa
     */
    public function isActive(): bool
    {
        return $this->status === 'ACTIVE' && is_null($this->ended_at);
    }

    /**
     * Verificar si la sesión está completada
     */
    public function isCompleted(): bool
    {
        return $this->status === 'COMPLETED' && !is_null($this->ended_at);
    }

    /**
     * Verificar si la sesión está cancelada
     */
    public function isCancelled(): bool
    {
        return $this->status === 'CANCELLED';
    }

    /**
     * Obtener la duración en minutos
     */
    public function getDurationInMinutes(): ?int
    {
        if (!$this->ended_at) {
            return null;
        }

        return $this->started_at->diffInMinutes($this->ended_at);
    }

    /**
     * Obtener la duración formateada
     */
    public function getFormattedDuration(): ?string
    {
        $minutes = $this->getDurationInMinutes();
        
        if (!$minutes) {
            return null;
        }

        $hours = floor($minutes / 60);
        $remainingMinutes = $minutes % 60;

        if ($hours > 0) {
            return "{$hours}h {$remainingMinutes}m";
        }

        return "{$remainingMinutes}m";
    }

    /**
     * Scope para sesiones activas
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'ACTIVE')->whereNull('ended_at');
    }

    /**
     * Scope para sesiones completadas
     */
    public function scopeCompleted(Builder $query): Builder
    {
        return $query->where('status', 'COMPLETED')->whereNotNull('ended_at');
    }

    /**
     * Scope para sesiones canceladas
     */
    public function scopeCancelled(Builder $query): Builder
    {
        return $query->where('status', 'CANCELLED');
    }

    /**
     * Obtener la duración actual en minutos (para sesiones activas)
     */
    public function getCurrentDurationInMinutes(): ?int
    {
        if (!$this->started_at) {
            return null;
        }

        $endTime = $this->ended_at ?? now();
        return (int) $this->started_at->diffInMinutes($endTime);
    }

    /**
     * Obtener la duración actual formateada (para sesiones activas)
     */
    public function getCurrentFormattedDuration(): ?string
    {
        $minutes = $this->getCurrentDurationInMinutes();
        
        if ($minutes === null) {
            return null;
        }

        $hours = floor($minutes / 60);
        $remainingMinutes = $minutes % 60;

        if ($hours > 0) {
            return "{$hours}h {$remainingMinutes}m";
        }

        return "{$remainingMinutes}m";
    }

    /**
     * Obtener el monto total pagado
     */
    public function getTotalPaid(): float
    {
        return $this->payments()->sum('amount');
    }

    /**
     * Obtener el monto total pagado formateado
     */
    public function getFormattedTotalPaid(): string
    {
        return '$' . number_format($this->getTotalPaid(), 0, ',', '.');
    }
}