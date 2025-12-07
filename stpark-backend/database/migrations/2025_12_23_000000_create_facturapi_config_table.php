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
        Schema::create('facturapi_config', function (Blueprint $table) {
            $table->id();
            
            // Usar DatabaseHelper para crear enum compatible con PostgreSQL y MySQL/MariaDB
            DatabaseHelper::createEnumColumn(
                $table,
                'environment',
                ['dev', 'prod'],
                'dev'
            );
            
            $table->text('dev_token'); // Token encriptado
            $table->text('prod_token'); // Token encriptado
            $table->timestamps();
        });
        
        // Agregar constraint CHECK para PostgreSQL después de crear la tabla
        DatabaseHelper::addEnumCheckConstraint('facturapi_config', 'environment', ['dev', 'prod']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $driver = DB::getDriverName();
        
        // Eliminar constraint CHECK si es PostgreSQL
        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE facturapi_config DROP CONSTRAINT IF EXISTS facturapi_config_environment_check');
        }
        
        Schema::dropIfExists('facturapi_config');
    }
};

