<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('uf_values', function (Blueprint $table) {
            $table->id();
            $table->date('date')->unique(); // Fecha del valor de la UF
            $table->decimal('value', 10, 2); // Valor de la UF
            $table->string('series_id', 50)->nullable(); // ID de la serie del Banco Central
            $table->timestamps();

            // Índice para búsquedas rápidas por fecha
            $table->index('date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('uf_values');
    }
};
