<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CarWash extends Model
{
    protected $fillable = [
        'plate',
        'car_wash_type_id',
        'session_id',
        'operator_id',
        'cashier_operator_id',
        'shift_id',
        'status',
        'amount',
        'discount_id',
        'discount_amount',
        'duration_minutes',
        'performed_at',
        'paid_at',
        'approval_code',
        'payment_type',
        'cash_amount_received',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'cash_amount_received' => 'decimal:2',
        'duration_minutes' => 'integer',
        'performed_at' => 'datetime',
        'paid_at' => 'datetime',
    ];

    public function carWashType(): BelongsTo
    {
        return $this->belongsTo(CarWashType::class, 'car_wash_type_id');
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(ParkingSession::class, 'session_id');
    }

    public function operator(): BelongsTo
    {
        return $this->belongsTo(Operator::class, 'operator_id');
    }

    public function cashierOperator(): BelongsTo
    {
        return $this->belongsTo(Operator::class, 'cashier_operator_id');
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class);
    }

    public function discount(): BelongsTo
    {
        return $this->belongsTo(CarWashDiscount::class, 'discount_id');
    }

    /**
     * Serializar la relación con snake_case para mantener consistencia
     */
    protected function serializeDate(\DateTimeInterface $date): string
    {
        return $date->format('Y-m-d H:i:s');
    }

    /**
     * Convertir a array con snake_case para relaciones
     */
    public function toArray(): array
    {
        $array = parent::toArray();
        
        // Agregar relación en snake_case si existe
        if ($this->relationLoaded('carWashType')) {
            $array['car_wash_type'] = $this->carWashType?->toArray();
        }
        
        return $array;
    }
}


