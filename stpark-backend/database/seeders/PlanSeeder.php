<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Plan;
use App\Models\PlanFeature;

class PlanSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Crear plan Gratis
        $freePlan = Plan::create([
            'name' => 'Gratis',
            'description' => 'Plan inicial ideal para comenzar a conocer y explorar todas las funcionalidades del sistema. Perfecto para evaluar las capacidades de gestión de estacionamiento sin compromiso.',
            'max_price_uf' => 0.00,
            'status' => 'ACTIVE',
        ]);

        // Crear funcionalidades del plan Gratis
        PlanFeature::create([
            'plan_id' => $freePlan->id,
            'max_operators' => 1,
            'max_streets' => 1,
            'max_sectors' => 1,
            'max_sessions' => 50,
            'max_pricing_profiles' => 1,
            'max_pricing_rules' => 1,
            'includes_debt_management' => false,
            'report_type' => 'BASIC',
            'support_type' => 'BASIC',
        ]);

        $this->command->info('Plan "Gratis" creado exitosamente con sus funcionalidades.');
    }
}
