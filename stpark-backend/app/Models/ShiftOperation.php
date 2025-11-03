<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShiftOperation extends Model
{
    use HasFactory;

    protected $fillable = [
        'shift_id',
        'kind',
        'amount',
        'at',
        'ref_id',
        'ref_type',
        'notes',
    ];

    protected $casts = [
        'at' => 'datetime',
        'amount' => 'decimal:2',
    ];

    const KIND_OPEN = 'OPEN';
    const KIND_CLOSE = 'CLOSE';
    const KIND_ADJUSTMENT = 'ADJUSTMENT';
    const KIND_WITHDRAWAL = 'WITHDRAWAL';
    const KIND_DEPOSIT = 'DEPOSIT';

    /**
     * Relación con el turno
     */
    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class);
    }

    /**
     * Obtener el tipo de operación formateado
     */
    public function getKindText(): string
    {
        return match($this->kind) {
            self::KIND_OPEN => 'Apertura',
            self::KIND_CLOSE => 'Cierre',
            self::KIND_ADJUSTMENT => 'Ajuste',
            self::KIND_WITHDRAWAL => 'Retiro',
            self::KIND_DEPOSIT => 'Depósito',
            default => 'Desconocido'
        };
    }
}

