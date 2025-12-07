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
        Schema::create('invoice_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained('invoices')->onDelete('cascade'); // Relación con factura
            $table->string('description'); // Descripción del item
            $table->integer('quantity')->default(1); // Cantidad
            $table->decimal('unit_price', 10, 2); // Precio unitario
            $table->decimal('subtotal', 10, 2); // Subtotal (cantidad * precio unitario) - valor neto
            $table->text('notes')->nullable(); // Notas adicionales del item
            $table->timestamps();

            // Índices
            $table->index('invoice_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('invoice_items');
    }
};
