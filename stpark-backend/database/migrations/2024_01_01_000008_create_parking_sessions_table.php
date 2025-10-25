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
        Schema::create('parking_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('plate');
            $table->foreignId('sector_id')->constrained()->onDelete('cascade');
            $table->foreignId('street_id')->nullable()->constrained()->onDelete('cascade');
            $table->foreignId('operator_in_id')->constrained('operators')->onDelete('cascade');
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->integer('seconds_total')->nullable();
            $table->decimal('gross_amount', 10, 2)->nullable();
            $table->decimal('discount_amount', 10, 2)->nullable();
            $table->decimal('net_amount', 10, 2)->nullable();
            $table->string('status')->default('CREATED');
            $table->timestamps();

            // Índices según especificación
            $table->index(['plate', 'status']);
            $table->index(['sector_id', 'started_at']);
            $table->index(['plate', 'sector_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('parking_sessions');
    }
};
