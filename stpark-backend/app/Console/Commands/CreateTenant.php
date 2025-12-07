<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Models\Plan;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Stancl\Tenancy\Tenancy;
use Throwable;

class CreateTenant extends Command
{
    protected $signature = 'tenant:create
        {id : ID/slug del tenant, ej. acme}
        {--name= : Nombre descriptivo}
        {--domain= : (Opcional) dominio del tenant, ej. acme.tuapp.com}
        {--no-migrate : Crea el tenant sin ejecutar migraciones por-tenant}
        {--seed : Ejecuta seeders después de migrar}
        {--seeder=Database\\Seeders\\TenantDatabaseSeeder : Clase de seeder a ejecutar}
        {--force : Forzar en producción}';

    protected $description = 'Crea un tenant con su base de datos y ejecuta migraciones (y seeders opcionalmente).';

    public function handle(Tenancy $tenancy): int
    {
        $id   = (string) $this->argument('id');
        $name = (string) ($this->option('name') ?? $id);
        $domain = $this->option('domain');
        $runMigrations = ! $this->option('no-migrate');
        $runSeed = (bool) $this->option('seed');
        $seeder  = (string) $this->option('seeder');

        if ($this->getLaravel()->environment('production') && ! $this->option('force')) {
            $this->error('Estás en producción. Usa --force si estás seguro.');
            return self::FAILURE;
        }

        if (Tenant::find($id)) {
            $this->error("Ya existe un tenant con id '{$id}'.");
            return self::FAILURE;
        }

        try {
            // 0) Obtener o asignar el plan Gratis por defecto
            $freePlan = Plan::where('name', 'Gratis')
                ->where('status', 'ACTIVE')
                ->first();

            if (!$freePlan) {
                // Si no existe el plan Gratis, intentar usar el primer plan activo
                $freePlan = Plan::where('status', 'ACTIVE')->first();
                
                if (!$freePlan) {
                    $this->error('No se encontró ningún plan activo. Por favor, ejecuta el PlanSeeder primero.');
                    return self::FAILURE;
                }
                
                $this->warn("Plan 'Gratis' no encontrado. Usando plan: {$freePlan->name}");
            }

            // 1) Crear registro de tenant (en landlord)
            /** @var \App\Models\Tenant $tenant */
            $tenant = Tenant::create([
                'id'   => $id,
                'name' => $name,
                'plan_id' => $freePlan->id,
            ]);

            // 2) (Opcional) asociar dominio
            if ($domain) {
                if (method_exists($tenant, 'domains')) {
                    $tenant->domains()->create(['domain' => $domain]);
                } else {
                    $this->warn('El modelo Tenant no tiene HasDomains. Omite --domain o añade el trait.');
                }
            }

            $this->info("✅ Tenant '{$tenant->id}' creado.");

            $this->line('');
            $this->info('🎉 Listo:');
            $this->line('- Tenant ID: ' . $tenant->id);
            $this->line('- BD: ' . $tenant->tenancy_db_name);
            if ($domain) {
                $this->line('- Dominio: ' . $domain);
            }
            $this->line('- Para consumir la API usa el header: X-Tenant-Id: ' . $tenant->id);

            return self::SUCCESS;
        } catch (Throwable $e) {
            $this->error('❌ Error creando el tenant: ' . $e->getMessage());
            // Limpieza best-effort si algo falló a medias
            try {
                // Si alcanzó a crear la BD, puedes borrarla manualmente si corresponde
                // DB::statement('DROP DATABASE IF EXISTS ' . $tenant->database()); // <- descomenta solo si quieres autocleanup
            } catch (Throwable $dropEx) {
                $this->warn('No se pudo limpiar la BD automáticamente: ' . $dropEx->getMessage());
            }
            return self::FAILURE;
        }
    }
}
