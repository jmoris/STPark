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
import { CONFIG } from '@/config/app';
import { ticketPrinterService, CarWashTicketData } from '@/services/ticketPrinter';
import { tuuPaymentsService, isDevelopmentMode } from '@/services/tuuPayments';
import { systemConfigService } from '@/services/systemConfig';

interface CarWashPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  carWash: any; // Car wash data (puede ser nuevo o pendiente)
  onSuccess: (result?: any) => void;
  operator?: any; // Para obtener el nombre del operador
}

export const CarWashPaymentModal: React.FC<CarWashPaymentModalProps> = ({
  visible,
  onClose,
  carWash,
  onSuccess,
  operator
}) => {
  const [showPaymentMethod, setShowPaymentMethod] = useState(false);
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [showApprovalCodeModal, setShowApprovalCodeModal] = useState(false);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [showPrintTicketModal, setShowPrintTicketModal] = useState(false);
  const [pendingTicketData, setPendingTicketData] = useState<CarWashTicketData | null>(null);
  const [printTicketCountdown, setPrintTicketCountdown] = useState(10);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'CASH' | 'CARD' | null>(null);
  const [amountPaid, setAmountPaid] = useState('');
  const [approvalCode, setApprovalCode] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [useTuuPosPayment, setUseTuuPosPayment] = useState<boolean>(false);
  const tuuPaymentProcessedRef = React.useRef(false);

  // Cargar configuración de POS TUU al montar el componente
  useEffect(() => {
    const loadTuuConfig = async () => {
      try {
        const config = await systemConfigService.getConfig();
        setUseTuuPosPayment(config.pos_tuu || false);
        console.log('CarWashPaymentModal: Configuración POS TUU cargada:', config.pos_tuu);
      } catch (error) {
        console.error('CarWashPaymentModal: Error cargando configuración POS TUU:', error);
        setUseTuuPosPayment(false);
      }
    };
    loadTuuConfig();
  }, []);

  // Contador regresivo para imprimir ticket
  useEffect(() => {
    if (!showPrintTicketModal) {
      return;
    }

    if (printTicketCountdown <= 0) {
      // Cuando llega a 0, imprimir automáticamente
      if (pendingTicketData) {
        setShowPrintTicketModal(false);
        setPrintTicketCountdown(10);
        (async () => {
          try {
            const printed = await ticketPrinterService.printCarWashTicket(pendingTicketData);
            if (printed) {
              console.log('Ticket de lavado impreso exitosamente');
            }
          } catch (printError) {
            console.error('Error imprimiendo ticket:', printError);
          }
          setPendingTicketData(null);
          showSuccessAndClose();
        })();
      }
      return;
    }
    
    const timer = setTimeout(() => {
      setPrintTicketCountdown(printTicketCountdown - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [showPrintTicketModal, printTicketCountdown, pendingTicketData]);

  // Resetear estado cuando se cierra el modal
  useEffect(() => {
    if (!visible) {
      setShowPaymentMethod(false);
      setShowAmountModal(false);
      setShowApprovalCodeModal(false);
      setShowChangeModal(false);
      setShowPrintTicketModal(false);
      setPendingTicketData(null);
      setPrintTicketCountdown(10);
      setSelectedPaymentMethod(null);
      setAmountPaid('');
      setApprovalCode('');
      tuuPaymentProcessedRef.current = false;
      console.log('CarWashPaymentModal: Modal cerrado, reseteando estado');
    } else if (carWash) {
      console.log('CarWashPaymentModal: Modal abierto, reseteando tuuPaymentProcessed');
      tuuPaymentProcessedRef.current = false;
      // Siempre mostrar el modal de método de pago primero
      setShowPaymentMethod(true);
    }
  }, [visible, carWash]);

  // Función para manejar método de pago
  const handlePaymentMethod = (method: 'CASH' | 'CARD') => {
    setSelectedPaymentMethod(method);
    setShowPaymentMethod(false);
    
    if (method === 'CASH') {
      // Para efectivo, usar el flujo normal con modal de monto
      setShowAmountModal(true);
    } else if (method === 'CARD') {
      // Para tarjeta, verificar si debemos usar TUU o el flujo normal
      const washAmount = parseFloat(carWash?.amount || carWash?.car_wash_type?.price || '0');
      if (useTuuPosPayment && washAmount > 0) {
        // Usar TUU para procesar el pago con tarjeta
        console.log('CarWashPaymentModal: Iniciando pago con TUU para tarjeta, monto:', washAmount);
        processPaymentWithTuu(washAmount);
      } else {
        // Usar el flujo normal con código de autorización
        setShowApprovalCodeModal(true);
      }
    }
  };

  // Función para procesar pago con TUU POS
  const processPaymentWithTuu = async (paymentAmount: number) => {
    if (!carWash || !paymentAmount) {
      console.log('CarWashPaymentModal: Error - No hay datos suficientes para procesar el pago');
      Alert.alert('Error', 'No hay datos suficientes para procesar el pago');
      return;
    }

    console.log('CarWashPaymentModal: Iniciando procesamiento de pago con TUU');
    setProcessingPayment(true);
    try {
      // Verificar que el servicio TUU esté disponible
      const isAvailable = tuuPaymentsService.isAvailable();
      console.log('CarWashPaymentModal: TUU disponible:', isAvailable);
      
      if (!isAvailable) {
        console.log('CarWashPaymentModal: TUU no está disponible');
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
      const plateValue = carWash?.plate || 'N/A';
      
      // Construir el objeto paso a paso usando solo valores primitivos
      const tuuPaymentData: any = {};
      tuuPaymentData.amount = Number(paymentAmount);
      tuuPaymentData.tip = 0;
      tuuPaymentData.cashback = 0;
      tuuPaymentData.method = 0;
      tuuPaymentData.installmentsQuantity = 0;
      tuuPaymentData.printVoucherOnApp = false;
      tuuPaymentData.dteType = 48;
      
      tuuPaymentData.extraData = {};
      tuuPaymentData.extraData.netAmount = Number(paymentAmount);
      tuuPaymentData.extraData.sourceName = 'STPark';
      tuuPaymentData.extraData.sourceVersion = CONFIG.VERSION;
      tuuPaymentData.extraData.customFields = [
        { name: 'patente', value: String(plateValue).toUpperCase(), print: false },
        { name: 'tipo', value: 'lavado', print: false },
      ];

      console.log('CarWashPaymentModal: Datos de pago TUU:', JSON.stringify(tuuPaymentData));
      
      const isDevMode = isDevelopmentMode();
      console.log(`CarWashPaymentModal: Llamando a tuuPaymentsService.startPayment (modo ${isDevMode ? 'DEV' : 'PROD'})`);
      const tuuResult = await tuuPaymentsService.startPayment(tuuPaymentData);
      console.log('CarWashPaymentModal: Resultado de TUU:', tuuResult);

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
      const approvalCodeValue = tuuResult.authorizationCode || tuuResult.authCode;

      console.log('CarWashPaymentModal: Datos extraídos de TUU:', {
        approvalCodeValue,
        fullResult: tuuResult
      });

      // Validar que el operador esté disponible
      if (!operator?.id) {
        Alert.alert('Error', 'No se pudo identificar el operador. Por favor, inicia sesión nuevamente.');
        setProcessingPayment(false);
        return;
      }

      // Obtener turno activo
      let activeShiftId: string | undefined;
      try {
        const shiftResponse = await apiService.getCurrentShift(operator?.id);
        console.log('CarWashPaymentModal: Respuesta de getCurrentShift:', shiftResponse);
        if (shiftResponse.success && shiftResponse.data?.shift?.id) {
          activeShiftId = shiftResponse.data.shift.id;
          console.log('CarWashPaymentModal: Turno activo encontrado:', activeShiftId);
        } else {
          console.log('CarWashPaymentModal: No se encontró turno activo');
        }
      } catch (error) {
        console.error('Error obteniendo turno activo:', error);
      }

      // Si el lavado no existe (no tiene id), crearlo directamente como PAID
      // Si ya existe, actualizarlo a PAID
      let response;
      
      if (!carWash.id) {
        // Crear el lavado directamente como PAID
        const performedAt = carWash.performed_at || new Date().toISOString();
        const createData: any = {
          plate: carWash.plate,
          car_wash_type_id: carWash.car_wash_type_id,
          status: 'PAID',
          amount: paymentAmount,
          performed_at: performedAt,
        };
        if (operator?.id) {
          createData.operator_id = operator.id;
          createData.cashier_operator_id = operator.id;
        }
        if (activeShiftId) {
          createData.shift_id = activeShiftId;
        }
        if (approvalCodeValue) {
          createData.approval_code = approvalCodeValue;
        }
        console.log('CarWashPaymentModal: Creando lavado como PAID con datos:', JSON.stringify(createData, null, 2));
        response = await apiService.createCarWash(createData);
      } else {
        // Actualizar el lavado existente a PAID
        const updateData: any = {
          status: 'PAID',
          amount: paymentAmount,
        };
        if (operator?.id) {
          updateData.cashier_operator_id = operator.id;
        }
        if (activeShiftId) {
          updateData.shift_id = activeShiftId;
        }
        if (approvalCodeValue) {
          updateData.approval_code = approvalCodeValue;
        }
        console.log('CarWashPaymentModal: Actualizando lavado con datos:', JSON.stringify(updateData, null, 2));
        response = await apiService.updateCarWash(carWash.id, updateData);
      }

      if (response.success) {
        // Preparar datos del ticket para mostrar modal de impresión
        const washTypeName = carWash?.car_wash_type?.name || 'N/A';
        const ticketData: CarWashTicketData = {
          type: 'CAR_WASH',
          plate: plateValue.toUpperCase(),
          washTypeName: washTypeName,
          performedAt: response.data?.performed_at || carWash.performed_at,
          amount: paymentAmount,
          status: 'PAID',
          operatorName: operator?.name,
          paymentMethod: 'CARD',
          // No incluir datos de pago porque TUU ya imprime el comprobante
        };
        setPendingTicketData(ticketData);
        setPrintTicketCountdown(10);
        setShowPrintTicketModal(true);
      } else {
        Alert.alert('Error', response.message || 'No se pudo procesar el pago');
      }
    } catch (error: any) {
      console.error('Error procesando pago con TUU:', error);
      
      tuuPaymentsService.resetPaymentState();
      
      let errorMessage = 'Error al procesar el pago con TUU';
      if (error?.message) {
        errorMessage = error.message;
      }

      // Detectar errores específicos
      const isAppNotInstalled = error?.code === 'APP_NOT_INSTALLED' || 
                                errorMessage.includes('no está instalada');
      const isUserCancelled = error?.code === 'USER_CANCELLED' || 
                              errorMessage.includes('cancelado');
      const isPaymentInProgress = error?.code === 'PAYMENT_IN_PROGRESS' || 
                                  errorMessage.includes('Ya hay un pago en curso');
      const isMapConsumedError = errorMessage.includes('Map already consumed');

      if (isAppNotInstalled) {
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
        Alert.alert(
          'Pago en Curso',
          'Después de varios intentos, aún hay un pago pendiente en la aplicación TUU Negocio.\n\nPor favor:\n\n1. Abre la aplicación TUU Negocio\n2. Completa o cancela el pago pendiente\n3. Vuelve aquí y presiona "Reintentar"',
          [
            {
              text: 'Abrir TUU Negocio',
              onPress: async () => {
                try {
                  const isDevMode = isDevelopmentMode();
                  const tuuPackage = Platform.OS === 'android' 
                    ? (isDevMode ? 'com.haulmer.paymentapp.dev' : 'com.haulmer.paymentapp')
                    : 'tuu-negocio';
                  
                  const url = Platform.OS === 'android'
                    ? `intent://#Intent;package=${tuuPackage};scheme=tuu;end`
                    : `tuu://`;
                  
                  const canOpen = await Linking.canOpenURL(url);
                  if (canOpen) {
                    await Linking.openURL(url);
                  } else {
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

  // Función para procesar pago en efectivo, imprimir ticket y mostrar modal de vuelto si corresponde
  const processCashPaymentAndPrint = async (paidAmountValue: number, change: number) => {
    if (!carWash) return;

    setProcessingPayment(true);
    try {
      // Obtener turno activo
      let activeShiftId: string | undefined;
      try {
        const shiftResponse = await apiService.getCurrentShift(operator?.id);
        console.log('CarWashPaymentModal (efectivo): Respuesta de getCurrentShift:', shiftResponse);
        if (shiftResponse.success && shiftResponse.data?.shift?.id) {
          activeShiftId = shiftResponse.data.shift.id;
          console.log('CarWashPaymentModal (efectivo): Turno activo encontrado:', activeShiftId);
        } else {
          console.log('CarWashPaymentModal (efectivo): No se encontró turno activo');
        }
      } catch (error) {
        console.error('Error obteniendo turno activo:', error);
      }

      const washAmount = parseFloat(carWash?.amount || carWash?.car_wash_type?.price || '0');

      console.log('CarWashPaymentModal (efectivo): Valores antes de construir updateData:', {
        operatorId: operator?.id,
        activeShiftId: activeShiftId,
        carWashId: carWash?.id,
        paidAmount: paidAmountValue,
        washAmount: washAmount,
      });

      // Si el lavado no existe (no tiene id), crearlo directamente como PAID
      // Si ya existe, actualizarlo a PAID
      let response;
      
      if (!carWash.id) {
        // Crear el lavado directamente como PAID
        const performedAt = carWash.performed_at || new Date().toISOString();
        const createData: any = {
          plate: carWash.plate,
          car_wash_type_id: carWash.car_wash_type_id,
          status: 'PAID',
          amount: washAmount, // Precio del lavado, no el monto recibido
          performed_at: performedAt,
        };
        if (operator?.id) {
          createData.operator_id = operator.id;
          createData.cashier_operator_id = operator.id;
        }
        if (activeShiftId) {
          createData.shift_id = activeShiftId;
        }
        console.log('CarWashPaymentModal: Creando lavado como PAID con datos (efectivo):', JSON.stringify(createData, null, 2));
        response = await apiService.createCarWash(createData);
      } else {
        // Actualizar el lavado existente a PAID
        const updateData: any = {
          status: 'PAID',
          amount: washAmount, // Precio del lavado, no el monto recibido
        };
        if (operator?.id) {
          updateData.cashier_operator_id = operator.id;
        }
        if (activeShiftId) {
          updateData.shift_id = activeShiftId;
        }
        console.log('CarWashPaymentModal: Actualizando lavado con datos (efectivo):', JSON.stringify(updateData, null, 2));
        response = await apiService.updateCarWash(carWash.id, updateData);
      }

      if (response.success) {
        // PRIMERO: Imprimir ticket con estado PAID y datos de pago en efectivo
        const washTypeName = carWash?.car_wash_type?.name || 'N/A';
        const plateValue = carWash?.plate || 'N/A';
        const ticketData: CarWashTicketData = {
          type: 'CAR_WASH',
          plate: plateValue.toUpperCase(),
          washTypeName: washTypeName,
          performedAt: response.data?.performed_at || carWash.performed_at,
          amount: washAmount,
          status: 'PAID',
          operatorName: operator?.name,
          paymentMethod: 'CASH',
          change: change > 0 ? change : undefined,
        };
        try {
          await ticketPrinterService.printCarWashTicket(ticketData);
          console.log('Ticket impreso exitosamente');
        } catch (error) {
          console.error('Error imprimiendo ticket:', error);
          // Continuar aunque falle la impresión
        }

        setProcessingPayment(false);

        // DESPUÉS: Si hay vuelto, mostrar modal de vuelto
        if (change > 0) {
          setShowChangeModal(true);
        } else {
          // Si no hay vuelto, cerrar directamente
          showSuccessAndClose();
        }
      } else {
        Alert.alert('Error', response.message || 'No se pudo procesar el pago');
        setProcessingPayment(false);
      }
    } catch (error) {
      console.error('Error procesando pago:', error);
      Alert.alert('Error', 'Error de conexión con el servidor');
      setProcessingPayment(false);
    }
  };

  // Función para procesar pago en efectivo (llamada desde el modal de vuelto)
  const processCashPayment = async () => {
    // Esta función solo cierra el modal de vuelto y muestra el mensaje de éxito
    setShowChangeModal(false);
    showSuccessAndClose();
  };

  // Función para manejar envío del monto pagado
  const handleAmountSubmit = async () => {
    if (!amountPaid.trim() || !carWash) {
      Alert.alert('Error', 'Por favor ingresa un monto válido');
      return;
    }

    const paidAmountValue = parseFloat(amountPaid);
    const washAmount = parseFloat(carWash?.amount || carWash?.car_wash_type?.price || '0');

    if (paidAmountValue < washAmount) {
      Alert.alert('Error', 'El monto pagado debe ser mayor o igual al monto del lavado');
      return;
    }

    // Cerrar modal de monto
    setShowAmountModal(false);

    // Calcular vuelto
    const change = paidAmountValue - washAmount;
    
    // Primero procesar el pago y imprimir el ticket
    // Luego, si hay vuelto, mostrar el modal de vuelto
    await processCashPaymentAndPrint(paidAmountValue, change);
  };

  // Función para manejar envío del código de autorización
  const handleApprovalCodeSubmit = async () => {
    if (!selectedPaymentMethod || !carWash) {
      Alert.alert('Error', 'Datos de pago no válidos');
      return;
    }

    setShowApprovalCodeModal(false);
    setProcessingPayment(true);
    try {
      // Obtener turno activo
      let activeShiftId: string | undefined;
      try {
        const shiftResponse = await apiService.getCurrentShift(operator?.id);
        console.log('CarWashPaymentModal (tarjeta manual): Respuesta de getCurrentShift:', shiftResponse);
        if (shiftResponse.success && shiftResponse.data?.shift?.id) {
          activeShiftId = shiftResponse.data.shift.id;
          console.log('CarWashPaymentModal (tarjeta manual): Turno activo encontrado:', activeShiftId);
        } else {
          console.log('CarWashPaymentModal (tarjeta manual): No se encontró turno activo');
        }
      } catch (error) {
        console.error('Error obteniendo turno activo:', error);
      }

      const washAmount = parseFloat(carWash?.amount || carWash?.car_wash_type?.price || '0');

      console.log('CarWashPaymentModal (tarjeta manual): Valores antes de construir updateData:', {
        operatorId: operator?.id,
        activeShiftId: activeShiftId,
        approvalCode: approvalCode,
        carWashId: carWash?.id,
      });

      // Si el lavado no existe (no tiene id), crearlo directamente como PAID
      // Si ya existe, actualizarlo a PAID
      let response;
      
      if (!carWash.id) {
        // Crear el lavado directamente como PAID
        const performedAt = carWash.performed_at || new Date().toISOString();
        const createData: any = {
          plate: carWash.plate,
          car_wash_type_id: carWash.car_wash_type_id,
          status: 'PAID',
          amount: washAmount,
          performed_at: performedAt,
        };
        if (operator?.id) {
          createData.operator_id = operator.id;
          createData.cashier_operator_id = operator.id;
        }
        if (activeShiftId) {
          createData.shift_id = activeShiftId;
        }
        if (approvalCode.trim()) {
          createData.approval_code = approvalCode.trim();
        }
        console.log('CarWashPaymentModal: Creando lavado como PAID con datos (tarjeta manual):', JSON.stringify(createData, null, 2));
        response = await apiService.createCarWash(createData);
      } else {
        // Actualizar el lavado existente a PAID
        const updateData: any = {
          status: 'PAID',
          amount: washAmount,
        };
        if (operator?.id) {
          updateData.cashier_operator_id = operator.id;
        }
        if (activeShiftId) {
          updateData.shift_id = activeShiftId;
        }
        if (approvalCode.trim()) {
          updateData.approval_code = approvalCode.trim();
        }
        console.log('CarWashPaymentModal: Actualizando lavado con datos (tarjeta manual):', JSON.stringify(updateData, null, 2));
        response = await apiService.updateCarWash(carWash.id, updateData);
      }

      if (response.success) {
        // Para pagos manuales con tarjeta, imprimir directamente (no hay comprobante de TUU)
        const washTypeName = carWash?.car_wash_type?.name || 'N/A';
        const plateValue = carWash?.plate || 'N/A';
        const ticketData: CarWashTicketData = {
          type: 'CAR_WASH',
          plate: plateValue.toUpperCase(),
          washTypeName: washTypeName,
          performedAt: response.data?.performed_at || carWash.performed_at,
          amount: washAmount,
          status: 'PAID',
          operatorName: operator?.name,
          paymentMethod: 'CARD',
          authCode: approvalCode.trim() || undefined,
        };
        try {
          await ticketPrinterService.printCarWashTicket(ticketData);
        } catch (error) {
          console.error('Error imprimiendo ticket:', error);
        }
        
        showSuccessAndClose();
      } else {
        Alert.alert('Error', response.message || 'No se pudo procesar el pago');
        setProcessingPayment(false);
      }
    } catch (error) {
      console.error('Error procesando pago:', error);
      Alert.alert('Error', 'Error de conexión con el servidor');
      setProcessingPayment(false);
    }
  };

  // Función para mostrar éxito y cerrar modales
  const showSuccessAndClose = () => {
    Alert.alert(
      'Éxito',
      'Lavado de auto pagado exitosamente',
      [
        {
          text: 'OK',
          onPress: () => {
            onSuccess();
            onClose();
          }
        }
      ]
    );
  };

  // Función para manejar la impresión del ticket
  const handlePrintTicket = async () => {
    if (!pendingTicketData) {
      setShowPrintTicketModal(false);
      setPrintTicketCountdown(10);
      showSuccessAndClose();
      return;
    }

    setShowPrintTicketModal(false);
    setPrintTicketCountdown(10);
    try {
      const printed = await ticketPrinterService.printCarWashTicket(pendingTicketData);
      if (printed) {
        console.log('Ticket de lavado impreso exitosamente');
      }
    } catch (printError) {
      console.error('Error imprimiendo ticket:', printError);
    }
    setPendingTicketData(null);
    showSuccessAndClose();
  };

  if (!carWash) return null;

  // Obtener información del lavado
  const washAmount = parseFloat(carWash?.amount || carWash?.car_wash_type?.price || '0');
  const washTypeName = carWash?.car_wash_type?.name || 'N/A';
  const plateValue = carWash?.plate || 'N/A';

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
              <Text style={styles.modalTitle}>Procesar Pago</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={onClose}
              >
                <IconSymbol size={24} name="xmark.circle.fill" color="#6c757d" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <View style={styles.sessionSummary}>
                <Text style={styles.sessionSummaryTitle}>Resumen de Lavado</Text>
                <View style={styles.sessionSummaryRow}>
                  <Text style={styles.sessionSummaryLabel}>Patente:</Text>
                  <Text style={styles.sessionSummaryValue}>{plateValue}</Text>
                </View>
                <View style={styles.sessionSummaryRow}>
                  <Text style={styles.sessionSummaryLabel}>Tipo:</Text>
                  <Text style={styles.sessionSummaryValue}>{washTypeName}</Text>
                </View>
                <View style={styles.sessionSummaryRow}>
                  <Text style={styles.sessionSummaryLabel}>Monto:</Text>
                  <Text style={styles.sessionSummaryValue}>${washAmount.toLocaleString('es-CL')}</Text>
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
                Monto a pagar: ${washAmount.toLocaleString('es-CL')}
              </Text>
              
              <TextInput
                style={styles.amountInput}
                placeholder="Ingresa el monto recibido"
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
                Monto a pagar: ${washAmount.toLocaleString('es-CL')}
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
        visible={processingPayment && useTuuPosPayment && !showPaymentMethod}
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
                Vuelto: ${((parseFloat(amountPaid) || 0) - washAmount).toLocaleString('es-CL')}
              </Text>
              
              <TouchableOpacity
                style={styles.changeConfirmButton}
                onPress={processCashPayment}
              >
                <Text style={styles.changeConfirmButtonText}>Finalizar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Impresión de Ticket */}
      <Modal
        visible={showPrintTicketModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Imprimir Comprobante</Text>
            </View>
            
            <View style={styles.modalContent}>
              <Text style={styles.printTicketText}>
                Se imprimirá el ticket automáticamente en:
              </Text>
              
              <Text style={styles.printTicketCountdown}>
                {printTicketCountdown}s
              </Text>
              
              <TouchableOpacity
                style={styles.printTicketButton}
                onPress={handlePrintTicket}
              >
                <Text style={styles.printTicketButtonText}>Imprimir Ahora</Text>
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
  printTicketText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  printTicketCountdown: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#043476',
    textAlign: 'center',
    marginBottom: 24,
  },
  printTicketButton: {
    backgroundColor: '#043476',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  printTicketButtonText: {
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

