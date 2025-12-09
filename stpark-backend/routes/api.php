<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\PlanController;
use App\Http\Controllers\UFController;
use App\Http\Controllers\CentralAdminDashboardController;


/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Rutas de autenticación del tenant central
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']); // Login usuario tenant central
    Route::post('/verify', [AuthController::class, 'verify']); // Verificar token
    Route::post('/logout', [AuthController::class, 'logout']); // Logout usuario
});

// Ruta pública para el retorno de WebPay (sin autenticación ni tenant)
// Esta ruta debe ser pública porque WebPay redirige sin headers de autenticación
Route::get('/invoices/{id}/webpay/return', [\App\Http\Controllers\InvoiceController::class, 'handleWebPayReturn']);

// Rutas protegidas del tenant central (requieren autenticación Sanctum)
Route::middleware('auth:sanctum')->group(function () {
    Route::prefix('tenants')->group(function () {
        Route::get('/', [AuthController::class, 'getTenants']); // Obtener lista de tenants
    });
    
    // Rutas de perfil de usuario
    Route::put('/user/profile', [AuthController::class, 'updateProfile']); // Actualizar perfil del usuario

    // Rutas de UF (Unidad de Fomento)
    Route::prefix('uf')->group(function () {
        Route::get('/current', [UFController::class, 'getCurrentValue']); // Obtener valor actual de la UF
        Route::get('/date', [UFController::class, 'getValueByDate']); // Obtener valor de UF por fecha
        Route::get('/search-series', [UFController::class, 'searchSeries']); // Buscar series disponibles
    });

    // Rutas de administración central (solo para administradores centrales)
    Route::prefix('central-admin')->group(function () {
        Route::get('/dashboard', [CentralAdminDashboardController::class, 'dashboard']); // Dashboard de administración central
        
        // Rutas de configuración de FacturAPI
        Route::prefix('facturapi-config')->group(function () {
            Route::get('/', [\App\Http\Controllers\FacturAPIConfigController::class, 'get']); // Obtener configuración
            Route::post('/', [\App\Http\Controllers\FacturAPIConfigController::class, 'store']); // Guardar configuración
        });
        
        // Rutas de planes
        Route::prefix('plans')->group(function () {
            Route::get('/', [PlanController::class, 'index']); // Listar planes
            Route::post('/', [PlanController::class, 'store']); // Crear plan
            Route::get('/{id}', [PlanController::class, 'show']); // Obtener plan por ID
            Route::put('/{id}', [PlanController::class, 'update']); // Actualizar plan
            Route::delete('/{id}', [PlanController::class, 'destroy']); // Eliminar plan
        });

        // Rutas de tenants (estacionamientos)
        Route::prefix('tenants')->group(function () {
            Route::get('/', [\App\Http\Controllers\TenantController::class, 'index']); // Listar tenants
            Route::post('/', [\App\Http\Controllers\TenantController::class, 'store']); // Crear tenant
            Route::get('/{id}', [\App\Http\Controllers\TenantController::class, 'show']); // Obtener tenant por ID
            Route::put('/{id}', [\App\Http\Controllers\TenantController::class, 'update']); // Actualizar tenant
            Route::delete('/{id}', [\App\Http\Controllers\TenantController::class, 'destroy']); // Eliminar tenant
        });

        // Rutas de usuarios
        Route::prefix('users')->group(function () {
            Route::get('/', [\App\Http\Controllers\UserController::class, 'index']); // Listar usuarios
            Route::post('/', [\App\Http\Controllers\UserController::class, 'store']); // Crear usuario
            Route::get('/{id}', [\App\Http\Controllers\UserController::class, 'show']); // Obtener usuario por ID
            Route::put('/{id}', [\App\Http\Controllers\UserController::class, 'update']); // Actualizar usuario
            Route::delete('/{id}', [\App\Http\Controllers\UserController::class, 'destroy']); // Eliminar usuario
            Route::post('/{id}/assign-tenants', [\App\Http\Controllers\UserController::class, 'assignToTenants']); // Asignar usuario a estacionamientos
            Route::post('/{id}/remove-tenants', [\App\Http\Controllers\UserController::class, 'removeFromTenants']); // Remover usuario de estacionamientos
        });
    });

    // Rutas de facturas (base de datos central)
    // Estas rutas están fuera del prefijo central-admin para que sean /api/invoices
    // El controlador filtra automáticamente por tenant_id según el contexto
    Route::prefix('invoices')->group(function () {
        Route::get('/', [\App\Http\Controllers\InvoiceController::class, 'index']); // Listar facturas (todas si central admin, filtradas si tenant, excluye pendientes)
        Route::get('/pending', [\App\Http\Controllers\InvoiceController::class, 'pending']); // Listar facturas pendientes de revisión (solo central admin)
        Route::get('/{id}', [\App\Http\Controllers\InvoiceController::class, 'show']); // Obtener factura por ID
        Route::post('/', [\App\Http\Controllers\InvoiceController::class, 'store']); // Crear factura
        Route::put('/{id}', [\App\Http\Controllers\InvoiceController::class, 'update']); // Actualizar factura
        Route::delete('/{id}', [\App\Http\Controllers\InvoiceController::class, 'destroy']); // Eliminar factura
        Route::post('/{id}/accept', [\App\Http\Controllers\InvoiceController::class, 'accept']); // Aceptar factura pendiente (solo central admin)
        Route::post('/{id}/reject', [\App\Http\Controllers\InvoiceController::class, 'reject']); // Rechazar factura pendiente (solo central admin)
        Route::post('/{id}/pay', [\App\Http\Controllers\InvoiceController::class, 'pay']); // Registrar pago de factura (solo central admin)
    });
});

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});


