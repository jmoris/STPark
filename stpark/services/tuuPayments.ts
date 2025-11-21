import { NativeModules } from 'react-native';

const { TuuPayments } = NativeModules;

export interface TuuPaymentData {
  amount: number;
  tip?: number;
  cashback?: number;
  method: number;
  installmentsQuantity?: number;
  printVoucherOnApp?: boolean;
  dteType?: number;
  extraData?: {
    taxIdnValidation?: string;
    exemptAmount?: number;
    netAmount?: number;
    sourceName?: string;
    sourceVersion?: string;
    customFields?: Array<{
      name: string;
      value: string;
      print?: boolean;
    }>;
  };
}

export interface TuuPaymentResult {
  transactionStatus?: string;
  sequenceNumber?: string;
  [key: string]: any;
}

class TuuPaymentsService {
  /**
   * Verifica si el módulo TuuPayments está disponible
   */
  isAvailable(): boolean {
    return !!TuuPayments;
  }

  /**
   * Inicia un pago usando TUU Payments
   * @param paymentData - Datos del pago a procesar
   * @returns Promise con el resultado del pago
   */
  async startPayment(paymentData: TuuPaymentData): Promise<TuuPaymentResult | null> {
    try {
      if (!TuuPayments) {
        throw new Error('Módulo TuuPayments no está disponible. Asegúrate de que el bridge nativo esté correctamente configurado.');
      }

      // Validar que el monto sea válido
      if (!paymentData.amount || paymentData.amount <= 0) {
        throw new Error('El monto debe ser mayor a 0');
      }

      // Según la documentación de TUU, el amount debe ser un entero > 0
      // Convertir el monto a entero (redondeando hacia arriba si es necesario)
      const amountAsInteger = Math.round(paymentData.amount);
      
      // Crear una copia del objeto con el monto convertido a entero
      // Asegurar que installmentsQuantity esté presente (0 si no se especifica)
      const paymentDataForTuu = {
        ...paymentData,
        amount: amountAsInteger,
        installmentsQuantity: paymentData.installmentsQuantity !== undefined ? paymentData.installmentsQuantity : 1,
      };

      const json = JSON.stringify(paymentDataForTuu);
      
      console.log('TuuPaymentsService: === INICIANDO PAGO TUU ===');
      console.log('TuuPaymentsService: Datos de pago originales:', paymentData);
      console.log('TuuPaymentsService: Monto original:', paymentData.amount);
      console.log('TuuPaymentsService: Monto convertido a entero:', amountAsInteger);
      console.log('TuuPaymentsService: JSON que se enviará a TUU:');
      console.log(json);
      console.log('TuuPaymentsService: Documentación: https://developers.tuu.cl/docs/integraci%C3%B3n-de-aplicaciones-de-pago-inter-app-new');
      
      const resultJson = await TuuPayments.startPayment(json);

      if (!resultJson) {
        return null;
      }

      const result = JSON.parse(resultJson) as TuuPaymentResult;
      console.log('Resultado TUU:', result);
      
      // Verificar si el resultado contiene un error
      if (result.errorCode || result.errorMessage || result.error) {
        const errorCode = result.errorCode || 'UNKNOWN_ERROR';
        const errorMessage = result.errorMessage || result.error || 'Error desconocido';
        console.error('Error en resultado TUU:', errorCode, errorMessage);
        throw new Error(`error ${errorCode} : ${errorMessage}`);
      }
      
      return result;
    } catch (error: any) {
      console.error('Error en pago TUU:', error);
      
      // Si el error ya tiene un mensaje descriptivo, lanzarlo tal cual
      if (error?.message && error.message.includes('error')) {
        throw error;
      }
      
      // Manejar errores específicos del módulo nativo
      if (error?.code === 'APP_NOT_FOUND') {
        throw new Error('La aplicación TUU Negocio no está instalada en el dispositivo');
      } else if (error?.code === 'TUU_ERROR') {
        // Error de TUU con código y mensaje - usar el mensaje tal cual
        throw new Error(error.message || 'Error al procesar el pago con TUU');
      } else if (error?.code === 'PAYMENT_CANCELLED') {
        // Si el mensaje ya contiene información del error, usarlo; si no, mensaje genérico
        const message = error.message && error.message.includes('error') 
          ? error.message 
          : 'El pago fue cancelado por el usuario';
        throw new Error(message);
      } else if (error?.code === 'PAYMENT_IN_PROGRESS') {
        throw new Error('Ya hay un pago en curso');
      } else if (error?.code === 'NO_ACTIVITY') {
        throw new Error('No hay una actividad activa para procesar el pago');
      }
      
      throw error;
    }
  }

  /**
   * Función de conveniencia para realizar un pago con configuración básica
   * @param amount - Monto a pagar
   * @param method - Método de pago (2 = tarjeta, otros valores según documentación)
   * @param options - Opciones adicionales del pago
   * @returns Promise con el resultado del pago
   */
  async pay(
    amount: number,
    method: number = 1,
    options?: {
      tip?: number;
      cashback?: number;
      installmentsQuantity?: number;
      printVoucherOnApp?: boolean;
      dteType?: number;
      taxIdnValidation?: string;
      exemptAmount?: number;
      netAmount?: number;
      sourceName?: string;
      sourceVersion?: string;
      customFields?: Array<{ name: string; value: string; print?: boolean }>;
    }
  ): Promise<TuuPaymentResult | null> {
    const paymentData: TuuPaymentData = {
      amount,
      tip: options?.tip || 0,
      cashback: options?.cashback || 0,
      method,
      installmentsQuantity: options?.installmentsQuantity || 1,
      printVoucherOnApp: options?.printVoucherOnApp || true,
      dteType: options?.dteType || 48,
      extraData: {
        taxIdnValidation: options?.taxIdnValidation,
        exemptAmount: options?.exemptAmount,
        netAmount: options?.netAmount,
        sourceName: options?.sourceName || 'STPark',
        sourceVersion: options?.sourceVersion || '1.0.0',
        customFields: options?.customFields,
      },
    };

    return this.startPayment(paymentData);
  }
}

export const tuuPaymentsService = new TuuPaymentsService();

