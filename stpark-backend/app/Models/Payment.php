<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'session_id',
        'debt_id',
        'sale_id',
        'amount',
        'method',
        'status',
        'paid_at',
        'transaction_id',
        'webpay_token',
        'approval_code'
    ];

    protected $casts = [
        'paid_at' => 'datetime',
        'amount' => 'decimal:2',
    ];

    /**
     * Relación con la sesión de estacionamiento
     */
    public function parkingSession(): BelongsTo
    {
        return $this->belongsTo(ParkingSession::class, 'session_id');
    }

    /**
     * Relación con la deuda
     */
    public function debt(): BelongsTo
    {
        return $this->belongsTo(Debt::class);
    }

    /**
     * Relación con la venta
     */
    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    /**
     * Verificar si el pago está completado
     */
    public function isCompleted(): bool
    {
        return $this->status === 'COMPLETED';
    }

    /**
     * Verificar si el pago está pendiente
     */
    public function isPending(): bool
    {
        return $this->status === 'PENDING';
    }

    /**
     * Verificar si el pago falló
     */
    public function isFailed(): bool
    {
        return $this->status === 'FAILED';
    }

    /**
     * Obtener el método de pago formateado
     */
    public function getPaymentMethodText(): string
    {
        return match($this->method) {
            'CASH' => 'Efectivo',
            'CARD' => 'Tarjeta',
            'TRANSFER' => 'Transferencia',
            default => 'Desconocido'
        };
    }

    /**
     * Obtener el estado formateado
     */
    public function getStatusText(): string
    {
        return match($this->status) {
            'PENDING' => 'Pendiente',
            'COMPLETED' => 'Completado',
            'FAILED' => 'Fallido',
            'CANCELLED' => 'Cancelado',
            default => 'Desconocido'
        };
    }
}