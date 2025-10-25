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
        Schema::create('debts', function (Blueprint $table) {
            $table->id();
            $table->string('plate');
            $table->enum('origin', ['SESSION', 'FINE', 'MANUAL']);
            $table->decimal('principal_amount', 10, 2);
            $table->timestamp('settled_at')->nullable();
            $table->string('status')->default('PENDING');
            $table->foreignId('session_id')->nullable()->constrained('parking_sessions')->onDelete('set null');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('debts');
    }
};
