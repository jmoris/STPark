<?php

namespace App\Services;

use App\Models\Payment;
use App\Models\Sale;
use App\Models\ParkingSession;
use App\Models\Debt;
use App\Models\AuditLog;
use App\Models\IdempotencyKey;
use Illuminate\Support\Facades\Hash;

class PaymentService
{
    /**
     * Procesar pago desde caja
     */
    public function processPayment(
        ?int $saleId,
        ?int $sessionId,
        string $method,
        float $amount,
        int $cashierOperatorId
    ): Payment {
        $payment = Payment::create([
            'sale_id' => $saleId,
            'session_id' => $sessionId,
            'method' => $method,
            'amount' => $amount,
            'paid_at' => now(),
            'status' => Payment::STATUS_COMPLETED,
        ]);

        // Si hay una venta asociada, verificar si está completamente pagada
        if ($saleId) {
            $sale = Sale::findOrFail($saleId);
            $this->processSalePayment($sale, $payment);
        }

        // Si hay una sesión asociada, verificar si está completamente pagada
        if ($sessionId) {
            $session = ParkingSession::findOrFail($sessionId);
            $this->processSessionPayment($session, $payment);
        }

        // Registrar auditoría
        AuditLog::log(
            $cashierOperatorId,
            'CREATE',
            'payments',
            $payment->id,
            null,
            $payment->toArray()
        );

        return $payment;
    }

    /**
     * Procesar webhook de Webpay
     */
    public function processWebpayWebhook(
        string $transactionId,
        int $sessionId,
        float $amount,
        string $status,
        ?string $providerRef
    ): Payment {
        // Verificar idempotencia
        $idempotencyKey = $this->generateIdempotencyKey($transactionId, $sessionId);
        
        if (IdempotencyKey::where('key', $idempotencyKey)->exists()) {
            return IdempotencyKey::where('key', $idempotencyKey)->first()->response;
        }

        $session = ParkingSession::findOrFail($sessionId);
        
        if (!$session->sale) {
            throw new \Exception('La sesión no tiene venta asociada');
        }

        $payment = Payment::create([
            'sale_id' => $session->sale->id,
            'session_id' => $sessionId,
            'method' => Payment::METHOD_WEBPAY,
            'amount' => $amount,
            'paid_at' => now(),
            'provider_ref' => $providerRef,
            'status' => $status === 'COMPLETED' ? Payment::STATUS_COMPLETED : Payment::STATUS_FAILED,
        ]);

        // Guardar idempotencia
        IdempotencyKey::create([
            'key' => $idempotencyKey,
            'endpoint' => 'payments/webhook',
            'payload_hash' => Hash::make($transactionId . $sessionId),
            'response' => $payment->toArray(),
            'created_at' => now(),
        ]);

        if ($status === 'COMPLETED') {
            $this->processSalePayment($session->sale, $payment);
            $this->processSessionPayment($session, $payment);
        }

        // Registrar auditoría
        AuditLog::log(
            $session->operator_in_id,
            'WEBHOOK',
            'payments',
            $payment->id,
            null,
            $payment->toArray()
        );

        return $payment;
    }

    /**
     * Procesar pago de venta
     */
    private function processSalePayment(Sale $sale, Payment $payment): void
    {
        $paidAmount = $sale->getPaidAmount();
        
        if ($paidAmount >= $sale->total) {
            // La venta está completamente pagada
            $sale->update([
                'issued_at' => now(),
            ]);
        }
    }

    /**
     * Procesar pago de sesión
     */
    private function processSessionPayment(ParkingSession $session, Payment $payment): void
    {
        $sessionService = app(ParkingSessionService::class);
        
        $paidAmount = $session->sale ? $session->sale->getPaidAmount() : 0;
        
        if ($paidAmount >= $session->net_amount) {
            // La sesión está completamente pagada
            $sessionService->markAsPaid($session);
            $sessionService->closeSession($session);
        } else {
            // Crear deuda por el monto faltante
            $sessionService->createDebtIfNeeded($session, $paidAmount);
        }
    }

    /**
     * Obtener resumen de pagos por operador
     */
    public function getOperatorSummary(int $operatorId, string $dateFrom, string $dateTo): array
    {
        $payments = Payment::completed()
            ->whereHas('sale', function($query) use ($operatorId) {
                $query->where('cashier_operator_id', $operatorId);
            })
            ->whereBetween('paid_at', [$dateFrom, $dateTo])
            ->get();

        $summary = [
            'operator_id' => $operatorId,
            'period' => [
                'from' => $dateFrom,
                'to' => $dateTo,
            ],
            'total_payments' => $payments->count(),
            'total_amount' => $payments->sum('amount'),
            'by_method' => $payments->groupBy('method')->map(function($group) {
                return [
                    'count' => $group->count(),
                    'total' => $group->sum('amount'),
                ];
            }),
            'daily_breakdown' => $payments->groupBy(function($payment) {
                return $payment->paid_at->format('Y-m-d');
            })->map(function($group) {
                return [
                    'count' => $group->count(),
                    'total' => $group->sum('amount'),
                ];
            }),
        ];

        return $summary;
    }

    /**
     * Generar clave de idempotencia
     */
    private function generateIdempotencyKey(string $transactionId, int $sessionId): string
    {
        return 'webpay_' . $transactionId . '_' . $sessionId;
    }
}
