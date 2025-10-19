<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PricingRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'profile_id',
        'rule_type',
        'start_min',
        'end_min',
        'price_per_min',
        'fixed_price',
        'days_of_week',
        'start_time',
        'end_time',
        'priority',
    ];

    protected $casts = [
        'days_of_week' => 'array',
        'start_time' => 'datetime',
        'end_time' => 'datetime',
        'start_min' => 'integer',
        'end_min' => 'integer',
        'price_per_min' => 'decimal:2',
        'fixed_price' => 'decimal:2',
        'priority' => 'integer',
    ];

    /**
     * Relación con perfil de precios
     */
    public function pricingProfile(): BelongsTo
    {
        return $this->belongsTo(PricingProfile::class, 'profile_id');
    }

    /**
     * Verificar si la regla aplica para un día de la semana
     */
    public function appliesToDay(int $dayOfWeek): bool
    {
        return in_array($dayOfWeek, $this->days_of_week ?? []);
    }

    /**
     * Verificar si la regla aplica para un rango de tiempo
     */
    public function appliesToTime(string $time): bool
    {
        $currentTime = \Carbon\Carbon::createFromFormat('H:i:s', $time);
        $startTime = \Carbon\Carbon::createFromFormat('H:i:s', $this->start_time->format('H:i:s'));
        $endTime = \Carbon\Carbon::createFromFormat('H:i:s', $this->end_time->format('H:i:s'));

        return $currentTime->between($startTime, $endTime);
    }
}
