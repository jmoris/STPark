<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Shift extends Model
{
    use HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'operator_id',
        'sector_id',
        'device_id',
        'opened_at',
        'closed_at',
        'opening_float',
        'closing_declared_cash',
        'cash_over_short',
        'status',
        'notes',
        'created_by',
        'closed_by',
    ];

    protected $casts = [
        'opened_at' => 'datetime',
        'closed_at' => 'datetime',
        'opening_float' => 'decimal:2',
        'closing_declared_cash' => 'decimal:2',
        'cash_over_short' => 'decimal:2',
    ];

    const STATUS_OPEN = 'OPEN';
    const STATUS_CLOSED = 'CLOSED';
    const STATUS_CANCELED = 'CANCELED';

    /**
     * Boot del modelo
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($shift) {
            if (empty($shift->id)) {
                $shift->id = (string) Str::uuid();
            }
        });
    }

    /**
     * Relación con el operador
     */
    public function operator(): BelongsTo
    {
        return $this->belongsTo(Operator::class);
    }

    /**
     * Relación con el sector
     */
    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
    }

    /**
     * Relación con el usuario que creó el turno
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Relación con el usuario que cerró el turno
     */
    public function closer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    /**
     * Relación con los pagos del turno
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * Relación con las operaciones del turno
     */
    public function operations(): HasMany
    {
        return $this->hasMany(ShiftOperation::class);
    }

    /**
     * Relación con los ajustes de caja
     */
    public function cashAdjustments(): HasMany
    {
        return $this->hasMany(CashAdjustment::class);
    }

    /**
     * Verificar si el turno está abierto
     */
    public function isOpen(): bool
    {
        return $this->status === self::STATUS_OPEN;
    }

    /**
     * Verificar si el turno está cerrado
     */
    public function isClosed(): bool
    {
        return $this->status === self::STATUS_CLOSED;
    }

    /**
     * Verificar si el turno está cancelado
     */
    public function isCanceled(): bool
    {
        return $this->status === self::STATUS_CANCELED;
    }

    /**
     * Obtener el estado formateado
     */
    public function getStatusText(): string
    {
        return match($this->status) {
            self::STATUS_OPEN => 'Abierto',
            self::STATUS_CLOSED => 'Cerrado',
            self::STATUS_CANCELED => 'Cancelado',
            default => 'Desconocido'
        };
    }
}

