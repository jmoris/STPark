<?php

namespace App\Services;

use App\Models\Shift;
use App\Models\Operator;

class CurrentShiftService
{
    /**
     * Obtener el turno actual abierto del operador
     * Sin usar cache para evitar problemas con tagging en drivers que no lo soportan
     */
    public function get(?int $operatorId = null, ?string $deviceId = null): ?Shift
    {
        if (!$operatorId) {
            return null;
        }

        $query = Shift::where('operator_id', $operatorId)
            ->where('status', Shift::STATUS_OPEN);

        if ($deviceId) {
            $query->where('device_id', $deviceId);
        }

        return $query->first();
    }

    /**
     * Limpiar caché del turno actual
     * Método mantenido por compatibilidad pero no hace nada ya que no usamos cache
     */
    public function forget(?int $operatorId = null, ?string $deviceId = null): void
    {
        // No-op: ya no usamos cache para evitar problemas con tagging
    }
}

