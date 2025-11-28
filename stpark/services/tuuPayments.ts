import { TuuPayment, type PaymentData, type PaymentResult } from 'react-native-tuu-printer';

// Re-exportar el tipo PaymentData para compatibilidad
export type TuuPaymentData = PaymentData;

// Interfaz para el resultado del pago compatible con el código existente
export interface TuuPaymentResult {
  status: 'success' | 'error' | 'cancelled';
  transactionId?: string;
  authorizationCode?: string;
  authCode?: string; // Alias para compatibilidad
  cardNumber?: string;
  transactionMethod?: string;
  method?: number;
  last4?: string;
  cardLast4?: string;
  lastFourDigits?: string;
  errorCode?: string;
  errorMessage?: string;
  message?: string;
  [key: string]: any;
}

class TuuPaymentsService {
  private initialized: boolean = false;
  private paymentInProgress: boolean = false;

  /**
   * Inicializa el servicio configurando el modo de desarrollo
   * Debe llamarse una vez al inicio de la app
   * Por el momento siempre usa modo desarrollo
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    // Por el momento siempre usar modo desarrollo
    const isDevelopment = true;
    TuuPayment.setDevelopmentMode(isDevelopment);
    this.initialized = true;
    
    console.log('TuuPaymentsService: Inicializado en modo: DESARROLLO (forzado)');
  }

  /**
   * Verifica si el módulo TuuPayment está disponible
   */
  isAvailable(): boolean {
    return true; // La librería siempre está disponible si está instalada
  }

  /**
   * Verifica si la aplicación TUU Negocio está instalada
   * @param isDevelopment - Opcional: true para desarrollo, false para producción
   * @returns Promise<boolean> - true si está instalada, false en caso contrario
   */
  async isPaymentAppInstalled(isDevelopment?: boolean): Promise<boolean> {
    try {
      const devMode = isDevelopment !== undefined ? isDevelopment : __DEV__;
      const installed = await TuuPayment.isPaymentAppInstalled(devMode);
      console.log('TuuPaymentsService: App TUU instalada:', installed);
      return installed;
    } catch (error) {
      console.error('TuuPaymentsService: Error verificando instalación:', error);
      return false;
    }
  }

  /**
   * Resetea el estado de pago en progreso
   */
  resetPaymentState(): void {
    console.log('TuuPaymentsService: Reseteando estado de pago');
    this.paymentInProgress = false;
  }

  /**
   * Cancela un pago en progreso
   * @returns Promise<boolean> - true si se canceló exitosamente
   */
  async cancelPayment(): Promise<boolean> {
    try {
      const cancelled = await TuuPayment.cancelPayment();
      if (cancelled) {
        this.resetPaymentState();
      }
      return cancelled;
    } catch (error) {
      console.error('TuuPaymentsService: Error cancelando pago:', error);
      this.resetPaymentState();
      return false;
    }
  }

  /**
   * Convierte el resultado de PaymentResult a TuuPaymentResult
   */
  private convertPaymentResult(result: PaymentResult): TuuPaymentResult {
    try {
      console.log('TuuPaymentsService: convertPaymentResult - Iniciando conversión');
      console.log('TuuPaymentsService: convertPaymentResult - Result status:', result?.status);
      
      const converted: TuuPaymentResult = {
        status: result?.status || 'error',
        transactionId: result?.transactionId,
        authorizationCode: result?.authorizationCode ? String(result.authorizationCode) : undefined,
        authCode: result?.authorizationCode ? String(result.authorizationCode) : undefined, // Alias para compatibilidad
        cardNumber: result?.cardNumber,
        errorCode: result?.errorCode ? String(result.errorCode) : undefined,
        errorMessage: result?.errorMessage,
        message: result?.message,
      };

      // Copiar cualquier campo adicional de forma segura
      if (result && typeof result === 'object') {
        try {
          Object.keys(result).forEach(key => {
            if (!(key in converted)) {
              const value = (result as any)[key];
              // Solo copiar valores primitivos o serializables
              if (value !== null && value !== undefined) {
                if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                  converted[key] = value;
                } else if (typeof value === 'object' && !Array.isArray(value)) {
                  // Intentar copiar objetos simples
                  try {
                    JSON.parse(JSON.stringify(value));
                    converted[key] = value;
                  } catch (e) {
                    console.warn(`TuuPaymentsService: No se pudo copiar campo ${key}:`, e);
                  }
                }
              }
            }
          });
        } catch (copyError) {
          console.error('TuuPaymentsService: Error copiando campos adicionales:', copyError);
        }
      }

      console.log('TuuPaymentsService: convertPaymentResult - Conversión completada');
      return converted;
    } catch (error) {
      console.error('TuuPaymentsService: Error en convertPaymentResult:', error);
      // Retornar un resultado básico en caso de error
      return {
        status: 'error',
        errorMessage: 'Error al procesar el resultado del pago',
        message: 'Error al procesar el resultado del pago',
      };
    }
  }

  /**
   * Inicia un pago usando TUU Payments
   * @param paymentData - Datos del pago a procesar
   * @param isDevelopment - Opcional: true para desarrollo, false para producción. Si no se especifica, usa la configuración global
   * @returns Promise con el resultado del pago
   */
  async startPayment(
    paymentData: TuuPaymentData,
    isDevelopment?: boolean
  ): Promise<TuuPaymentResult | null> {
    // Asegurar que el servicio esté inicializado
    if (!this.initialized) {
      this.initialize();
    }

    // Prevenir múltiples llamadas simultáneas
    if (this.paymentInProgress) {
      console.log('TuuPaymentsService: Intento de pago bloqueado - ya hay un pago en progreso');
      throw new Error('Ya hay un pago en curso. Por favor espera a que se complete el pago anterior.');
    }

    this.paymentInProgress = true;

    // Preparar variables fuera del try para que estén disponibles en el catch
    const devMode = true; // Siempre desarrollo por el momento
    
    // Convertir el monto a entero y construir el objeto de pago antes del try
    const amountAsInteger = Math.round(paymentData.amount);
    const cleanPaymentData: PaymentData = {
      amount: amountAsInteger,
      tip: paymentData.tip ?? 0,
      cashback: paymentData.cashback ?? 0,
      method: paymentData.method,
      installmentsQuantity: paymentData.installmentsQuantity ?? 0,
      printVoucherOnApp: paymentData.printVoucherOnApp ?? true,
      dteType: paymentData.dteType ?? 48,
      extraData: paymentData.extraData || {
        sourceName: 'STPark',
        sourceVersion: '1.0.0',
      },
    };

    try {
      // Validar que el monto sea válido
      if (!paymentData.amount || paymentData.amount <= 0) {
        this.resetPaymentState();
        throw new Error('El monto debe ser mayor a 0');
      }

      const isInstalled = await this.isPaymentAppInstalled(devMode);
      
      if (!isInstalled) {
        this.resetPaymentState();
        throw new Error(
          devMode
            ? 'La app TUU Negocio (DEV) no está instalada'
            : 'La app TUU Negocio no está instalada'
        );
      }

      console.log('TuuPaymentsService: === INICIANDO PAGO TUU ===');
      console.log('TuuPaymentsService: Modo:', devMode ? 'DESARROLLO' : 'PRODUCCIÓN');
      console.log('TuuPaymentsService: Datos de pago:', JSON.stringify(cleanPaymentData, null, 2));
      console.log('TuuPaymentsService: Verificando tipos de datos...');
      console.log('TuuPaymentsService: - amount:', cleanPaymentData.amount, typeof cleanPaymentData.amount);
      console.log('TuuPaymentsService: - method:', cleanPaymentData.method, typeof cleanPaymentData.method);
      console.log('TuuPaymentsService: - extraData:', cleanPaymentData.extraData);
      console.log('TuuPaymentsService: Llamando a TuuPayment.startPayment con modo desarrollo=true...');

      // Iniciar el pago
      // Por el momento siempre usar modo desarrollo
      let result: PaymentResult;
      try {
        console.log('TuuPaymentsService: Antes de llamar TuuPayment.startPayment');
        result = await TuuPayment.startPayment(
          cleanPaymentData,
          true // Siempre desarrollo por el momento
        );
        console.log('TuuPaymentsService: Después de llamar TuuPayment.startPayment');
        console.log('TuuPaymentsService: Resultado recibido (raw):', result);
        console.log('TuuPaymentsService: Tipo de resultado:', typeof result);
        console.log('TuuPaymentsService: Es null/undefined?', result === null || result === undefined);
        
        if (!result) {
          console.warn('TuuPaymentsService: Resultado es null o undefined');
          this.resetPaymentState();
          return null;
        }

        // Intentar serializar el resultado de forma segura
        try {
          console.log('TuuPaymentsService: Intentando serializar resultado...');
          const resultString = JSON.stringify(result, null, 2);
          console.log('TuuPaymentsService: Resultado TUU recibido (JSON):', resultString);
        } catch (stringifyError) {
          console.error('TuuPaymentsService: Error al serializar resultado:', stringifyError);
          console.log('TuuPaymentsService: Resultado (sin serializar):', result);
        }

        console.log('TuuPaymentsService: Status del resultado:', result?.status);
        console.log('TuuPaymentsService: Keys del resultado:', result ? Object.keys(result) : 'N/A');
      } catch (paymentError: any) {
        console.error('TuuPaymentsService: Error al llamar startPayment:', paymentError);
        console.error('TuuPaymentsService: Tipo de error:', typeof paymentError);
        console.error('TuuPaymentsService: Código de error:', paymentError?.code);
        console.error('TuuPaymentsService: Mensaje de error:', paymentError?.message);
        console.error('TuuPaymentsService: Stack trace:', paymentError?.stack);
        try {
          console.error('TuuPaymentsService: Error completo (stringified):', JSON.stringify(paymentError, Object.getOwnPropertyNames(paymentError)));
        } catch (e) {
          console.error('TuuPaymentsService: No se pudo serializar el error');
        }
        // Re-lanzar el error para que se maneje en el catch externo
        throw paymentError;
      }

      // Convertir el resultado de forma segura
      let tuuResult: TuuPaymentResult;
      try {
        console.log('TuuPaymentsService: Convirtiendo resultado...');
        tuuResult = this.convertPaymentResult(result);
        console.log('TuuPaymentsService: Resultado convertido exitosamente');
        try {
          const convertedString = JSON.stringify(tuuResult, null, 2);
          console.log('TuuPaymentsService: Resultado convertido (JSON):', convertedString);
        } catch (e) {
          console.log('TuuPaymentsService: Resultado convertido (sin serializar):', tuuResult);
        }
      } catch (convertError) {
        console.error('TuuPaymentsService: Error al convertir resultado:', convertError);
        this.resetPaymentState();
        throw new Error('Error al procesar el resultado del pago');
      }

      // Verificar el estado del resultado
      if (tuuResult.status === 'success') {
        console.log('TuuPaymentsService: Pago exitoso');
        console.log('TuuPaymentsService: Transaction ID:', tuuResult.transactionId);
        console.log('TuuPaymentsService: Authorization Code:', tuuResult.authorizationCode);
        this.resetPaymentState();
        return tuuResult;
      } else if (tuuResult.status === 'cancelled') {
        // Pago cancelado por el usuario
        const errorMessage = tuuResult.errorMessage || tuuResult.message || 'El pago fue cancelado por el usuario';
        console.warn('TuuPaymentsService: Pago cancelado:', errorMessage);
        this.resetPaymentState();
        throw new Error(errorMessage);
      } else {
        // Pago fallido
        const errorMessage = tuuResult.errorMessage || tuuResult.message || 'Error desconocido en el pago';
        console.error('TuuPaymentsService: Pago fallido:', errorMessage);
        this.resetPaymentState();
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      this.resetPaymentState();
      
      console.error('TuuPaymentsService: Error en pago TUU:', error);
      console.error('TuuPaymentsService: Código de error:', error?.code);
      console.error('TuuPaymentsService: Mensaje de error:', error?.message);

      // Manejar errores específicos según la documentación
      if (error?.code === 'APP_NOT_INSTALLED') {
        throw new Error('La aplicación TUU Negocio no está instalada');
      } else if (error?.code === 'USER_CANCELLED') {
        throw new Error('El pago fue cancelado por el usuario');
      } else if (error?.code === 'PAYMENT_CLEARED') {
        // Pago anterior fue cancelado o limpiado
        throw new Error('El pago anterior fue cancelado o limpiado. Por favor intenta nuevamente después de limpiar el pago pendiente en la app TUU.');
      } else if (error?.code === 'PAYMENT_ERROR') {
        throw new Error(error.message || 'Error en el procesamiento del pago');
      } else if (error?.code === 'PAYMENT_IN_PROGRESS') {
        throw new Error('Ya hay un pago en curso en la aplicación TUU. Por favor cierra y vuelve a abrir la aplicación TUU Negocio, luego intenta nuevamente.');
      }

      // Si el error ya tiene un mensaje descriptivo, lanzarlo tal cual
      if (error?.message) {
        throw error;
      }

      throw new Error('Error desconocido al procesar el pago');
    }
  }

}

// Crear instancia del servicio
export const tuuPaymentsService = new TuuPaymentsService();

// Inicializar automáticamente al importar el módulo
tuuPaymentsService.initialize();
