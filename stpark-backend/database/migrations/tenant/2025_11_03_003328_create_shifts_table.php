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
        Schema::create('shifts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('operator_id')->constrained('operators')->onDelete('cascade');
            $table->foreignId('sector_id')->nullable()->constrained('sectors')->onDelete('set null');
            $table->string('device_id')->nullable(); // Terminal/POS opcional
            $table->timestampTz('opened_at')->useCurrent();
            $table->timestampTz('closed_at')->nullable();
            $table->decimal('opening_float', 12, 2)->default(0); // Fondo inicial
            $table->decimal('closing_declared_cash', 12, 2)->nullable(); // Efectivo contado al cierre
            $table->decimal('cash_over_short', 12, 2)->nullable(); // Sobra/Falta calculada
            $table->enum('status', ['OPEN', 'CLOSED', 'CANCELED'])->default('OPEN');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('closed_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestampsTz();

            // Índice único parcial para un solo turno abierto por operador y dispositivo
            $table->index(['operator_id', 'device_id', 'status']);
        });

        // Índice único compatible entre PostgreSQL y MariaDB
        $driver = DB::getDriverName();
        
        if ($driver === 'pgsql') {
            // PostgreSQL soporta índices parciales con WHERE
            DB::statement('CREATE UNIQUE INDEX shifts_unique_open ON shifts(operator_id, COALESCE(device_id, \'\'), status) WHERE status = \'OPEN\';');
        } else {
            // MariaDB/MySQL no soporta índices parciales con WHERE
            // No creamos índice único completo porque sería demasiado restrictivo
            // La validación de "solo un turno abierto" se debe manejar a nivel de aplicación/modelo
            // El índice normal en ['operator_id', 'device_id', 'status'] ayudará en las consultas
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $driver = DB::getDriverName();
        
        // Solo eliminar el índice único si es PostgreSQL (donde se creó)
        if ($driver === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS shifts_unique_open;');
        }
        
        Schema::dropIfExists('shifts');
    }
};

