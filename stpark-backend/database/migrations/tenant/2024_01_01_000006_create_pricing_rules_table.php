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
        Schema::create('pricing_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('profile_id')->constrained('pricing_profiles')->onDelete('cascade');
            $table->string('rule_type');
            $table->integer('start_min')->nullable();
            $table->integer('end_min')->nullable();
            $table->decimal('price_per_min', 10, 2)->nullable();
            $table->decimal('fixed_price', 10, 2)->nullable();
            $table->json('days_of_week')->nullable();
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->integer('priority')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pricing_rules');
    }
};
