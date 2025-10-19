<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Debt extends Model
{
    use HasFactory;

    protected $fillable = [
        'plate',
        'origin',
        'principal_amount',
        'created_at',
        'settled_at',
        'status',
        'session_id',
    ];

    protected $casts = [
        'principal_amount' => 'decimal:2',
        'created_at' => 'datetime',
        'settled_at' => 'datetime',
    ];

    const ORIGIN_SESSION = 'SESSION';
    const ORIGIN_FINE = 'FINE';
    const ORIGIN_MANUAL = 'MANUAL';

    const STATUS_PENDING = 'PENDING';
    const STATUS_SETTLED = 'SETTLED';
    const STATUS_CANCELLED = 'CANCELLED';

    /**
     * Relación con sesión de estacionamiento
     */
    public function parkingSession(): BelongsTo
    {
        return $this->belongsTo(ParkingSession::class, 'session_id');
    }

    /**
     * Relación con pagos de deuda
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * Verificar si la deuda está pendiente
     */
    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    /**
     * Verificar si la deuda está liquidada
     */
    public function isSettled(): bool
    {
        return $this->status === self::STATUS_SETTLED;
    }

    /**
     * Calcular monto pagado de la deuda
     */
    public function getPaidAmount(): float
    {
        return $this->payments()
                   ->where('status', Payment::STATUS_COMPLETED)
                   ->sum('amount');
    }

    /**
     * Obtener monto pendiente de la deuda
     */
    public function getPendingAmount(): float
    {
        return max(0, $this->principal_amount - $this->getPaidAmount());
    }

    /**
     * Scope para deudas pendientes
     */
    public function scopePending($query)
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    /**
     * Scope para deudas por placa
     */
    public function scopeByPlate($query, string $plate)
    {
        return $query->where('plate', $plate);
    }
}
