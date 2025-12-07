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
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('rut')->nullable()->after('name');
            $table->string('razon_social')->nullable()->after('rut');
            $table->string('giro')->nullable()->after('razon_social');
            $table->string('direccion')->nullable()->after('giro');
            $table->string('comuna')->nullable()->after('direccion');
            $table->integer('dias_credito')->nullable()->default(0)->after('comuna');
            $table->string('correo_intercambio')->nullable()->after('dias_credito');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['rut', 'razon_social', 'giro', 'direccion', 'comuna', 'dias_credito', 'correo_intercambio']);
        });
    }
};
