<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ParkingSessionController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\DebtController;
use App\Http\Controllers\SectorController;
use App\Http\Controllers\OperatorController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\PricingProfileController;
use App\Http\Controllers\PricingRuleController;
use App\Http\Controllers\StreetController;
use App\Http\Controllers\StatsController;
use Stancl\Tenancy\Middleware\InitializeTenancyByRequestData;

/*
|--------------------------------------------------------------------------
| Tenant Routes
|--------------------------------------------------------------------------
|
| Here you can register the tenant routes for your application.
| These routes are loaded by the TenantRouteServiceProvider.
|
| Feel free to customize them however you want. Good luck!
|
*/

Route::middleware([
    'api',
    InitializeTenancyByRequestData::class,
])->prefix('parking')->group(function () {
    Route::get('/', function () {
        return 'This is your multi-tenant application. The id of the current tenant is ' . tenant('id');
    });
    // Rutas de autenticación
    Route::prefix('auth')->group(function () {
        Route::post('/verify', [AuthController::class, 'verify']); // Verificar token
        Route::post('/logout', [AuthController::class, 'logout']); // Logout operador
    });

    // Rutas de sesiones de estacionamiento
    Route::prefix('sessions')->group(function () {
        Route::post('/', [ParkingSessionController::class, 'store']); // Crear sesión (check-in)
        Route::post('/with-debt-check', [ParkingSessionController::class, 'createSessionWithDebtCheck']); // Crear sesión con verificación de deudas
        Route::get('/', [ParkingSessionController::class, 'index']); // Listar sesiones
        Route::get('/active-by-plate', [ParkingSessionController::class, 'activeByPlate']); // Buscar sesión activa por placa
        Route::get('/active-by-operator', [ParkingSessionController::class, 'activeByOperator']); // Obtener sesiones activas por operador
        Route::get('/check-pending-debts', [ParkingSessionController::class, 'checkPendingDebts']); // Verificar deudas pendientes por placa
        Route::get('/{id}', [ParkingSessionController::class, 'show']); // Obtener sesión por ID
        Route::post('/{id}/quote', [ParkingSessionController::class, 'quote']); // Obtener cotización
        Route::post('/{id}/checkout', [ParkingSessionController::class, 'checkout']); // Checkout
        Route::post('/{id}/force-checkout', [ParkingSessionController::class, 'forceCheckoutWithoutPayment']); // Forzar checkout sin pago
        Route::post('/{id}/cancel', [ParkingSessionController::class, 'cancel']); // Cancelar sesión
    });

    // Rutas de pagos
    Route::prefix('payments')->group(function () {
        Route::post('/', [PaymentController::class, 'store']); // Procesar pago desde caja
        Route::post('/webhook', [PaymentController::class, 'webhook']); // Webhook Webpay
        Route::get('/', [PaymentController::class, 'index']); // Listar pagos
        Route::get('/summary-by-operator', [PaymentController::class, 'summaryByOperator']); // Resumen por operador
        Route::get('/{id}', [PaymentController::class, 'show']); // Obtener pago por ID
    });

    // Rutas de deudas
    Route::prefix('debts')->group(function () {
        Route::post('/', [DebtController::class, 'store']); // Crear deuda manual
        Route::get('/', [DebtController::class, 'index']); // Listar deudas
        Route::get('/by-plate', [DebtController::class, 'byPlate']); // Buscar deudas por placa
        Route::get('/pending-summary', [DebtController::class, 'pendingSummary']); // Resumen de deudas pendientes
        Route::get('/{id}', [DebtController::class, 'show']); // Obtener deuda por ID
        Route::post('/{id}/settle', [DebtController::class, 'settle']); // Liquidar deuda
    });

    // Rutas de sectores
    Route::prefix('sectors')->group(function () {
        Route::get('/', [SectorController::class, 'index']); // Listar sectores
        Route::post('/', [SectorController::class, 'store']); // Crear sector
        Route::get('/{id}', [SectorController::class, 'show']); // Obtener sector por ID
        Route::put('/{id}', [SectorController::class, 'update']); // Actualizar sector
        Route::delete('/{id}', [SectorController::class, 'destroy']); // Eliminar sector
        Route::get('/{id}/streets', [SectorController::class, 'streets']); // Obtener calles de un sector
    });

    // Rutas de calles
    Route::prefix('streets')->group(function () {
        Route::get('/', [StreetController::class, 'index']); // Listar calles
        Route::post('/', [StreetController::class, 'store']); // Crear calle
        Route::get('/{id}', [StreetController::class, 'show']); // Obtener calle por ID
        Route::put('/{id}', [StreetController::class, 'update']); // Actualizar calle
        Route::delete('/{id}', [StreetController::class, 'destroy']); // Eliminar calle
    });

    // Rutas de operadores
    Route::prefix('operators')->group(function () {
        Route::post('/login', [AuthController::class, 'operatorsLogin']); // Login operador
        Route::get('/', [OperatorController::class, 'index']); // Listar operadores
        Route::get('/all', [OperatorController::class, 'all']); // Obtener todos los operadores activos
        Route::post('/', [OperatorController::class, 'store']); // Crear operador
        Route::get('/{id}', [OperatorController::class, 'show']); // Obtener operador por ID
        Route::put('/{id}', [OperatorController::class, 'update']); // Actualizar operador
        Route::put('/{id}/pin', [OperatorController::class, 'updatePin']); // Actualizar PIN del operador
        Route::post('/{id}/assign', [OperatorController::class, 'assign']); // Asignar operador a sector/calle
        Route::delete('/{id}/assignments', [OperatorController::class, 'removeAllAssignments']); // Eliminar todas las asignaciones del operador
        Route::get('/{id}/assignments', [OperatorController::class, 'assignments']); // Obtener asignaciones del operador
    });

    // Rutas de reportes
    Route::prefix('reports')->group(function () {
        Route::get('/sales', [ReportController::class, 'salesReport']); // Reporte de ventas
        Route::get('/payments', [ReportController::class, 'paymentsReport']); // Reporte de pagos
        Route::get('/debts', [ReportController::class, 'debtsReport']); // Reporte de deudas
        Route::get('/operator', [ReportController::class, 'operatorReport']); // Reporte por operador
        Route::get('/dashboard', [ReportController::class, 'dashboard']); // Dashboard general
    });

    // Rutas de perfiles de precios
    Route::prefix('pricing-profiles')->group(function () {
        Route::get('/', [PricingProfileController::class, 'index']); // Listar perfiles
        Route::post('/', [PricingProfileController::class, 'store']); // Crear perfil
        Route::get('/{id}', [PricingProfileController::class, 'show']); // Obtener perfil por ID
        Route::put('/{id}', [PricingProfileController::class, 'update']); // Actualizar perfil
        Route::delete('/{id}', [PricingProfileController::class, 'destroy']); // Eliminar perfil
        Route::post('/{id}/toggle-status', [PricingProfileController::class, 'toggleStatus']); // Activar/desactivar perfil
        Route::get('/{id}/rules', [PricingRuleController::class, 'getByProfile']); // Obtener reglas de un perfil
    });

    // Rutas de reglas de precios
    Route::prefix('pricing-rules')->group(function () {
        Route::get('/', [PricingRuleController::class, 'index']); // Listar reglas
        Route::post('/', [PricingRuleController::class, 'store']); // Crear regla
        Route::get('/{id}', [PricingRuleController::class, 'show']); // Obtener regla por ID
        Route::put('/{id}', [PricingRuleController::class, 'update']); // Actualizar regla
        Route::delete('/{id}', [PricingRuleController::class, 'destroy']); // Eliminar regla
        Route::post('/{id}/toggle-status', [PricingRuleController::class, 'toggleStatus']); // Activar/desactivar regla
    });

    // Rutas de estadísticas
    Route::prefix('stats')->group(function () {
        Route::get('/daily', [StatsController::class, 'getDailyStats']); // Estadísticas del día
        Route::get('/date-range', [StatsController::class, 'getStatsByDateRange']); // Estadísticas por rango de fechas
    });

});
