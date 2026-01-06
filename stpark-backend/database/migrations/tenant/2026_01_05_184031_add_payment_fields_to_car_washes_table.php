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
        Schema::table('car_washes', function (Blueprint $table) {
            $table->foreignId('cashier_operator_id')->nullable()->after('operator_id')->constrained('operators')->nullOnDelete();
            $table->uuid('shift_id')->nullable()->after('cashier_operator_id');
            $table->string('approval_code', 50)->nullable()->after('shift_id');
            
            $table->foreign('shift_id')->references('id')->on('shifts')->onDelete('set null');
            
            // Índice para búsquedas por turno
            $table->index('shift_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('car_washes', function (Blueprint $table) {
            $table->dropForeign(['cashier_operator_id']);
            $table->dropForeign(['shift_id']);
            $table->dropIndex(['shift_id']);
            $table->dropColumn(['cashier_operator_id', 'shift_id', 'approval_code']);
        });
    }
};
