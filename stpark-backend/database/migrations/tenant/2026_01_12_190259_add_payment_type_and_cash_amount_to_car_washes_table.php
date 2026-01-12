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
            $table->enum('payment_type', ['cash', 'card'])->nullable()->after('approval_code');
            $table->decimal('cash_amount_received', 10, 2)->nullable()->after('payment_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('car_washes', function (Blueprint $table) {
            $table->dropColumn(['payment_type', 'cash_amount_received']);
        });
    }
};
