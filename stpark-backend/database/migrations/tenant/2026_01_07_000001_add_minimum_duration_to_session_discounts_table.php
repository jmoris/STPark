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
        Schema::table('session_discounts', function (Blueprint $table) {
            $table->integer('minimum_duration')->nullable()->after('min_amount')->comment('Duración mínima en minutos para PRICING_PROFILE');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('session_discounts', function (Blueprint $table) {
            $table->dropColumn('minimum_duration');
        });
    }
};