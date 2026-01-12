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
            $table->integer('minimum_session_duration')->nullable()->after('minimum_duration')->comment('Duración mínima de la sesión en minutos requerida para aplicar el descuento (aplica a todos los tipos de descuento)');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('session_discounts', function (Blueprint $table) {
            $table->dropColumn('minimum_session_duration');
        });
    }
};
