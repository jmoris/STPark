<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlanFeature extends Model
{
    use HasFactory;

    protected $fillable = [
        'plan_id',
        'max_operators',
        'max_streets',
        'max_sectors',
        'max_sessions',
        'max_pricing_profiles',
        'max_pricing_rules',
        'includes_debt_management',
        'report_type',
        'support_type',
    ];

    protected $casts = [
        'max_operators' => 'integer',
        'max_streets' => 'integer',
        'max_sectors' => 'integer',
        'max_sessions' => 'integer',
        'max_pricing_profiles' => 'integer',
        'max_pricing_rules' => 'integer',
        'includes_debt_management' => 'boolean',
    ];

    /**
     * Relación con el plan (uno a uno)
     */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }
}
