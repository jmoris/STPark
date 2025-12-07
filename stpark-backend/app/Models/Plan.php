<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'max_price_uf',
        'status',
    ];

    protected $casts = [
        'max_price_uf' => 'decimal:2',
    ];

    /**
     * Relación con el feature del plan (uno a uno)
     */
    public function feature(): HasOne
    {
        return $this->hasOne(PlanFeature::class);
    }

    /**
     * Relación con features del plan (uno a muchos)
     */
    public function features(): HasMany
    {
        return $this->hasMany(PlanFeature::class);
    }
}
