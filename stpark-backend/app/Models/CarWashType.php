<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CarWashType extends Model
{
    protected $fillable = [
        'name',
        'price',
        'duration_minutes',
        'is_active',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'duration_minutes' => 'integer',
        'is_active' => 'boolean',
    ];

    public function carWashes(): HasMany
    {
        return $this->hasMany(CarWash::class, 'car_wash_type_id');
    }
}


