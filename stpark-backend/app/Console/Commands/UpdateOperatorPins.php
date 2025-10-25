<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Operator;

class UpdateOperatorPins extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'operators:update-pins';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Actualizar PINs de operadores existentes';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Actualizando PINs de operadores...');

        // Obtener todos los operadores
        $operators = Operator::all();

        if ($operators->isEmpty()) {
            $this->warn('No hay operadores en la base de datos.');
            return;
        }

        // Datos de prueba para asignar
        $testData = [
            ['email' => 'juan.perez@stpark.cl', 'pin' => '123456'],
            ['email' => 'maria.gonzalez@stpark.cl', 'pin' => '654321'],
            ['email' => 'carlos.lopez@stpark.cl', 'pin' => '111111'],
            ['email' => 'ana.silva@stpark.cl', 'pin' => '222222'],
            ['email' => 'luis.martinez@stpark.cl', 'pin' => '333333'],
        ];
        $dataIndex = 0;

        foreach ($operators as $operator) {
            // Si no tiene email o PIN, asignar datos de prueba
            if (empty($operator->email) || empty($operator->pin)) {
                $testInfo = $testData[$dataIndex % count($testData)];
                
                if (empty($operator->email)) {
                    $operator->email = $testInfo['email'];
                }
                if (empty($operator->pin)) {
                    $operator->pin = $testInfo['pin'];
                }
                
                $operator->save();

                $this->line("Operador {$operator->name} - Email: {$operator->email} | PIN: {$operator->pin}");
                $dataIndex++;
            } else {
                $this->line("Operador {$operator->name} - Email: {$operator->email} | PIN: {$operator->pin} (ya existe)");
            }
        }

        $this->info('PINs actualizados exitosamente!');
        $this->newLine();
        $this->info('Credenciales de prueba para la app móvil:');
        
        foreach ($operators as $operator) {
            if ($operator->email && $operator->pin) {
                $this->line("- Email: {$operator->email} | PIN: {$operator->pin}");
            }
        }
    }
}