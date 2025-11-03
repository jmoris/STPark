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
        Schema::create('cash_adjustments', function (Blueprint $table) {
            $table->id();
            $table->uuid('shift_id')->constrained('shifts')->onDelete('cascade');
            $table->enum('type', ['WITHDRAWAL', 'DEPOSIT']);
            $table->decimal('amount', 12, 2);
            $table->timestampTz('at')->useCurrent();
            $table->text('reason')->nullable();
            $table->string('receipt_number')->nullable(); // Número de vale/recibo
            $table->foreignId('actor_id')->nullable()->constrained('operators')->onDelete('set null'); // Operador que realiza el ajuste
            $table->foreignId('approved_by')->nullable()->constrained('users')->onDelete('set null'); // Supervisor que aprueba
            $table->timestampsTz();

            $table->index(['shift_id', 'type']);
            $table->index(['shift_id', 'at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cash_adjustments');
    }
};

