<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\HandleCors;
use Illuminate\Http\Middleware\TrustProxies;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // 🔴 Asegura CORS GLOBAL (para TODAS las rutas, incluidas las que fallen)
        $middleware->append(HandleCors::class); 

        // (Opcional pero recomendable si estás detrás de Apache/Octane reverse proxy)
        $middleware->trustProxies(TrustProxies::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
