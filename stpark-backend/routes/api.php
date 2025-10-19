<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ParkingSessionController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\DebtController;
use App\Http\Controllers\SectorController;
use App\Http\Controllers\OperatorController;
use App\Http\Controllers\ReportController;

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

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

// Rutas de sesiones de estacionamiento
Route::prefix('sessions')->group(function () {
    Route::post('/', [ParkingSessionController::class, 'store']); // Crear sesión (check-in)
    Route::get('/', [ParkingSessionController::class, 'index']); // Listar sesiones
    Route::get('/active-by-plate', [ParkingSessionController::class, 'activeByPlate']); // Buscar sesión activa por placa
    Route::get('/{id}', [ParkingSessionController::class, 'show']); // Obtener sesión por ID
    Route::post('/{id}/quote', [ParkingSessionController::class, 'quote']); // Obtener cotización
    Route::post('/{id}/checkout', [ParkingSessionController::class, 'checkout']); // Checkout
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
});

// Rutas de operadores
Route::prefix('operators')->group(function () {
    Route::get('/', [OperatorController::class, 'index']); // Listar operadores
    Route::post('/', [OperatorController::class, 'store']); // Crear operador
    Route::get('/{id}', [OperatorController::class, 'show']); // Obtener operador por ID
    Route::put('/{id}', [OperatorController::class, 'update']); // Actualizar operador
    Route::post('/{id}/assign', [OperatorController::class, 'assign']); // Asignar operador a sector/calle
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
