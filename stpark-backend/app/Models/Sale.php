<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sale extends Model
{
    use HasFactory;

    protected $fillable = [
        'parking_session_id',
        'cashier_operator_id',
        'subtotal',
        'discount_amount',
        'total',
        'status',
    ];

    protected $casts = [
        'subtotal' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'total' => 'decimal:2',
    ];

    const STATUS_PENDING = 'PENDING';
    const STATUS_PAID = 'PAID';
    const STATUS_CANCELLED = 'CANCELLED';

    /**
     * Relación con sesión de estacionamiento
     */
    public function parkingSession(): BelongsTo
    {
        return $this->belongsTo(ParkingSession::class, 'parking_session_id');
    }

    /**
     * Relación con operador cajero
     */
    public function cashierOperator(): BelongsTo
    {
        return $this->belongsTo(Operator::class, 'cashier_operator_id');
    }

    /**
     * Relación con pagos
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * Calcular monto pagado
     */
    public function getPaidAmount(): float
    {
        return $this->payments()
                   ->where('status', 'COMPLETED')
                   ->sum('amount');
    }

    /**
     * Verificar si la venta está completamente pagada
     */
    public function isFullyPaid(): bool
    {
        return $this->getPaidAmount() >= $this->total;
    }

    /**
     * Obtener monto pendiente
     */
    public function getPendingAmount(): float
    {
        return max(0, $this->total - $this->getPaidAmount());
    }
}
