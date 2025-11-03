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
        Schema::create('shift_operations', function (Blueprint $table) {
            $table->id();
            $table->uuid('shift_id')->constrained('shifts')->onDelete('cascade');
            $table->enum('kind', ['OPEN', 'CLOSE', 'ADJUSTMENT', 'WITHDRAWAL', 'DEPOSIT']);
            $table->decimal('amount', 12, 2)->nullable();
            $table->timestampTz('at')->useCurrent();
            $table->unsignedBigInteger('ref_id')->nullable(); // Referencia a payment, cash_adjustment, etc.
            $table->string('ref_type')->nullable(); // Tipo de referencia: 'payment', 'cash_adjustment', etc.
            $table->text('notes')->nullable();
            $table->timestampsTz();

            $table->index(['shift_id', 'kind']);
            $table->index(['shift_id', 'at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('shift_operations');
    }
};

