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
        Schema::create('session_discounts', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->enum('discount_type', ['AMOUNT', 'PERCENTAGE', 'PRICING_PROFILE']);
            $table->decimal('value', 10, 2)->nullable(); // Para AMOUNT y PERCENTAGE
            $table->decimal('max_amount', 10, 2)->nullable(); // Monto máximo de descuento (para PERCENTAGE)
            
            // Para PRICING_PROFILE
            $table->decimal('minute_value', 10, 2)->nullable(); // Valor del minuto distinto
            $table->decimal('min_amount', 10, 2)->nullable(); // Valor mínimo distinto
            
            $table->boolean('is_active')->default(true);
            $table->integer('priority')->default(0); // Prioridad de aplicación
            $table->date('valid_from')->nullable(); // Fecha de inicio de validez
            $table->date('valid_until')->nullable(); // Fecha de fin de validez
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('session_discounts');
    }
};


