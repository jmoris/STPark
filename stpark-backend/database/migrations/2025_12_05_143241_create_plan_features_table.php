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
        Schema::create('plan_features', function (Blueprint $table) {
            $table->id();
            $table->foreignId('plan_id')->unique()->constrained('plans')->onDelete('cascade');
            $table->integer('max_operators')->nullable(); // Máximo de operadores
            $table->integer('max_streets')->nullable(); // Máximo de calles
            $table->integer('max_sectors')->nullable(); // Máximo de sectores
            $table->integer('max_sessions')->nullable(); // Máximo de sesiones de estacionamiento
            $table->integer('max_pricing_profiles')->nullable(); // Máximo de perfiles de precio
            $table->integer('max_pricing_rules')->nullable(); // Máximo de reglas de precio
            $table->boolean('includes_debt_management')->default(false); // Incluye gestión de deuda
            $table->enum('report_type', ['BASIC', 'ADVANCED'])->default('BASIC'); // Tipo de reporte: básico o avanzado
            $table->enum('support_type', ['BASIC', 'PRIORITY'])->default('BASIC'); // Tipo de soporte: básico o prioritario
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('plan_features');
    }
};
