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
        Schema::table('streets', function (Blueprint $table) {
            $table->string('address_number')->nullable()->after('name'); // Número de dirección específica
            $table->string('address_type')->default('STREET')->after('address_number'); // STREET o ADDRESS
            $table->string('block_range')->nullable()->after('address_type'); // Rango de cuadras (ej: "100-200")
            $table->boolean('is_specific_address')->default(false)->after('block_range'); // Si es dirección específica o calle completa
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('streets', function (Blueprint $table) {
            $table->dropColumn(['address_number', 'address_type', 'block_range', 'is_specific_address']);
        });
    }
};
