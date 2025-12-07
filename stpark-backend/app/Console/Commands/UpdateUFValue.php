<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\BancoCentralService;

class UpdateUFValue extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'uf:update 
                            {--days=7 : Número de días hacia atrás para actualizar}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Actualizar el valor de la UF desde el webservice del Banco Central de Chile';

    /**
     * Execute the console command.
     */
    public function handle(BancoCentralService $bancoCentralService)
    {
        $this->info('Actualizando valores de UF desde el Banco Central...');

        $daysBack = (int) $this->option('days');

        $result = $bancoCentralService->updateUFValues($daysBack);

        if ($result['success']) {
            $this->info("✅ {$result['message']}");
            $this->info("   Valores actualizados: {$result['updated_count']}");

            if (!empty($result['errors'])) {
                $this->warn('   Algunos errores ocurrieron:');
                foreach ($result['errors'] as $error) {
                    $this->error("   - {$error}");
                }
            }

            // Mostrar el valor más reciente
            $latestValue = \App\Models\UFValue::getLatestValue();
            if ($latestValue) {
                $this->newLine();
                $this->info("Valor más reciente de UF:");
                $this->line("   Fecha: {$latestValue->date->format('Y-m-d')}");
                $this->line("   Valor: $" . number_format($latestValue->value, 2, ',', '.'));
            }

            return Command::SUCCESS;
        } else {
            $this->error("❌ Error: {$result['message']}");
            return Command::FAILURE;
        }
    }
}
