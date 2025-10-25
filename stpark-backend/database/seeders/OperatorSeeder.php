<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Operator;

class OperatorSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $operators = [
            [
                'name' => 'Juan Pérez',
                'rut' => '12345678-9',
                'email' => 'juan.perez@stpark.cl',
                'phone' => '+56912345678',
                'pin' => '123456',
                'status' => 'ACTIVE',
            ],
            [
                'name' => 'María González',
                'rut' => '87654321-0',
                'email' => 'maria.gonzalez@stpark.cl',
                'phone' => '+56987654321',
                'pin' => '654321',
                'status' => 'ACTIVE',
            ],
            [
                'name' => 'Carlos Rodríguez',
                'rut' => '11223344-5',
                'email' => 'carlos.rodriguez@stpark.cl',
                'phone' => '+56911223344',
                'pin' => '111111',
                'status' => 'ACTIVE',
            ],
            [
                'name' => 'Ana Silva',
                'rut' => '55667788-9',
                'email' => 'ana.silva@stpark.cl',
                'phone' => '+56955667788',
                'pin' => '222222',
                'status' => 'ACTIVE',
            ],
            [
                'name' => 'Luis Martínez',
                'rut' => '99887766-5',
                'email' => 'luis.martinez@stpark.cl',
                'phone' => '+56999887766',
                'pin' => '333333',
                'status' => 'ACTIVE',
            ],
        ];

        foreach ($operators as $operatorData) {
            Operator::updateOrCreate(
                ['email' => $operatorData['email']],
                $operatorData
            );
        }

        $this->command->info('Operadores de prueba creados exitosamente con PINs:');
        $this->command->info('- juan.perez@stpark.cl (PIN: 123456)');
        $this->command->info('- maria.gonzalez@stpark.cl (PIN: 654321)');
        $this->command->info('- carlos.rodriguez@stpark.cl (PIN: 111111)');
        $this->command->info('- ana.silva@stpark.cl (PIN: 222222)');
        $this->command->info('- luis.martinez@stpark.cl (PIN: 333333)');
    }
}