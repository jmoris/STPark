<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $driver = DB::getDriverName();
        
        // Verificar si la columna discount_id existe
        if (Schema::hasColumn('car_washes', 'discount_id')) {
            // Obtener todos los foreign keys de la tabla car_washes
            $foreignKeys = [];
            
            if ($driver === 'mysql' || $driver === 'mariadb') {
                // MySQL/MariaDB
                $foreignKeys = DB::select("
                    SELECT CONSTRAINT_NAME 
                    FROM information_schema.KEY_COLUMN_USAGE 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'car_washes' 
                    AND COLUMN_NAME = 'discount_id'
                    AND REFERENCED_TABLE_NAME IS NOT NULL
                ");
            } elseif ($driver === 'pgsql') {
                // PostgreSQL - usar current_schema() para obtener el schema actual
                $foreignKeys = DB::select("
                    SELECT 
                        tc.constraint_name
                    FROM information_schema.table_constraints AS tc 
                    JOIN information_schema.key_column_usage AS kcu
                      ON tc.constraint_name = kcu.constraint_name
                      AND tc.table_schema = kcu.table_schema
                    WHERE tc.constraint_type = 'FOREIGN KEY' 
                    AND tc.table_schema = current_schema()
                    AND tc.table_name = 'car_washes'
                    AND kcu.column_name = 'discount_id'
                ");
            }

            // Eliminar todos los foreign keys relacionados con discount_id
            foreach ($foreignKeys as $fk) {
                try {
                    // En PostgreSQL, los resultados vienen como objetos stdClass con nombres en minúsculas
                    // En MySQL/MariaDB, vienen como CONSTRAINT_NAME
                    $constraintName = is_object($fk) 
                        ? ($fk->CONSTRAINT_NAME ?? $fk->constraint_name ?? null)
                        : ($fk['CONSTRAINT_NAME'] ?? $fk['constraint_name'] ?? null);
                    
                    if (!$constraintName) {
                        continue;
                    }
                    
                    if ($driver === 'mysql' || $driver === 'mariadb') {
                        DB::statement("ALTER TABLE car_washes DROP FOREIGN KEY `{$constraintName}`");
                    } elseif ($driver === 'pgsql') {
                        DB::statement("ALTER TABLE car_washes DROP CONSTRAINT IF EXISTS \"{$constraintName}\"");
                    }
                } catch (\Exception $e) {
                    // Continuar si falla
                }
            }

            // Eliminar la columna temporalmente para recrearla con el foreign key correcto
            Schema::table('car_washes', function (Blueprint $table) {
                $table->dropColumn('discount_id');
            });
        }

        // Recrear la columna con el foreign key correcto solo si la tabla car_wash_discounts existe
        if (Schema::hasTable('car_wash_discounts')) {
            Schema::table('car_washes', function (Blueprint $table) use ($driver) {
                $column = $table->foreignId('discount_id')->nullable();
                
                // 'after' solo funciona en MySQL/MariaDB
                if ($driver === 'mysql' || $driver === 'mariadb') {
                    $column->after('amount');
                }
                
                $column->constrained('car_wash_discounts')->nullOnDelete();
            });
        }

        // Asegurar que discount_amount existe (puede que ya exista)
        if (!Schema::hasColumn('car_washes', 'discount_amount')) {
            Schema::table('car_washes', function (Blueprint $table) use ($driver) {
                $column = $table->decimal('discount_amount', 10, 2)->default(0);
                
                // 'after' solo funciona en MySQL/MariaDB
                if ($driver === 'mysql' || $driver === 'mariadb') {
                    $column->after('discount_id');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No hacer nada en down, dejar que la migración original maneje el rollback
    }
};
