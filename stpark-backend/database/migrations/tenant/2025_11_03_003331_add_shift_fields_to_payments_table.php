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
        Schema::table('payments', function (Blueprint $table) {
            $table->uuid('shift_id')->nullable()->after('sale_id');
            $table->string('cash_drawer_ref')->nullable()->after('shift_id'); // Correlativo de boleta manual/vale
            
            $table->foreign('shift_id')->references('id')->on('shifts')->onDelete('set null');
            
            // Índice compuesto para filtrar por turno, método y estado
            $table->index(['shift_id', 'method', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropForeign(['shift_id']);
            $table->dropIndex(['shift_id', 'method', 'status']);
            $table->dropColumn(['shift_id', 'cash_drawer_ref']);
        });
    }
};

