<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use App\Helpers\DatabaseHelper;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_id'); // ID del tenant (estacionamiento)
            $table->foreign('tenant_id')->references('id')->on('tenants')->onDelete('cascade');
            $table->string('folio')->nullable()->unique(); // Folio único de la factura (null hasta ser emitida en SII)
            $table->string('client_name'); // Nombre del cliente
            $table->string('client_rut'); // RUT del cliente
            $table->date('emission_date'); // Fecha de emisión
            $table->decimal('net_amount', 10, 2); // Monto neto (sin IVA)
            $table->decimal('iva_amount', 10, 2); // Monto IVA
            $table->decimal('total_amount', 10, 2); // Monto total (con IVA)
            
            // Usar DatabaseHelper para crear enum compatible con PostgreSQL y MySQL/MariaDB
            DatabaseHelper::createEnumColumn(
                $table,
                'status',
                ['PENDING_REVIEW', 'UNPAID', 'PAID', 'OVERDUE', 'CANCELLED'],
                'PENDING_REVIEW'
            );
            
            $table->date('payment_date')->nullable(); // Fecha de pago
            $table->text('notes')->nullable(); // Notas adicionales
            $table->timestamps();

            // Índices para mejorar consultas
            $table->index('tenant_id');
            $table->index('folio');
            $table->index('emission_date');
            $table->index('status');
        });
        
        // Agregar constraint CHECK para PostgreSQL después de crear la tabla
        DatabaseHelper::addEnumCheckConstraint('invoices', 'status', ['PENDING_REVIEW', 'UNPAID', 'PAID', 'OVERDUE', 'CANCELLED']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $driver = DB::getDriverName();
        
        // Eliminar constraint CHECK si es PostgreSQL
        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check');
        }
        
        Schema::dropIfExists('invoices');
    }
};
