<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'actor_id',
        'action',
        'entity',
        'entity_id',
        'before_json',
        'after_json',
        'at',
    ];

    protected $casts = [
        'before_json' => 'array',
        'after_json' => 'array',
        'at' => 'datetime',
    ];

    /**
     * Crear un log de auditoría
     */
    public static function log(
        ?int $actorId,
        string $action,
        string $entity,
        ?int $entityId,
        ?array $before = null,
        ?array $after = null
    ): self {
        return self::create([
            'actor_id' => $actorId,
            'action' => $action,
            'entity' => $entity,
            'entity_id' => $entityId,
            'before_json' => $before,
            'after_json' => $after,
            'at' => now(),
        ]);
    }

    /**
     * Scope para logs por entidad
     */
    public function scopeByEntity($query, string $entity, ?int $entityId = null)
    {
        $query = $query->where('entity', $entity);
        
        if ($entityId !== null) {
            $query = $query->where('entity_id', $entityId);
        }
        
        return $query;
    }

    /**
     * Scope para logs por actor
     */
    public function scopeByActor($query, int $actorId)
    {
        return $query->where('actor_id', $actorId);
    }

    /**
     * Scope para logs por acción
     */
    public function scopeByAction($query, string $action)
    {
        return $query->where('action', $action);
    }
}
