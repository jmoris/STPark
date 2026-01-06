<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('car_washes', function (Blueprint $table) {
            $table->id();
            $table->string('plate');
            $table->foreignId('car_wash_type_id')->constrained('car_wash_types')->onDelete('restrict');
            $table->foreignId('session_id')->nullable()->constrained('parking_sessions')->nullOnDelete();
            $table->foreignId('operator_id')->nullable()->constrained('operators')->nullOnDelete();

            $table->string('status')->default('PENDING'); // PENDING | PAID
            $table->decimal('amount', 10, 2);
            $table->unsignedInteger('duration_minutes')->nullable();

            $table->timestamp('performed_at');
            $table->timestamp('paid_at')->nullable();

            $table->timestamps();

            $table->index(['plate', 'status']);
            $table->index(['performed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('car_washes');
    }
};


