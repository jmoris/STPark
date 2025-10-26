<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CorsMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $origin = $request->header('Origin');
        
        // Lista de orígenes permitidos para web
        $allowedOrigins = [
            'https://panel.stpark.cl',
            'http://localhost:4200',
            'http://localhost:8081',
        ];
        
        // Si no hay origen (app móvil), usar wildcard
        // Si hay origen, verificar si está en la lista permitida
        if (!$origin) {
            // App móvil o petición sin origen
            $allowedOrigin = '*';
            $supportsCredentials = false;
        } elseif (in_array($origin, $allowedOrigins)) {
            // Origen web permitido
            $allowedOrigin = $origin;
            $supportsCredentials = true;
        } else {
            // Origen web no permitido
            $allowedOrigin = '*';
            $supportsCredentials = false;
        }
        
        // Handle preflight requests
        if ($request->getMethod() === 'OPTIONS') {
            $preflightResponse = response('', 200)
                ->header('Access-Control-Allow-Origin', $allowedOrigin)
                ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
                ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Tenant');
            
            if ($supportsCredentials) {
                $preflightResponse->header('Access-Control-Allow-Credentials', 'true');
            }
            
            return $preflightResponse->header('Access-Control-Max-Age', '86400');
        }

        $response = $next($request);

        // Add CORS headers to the response
        $response->headers->set('Access-Control-Allow-Origin', $allowedOrigin);
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Tenant');
        
        if ($supportsCredentials) {
            $response->headers->set('Access-Control-Allow-Credentials', 'true');
        }
        
        $response->headers->set('Access-Control-Max-Age', '86400');

        return $response;
    }
}
