<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Export extends Model
{
    use HasFactory;

    protected $fillable = [
        'type',
        'params_json',
        'file_url',
        'created_by',
        'created_at',
    ];

    protected $casts = [
        'params_json' => 'array',
        'created_at' => 'datetime',
    ];

    const TYPE_SALES_REPORT = 'SALES_REPORT';
    const TYPE_PAYMENTS_REPORT = 'PAYMENTS_REPORT';
    const TYPE_DEBTS_REPORT = 'DEBTS_REPORT';
    const TYPE_OPERATOR_REPORT = 'OPERATOR_REPORT';
    const TYPE_KPI_DAILY = 'KPI_DAILY';

    /**
     * Relación con usuario que creó el export
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Verificar si el export está listo
     */
    public function isReady(): bool
    {
        return !empty($this->file_url);
    }

    /**
     * Scope para exports por tipo
     */
    public function scopeByType($query, string $type)
    {
        return $query->where('type', $type);
    }

    /**
     * Scope para exports por creador
     */
    public function scopeByCreator($query, int $createdBy)
    {
        return $query->where('created_by', $createdBy);
    }
}
