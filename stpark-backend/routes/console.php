<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Programar actualización diaria del valor de la UF
// Se ejecuta todos los días a las 8:00 AM (hora de Chile)
Schedule::command('uf:update --days=7')
    ->dailyAt('08:00')
    ->timezone('America/Santiago')
    ->withoutOverlapping()
    ->onFailure(function () {
        \Illuminate\Support\Facades\Log::error('Error al ejecutar actualización diaria de UF');
    });

