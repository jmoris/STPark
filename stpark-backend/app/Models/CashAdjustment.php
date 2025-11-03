<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CashAdjustment extends Model
{
    use HasFactory;

    protected $fillable = [
        'shift_id',
        'type',
        'amount',
        'at',
        'reason',
        'receipt_number',
        'actor_id',
        'approved_by',
    ];

    protected $casts = [
        'at' => 'datetime',
        'amount' => 'decimal:2',
    ];

    const TYPE_WITHDRAWAL = 'WITHDRAWAL';
    const TYPE_DEPOSIT = 'DEPOSIT';

    /**
     * Relación con el turno
     */
    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class);
    }

    /**
     * Relación con el operador que realiza el ajuste
     */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(Operator::class, 'actor_id');
    }

    /**
     * Relación con el supervisor que aprueba
     */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * Verificar si es un retiro
     */
    public function isWithdrawal(): bool
    {
        return $this->type === self::TYPE_WITHDRAWAL;
    }

    /**
     * Verificar si es un depósito
     */
    public function isDeposit(): bool
    {
        return $this->type === self::TYPE_DEPOSIT;
    }

    /**
     * Obtener el tipo formateado
     */
    public function getTypeText(): string
    {
        return match($this->type) {
            self::TYPE_WITHDRAWAL => 'Retiro',
            self::TYPE_DEPOSIT => 'Depósito',
            default => 'Desconocido'
        };
    }
}

