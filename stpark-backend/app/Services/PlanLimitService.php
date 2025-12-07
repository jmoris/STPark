<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PlanLimitService
{
    /**
     * Obtener las features del plan del tenant actual
     */
    public static function getTenantPlanFeatures(): ?object
    {
        try {
            $tenantId = tenant('id');
            if (!$tenantId) {
                Log::warning('PlanLimitService: No se pudo obtener el tenant actual');
                return null;
            }

            $centralConnection = config('tenancy.database.central_connection', 'central');
            
            $planFeatures = DB::connection($centralConnection)
                ->table('tenants')
                ->join('plans', 'tenants.plan_id', '=', 'plans.id')
                ->leftJoin('plan_features', 'plans.id', '=', 'plan_features.plan_id')
                ->where('tenants.id', $tenantId)
                ->select('plan_features.*')
                ->first();

            return $planFeatures;
        } catch (\Exception $e) {
            Log::error('PlanLimitService: Error al obtener features del plan', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return null;
        }
    }

    /**
     * Validar si se puede crear un nuevo operador
     */
    public static function canCreateOperator(): array
    {
        $features = self::getTenantPlanFeatures();
        
        if (!$features) {
            // Si no hay plan asignado, permitir (comportamiento por defecto)
            return ['allowed' => true];
        }

        // Si max_operators es null, no hay límite
        if ($features->max_operators === null) {
            return ['allowed' => true];
        }

        // Contar operadores actuales (solo activos)
        $currentCount = DB::table('operators')
            ->where('status', 'ACTIVE')
            ->count();

        if ($currentCount >= $features->max_operators) {
            return [
                'allowed' => false,
                'message' => "La suscripción contratada no permite más operadores. Límite: {$features->max_operators}",
                'current' => $currentCount,
                'limit' => $features->max_operators
            ];
        }

        return ['allowed' => true, 'current' => $currentCount, 'limit' => $features->max_operators];
    }

    /**
     * Validar si se puede crear un nuevo sector
     */
    public static function canCreateSector(): array
    {
        $features = self::getTenantPlanFeatures();
        
        if (!$features) {
            return ['allowed' => true];
        }

        if ($features->max_sectors === null) {
            return ['allowed' => true];
        }

        $currentCount = DB::table('sectors')->count();

        if ($currentCount >= $features->max_sectors) {
            return [
                'allowed' => false,
                'message' => "La suscripción contratada no permite más sectores. Límite: {$features->max_sectors}",
                'current' => $currentCount,
                'limit' => $features->max_sectors
            ];
        }

        return ['allowed' => true, 'current' => $currentCount, 'limit' => $features->max_sectors];
    }

    /**
     * Validar si se puede crear una nueva calle
     */
    public static function canCreateStreet(): array
    {
        $features = self::getTenantPlanFeatures();
        
        if (!$features) {
            return ['allowed' => true];
        }

        if ($features->max_streets === null) {
            return ['allowed' => true];
        }

        $currentCount = DB::table('streets')->count();

        if ($currentCount >= $features->max_streets) {
            return [
                'allowed' => false,
                'message' => "La suscripción contratada no permite más calles. Límite: {$features->max_streets}",
                'current' => $currentCount,
                'limit' => $features->max_streets
            ];
        }

        return ['allowed' => true, 'current' => $currentCount, 'limit' => $features->max_streets];
    }

    /**
     * Validar si se puede crear un nuevo perfil de precios
     */
    public static function canCreatePricingProfile(): array
    {
        $features = self::getTenantPlanFeatures();
        
        if (!$features) {
            return ['allowed' => true];
        }

        if ($features->max_pricing_profiles === null) {
            return ['allowed' => true];
        }

        $currentCount = DB::table('pricing_profiles')->count();

        if ($currentCount >= $features->max_pricing_profiles) {
            return [
                'allowed' => false,
                'message' => "La suscripción contratada no permite más perfiles de precios. Límite: {$features->max_pricing_profiles}",
                'current' => $currentCount,
                'limit' => $features->max_pricing_profiles
            ];
        }

        return ['allowed' => true, 'current' => $currentCount, 'limit' => $features->max_pricing_profiles];
    }

    /**
     * Validar si se puede crear una nueva regla de precios
     */
    public static function canCreatePricingRule(int $profileId): array
    {
        $features = self::getTenantPlanFeatures();
        
        if (!$features) {
            return ['allowed' => true];
        }

        if ($features->max_pricing_rules === null) {
            return ['allowed' => true];
        }

        $currentCount = DB::table('pricing_rules')->count();

        if ($currentCount >= $features->max_pricing_rules) {
            return [
                'allowed' => false,
                'message' => "La suscripción contratada no permite más reglas de precios. Límite: {$features->max_pricing_rules}",
                'current' => $currentCount,
                'limit' => $features->max_pricing_rules
            ];
        }

        return ['allowed' => true, 'current' => $currentCount, 'limit' => $features->max_pricing_rules];
    }

    /**
     * Validar si una feature está disponible en el plan
     */
    public static function hasFeature(string $featureName): bool
    {
        $features = self::getTenantPlanFeatures();
        
        if (!$features) {
            return false;
        }

        // Mapeo de nombres de features a columnas
        $featureMap = [
            'debt_management' => 'includes_debt_management',
        ];

        $columnName = $featureMap[$featureName] ?? $featureName;

        if (!property_exists($features, $columnName)) {
            return false;
        }

        return (bool) $features->$columnName;
    }
}
