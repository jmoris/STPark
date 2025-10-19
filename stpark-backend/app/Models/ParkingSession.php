<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ParkingSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'plate',
        'sector_id',
        'street_id',
        'operator_in_id',
        'started_at',
        'ended_at',
        'seconds_total',
        'gross_amount',
        'discount_amount',
        'net_amount',
        'status',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'seconds_total' => 'integer',
        'gross_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'net_amount' => 'decimal:2',
    ];

    const STATUS_CREATED = 'CREATED';
    const STATUS_ACTIVE = 'ACTIVE';
    const STATUS_TO_PAY = 'TO_PAY';
    const STATUS_PAID = 'PAID';
    const STATUS_CLOSED = 'CLOSED';
    const STATUS_CANCELED = 'CANCELED';

    /**
     * Relación con sector
     */
    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
    }

    /**
     * Relación con calle
     */
    public function street(): BelongsTo
    {
        return $this->belongsTo(Street::class);
    }

    /**
     * Relación con operador de entrada
     */
    public function operatorIn(): BelongsTo
    {
        return $this->belongsTo(Operator::class, 'operator_in_id');
    }

    /**
     * Relación con venta
     */
    public function sale(): HasOne
    {
        return $this->hasOne(Sale::class);
    }

    /**
     * Relación con deudas
     */
    public function debts(): HasMany
    {
        return $this->hasMany(Debt::class);
    }

    /**
     * Verificar si la sesión está activa
     */
    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    /**
     * Verificar si la sesión está pendiente de pago
     */
    public function isPendingPayment(): bool
    {
        return $this->status === self::STATUS_TO_PAY;
    }

    /**
     * Verificar si la sesión está pagada
     */
    public function isPaid(): bool
    {
        return $this->status === self::STATUS_PAID;
    }

    /**
     * Verificar si la sesión está cerrada
     */
    public function isClosed(): bool
    {
        return $this->status === self::STATUS_CLOSED;
    }

    /**
     * Calcular duración en minutos
     */
    public function getDurationInMinutes(): int
    {
        if (!$this->ended_at) {
            return 0;
        }
        return (int) ceil($this->seconds_total / 60);
    }

    /**
     * Scope para sesiones activas
     */
    public function scopeActive($query)
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    /**
     * Scope para sesiones por placa
     */
    public function scopeByPlate($query, string $plate)
    {
        return $query->where('plate', $plate);
    }

    /**
     * Scope para sesiones por sector
     */
    public function scopeBySector($query, int $sectorId)
    {
        return $query->where('sector_id', $sectorId);
    }
}
