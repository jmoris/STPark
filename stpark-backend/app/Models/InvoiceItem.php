<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InvoiceItem extends Model
{
    use HasFactory;

    /**
     * La conexión de base de datos utilizada por el modelo.
     * Los items de factura están en la base de datos central.
     * Usamos null para que use la conexión por defecto (que es la central cuando no hay tenant inicializado)
     *
     * @var string|null
     */
    protected $connection = null;

    protected $fillable = [
        'invoice_id',
        'description',
        'quantity',
        'unit_price',
        'subtotal',
        'notes',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'unit_price' => 'decimal:2',
        'subtotal' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Relación con factura
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'invoice_id');
    }

    /**
     * Calcular subtotal automáticamente
     */
    public function calculateSubtotal(): float
    {
        return (float) ($this->quantity * $this->unit_price);
    }
}
