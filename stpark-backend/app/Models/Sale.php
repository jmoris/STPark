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
        'session_id',
        'doc_type',
        'doc_number',
        'net',
        'tax',
        'total',
        'issued_at',
        'cashier_operator_id',
    ];

    protected $casts = [
        'net' => 'decimal:2',
        'tax' => 'decimal:2',
        'total' => 'decimal:2',
        'issued_at' => 'datetime',
    ];

    const DOC_TYPE_BOILET = 'BOLETA';
    const DOC_TYPE_FACTURA = 'FACTURA';

    /**
     * Relación con sesión de estacionamiento
     */
    public function parkingSession(): BelongsTo
    {
        return $this->belongsTo(ParkingSession::class, 'session_id');
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
                   ->where('status', Payment::STATUS_COMPLETED)
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
