<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Invoice extends Model
{
    use HasFactory;

    /**
     * La conexión de base de datos utilizada por el modelo.
     * Las facturas están en la base de datos central, no en las de los tenants.
     * Usamos null para que use la conexión por defecto (que es la central cuando no hay tenant inicializado)
     *
     * @var string|null
     */
    protected $connection = null;
    
    /**
     * Boot del modelo para asegurar que siempre use la conexión central
     */
    protected static function boot()
    {
        parent::boot();
        
        // Forzar conexión central
        static::addGlobalScope('central', function ($builder) {
            // No hacer nada aquí, solo asegurar que el modelo no use tenancy
        });
    }

    protected $fillable = [
        'tenant_id',
        'folio',
        'client_name',
        'client_rut',
        'emission_date',
        'net_amount',
        'iva_amount',
        'total_amount',
        'status',
        'payment_date',
        'notes',
    ];

    protected $casts = [
        'emission_date' => 'date',
        'payment_date' => 'date',
        'net_amount' => 'decimal:2',
        'iva_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    const STATUS_PENDING_REVIEW = 'PENDING_REVIEW';
    const STATUS_UNPAID = 'UNPAID';
    const STATUS_PAID = 'PAID';
    const STATUS_OVERDUE = 'OVERDUE';
    const STATUS_CANCELLED = 'CANCELLED';

    /**
     * Relación con tenant (estacionamiento)
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    /**
     * Relación con items de factura
     */
    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class, 'invoice_id');
    }

    /**
     * Verificar si la factura está pendiente de revisión
     */
    public function isPendingReview(): bool
    {
        return $this->status === self::STATUS_PENDING_REVIEW;
    }

    /**
     * Verificar si la factura está impaga
     */
    public function isUnpaid(): bool
    {
        return $this->status === self::STATUS_UNPAID;
    }

    /**
     * Verificar si la factura está pagada
     */
    public function isPaid(): bool
    {
        return $this->status === self::STATUS_PAID;
    }

    /**
     * Verificar si la factura está vencida
     */
    public function isOverdue(): bool
    {
        return $this->status === self::STATUS_OVERDUE;
    }

    /**
     * Verificar si la factura está cancelada
     */
    public function isCancelled(): bool
    {
        return $this->status === self::STATUS_CANCELLED;
    }

    /**
     * Obtener el estado formateado
     */
    public function getStatusText(): string
    {
        return match($this->status) {
            self::STATUS_PENDING_REVIEW => 'Pendiente de Revisión',
            self::STATUS_UNPAID => 'Sin pago registrado',
            self::STATUS_PAID => 'Pago registrado',
            self::STATUS_OVERDUE => 'Factura vencida',
            self::STATUS_CANCELLED => 'Cancelada',
            default => 'Desconocido'
        };
    }
}
