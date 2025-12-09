<?php

namespace App\Services;

use Transbank\Webpay\WebpayPlus\Transaction;
use Transbank\Webpay\Options;
use Transbank\Webpay\WebpayPlus\Responses\TransactionCreateResponse;
use Transbank\Webpay\WebpayPlus\Responses\TransactionCommitResponse;
use Transbank\Webpay\WebpayPlus\Responses\TransactionStatusResponse;
use Illuminate\Support\Facades\Log;

class WebPayService
{
    /**
     * Obtener las opciones de configuración de WebPay
     * 
     * @return Options
     */
    private function getOptions(): Options
    {
        // Obtener configuración desde variables de entorno
        $environment = env('WEBPAY_ENVIRONMENT', Options::ENVIRONMENT_INTEGRATION);
        $commerceCode = env('WEBPAY_COMMERCE_CODE', '597055555532');
        $apiKey = env('WEBPAY_API_KEY', '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C');

        // Crear y retornar las opciones de configuración
        return new Options($apiKey, $commerceCode, $environment);
    }

    /**
     * Crear una nueva instancia de Transaction con la configuración correcta
     * 
     * @return Transaction
     */
    private function getTransaction(): Transaction
    {
        $options = $this->getOptions();
        return new Transaction($options);
    }

    /**
     * Crear transacción de WebPay Plus
     * 
     * @param string $buyOrder Orden de compra única (máximo 26 caracteres)
     * @param string $sessionId ID de sesión único
     * @param int $amount Monto a pagar en pesos chilenos (entero, sin decimales)
     * @param string $returnUrl URL de retorno después del pago
     * @return TransactionCreateResponse
     */
    public function createTransaction(
        string $buyOrder,
        string $sessionId,
        int $amount,
        string $returnUrl
    ): TransactionCreateResponse {
        try {
            // Validar que el monto sea mayor a 0
            if ($amount <= 0) {
                throw new \InvalidArgumentException('El monto debe ser mayor a 0');
            }

            // Validar longitud del buyOrder (máximo 26 caracteres según documentación)
            if (strlen($buyOrder) > 26) {
                throw new \InvalidArgumentException('El buyOrder no puede exceder 26 caracteres');
            }

            // Obtener instancia de Transaction con configuración
            $transaction = $this->getTransaction();

            // Crear la transacción según documentación oficial
            $response = $transaction->create(
                $buyOrder,              // buyOrder: Identificador único de la orden (máx 26 caracteres)
                $sessionId,             // sessionId: ID de sesión del usuario
                $amount,                // amount: Monto en pesos chilenos (entero)
                $returnUrl              // returnUrl: URL donde Transbank redirigirá después del pago
            );

            Log::info('WebPay transaction created', [
                'buy_order' => $buyOrder,
                'session_id' => $sessionId,
                'amount' => $amount,
                'token' => $response->getToken(),
                'url' => $response->getUrl()
            ]);

            return $response;

        } catch (\Exception $e) {
            Log::error('Error creating WebPay transaction', [
                'buy_order' => $buyOrder,
                'session_id' => $sessionId,
                'amount' => $amount,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw new \Exception('Error al crear transacción de WebPay: ' . $e->getMessage());
        }
    }

    /**
     * Confirmar transacción de WebPay Plus
     * Este método se llama cuando WebPay redirige de vuelta con el token_ws
     * 
     * @param string $token Token de la transacción recibido de WebPay (token_ws)
     * @return TransactionCommitResponse
     */
    public function commitTransaction(string $token): TransactionCommitResponse
    {
        try {
            if (empty($token)) {
                throw new \InvalidArgumentException('El token no puede estar vacío');
            }

            // Obtener instancia de Transaction con configuración
            $transaction = $this->getTransaction();

            // Confirmar la transacción según documentación oficial
            $response = $transaction->commit($token);

            Log::info('WebPay transaction committed', [
                'token' => $token,
                'response_code' => $response->getResponseCode(),
                'status' => $response->getStatus(),
                'buy_order' => $response->getBuyOrder(),
                'authorization_code' => $response->getAuthorizationCode()
            ]);

            return $response;

        } catch (\Exception $e) {
            Log::error('Error committing WebPay transaction', [
                'token' => $token,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw new \Exception('Error al confirmar transacción de WebPay: ' . $e->getMessage());
        }
    }

    /**
     * Verificar estado de una transacción
     * 
     * @param string $token Token de la transacción
     * @return TransactionStatusResponse
     */
    public function getTransactionStatus(string $token): TransactionStatusResponse
    {
        try {
            if (empty($token)) {
                throw new \InvalidArgumentException('El token no puede estar vacío');
            }

            // Obtener instancia de Transaction con configuración
            $transaction = $this->getTransaction();

            // Consultar estado de la transacción
            $response = $transaction->status($token);

            Log::info('WebPay transaction status retrieved', [
                'token' => $token,
                'response_code' => $response->getResponseCode(),
                'status' => $response->getStatus()
            ]);

            return $response;

        } catch (\Exception $e) {
            Log::error('Error getting WebPay transaction status', [
                'token' => $token,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw new \Exception('Error al consultar estado de transacción: ' . $e->getMessage());
        }
    }
}
