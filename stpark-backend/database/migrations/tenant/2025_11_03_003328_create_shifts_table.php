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

        // Índice único parcial (PostgreSQL)
        DB::statement('CREATE UNIQUE INDEX shifts_unique_open ON shifts(operator_id, COALESCE(device_id, \'\'), status) WHERE status = \'OPEN\';');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS shifts_unique_open;');
        Schema::dropIfExists('shifts');
    }
};

