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
        Schema::table('tenants', function (Blueprint $table) {
            // Aplicar ->after() solo si el driver lo soporta (MySQL/MariaDB)
            // Nota: 'name' no es una columna en tenants, está en el JSON 'data'
            // Usamos 'id' como referencia, o si existe 'plan_id', después de ese
            if (DatabaseHelper::supportsAfterClause()) {
                // Verificar si plan_id existe para usarlo como referencia
                if (Schema::hasColumn('tenants', 'plan_id')) {
                    $table->string('rut')->nullable()->after('plan_id');
                    $table->string('razon_social')->nullable()->after('rut');
                    $table->string('giro')->nullable()->after('razon_social');
                    $table->string('direccion')->nullable()->after('giro');
                    $table->string('comuna')->nullable()->after('direccion');
                    $table->integer('dias_credito')->nullable()->default(0)->after('comuna');
                    $table->string('correo_intercambio')->nullable()->after('dias_credito');
                } else {
                    // Si plan_id no existe, agregar después de id
                    $table->string('rut')->nullable()->after('id');
                    $table->string('razon_social')->nullable()->after('rut');
                    $table->string('giro')->nullable()->after('razon_social');
                    $table->string('direccion')->nullable()->after('giro');
                    $table->string('comuna')->nullable()->after('direccion');
                    $table->integer('dias_credito')->nullable()->default(0)->after('comuna');
                    $table->string('correo_intercambio')->nullable()->after('dias_credito');
                }
            } else {
                // PostgreSQL: no soporta ->after(), las columnas se agregan al final
                $table->string('rut')->nullable();
                $table->string('razon_social')->nullable();
                $table->string('giro')->nullable();
                $table->string('direccion')->nullable();
                $table->string('comuna')->nullable();
                $table->integer('dias_credito')->nullable()->default(0);
                $table->string('correo_intercambio')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['rut', 'razon_social', 'giro', 'direccion', 'comuna', 'dias_credito', 'correo_intercambio']);
        });
    }
};
