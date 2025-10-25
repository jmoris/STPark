<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;


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

// Rutas protegidas del tenant central (requieren autenticación Sanctum)
Route::middleware('auth:sanctum')->group(function () {
    Route::prefix('tenants')->group(function () {
        Route::get('/', [AuthController::class, 'getTenants']); // Obtener lista de tenants
    });
});

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});


