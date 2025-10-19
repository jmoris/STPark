<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OperatorAssignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'operator_id',
        'sector_id',
        'street_id',
        'valid_from',
        'valid_to',
    ];

    protected $casts = [
        'valid_from' => 'datetime',
        'valid_to' => 'datetime',
    ];

    /**
     * Relación con operador
     */
    public function operator(): BelongsTo
    {
        return $this->belongsTo(Operator::class);
    }

    /**
     * Relación con sector
     */
    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
    }

    /**
     * Relación con calle
     */
    public function street(): BelongsTo
    {
        return $this->belongsTo(Street::class);
    }

    /**
     * Verificar si la asignación está vigente
     */
    public function isValid(): bool
    {
        $now = now();
        return $this->valid_from <= $now && 
               ($this->valid_to === null || $this->valid_to >= $now);
    }
}
