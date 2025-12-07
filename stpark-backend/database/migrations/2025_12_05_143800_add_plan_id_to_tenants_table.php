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
        
        // Agregar la columna plan_id (compatible con PostgreSQL y MySQL/MariaDB)
        Schema::table('tenants', function (Blueprint $table) use ($driver) {
            if ($driver === 'pgsql') {
                // PostgreSQL no soporta UNSIGNED, usamos bigInteger normal
                $table->bigInteger('plan_id')->nullable();
            } else {
                // MySQL/MariaDB soporta UNSIGNED y AFTER
                $table->unsignedBigInteger('plan_id')->nullable()->after('id');
            }
        });

        // Buscar el plan Gratis y asignarlo a todos los tenants existentes
        $freePlan = DB::table('plans')
            ->where('name', 'Gratis')
            ->where('status', 'ACTIVE')
            ->first();

        if ($freePlan) {
            // Asignar el plan Gratis a todos los tenants existentes
            DB::table('tenants')
                ->whereNull('plan_id')
                ->update(['plan_id' => $freePlan->id]);
        } else {
            // Si no existe el plan Gratis, intentar con el primer plan activo
            $firstPlan = DB::table('plans')
                ->where('status', 'ACTIVE')
                ->first();
            
            if ($firstPlan) {
                DB::table('tenants')
                    ->whereNull('plan_id')
                    ->update(['plan_id' => $firstPlan->id]);
            }
        }

        // Hacer la columna obligatoria y agregar la foreign key
        Schema::table('tenants', function (Blueprint $table) {
            $table->foreign('plan_id')->references('id')->on('plans')->onDelete('restrict');
        });

        // Hacer la columna obligatoria (not null) usando DatabaseHelper
        if ($driver === 'pgsql') {
            DatabaseHelper::setColumnNotNull('tenants', 'plan_id');
        } else {
            DatabaseHelper::setColumnNotNull('tenants', 'plan_id', 'BIGINT UNSIGNED');
        }
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
