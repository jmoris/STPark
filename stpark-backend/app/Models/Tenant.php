<?php

namespace App\Models;

use Stancl\Tenancy\Database\Models\Tenant as BaseTenant;
use Stancl\Tenancy\Contracts\TenantWithDatabase;
use Stancl\Tenancy\Database\Concerns\HasDatabase;
use Stancl\Tenancy\Database\Concerns\HasDomains;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Tenant extends BaseTenant implements TenantWithDatabase {
    use HasDatabase, HasDomains;

    protected $fillable = [
        'plan_id',
        'name',
        'rut',
        'razon_social',
        'giro',
        'direccion',
        'comuna',
        'dias_credito',
        'correo_intercambio',
    ];

    public function databaseName(): string
    {
        return 'stpark_' . $this->getTenantKey(); // ej: acme -> stpark_acme
    }

    /**
     * Relación con el plan de servicio
     */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    /**
     * Relación muchos a muchos con usuarios del sistema central
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(\App\Models\User::class, 'user_tenants')
                    ->withTimestamps();
    }
}
