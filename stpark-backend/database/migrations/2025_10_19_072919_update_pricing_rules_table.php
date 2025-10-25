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
        Schema::table('pricing_rules', function (Blueprint $table) {
            $table->string('name')->default('Regla')->after('profile_id');
            $table->integer('min_duration_minutes')->default(0)->after('name');
            $table->integer('max_duration_minutes')->nullable()->after('min_duration_minutes');
            $table->boolean('is_active')->default(true)->after('max_duration_minutes');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pricing_rules', function (Blueprint $table) {
            $table->dropColumn(['name', 'min_duration_minutes', 'max_duration_minutes', 'is_active']);
        });
    }
};