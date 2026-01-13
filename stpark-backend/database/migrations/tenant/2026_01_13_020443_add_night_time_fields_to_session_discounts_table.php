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
            $table->time('night_time_start')->nullable()->after('min_amount')->comment('Hora de inicio del horario nocturno (ej: 22:00)');
            $table->time('night_time_end')->nullable()->after('night_time_start')->comment('Hora de fin del horario nocturno (ej: 06:00)');
            $table->decimal('night_minute_value', 10, 2)->nullable()->after('night_time_end')->comment('Valor del minuto en horario nocturno');
            $table->decimal('night_min_amount', 10, 2)->nullable()->after('night_minute_value')->comment('Monto mínimo en horario nocturno (opcional)');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('session_discounts', function (Blueprint $table) {
            $table->dropColumn(['night_time_start', 'night_time_end', 'night_minute_value', 'night_min_amount']);
        });
    }
};
