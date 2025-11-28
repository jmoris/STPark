import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { apiService } from '@/services/api';
import { ticketPrinterService, CheckoutTicketData } from '@/services/ticketPrinter';
import { getCurrentDateInSantiago } from '@/utils/dateUtils';
import { tuuPaymentsService } from '@/services/tuuPayments';
import { systemConfigService } from '@/services/systemConfig';

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  data: any; // Puede ser session o debt
  onSuccess: (result?: any) => void;
  type: 'checkout' | 'debt';
  operator?: any; // Para obtener el nombre del operador
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  onClose,
  data,
  onSuccess,
  type,
  operator
}) => {
  const [showPaymentMethod, setShowPaymentMethod] = useState(false);
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [showApprovalCodeModal, setShowApprovalCodeModal] = useState(false);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [paymentSummary, setPaymentSummary] = useState<any>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'CASH' | 'CARD' | null>(null);
  const [amountPaid, setAmountPaid] = useState('');
  const [approvalCode, setApprovalCode] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [estimatedAmount, setEstimatedAmount] = useState<number | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [useTuuPosPayment, setUseTuuPosPayment] = useState<boolean>(false); // Cargado desde configuración del tenant
  const [quoteBreakdown, setQuoteBreakdown] = useState<any[] | null>(null); // Breakdown de la cotización para obtener monto mínimo
  const tuuPaymentProcessedRef = React.useRef(false);

  // Cargar configuración de POS TUU al montar el componente
  useEffect(() => {
    const loadTuuConfig = async () => {
      try {
        const config = await systemConfigService.getConfig();
        setUseTuuPosPayment(config.pos_tuu || false);
        console.log('PaymentModal: Configuración POS TUU cargada:', config.pos_tuu);
      } catch (error) {
        console.error('PaymentModal: Error cargando configuración POS TUU:', error);
        setUseTuuPosPayment(false); // Por defecto desactivado si hay error
      }
    };
    loadTuuConfig();
  }, []);

  // Resetear estado cuando se cierra el modal
  useEffect(() => {
    if (!visible) {
      setShowPaymentMethod(false);
      setShowAmountModal(false);
      setShowApprovalCodeModal(false);
      setShowChangeModal(false);
      setSelectedPaymentMethod(null);
      setAmountPaid('');
      setApprovalCode('');
      setPaymentSummary(null);
      setEstimatedAmount(null);
      setQuoteBreakdown(null);
      tuuPaymentProcessedRef.current = false;
      console.log('PaymentModal: Modal cerrado, reseteando estado');
    } else if (data) {
      console.log('PaymentModal: Modal abierto, reseteando tuuPaymentProcessed');
      // Resetear el ref cuando se abre el modal con nuevos datos
      tuuPaymentProcessedRef.current = false;
      // Obtener cotización cuando se abre el modal
      getEstimatedQuote();
      
      // Siempre mostrar el modal de método de pago primero
      // El usuario seleccionará el método y luego se procesará con TUU si corresponde
      setShowPaymentMethod(true);
    }
  }, [visible, data]);

  // Función para obtener cotización estimada
  const getEstimatedQuote = async () => {
    if (!data) {
      console.log('PaymentModal: No hay data para obtener cotización');
      return;
    }
    
    console.log('PaymentModal: Obteniendo cotización para:', type, 'ID:', data.id);
    setLoadingQuote(true);
    try {
      let response;
      if (type === 'checkout') {
        // Para checkout, obtener cotización de la sesión
        console.log('PaymentModal: Llamando a getSessionQuote para sesión:', data.id);
        response = await apiService.getSessionQuote(data.id);
        console.log('PaymentModal: Respuesta de cotización:', response);
      } else {
        // Para deudas, usar el monto de la deuda directamente
        if (data.debts && data.debts.length > 0) {
          // Múltiples deudas - sumar el total
          const total = data.debts.reduce((sum: number, debt: any) => sum + parseFloat(debt.principal_amount), 0);
          setEstimatedAmount(total);
        } else {
          // Una sola deuda
          setEstimatedAmount(parseFloat(data.principal_amount));
        }
        setLoadingQuote(false);
        return;
      }
      
      if (response.success && response.data) {
        const amount = response.data.net_amount || response.data.gross_amount || 0;
        console.log('PaymentModal: Monto obtenido:', amount);
        setEstimatedAmount(amount);
        // Guardar breakdown para obtener monto mínimo
        if (response.data.breakdown) {
          setQuoteBreakdown(response.data.breakdown);
        }
        // NO procesar automáticamente con TUU aquí
        // El pago con TUU se iniciará solo cuando el usuario seleccione "Tarjeta"
      } else {
        console.log('PaymentModal: Error en respuesta de cotización:', response);
      }
    } catch (error) {
      console.error('PaymentModal: Error obteniendo cotización:', error);
    } finally {
      setLoadingQuote(false);
    }
  };

  // Función para manejar método de pago
  const handlePaymentMethod = (method: 'CASH' | 'CARD') => {
    setSelectedPaymentMethod(method);
    setShowPaymentMethod(false);
    
    if (method === 'CASH') {
      // Para efectivo, usar el flujo normal con modal de monto
      setShowAmountModal(true);
    } else if (method === 'CARD') {
      // Para tarjeta, verificar si debemos usar TUU o el flujo normal
      if (useTuuPosPayment && (type === 'checkout' || type === 'debt') && estimatedAmount && estimatedAmount > 0) {
        // Usar TUU para procesar el pago con tarjeta (tanto para checkout como para deudas)
        console.log('PaymentModal: Iniciando pago con TUU para tarjeta, monto:', estimatedAmount, 'tipo:', type);
        processPaymentWithTuu(estimatedAmount);
      } else {
        // Usar el flujo normal con código de autorización
        setShowApprovalCodeModal(true);
      }
    }
  };

  // Función para procesar pago con TUU POS
  const processPaymentWithTuu = async (amountOverride?: number) => {
    // Usar el amount pasado como parámetro o el del estado
    const paymentAmount = amountOverride || estimatedAmount;
    
    console.log('PaymentModal: processPaymentWithTuu llamado');
    console.log('PaymentModal: data:', data ? 'existe' : 'no existe');
    console.log('PaymentModal: paymentAmount:', paymentAmount);
    console.log('PaymentModal: estimatedAmount (estado):', estimatedAmount);
    console.log('PaymentModal: loadingQuote:', loadingQuote);
    
    if (!data || !paymentAmount) {
      console.log('PaymentModal: Error - No hay datos suficientes para procesar el pago');
      Alert.alert('Error', 'No hay datos suficientes para procesar el pago');
      return;
    }

    // Esperar a que se obtenga la cotización
    if (loadingQuote) {
      console.log('PaymentModal: Esperando cotización...');
      return;
    }

    console.log('PaymentModal: Iniciando procesamiento de pago con TUU');
    setProcessingPayment(true);
    try {
      // Verificar que el servicio TUU esté disponible
      const isAvailable = tuuPaymentsService.isAvailable();
      console.log('PaymentModal: TUU disponible:', isAvailable);
      
      if (!isAvailable) {
        console.log('PaymentModal: TUU no está disponible');
        Alert.alert(
          'Error',
          'El servicio de pagos TUU no está disponible. Por favor, usa el método de pago manual.',
          [
            {
              text: 'OK',
              onPress: () => {
                setShowPaymentMethod(true);
                setProcessingPayment(false);
              }
            }
          ]
        );
        return;
      }

      // Preparar datos del pago para TUU
      // Construir el objeto de forma completamente limpia usando solo valores primitivos
      // para evitar referencias problemáticas que causan el error "Map already consumed"
      const plateValue = data?.plate || (data?.debts && data.debts[0]?.plate) || 'N/A';
      const tipoValue = type === 'debt' ? 'deuda' : 'checkout';
      
      // Construir el objeto paso a paso usando solo valores primitivos
      const tuuPaymentData: any = {};
      tuuPaymentData.amount = Number(paymentAmount);
      tuuPaymentData.tip = 0; // 0 = solicitar en app
      tuuPaymentData.cashback = 0; // 0 = solicitar en app
      tuuPaymentData.method = 0; // 0 = Solicitar en APP (puede funcionar mejor en desarrollo que method: 2)
      tuuPaymentData.installmentsQuantity = 0; // Solo aplica a crédito
      tuuPaymentData.printVoucherOnApp = false;
      tuuPaymentData.dteType = 48;
      
      // Construir extraData de forma completamente nueva
      tuuPaymentData.extraData = {};
      tuuPaymentData.extraData.netAmount = Number(paymentAmount);
      tuuPaymentData.extraData.sourceName = 'STPark';
      tuuPaymentData.extraData.sourceVersion = '1.0.0';
      tuuPaymentData.extraData.customFields = [
        { name: 'patente', value: String(plateValue), print: true },
        { name: 'tipo', value: String(tipoValue), print: true },
      ];

      console.log('PaymentModal: Datos de pago TUU:', JSON.stringify(tuuPaymentData));
      
      // Iniciar pago con TUU directamente (sin reintentos)
      // Por el momento siempre usar modo desarrollo
      console.log('PaymentModal: Llamando a tuuPaymentsService.startPayment (modo DEV)');
      const tuuResult = await tuuPaymentsService.startPayment(
        tuuPaymentData, 
        true  // true = DEV, false = PROD
      );
      console.log('PaymentModal: Resultado de TUU:', tuuResult);

      if (!tuuResult) {
        Alert.alert('Error', 'No se recibió respuesta del procesador de pagos');
        setProcessingPayment(false);
        return;
      }

      // Verificar que el pago fue exitoso
      if (tuuResult.status !== 'success') {
        const errorMsg = tuuResult.errorMessage || tuuResult.message || 'El pago no fue exitoso';
        Alert.alert('Error', errorMsg);
        setProcessingPayment(false);
        return;
      }

      // Extraer información del resultado de TUU
      // El resultado ahora tiene la estructura: { status, transactionId, authorizationCode, ... }
      const approvalCode = tuuResult.authorizationCode || tuuResult.authCode;
      
      // Extraer método de transacción (puede venir como string o número)
      let transactionMethod: string | undefined;
      if (tuuResult.transactionMethod) {
        transactionMethod = tuuResult.transactionMethod;
      } else if (tuuResult.method !== undefined) {
        // Convertir número a string según documentación: 0=Crédito, 2=Débito
        const methodMap: { [key: number]: string } = {
          0: 'CREDITO',
          2: 'DEBITO',
        };
        transactionMethod = methodMap[tuuResult.method] || `METODO_${tuuResult.method}`;
      }
      
      // Extraer últimos 4 dígitos de la tarjeta
      const last4 = tuuResult.last4 || 
                   tuuResult.cardLast4 || 
                   tuuResult.lastFourDigits ||
                   undefined;

      // Extraer número de secuencia de la transacción
      const sequenceNumber = tuuResult.sequenceNumber || undefined;

      console.log('PaymentModal: Datos extraídos de TUU:', {
        approvalCode,
        transactionMethod,
        last4,
        sequenceNumber,
        fullResult: tuuResult
      });

      // Validar que el operador esté disponible
      if (!operator?.id) {
        Alert.alert('Error', 'No se pudo identificar el operador. Por favor, inicia sesión nuevamente.');
        setProcessingPayment(false);
        return;
      }

      // Procesar el pago según el tipo (checkout o deuda)
      let response: any;
      
      if (type === 'checkout') {
        // Procesar checkout de sesión
        const endedAt = getCurrentDateInSantiago();
        const paymentData: any = {
          payment_method: 'CARD',
          amount: paymentAmount,
          ended_at: endedAt,
          approval_code: approvalCode || undefined,
          operator_id: operator.id, // Operador que hace el checkout (REQUERIDO)
        };

        response = await apiService.checkoutSession(data.id, paymentData);
      } else {
        // Procesar pago de deuda
        let firstDebtWithRelations = null;
        
        if (data.debts && data.debts.length > 0) {
          // Si hay múltiples deudas, procesarlas una por una
          for (const debt of data.debts) {
            const paymentData = {
              amount: parseFloat(debt.principal_amount),
              method: 'CARD' as 'CASH' | 'CARD' | 'TRANSFER',
              cashier_operator_id: operator?.id || 1,
              approval_code: approvalCode || undefined,
            };
            
            const debtResponse = await apiService.payDebt(debt.id, paymentData);
            if (!debtResponse.success) {
              throw new Error(`Error al liquidar deuda ID ${debt.id}`);
            }
            
            // Guardar la primera respuesta que tiene las relaciones
            if (!firstDebtWithRelations) {
              firstDebtWithRelations = debtResponse.data;
            }
          }
          
          // Crear respuesta agregada usando la primera deuda para las relaciones
          response = {
            success: true,
            data: {
              ...firstDebtWithRelations,
              plate: data.plate,
              debts_paid: data.debts.length,
              total_amount: paymentAmount,
            },
          };
        } else {
          // Una sola deuda
          const paymentData = {
            amount: paymentAmount || 0,
            method: 'CARD' as 'CASH' | 'CARD' | 'TRANSFER',
            cashier_operator_id: operator?.id || 1,
            approval_code: approvalCode || undefined,
          };

          response = await apiService.payDebt(data.id, paymentData);
        }
      }

      if (response.success) {
        setPaymentSummary(response.data);

        // Imprimir ticket
        try {
          if (type === 'checkout') {
            // Ticket para checkout de sesión
            const endTime = response.data.session?.ended_at || getCurrentDateInSantiago();
            const startTime = data.started_at;
            const isFullDay = data.is_full_day || response.data.session?.is_full_day || false;
            const duration = isFullDay ? 'Día completo' : calculateElapsedTime(startTime, endTime);

            const ticketData: CheckoutTicketData = {
              type: 'CHECKOUT',
              plate: data.plate,
              sector: data.sector?.name,
              street: data.street?.name,
              sectorIsPrivate: data.sector?.is_private || false,
              streetAddress: data.street?.full_address || data.street?.name,
              startTime: startTime,
              endTime: endTime,
              duration: duration,
              amount: paymentAmount || 0,
              paymentMethod: 'CARD',
              operatorName: operator?.name,
              approvalCode: approvalCode,
              // Datos adicionales de TUU para el ticket
              authCode: approvalCode || undefined,
              transactionMethod: transactionMethod,
              last4: last4,
              sequenceNumber: sequenceNumber,
              minAmount: getMinAmountFromBreakdown(),
              isFullDay: isFullDay,
            };

            const printed = await ticketPrinterService.printCheckoutTicket(ticketData);
            if (printed) {
              console.log('Ticket de checkout impreso exitosamente');
            }
          } else {
            // Ticket para liquidación de deuda
            const debt = data.debts && data.debts.length > 0 ? data.debts[0] : data;
            const settledDebt = response.data;
            const parkingSession = settledDebt.parking_session || debt.parking_session;
            
            if (parkingSession && parkingSession.started_at) {
              const startTime = parkingSession.started_at;
              const endTime = debt.created_at || new Date().toISOString();
              const isFullDay = parkingSession?.is_full_day || false;
              const duration = isFullDay ? 'Día completo' : calculateElapsedTime(startTime, endTime);
              
              const ticketData: CheckoutTicketData = {
                type: 'CHECKOUT',
                plate: data.plate || (data.debts && data.debts[0]?.plate) || 'N/A',
                sector: parkingSession?.sector?.name || 'N/A',
                street: parkingSession?.street?.name || 'N/A',
                sectorIsPrivate: parkingSession?.sector?.is_private || false,
                streetAddress: parkingSession?.street?.full_address || parkingSession?.street?.name || 'N/A',
                startTime: startTime,
                endTime: endTime,
                duration: duration,
                amount: paymentAmount || 0,
                paymentMethod: 'CARD',
                operatorName: operator?.name,
                approvalCode: approvalCode,
                // Datos adicionales de TUU para el ticket
                authCode: approvalCode || undefined,
                transactionMethod: transactionMethod,
                last4: last4,
                sequenceNumber: sequenceNumber,
                minAmount: getMinAmountFromBreakdown(),
                isFullDay: isFullDay,
              };
              
              const printed = await ticketPrinterService.printCheckoutTicket(ticketData);
              if (printed) {
                console.log('Ticket de liquidación de deuda impreso exitosamente');
              }
            }
          }
        } catch (printError) {
          console.error('Error imprimiendo ticket:', printError);
        }

        showSuccessAndClose();
      } else {
        Alert.alert('Error', response.message || `Error al procesar el ${type === 'checkout' ? 'checkout' : 'pago de deuda'}`);
      }
    } catch (error: any) {
      console.error('Error procesando pago con TUU:', error);
      
      // Resetear el estado del servicio TUU si hay un error
      tuuPaymentsService.resetPaymentState();
      
      let errorMessage = 'Error al procesar el pago con TUU';
      if (error?.message) {
        errorMessage = error.message;
      }

      // Detectar errores específicos según la documentación de la librería
      const isAppNotInstalled = error?.code === 'APP_NOT_INSTALLED' || 
                                errorMessage.includes('no está instalada');
      const isUserCancelled = error?.code === 'USER_CANCELLED' || 
                              errorMessage.includes('cancelado');
      const isPaymentInProgress = error?.code === 'PAYMENT_IN_PROGRESS' || 
                                  errorMessage.includes('Ya hay un pago en curso');
      const isPaymentError = error?.code === 'PAYMENT_ERROR';
      const isMapConsumedError = errorMessage.includes('Map already consumed');

      if (isAppNotInstalled) {
        // App TUU no está instalada
        Alert.alert(
          'App No Instalada',
          'La aplicación TUU Negocio no está instalada en el dispositivo.\n\nPor favor instala la aplicación desde la tienda de aplicaciones.',
          [
            {
              text: 'Usar método manual',
              onPress: () => {
                tuuPaymentsService.resetPaymentState();
                setShowPaymentMethod(true);
                setProcessingPayment(false);
              }
            },
            {
              text: 'Cancelar',
              style: 'cancel',
              onPress: () => {
                tuuPaymentsService.resetPaymentState();
                setProcessingPayment(false);
                onClose();
              }
            }
          ]
        );
      } else if (isUserCancelled) {
        // Usuario canceló el pago
        Alert.alert(
          'Pago Cancelado',
          'El pago fue cancelado por el usuario.',
          [
            {
              text: 'Intentar nuevamente',
              onPress: () => {
                tuuPaymentsService.resetPaymentState();
                setShowPaymentMethod(true);
                setProcessingPayment(false);
              }
            },
            {
              text: 'Cancelar',
              style: 'cancel',
              onPress: () => {
                tuuPaymentsService.resetPaymentState();
                setProcessingPayment(false);
                onClose();
              }
            }
          ]
        );
      } else if (isMapConsumedError) {
        // Error específico de serialización - puede ser un problema con la librería
        Alert.alert(
          'Error de Comunicación',
          'Hubo un problema al comunicarse con el procesador de pagos. Esto puede ser un problema temporal.\n\nPor favor intenta:\n\n1. Reiniciar la aplicación\n2. Usar el método de pago manual\n3. Contactar al soporte técnico si el problema persiste',
          [
            {
              text: 'Usar método manual',
              onPress: () => {
                tuuPaymentsService.resetPaymentState();
                setShowPaymentMethod(true);
                setProcessingPayment(false);
              }
            },
            {
              text: 'Cancelar',
              style: 'cancel',
              onPress: () => {
                tuuPaymentsService.resetPaymentState();
                setProcessingPayment(false);
                onClose();
              }
            }
          ]
        );
      } else if (isPaymentInProgress) {
        // Mostrar un alert específico para este error con opciones más claras
        Alert.alert(
          'Pago en Curso',
          'Después de varios intentos, aún hay un pago pendiente en la aplicación TUU Negocio.\n\nPor favor:\n\n1. Abre la aplicación TUU Negocio\n2. Completa o cancela el pago pendiente\n3. Vuelve aquí y presiona "Reintentar"',
          [
            {
              text: 'Abrir TUU Negocio',
              onPress: async () => {
                try {
                  // Intentar abrir la aplicación TUU Negocio
                  // Package names correctos: com.haulmer.paymentapp.dev (dev) o com.haulmer.paymentapp (prod)
                  // Por el momento siempre usar modo desarrollo
                  const tuuPackage = Platform.OS === 'android' 
                    ? 'com.haulmer.paymentapp.dev' 
                    : 'tuu-negocio';
                  
                  const url = Platform.OS === 'android'
                    ? `intent://#Intent;package=${tuuPackage};scheme=tuu;end`
                    : `tuu://`;
                  
                  const canOpen = await Linking.canOpenURL(url);
                  if (canOpen) {
                    await Linking.openURL(url);
                  } else {
                    // Si no se puede abrir con el intent, intentar abrir el package directamente
                    if (Platform.OS === 'android') {
                      await Linking.openURL(`market://details?id=${tuuPackage}`);
                    } else {
                      Alert.alert('Error', 'No se pudo abrir la aplicación TUU Negocio. Por favor ábrela manualmente.');
                    }
                  }
                } catch (linkError) {
                  console.error('Error abriendo aplicación TUU:', linkError);
                  Alert.alert('Error', 'No se pudo abrir la aplicación TUU Negocio. Por favor ábrela manualmente desde el menú de aplicaciones.');
                }
                setProcessingPayment(false);
              }
            },
            {
              text: 'Reintentar',
              onPress: () => {
                tuuPaymentsService.resetPaymentState();
                // Reintentar el pago después de un breve delay
                setTimeout(() => {
                  processPaymentWithTuu(paymentAmount);
                }, 1000);
              }
            },
            {
              text: 'Usar método manual',
              onPress: () => {
                tuuPaymentsService.resetPaymentState();
                setShowPaymentMethod(true);
                setProcessingPayment(false);
              }
            },
            {
              text: 'Cancelar',
              style: 'cancel',
              onPress: () => {
                tuuPaymentsService.resetPaymentState();
                setProcessingPayment(false);
                onClose();
              }
            }
          ]
        );
      } else {
        // Para otros errores, mostrar el alert normal
        Alert.alert(
          'Error',
          errorMessage,
          [
            {
              text: 'Intentar con método manual',
              onPress: () => {
                tuuPaymentsService.resetPaymentState();
                setShowPaymentMethod(true);
                setProcessingPayment(false);
              }
            },
            {
              text: 'Cancelar',
              style: 'cancel',
              onPress: () => {
                tuuPaymentsService.resetPaymentState();
                setProcessingPayment(false);
                onClose();
              }
            }
          ]
        );
      }
    } finally {
      setProcessingPayment(false);
    }
  };

  // Función para procesar pago
  const processPayment = async () => {
    if (!data || !selectedPaymentMethod) return;
    
    setProcessingPayment(true);
    try {
      let response;
      
      if (type === 'checkout') {
        // Validar que el operador esté disponible
        if (!operator?.id) {
          Alert.alert('Error', 'No se pudo identificar el operador. Por favor, inicia sesión nuevamente.');
          setProcessingPayment(false);
          return;
        }

        // Procesar checkout de sesión
        // Obtener fecha actual en timezone America/Santiago
        const endedAt = getCurrentDateInSantiago();
        
        const paymentData: any = {
          payment_method: selectedPaymentMethod,
          amount: estimatedAmount || 0,
          ended_at: endedAt,
          operator_id: operator.id, // Operador que hace el checkout (REQUERIDO)
        };

        if (selectedPaymentMethod === 'CASH' && amountPaid) {
          paymentData.amount_paid = parseFloat(amountPaid);
        } else if (selectedPaymentMethod === 'CARD' && approvalCode) {
          paymentData.approval_code = approvalCode;
        }

        response = await apiService.checkoutSession(data.id, paymentData);
      } else {
        // Procesar pago de deuda
        let firstDebtWithRelations = null;
        
        if (data.debts && data.debts.length > 0) {
          // Si hay múltiples deudas, procesarlas una por una
          for (const debt of data.debts) {
            const paymentData = {
              amount: parseFloat(debt.principal_amount),
              method: selectedPaymentMethod,
              cashier_operator_id: operator?.id || 1,
              approval_code: approvalCode || undefined,
            };
            
            const debtResponse = await apiService.payDebt(debt.id, paymentData);
            if (!debtResponse.success) {
              throw new Error(`Error al liquidar deuda ID ${debt.id}`);
            }
            
            // Guardar la primera respuesta que tiene las relaciones
            if (!firstDebtWithRelations) {
              firstDebtWithRelations = debtResponse.data;
            }
          }
          
          // Crear respuesta agregada usando la primera deuda para las relaciones
          response = {
            success: true,
            data: {
              ...firstDebtWithRelations,
              plate: data.plate,
              debts_paid: data.debts.length,
              total_amount: estimatedAmount,
            },
          };
        } else {
          // Una sola deuda
          const paymentData = {
            amount: estimatedAmount || 0,
            method: selectedPaymentMethod,
            cashier_operator_id: operator?.id || 1,
            approval_code: approvalCode || undefined,
          };

          response = await apiService.payDebt(data.id, paymentData);
        }
      }
      
      if (response.success) {
        setPaymentSummary(response.data);
        
        // Imprimir ticket solo para checkout
        if (type === 'checkout' && response.data) {
          try {
            // Usar la fecha de finalización de la sesión si está disponible, 
            // o la fecha actual en timezone Santiago
            const endTime = response.data.session?.ended_at || getCurrentDateInSantiago();
            const startTime = data.started_at;
            const isFullDay = data.is_full_day || response.data.session?.is_full_day || false;
            const duration = isFullDay ? 'Día completo' : calculateElapsedTime(startTime, endTime);
            
            const ticketData: CheckoutTicketData = {
              type: 'CHECKOUT',
              plate: data.plate,
              sector: data.sector?.name,
              street: data.street?.name,
              sectorIsPrivate: data.sector?.is_private || false,
              streetAddress: data.street?.full_address || data.street?.name,
              startTime: startTime,
              endTime: endTime,
              duration: duration,
              amount: estimatedAmount || 0,
              paymentMethod: selectedPaymentMethod,
              operatorName: operator?.name,
              approvalCode: approvalCode,
              change: selectedPaymentMethod === 'CASH' && amountPaid ? 
                parseFloat(amountPaid) - (estimatedAmount || 0) : undefined,
              minAmount: getMinAmountFromBreakdown(),
              isFullDay: isFullDay,
            };
            
            const printed = await ticketPrinterService.printCheckoutTicket(ticketData);
            if (printed) {
              console.log('Ticket de checkout impreso exitosamente');
            }
          } catch (printError) {
            console.error('Error imprimiendo ticket:', printError);
          }
        }
        
        // Imprimir ticket de checkout para deuda
        if (type === 'debt' && response.data) {
          try {
            // Usar la primera deuda para obtener información de la sesión
            const debt = data.debts && data.debts.length > 0 ? data.debts[0] : data;
            // response.data es la deuda liquidada con sus relaciones
            const settledDebt = response.data;
            const parkingSession = settledDebt.parking_session || debt.parking_session;
            
            if (parkingSession && parkingSession.started_at) {
              const startTime = parkingSession.started_at;
              // Usar la fecha de creación de la deuda como fecha de salida, no la hora actual
              const endTime = debt.created_at || new Date().toISOString();
              const isFullDay = parkingSession?.is_full_day || false;
              const duration = isFullDay ? 'Día completo' : calculateElapsedTime(startTime, endTime);
              
              const ticketData: CheckoutTicketData = {
                type: 'CHECKOUT',
                plate: data.plate,
                sector: parkingSession?.sector?.name || 'N/A',
                street: parkingSession?.street?.name || 'N/A',
                sectorIsPrivate: parkingSession?.sector?.is_private || false,
                streetAddress: parkingSession?.street?.full_address || parkingSession?.street?.name || 'N/A',
                startTime: startTime,
                endTime: endTime,
                duration: duration,
                amount: estimatedAmount || 0,
                paymentMethod: selectedPaymentMethod,
                operatorName: operator?.name,
                approvalCode: approvalCode,
                change: selectedPaymentMethod === 'CASH' && amountPaid ? 
                  parseFloat(amountPaid) - (estimatedAmount || 0) : undefined,
                minAmount: getMinAmountFromBreakdown(), // Puede ser undefined para deudas
                isFullDay: isFullDay,
              };
              
              const printed = await ticketPrinterService.printCheckoutTicket(ticketData);
              if (printed) {
                console.log('Ticket de checkout impreso exitosamente');
              }
            }
          } catch (printError) {
            console.error('Error imprimiendo ticket:', printError);
          }
        }

        // Manejar vuelto para pagos en efectivo
        if (selectedPaymentMethod === 'CASH' && amountPaid) {
          const change = parseFloat(amountPaid) - (estimatedAmount || 0);
          if (change > 0) {
            setShowChangeModal(true);
          } else {
            showSuccessAndClose();
          }
        } else {
          showSuccessAndClose();
        }
      } else {
        Alert.alert('Error', response.message || 'Error al procesar el pago');
      }
    } catch (error) {
      console.error('Error procesando pago:', error);
      Alert.alert('Error', 'Error al procesar el pago');
    } finally {
      setProcessingPayment(false);
    }
  };

  // Función para manejar envío del monto pagado
  const handleAmountSubmit = () => {
    if (!amountPaid.trim() || !selectedPaymentMethod || !data) {
      Alert.alert('Error', 'Por favor ingresa un monto válido');
      return;
    }

    const paidAmount = parseFloat(amountPaid);
    const sessionAmount = estimatedAmount || 0;

    if (paidAmount < sessionAmount) {
      Alert.alert('Error', 'El monto pagado debe ser mayor o igual al monto de la sesión');
      return;
    }

    processPayment();
  };

  // Función para manejar envío del código de autorización
  const handleApprovalCodeSubmit = () => {
    if (!selectedPaymentMethod || !data) {
      Alert.alert('Error', 'Datos de pago no válidos');
      return;
    }

    processPayment();
  };

  // Función para mostrar éxito y cerrar modales
  const showSuccessAndClose = () => {
    const title = type === 'checkout' ? 'Checkout Exitoso' : 'Pago Exitoso';
    const message = type === 'checkout' 
      ? `Sesión finalizada correctamente para patente ${data.plate}`
      : `Deuda pagada exitosamente para patente ${data.plate}`;
    
    Alert.alert(
      title,
      `${message}${paymentSummary ? `\nTotal: $${paymentSummary.total_amount?.toLocaleString('es-CL') || estimatedAmount?.toLocaleString('es-CL') || '0'}` : ''}`,
      [
        {
          text: 'OK',
          onPress: () => {
            onSuccess(paymentSummary);
            onClose();
          }
        }
      ]
    );
  };

  // Función para calcular tiempo transcurrido
  const calculateElapsedTime = (startedAt: string, endedAt?: string) => {
    const start = new Date(startedAt);
    const end = endedAt ? new Date(endedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  // Función para obtener el monto mínimo del breakdown
  const getMinAmountFromBreakdown = (): number | undefined => {
    if (!quoteBreakdown || quoteBreakdown.length === 0) {
      return undefined;
    }
    
    // Buscar el mayor min_amount de todas las reglas aplicadas
    const minAmounts = quoteBreakdown
      .map((rule: any) => rule.min_amount)
      .filter((min: any) => min !== null && min !== undefined && min > 0);
    
    if (minAmounts.length === 0) {
      return undefined;
    }
    
    // Retornar el mayor monto mínimo encontrado
    return Math.max(...minAmounts);
  };

  if (!data) return null;

  // Función para obtener el título del modal según el tipo
  const getModalTitle = () => {
    return type === 'checkout' ? 'Procesar Checkout' : 'Pagar Deuda';
  };

  // Función para obtener información específica según el tipo
  const getDataInfo = () => {
    
    if (type === 'checkout') {
      // Si es día completo, mostrar "Día completo", sino calcular el tiempo transcurrido
      const isFullDay = data.is_full_day || false;
      const timeDisplay = isFullDay ? 'Día completo' : calculateElapsedTime(data.started_at);
      
      return {
        title: 'Resumen de Sesión',
        plate: data.plate,
        location: `${data.sector?.name || 'N/A'} - ${data.street?.name || 'N/A'}`,
        time: timeDisplay,
        amount: loadingQuote ? 'Calculando...' : 
                estimatedAmount ? `$${estimatedAmount.toLocaleString('es-CL')}` : 
                '$0'
      };
    } else {
      // Para deudas, obtener la información de la primera deuda
      const firstDebt = data.debts && data.debts.length > 0 ? data.debts[0] : data;
      const parkingSession = firstDebt.parking_session;
      
      // Construir ubicación desde parking_session
      let sectorName = 'N/A';
      let streetName = '';
      
      if (parkingSession) {
        sectorName = parkingSession.sector?.name || 'N/A';
        streetName = parkingSession.street?.name || '';
      }
      
      const location = streetName ? `${sectorName} - ${streetName}` : sectorName;
      
      // Obtener fecha de creación de la deuda
      let displayTime = 'N/A';
      try {
        if (firstDebt.created_at) {
          displayTime = new Date(firstDebt.created_at).toLocaleDateString('es-CL');
        }
      } catch (e) {
        console.error('Error formateando fecha:', e);
      }
      
      return {
        title: 'Resumen de Deuda',
        plate: data.plate,
        location: location,
        time: displayTime,
        amount: estimatedAmount ? `$${estimatedAmount.toLocaleString('es-CL')}` : '$0'
      };
    }
  };

  const dataInfo = getDataInfo();

  return (
    <>
      {/* Modal Principal - Método de Pago */}
      <Modal
        visible={visible && showPaymentMethod}
        transparent={true}
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{getModalTitle()}</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={onClose}
              >
                <IconSymbol size={24} name="xmark.circle.fill" color="#6c757d" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <View style={styles.sessionSummary}>
                <Text style={styles.sessionSummaryTitle}>{dataInfo.title}</Text>
                <View style={styles.sessionSummaryRow}>
                  <Text style={styles.sessionSummaryLabel}>Patente:</Text>
                  <Text style={styles.sessionSummaryValue}>{dataInfo.plate}</Text>
                </View>
                <View style={styles.sessionSummaryRow}>
                  <Text style={styles.sessionSummaryLabel}>Monto:</Text>
                  <Text style={styles.sessionSummaryValue}>{dataInfo.amount}</Text>
                </View>
                <View style={styles.sessionSummaryRow}>
                  <Text style={styles.sessionSummaryLabel}>Ubicación:</Text>
                  <Text style={styles.sessionSummaryValue}>{dataInfo.location}</Text>
                </View>
                {type === 'checkout' && data?.operator?.name && (
                  <View style={styles.sessionSummaryRow}>
                    <Text style={styles.sessionSummaryLabel}>Operador que recibió:</Text>
                    <Text style={styles.sessionSummaryValue}>{data.operator.name}</Text>
                  </View>
                )}
                <View style={styles.sessionSummaryRow}>
                  <Text style={styles.sessionSummaryLabel}>
                    {type === 'checkout' ? 'Tiempo:' : 'Fecha:'}
                  </Text>
                  <Text style={styles.sessionSummaryValue}>{dataInfo.time}</Text>
                </View>
              </View>

              <Text style={styles.paymentMethodTitle}>Selecciona el método de pago:</Text>
              
              <View style={styles.paymentMethodsContainer}>
                <TouchableOpacity
                  style={styles.paymentMethodButton}
                  onPress={() => handlePaymentMethod('CASH')}
                  disabled={processingPayment}
                >
                  <IconSymbol size={24} name="banknote.fill" color="#28a745" />
                  <Text style={styles.paymentMethodText}>Efectivo</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.paymentMethodButton}
                  onPress={() => handlePaymentMethod('CARD')}
                  disabled={processingPayment}
                >
                  <IconSymbol size={24} name="creditcard.fill" color="#007bff" />
                  <Text style={styles.paymentMethodText}>Tarjeta</Text>
                </TouchableOpacity>
              </View>

              {processingPayment && (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Procesando pago...</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Monto Pagado */}
      <Modal
        visible={showAmountModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowAmountModal(false);
          setAmountPaid('');
          setSelectedPaymentMethod(null);
        }}
      >
        <View style={styles.amountModalOverlay}>
          <View style={styles.amountModalContainer}>
            <View style={styles.amountModalHeader}>
              <Text style={styles.amountModalTitle}>Monto Pagado</Text>
              <TouchableOpacity
                style={styles.amountModalCloseButton}
                onPress={() => {
                  setShowAmountModal(false);
                  setAmountPaid('');
                  setSelectedPaymentMethod(null);
                }}
              >
                <IconSymbol size={24} name="xmark.circle.fill" color="#6c757d" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.amountModalContent}>
              <Text style={styles.amountModalLabel}>
                {type === 'checkout' ? 'Monto a pagar:' : 'Monto de la deuda:'} ${estimatedAmount?.toLocaleString('es-CL') || '0'}
              </Text>
              
              <TextInput
                style={styles.amountInput}
                placeholder={type === 'checkout' ? "Ingresa el monto recibido" : "Ingresa el monto pagado"}
                value={amountPaid}
                onChangeText={setAmountPaid}
                keyboardType="numeric"
                placeholderTextColor="#6c757d"
              />
              
              <TouchableOpacity
                style={styles.amountConfirmButton}
                onPress={handleAmountSubmit}
                disabled={!amountPaid || processingPayment}
              >
                <Text style={styles.amountConfirmButtonText}>
                  {processingPayment ? 'Procesando...' : 'Confirmar Pago'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para código de aprobación */}
      <Modal
        visible={showApprovalCodeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowApprovalCodeModal(false);
          setApprovalCode('');
          setSelectedPaymentMethod(null);
        }}
      >
        <View style={styles.amountModalOverlay}>
          <View style={styles.amountModalContainer}>
            <View style={styles.amountModalHeader}>
              <Text style={styles.amountModalTitle}>Código de Aprobación</Text>
              <TouchableOpacity
                style={styles.amountModalCloseButton}
                onPress={() => {
                  setShowApprovalCodeModal(false);
                  setApprovalCode('');
                  setSelectedPaymentMethod(null);
                }}
              >
                <IconSymbol size={24} name="xmark.circle.fill" color="#6c757d" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.amountModalContent}>
              <Text style={styles.amountModalLabel}>
                {type === 'checkout' ? 'Monto a pagar:' : 'Monto de la deuda:'} ${estimatedAmount?.toLocaleString('es-CL') || '0'}
              </Text>
              
              <TextInput
                style={styles.amountInput}
                placeholder="Ej: 123456"
                value={approvalCode}
                onChangeText={setApprovalCode}
                keyboardType="numeric"
                returnKeyType="done"
                onSubmitEditing={handleApprovalCodeSubmit}
                autoFocus={true}
              />
              <Text style={styles.amountInputHint}>
                (Opcional - puede dejarse vacío)
              </Text>
              
              <TouchableOpacity
                style={styles.amountConfirmButton}
                onPress={handleApprovalCodeSubmit}
                disabled={processingPayment}
              >
                <Text style={styles.amountConfirmButtonText}>
                  {processingPayment ? 'Procesando...' : 'Confirmar Pago'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de carga para pago con TUU */}
      <Modal
        visible={processingPayment && useTuuPosPayment && (type === 'checkout' || type === 'debt') && !showPaymentMethod}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Procesando pago con TUU...</Text>
                <Text style={styles.loadingSubtext}>Por favor, completa el pago en la aplicación TUU</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Vuelto */}
      <Modal
        visible={showChangeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowChangeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Vuelto</Text>
            </View>
            
            <View style={styles.modalContent}>
              <Text style={styles.changeAmount}>
                {type === 'checkout' ? 'Vuelto:' : 'Cambio:'} ${((parseFloat(amountPaid) || 0) - (estimatedAmount || 0)).toLocaleString('es-CL')}
              </Text>
              
              <TouchableOpacity
                style={styles.changeConfirmButton}
                onPress={showSuccessAndClose}
              >
                <Text style={styles.changeConfirmButtonText}>Finalizar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#043476',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  sessionSummary: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  sessionSummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#043476',
    marginBottom: 12,
    textAlign: 'center',
  },
  sessionSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sessionSummaryLabel: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  sessionSummaryValue: {
    fontSize: 14,
    color: '#043476',
    fontWeight: '600',
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#043476',
    marginBottom: 16,
    textAlign: 'center',
  },
  paymentMethodsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  paymentMethodButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e9ecef',
    minWidth: 120,
  },
  paymentMethodText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#043476',
    marginTop: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 18,
    color: '#043476',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
  amountModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '90%',
    maxWidth: 400,
  },
  amountModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  amountModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#043476',
  },
  amountModalCloseButton: {
    padding: 4,
  },
  amountModalContent: {
    padding: 20,
  },
  amountModalLabel: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 16,
    textAlign: 'center',
  },
  amountInput: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  amountConfirmButton: {
    backgroundColor: '#28a745',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  amountConfirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  changeAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#28a745',
    textAlign: 'center',
    marginBottom: 20,
  },
  changeConfirmButton: {
    backgroundColor: '#043476',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  changeConfirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  amountInputHint: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 8,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

