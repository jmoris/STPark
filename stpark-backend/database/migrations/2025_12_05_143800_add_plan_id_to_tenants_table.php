<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use App\Helpers\DatabaseHelper;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $driver = DB::getDriverName();
        
        // Verificar si la columna ya existe (por si la migración falló parcialmente)
        if (!Schema::hasColumn('tenants', 'plan_id')) {
            // Agregar la columna plan_id (compatible con PostgreSQL y MySQL/MariaDB)
            Schema::table('tenants', function (Blueprint $table) use ($driver) {
                if ($driver === 'pgsql') {
                    // PostgreSQL no soporta UNSIGNED, usamos bigInteger normal
                    $table->bigInteger('plan_id')->nullable();
                } else {
                    // MySQL/MariaDB soporta UNSIGNED y AFTER
                    $column = $table->unsignedBigInteger('plan_id')->nullable();
                    if (DatabaseHelper::supportsAfterClause()) {
                        $column->after('id');
                    }
                }
            });
        }

        // Buscar el plan Gratis y asignarlo a todos los tenants existentes
        $freePlan = DB::table('plans')
            ->where('name', 'Gratis')
            ->where('status', 'ACTIVE')
            ->first();

        if ($freePlan) {
            // Asignar el plan Gratis a todos los tenants existentes que no tengan plan_id
            DB::table('tenants')
                ->whereNull('plan_id')
                ->update(['plan_id' => $freePlan->id]);
        } else {
            // Si no existe el plan Gratis, intentar con el primer plan activo
            $firstPlan = DB::table('plans')
                ->where('status', 'ACTIVE')
                ->orderBy('id')
                ->first();
            
            if ($firstPlan) {
                DB::table('tenants')
                    ->whereNull('plan_id')
                    ->update(['plan_id' => $firstPlan->id]);
            } else {
                // Si no hay planes disponibles, crear uno por defecto
                $defaultPlanId = DB::table('plans')->insertGetId([
                    'name' => 'Gratis',
                    'description' => 'Plan gratuito por defecto',
                    'max_price_uf' => 0.00,
                    'status' => 'ACTIVE',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                
                DB::table('tenants')
                    ->whereNull('plan_id')
                    ->update(['plan_id' => $defaultPlanId]);
            }
        }

        // Verificar que todos los tenants tengan un plan_id válido antes de hacer NOT NULL
        $tenantsWithoutPlan = DB::table('tenants')
            ->whereNull('plan_id')
            ->count();

        if ($tenantsWithoutPlan > 0) {
            // Si aún hay tenants sin plan, asignar el primer plan disponible
            $anyPlan = DB::table('plans')
                ->orderBy('id')
                ->first();
            
            if ($anyPlan) {
                DB::table('tenants')
                    ->whereNull('plan_id')
                    ->update(['plan_id' => $anyPlan->id]);
            } else {
                throw new \Exception('No hay planes disponibles para asignar a los tenants existentes');
            }
        }

        // Agregar la foreign key (intentar crear, si ya existe se ignorará el error)
        try {
            Schema::table('tenants', function (Blueprint $table) {
                $table->foreign('plan_id')->references('id')->on('plans')->onDelete('restrict');
            });
        } catch (\Exception $e) {
            // Si la foreign key ya existe, continuar
            // En producción puede que ya exista si la migración falló parcialmente
            if (strpos($e->getMessage(), 'already exists') === false && 
                strpos($e->getMessage(), 'Duplicate') === false) {
                throw $e;
            }
        }

        // Hacer la columna obligatoria (not null) usando DatabaseHelper
        // Verificar si la columna es nullable antes de hacerla NOT NULL
        $isNullable = $this->isColumnNullable('tenants', 'plan_id');
        
        if ($isNullable) {
            if ($driver === 'pgsql') {
                DatabaseHelper::setColumnNotNull('tenants', 'plan_id');
            } else {
                DatabaseHelper::setColumnNotNull('tenants', 'plan_id', 'BIGINT UNSIGNED');
            }
        }
    }

    /**
     * Verificar si una columna es nullable
     */
    private function isColumnNullable(string $table, string $column): bool
    {
        $driver = DB::getDriverName();
        
        if ($driver === 'pgsql') {
            $result = DB::select("
                SELECT is_nullable
                FROM information_schema.columns
                WHERE table_name = ?
                AND column_name = ?
                AND table_schema = current_schema()
            ", [$table, $column]);
        } else {
            $result = DB::select("
                SELECT IS_NULLABLE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = ?
                AND COLUMN_NAME = ?
            ", [$table, $column]);
        }
        
        if (empty($result)) {
            return true; // Si no existe, asumir que es nullable
        }
        
        $nullable = $driver === 'pgsql' ? $result[0]->is_nullable : $result[0]->IS_NULLABLE;
        return strtoupper($nullable) === 'YES';
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropForeign(['plan_id']);
            $table->dropColumn('plan_id');
        });
    }
};
