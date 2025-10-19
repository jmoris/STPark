<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Sector;
use App\Models\Street;
use App\Models\Operator;
use App\Models\OperatorAssignment;
use App\Models\PricingProfile;
use App\Models\PricingRule;
use App\Models\DiscountRule;

class ParkingSystemSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Crear sectores
        $centro = Sector::create([
            'name' => 'Centro',
            'is_private' => false,
        ]);

        $plaza = Sector::create([
            'name' => 'Plaza Principal',
            'is_private' => false,
        ]);

        $estacionamiento = Sector::create([
            'name' => 'Estacionamiento Privado',
            'is_private' => true,
        ]);

        // Crear calles
        Street::create([
            'sector_id' => $centro->id,
            'name' => 'Calle Principal',
            'notes' => 'Zona comercial',
        ]);

        Street::create([
            'sector_id' => $centro->id,
            'name' => 'Calle Secundaria',
            'notes' => 'Zona residencial',
        ]);

        Street::create([
            'sector_id' => $plaza->id,
            'name' => 'Alrededor de la Plaza',
            'notes' => 'Zona turística',
        ]);

        Street::create([
            'sector_id' => $estacionamiento->id,
            'name' => 'Nivel 1',
            'notes' => 'Piso inferior',
        ]);

        // Crear operadores
        $operador1 = Operator::create([
            'name' => 'Juan Pérez',
            'rut' => '12345678-9',
            'status' => 'ACTIVE',
        ]);

        $operador2 = Operator::create([
            'name' => 'María González',
            'rut' => '98765432-1',
            'status' => 'ACTIVE',
        ]);

        $operador3 = Operator::create([
            'name' => 'Carlos López',
            'rut' => '11223344-5',
            'status' => 'ACTIVE',
        ]);

        // Crear asignaciones de operadores
        OperatorAssignment::create([
            'operator_id' => $operador1->id,
            'sector_id' => $centro->id,
            'street_id' => null,
            'valid_from' => now()->subDays(30),
            'valid_to' => null,
        ]);

        OperatorAssignment::create([
            'operator_id' => $operador2->id,
            'sector_id' => $plaza->id,
            'street_id' => null,
            'valid_from' => now()->subDays(30),
            'valid_to' => null,
        ]);

        OperatorAssignment::create([
            'operator_id' => $operador3->id,
            'sector_id' => $estacionamiento->id,
            'street_id' => null,
            'valid_from' => now()->subDays(30),
            'valid_to' => null,
        ]);

        // Crear perfiles de precios para el centro
        $perfilCentro = PricingProfile::create([
            'sector_id' => $centro->id,
            'name' => 'Tarifa Centro 2024',
            'active_from' => now()->startOfYear(),
            'active_to' => null,
        ]);

        // Reglas de precios para el centro
        PricingRule::create([
            'profile_id' => $perfilCentro->id,
            'rule_type' => 'HOURLY',
            'start_min' => 0,
            'end_min' => 60,
            'price_per_min' => 50, // $50 CLP por minuto
            'fixed_price' => null,
            'days_of_week' => [1, 2, 3, 4, 5], // Lunes a Viernes
            'start_time' => '08:00:00',
            'end_time' => '18:00:00',
            'priority' => 1,
        ]);

        PricingRule::create([
            'profile_id' => $perfilCentro->id,
            'rule_type' => 'HOURLY',
            'start_min' => 60,
            'end_min' => null,
            'price_per_min' => 30, // $30 CLP por minuto después de la primera hora
            'fixed_price' => null,
            'days_of_week' => [1, 2, 3, 4, 5],
            'start_time' => '08:00:00',
            'end_time' => '18:00:00',
            'priority' => 2,
        ]);

        PricingRule::create([
            'profile_id' => $perfilCentro->id,
            'rule_type' => 'FIXED',
            'start_min' => null,
            'end_min' => null,
            'price_per_min' => null,
            'fixed_price' => 500, // $500 CLP fijo fines de semana
            'days_of_week' => [6, 0], // Sábado y Domingo
            'start_time' => '00:00:00',
            'end_time' => '23:59:59',
            'priority' => 1,
        ]);

        // Reglas de descuento para el centro
        DiscountRule::create([
            'profile_id' => $perfilCentro->id,
            'kind' => 'PERCENTAGE',
            'condition_json' => [
                'min_minutes' => 120, // Descuento después de 2 horas
            ],
            'value' => 10, // 10% de descuento
            'max_amount' => 2000, // Máximo $2000 CLP de descuento
            'priority' => 1,
        ]);

        DiscountRule::create([
            'profile_id' => $perfilCentro->id,
            'kind' => 'FIXED',
            'condition_json' => [
                'min_amount' => 5000, // Descuento fijo para montos altos
            ],
            'value' => 500, // $500 CLP de descuento fijo
            'max_amount' => null,
            'priority' => 2,
        ]);

        // Crear perfil de precios para la plaza
        $perfilPlaza = PricingProfile::create([
            'sector_id' => $plaza->id,
            'name' => 'Tarifa Plaza 2024',
            'active_from' => now()->startOfYear(),
            'active_to' => null,
        ]);

        PricingRule::create([
            'profile_id' => $perfilPlaza->id,
            'rule_type' => 'FIXED',
            'start_min' => null,
            'end_min' => null,
            'price_per_min' => null,
            'fixed_price' => 1000, // $1000 CLP fijo
            'days_of_week' => [1, 2, 3, 4, 5, 6, 0], // Todos los días
            'start_time' => '00:00:00',
            'end_time' => '23:59:59',
            'priority' => 1,
        ]);

        // Crear perfil de precios para estacionamiento privado
        $perfilPrivado = PricingProfile::create([
            'sector_id' => $estacionamiento->id,
            'name' => 'Tarifa Estacionamiento Privado 2024',
            'active_from' => now()->startOfYear(),
            'active_to' => null,
        ]);

        PricingRule::create([
            'profile_id' => $perfilPrivado->id,
            'rule_type' => 'HOURLY',
            'start_min' => null,
            'end_min' => null,
            'price_per_min' => 80, // $80 CLP por minuto
            'fixed_price' => null,
            'days_of_week' => [1, 2, 3, 4, 5, 6, 0],
            'start_time' => '00:00:00',
            'end_time' => '23:59:59',
            'priority' => 1,
        ]);
    }
}
