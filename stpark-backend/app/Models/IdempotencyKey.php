<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class IdempotencyKey extends Model
{
    use HasFactory;

    protected $fillable = [
        'key',
        'endpoint',
        'payload_hash',
        'response',
        'created_at',
    ];

    protected $casts = [
        'response' => 'array',
        'created_at' => 'datetime',
    ];

    public $timestamps = false;
    protected $dates = ['created_at'];

    /**
     * Verificar si una clave de idempotencia existe
     */
    public static function exists(string $key): bool
    {
        return self::where('key', $key)->exists();
    }

    /**
     * Obtener respuesta de una clave de idempotencia
     */
    public static function getResponse(string $key): ?array
    {
        $record = self::where('key', $key)->first();
        return $record ? $record->response : null;
    }

    /**
     * Crear o actualizar clave de idempotencia
     */
    public static function store(string $key, string $endpoint, string $payloadHash, array $response): self
    {
        return self::updateOrCreate(
            ['key' => $key],
            [
                'endpoint' => $endpoint,
                'payload_hash' => $payloadHash,
                'response' => $response,
                'created_at' => now(),
            ]
        );
    }
}
