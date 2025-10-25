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
        'valid_to'
    ];

    protected $casts = [
        'valid_from' => 'datetime',
        'valid_to' => 'datetime',
    ];

    /**
     * Relación con el operador
     */
    public function operator(): BelongsTo
    {
        return $this->belongsTo(Operator::class);
    }

    /**
     * Relación con el sector
     */
    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
    }

    /**
     * Relación con la calle
     */
    public function street(): BelongsTo
    {
        return $this->belongsTo(Street::class);
    }

    /**
     * Verificar si la asignación está activa
     */
    public function isActive(): bool
    {
        $now = now();
        
        if ($this->valid_from > $now) {
            return false;
        }
        
        if ($this->valid_to && $this->valid_to < $now) {
            return false;
        }
        
        return true;
    }

    /**
     * Obtener el período de validez formateado
     */
    public function getValidityPeriod(): string
    {
        $from = $this->valid_from->format('d/m/Y');
        $to = $this->valid_to ? $this->valid_to->format('d/m/Y') : 'Indefinido';
        
        return "Desde {$from} hasta {$to}";
    }
}