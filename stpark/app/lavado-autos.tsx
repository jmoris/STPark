import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { STParkLogo } from '@/components/STParkLogo';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { router } from 'expo-router';
import { apiService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { systemConfigService } from '@/services/systemConfig';
import { tuuPaymentsService, isDevelopmentMode } from '@/services/tuuPayments';
import { CONFIG } from '@/config/app';
import { ticketPrinterService, CarWashTicketData } from '@/services/ticketPrinter';
import { OpenShiftModal } from '@/components/OpenShiftModal';
import { CarWashPaymentModal } from '@/components/CarWashPaymentModal';

interface CarWashType {
  id: number;
  name: string;
  price: number;
  duration_minutes?: number;
}

export default function LavadoAutosScreen() {
  const { operator } = useAuth();
  const [patente, setPatente] = useState('');
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [washTypes, setWashTypes] = useState<CarWashType[]>([]);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showPaymentOptionModal, setShowPaymentOptionModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [createdCarWash, setCreatedCarWash] = useState<any>(null);
  const [showNoShiftAlert, setShowNoShiftAlert] = useState(false);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [openingShift, setOpeningShift] = useState(false);
  const [carWashPaymentDeferred, setCarWashPaymentDeferred] = useState<boolean>(false);
  const selectedDate = new Date(); // Readonly - siempre usa la fecha/hora actual

  // Cargar tipos de lavado y configuración al montar el componente
  useEffect(() => {
    loadWashTypes();
    loadPaymentDeferredConfig();
  }, []);

  // Cargar configuración de pago posterior
  const loadPaymentDeferredConfig = async () => {
    try {
      const config = await systemConfigService.getConfig();
      const isPaymentDeferred = config.car_wash_payment_deferred || false;
      setCarWashPaymentDeferred(isPaymentDeferred);
      console.log('LavadoAutos: Pago posterior habilitado:', isPaymentDeferred);
    } catch (error) {
      console.error('Error cargando configuración de pago posterior:', error);
      setCarWashPaymentDeferred(false);
    }
  };

  const loadWashTypes = async () => {
    setLoadingTypes(true);
    try {
      const response = await apiService.getCarWashTypes();
      if (response.success && response.data) {
        setWashTypes(response.data);
        if (response.data.length > 0 && !selectedType) {
          setSelectedType(response.data[0].id);
        }
      } else {
        Alert.alert('Error', response.message || 'No se pudieron cargar los tipos de lavado');
      }
    } catch (error) {
      console.error('Error cargando tipos de lavado:', error);
      Alert.alert('Error', 'Error de conexión con el servidor');
    } finally {
      setLoadingTypes(false);
    }
  };

  const handleCreateCarWash = () => {
    if (!patente.trim()) {
      Alert.alert('Error', 'Por favor ingresa la patente del vehículo');
      return;
    }

    if (!selectedType) {
      Alert.alert('Error', 'Por favor selecciona un tipo de lavado');
      return;
    }

    // Si el pago posterior está habilitado, mostrar modal de elección
    // Si no está habilitado, ir directo al pago inmediato
    if (carWashPaymentDeferred) {
      setShowPaymentOptionModal(true);
    } else {
      // Si no está habilitado, ir directo al pago inmediato
      handlePayNow();
    }
  };

  const handlePayLater = async () => {
    setShowPaymentOptionModal(false);
    setLoading(true);
    try {
      const performedAt = selectedDate.toISOString();
      const response = await apiService.createCarWash({
        plate: patente.toUpperCase().trim(),
        car_wash_type_id: selectedType,
        status: 'PENDING',
        operator_id: operator?.id,
        performed_at: performedAt,
      });

      if (response.success) {
        // Imprimir ticket con estado PENDING
        if (selectedWashType && response.data) {
          const ticketData: CarWashTicketData = {
            type: 'CAR_WASH',
            plate: patente.toUpperCase().trim(),
            washTypeName: selectedWashType.name,
            performedAt: response.data.performed_at || performedAt,
            amount: selectedWashType.price,
            status: 'PENDING',
            operatorName: operator?.name,
          };
          try {
            await ticketPrinterService.printCarWashTicket(ticketData);
          } catch (error) {
            console.error('Error imprimiendo ticket:', error);
          }
        }
        
        Alert.alert(
          'Éxito',
          'Lavado de auto registrado exitosamente (Pendiente)',
          [
            {
              text: 'OK',
              onPress: () => {
                setPatente('');
              },
            },
          ]
        );
      } else {
        console.error('Error en respuesta:', response);
        
        // Verificar si no hay turno abierto
        if (response.error_code === 'NO_SHIFT_OPEN') {
          setShowNoShiftAlert(true);
          return;
        }
        
        Alert.alert('Error', response.message || 'No se pudo crear el lavado de auto');
      }
    } catch (error) {
      console.error('Error creando lavado de auto:', error);
      Alert.alert('Error', 'Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = async () => {
    setShowPaymentOptionModal(false);
    setLoading(true);
    try {
      const performedAt = selectedDate.toISOString();
      const response = await apiService.createCarWash({
        plate: patente.toUpperCase().trim(),
        car_wash_type_id: selectedType,
        status: 'PENDING',
        operator_id: operator?.id,
        performed_at: performedAt,
      });

      if (response.success) {
        // Incluir el tipo de lavado en el objeto creado para que el modal de pago lo tenga
        const washType = washTypes.find((type) => type.id === selectedType);
        setCreatedCarWash({
          ...response.data,
          car_wash_type: washType || { name: 'N/A', price: 0 },
          amount: washType?.price || 0,
        });
        setShowPaymentModal(true);
      } else {
        console.error('Error en respuesta:', response);
        
        // Verificar si no hay turno abierto
        if (response.error_code === 'NO_SHIFT_OPEN') {
          setShowNoShiftAlert(true);
          return;
        }
        
        Alert.alert('Error', response.message || 'No se pudo crear el lavado de auto');
      }
    } catch (error) {
      console.error('Error creando lavado de auto:', error);
      Alert.alert('Error', 'Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenShift = async (openingFloat: number) => {
    if (!operator) {
      Alert.alert('Error', 'No hay operador disponible');
      return;
    }

    setOpeningShift(true);
    try {
      const response = await apiService.openShift({
        operator_id: operator.id,
        opening_float: openingFloat,
        sector_id: operator?.activeSector?.id,
      });

      if (response.success) {
        console.log('Turno abierto exitosamente');
        setShowOpenShiftModal(false);
        setShowNoShiftAlert(false);
        // No recrear el lavado automáticamente, el usuario debe intentarlo de nuevo
      } else {
        Alert.alert('Error', response.message || 'No se pudo abrir el turno');
      }
    } catch (error) {
      console.error('Error abriendo turno:', error);
      Alert.alert('Error', 'No se pudo conectar con el servidor');
    } finally {
      setOpeningShift(false);
    }
  };

  // Función para manejar éxito del pago
  const handlePaymentSuccess = () => {
    setPatente('');
    setShowPaymentModal(false);
    setCreatedCarWash(null);
  };

  // Funciones de pago eliminadas - ahora se manejan en CarWashPaymentModal
  const processPaymentWithTuu_OLD = async (paymentAmount: number) => {
    if (!createdCarWash) return;

    setProcessingPayment(true);
    try {
      if (!tuuPaymentsService.isAvailable()) {
        Alert.alert(
          'Error',
          'El servicio de pagos TUU no está disponible. Por favor, usa el método de pago manual.',
          [
            {
              text: 'OK',
              onPress: () => {
                setShowPaymentModal(true);
                setProcessingPayment(false);
              }
            }
          ]
        );
        return;
      }

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
        { name: 'patente', value: String(patente.toUpperCase()), print: false },
        { name: 'tipo', value: 'lavado', print: false },
      ];

      console.log('LavadoAutos: Datos de pago TUU:', JSON.stringify(tuuPaymentData));
      
      const isDevMode = isDevelopmentMode();
      console.log(`LavadoAutos: Llamando a tuuPaymentsService.startPayment (modo ${isDevMode ? 'DEV' : 'PROD'})`);
      const tuuResult = await tuuPaymentsService.startPayment(tuuPaymentData);
      console.log('LavadoAutos: Resultado de TUU:', tuuResult);

      if (!tuuResult) {
        Alert.alert('Error', 'No se recibió respuesta del procesador de pagos');
        setProcessingPayment(false);
        return;
      }

      if (tuuResult.status !== 'success') {
        const errorMsg = tuuResult.errorMessage || tuuResult.message || 'El pago no fue exitoso';
        Alert.alert('Error', errorMsg);
        setProcessingPayment(false);
        return;
      }

      const approvalCodeValue = tuuResult.authorizationCode || tuuResult.authCode;
      const transactionMethod = tuuResult.transactionMethod || (tuuResult.method !== undefined ? (tuuResult.method === 0 ? 'CREDITO' : tuuResult.method === 2 ? 'DEBITO' : `METODO_${tuuResult.method}`) : undefined);
      const last4 = tuuResult.last4 || tuuResult.cardLast4 || tuuResult.lastFourDigits;
      const sequenceNumber = tuuResult.sequenceNumber;

      // Obtener turno activo
      let activeShiftId: string | undefined;
      try {
        const shiftResponse = await apiService.getCurrentShift(operator?.id);
        console.log('LavadoAutos: Respuesta de getCurrentShift:', shiftResponse);
        if (shiftResponse.success && shiftResponse.data?.shift?.id) {
          activeShiftId = shiftResponse.data.shift.id;
          console.log('LavadoAutos: Turno activo encontrado:', activeShiftId);
        } else {
          console.log('LavadoAutos: No se encontró turno activo');
        }
      } catch (error) {
        console.error('Error obteniendo turno activo:', error);
      }

      console.log('LavadoAutos: Valores antes de construir updateData:', {
        operatorId: operator?.id,
        activeShiftId: activeShiftId,
        approvalCodeValue: approvalCodeValue,
        createdCarWashId: createdCarWash?.id,
      });

      // Actualizar el car wash a PAID con datos adicionales
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
      console.log('LavadoAutos: Actualizando lavado con datos:', JSON.stringify(updateData, null, 2));
      const response = await apiService.updateCarWash(createdCarWash.id, updateData);

      if (response.success) {
        // Preparar datos del ticket para mostrar modal de impresión
        if (selectedWashType && response.data) {
          const ticketData: CarWashTicketData = {
            type: 'CAR_WASH',
            plate: patente.toUpperCase().trim(),
            washTypeName: selectedWashType.name,
            performedAt: response.data.performed_at || createdCarWash.performed_at,
            amount: selectedWashType.price,
            status: 'PAID',
            operatorName: operator?.name,
            paymentMethod: 'CARD',
            // No incluir datos de pago porque TUU ya imprime el comprobante
          };
          setPendingTicketData(ticketData);
          setPrintTicketCountdown(10);
          setShowPrintTicketModal(true);
        } else {
          Alert.alert(
            'Éxito',
            'Lavado de auto registrado y pagado exitosamente',
            [
              {
                text: 'OK',
                onPress: () => {
                  setPatente('');
                  setShowPaymentModal(false);
                  setCreatedCarWash(null);
                  setSelectedPaymentMethod(null);
                  setAmountPaid('');
                  setApprovalCode('');
                  setProcessingPayment(false);
                },
              },
            ]
          );
        }
      } else {
        Alert.alert('Error', response.message || 'No se pudo procesar el pago');
        setProcessingPayment(false);
      }
    } catch (error: any) {
      console.error('Error procesando pago con TUU:', error);
      const errorMessage = error?.message || 'Error al procesar el pago';
      Alert.alert('Error', errorMessage);
      setProcessingPayment(false);
    }
  };

  const handleAmountSubmit = () => {
    if (!amountPaid.trim() || !selectedPaymentMethod || !createdCarWash) {
      Alert.alert('Error', 'Por favor ingresa un monto válido');
      return;
    }

    const paidAmount = parseFloat(amountPaid);
    const washAmount = selectedWashType?.price || 0;

    if (paidAmount < washAmount) {
      Alert.alert('Error', 'El monto pagado debe ser mayor o igual al monto del lavado');
      return;
    }

    // Cerrar modal de monto
    setShowAmountModal(false);

    // Calcular vuelto y mostrar modal de vuelto si hay
    const change = paidAmount - washAmount;
    if (change > 0) {
      setShowChangeModal(true);
    } else {
      // Si no hay vuelto, procesar el pago directamente
      processCashPayment();
    }
  };

  const processCashPayment = async () => {
    if (!createdCarWash) return;

    setShowChangeModal(false);
    setProcessingPayment(true);
    try {
      // Obtener turno activo
      let activeShiftId: string | undefined;
      try {
        const shiftResponse = await apiService.getCurrentShift(operator?.id);
        console.log('LavadoAutos (efectivo): Respuesta de getCurrentShift:', shiftResponse);
        if (shiftResponse.success && shiftResponse.data?.shift?.id) {
          activeShiftId = shiftResponse.data.shift.id;
          console.log('LavadoAutos (efectivo): Turno activo encontrado:', activeShiftId);
        } else {
          console.log('LavadoAutos (efectivo): No se encontró turno activo');
        }
      } catch (error) {
        console.error('Error obteniendo turno activo:', error);
      }

      const paidAmount = parseFloat(amountPaid);
      const washAmount = selectedWashType?.price || 0;

      console.log('LavadoAutos (efectivo): Valores antes de construir updateData:', {
        operatorId: operator?.id,
        activeShiftId: activeShiftId,
        createdCarWashId: createdCarWash?.id,
        paidAmount: paidAmount,
        washAmount: washAmount,
      });

      // Actualizar el car wash a PAID con datos adicionales
      // amount debe ser el precio del lavado, no el monto recibido
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
      console.log('LavadoAutos: Actualizando lavado con datos (efectivo):', JSON.stringify(updateData, null, 2));
      const response = await apiService.updateCarWash(createdCarWash.id, updateData);

      if (response.success) {
        const change = paidAmount - washAmount;
        
        // Imprimir ticket con estado PAID y datos de pago en efectivo
        if (selectedWashType && response.data) {
          const ticketData: CarWashTicketData = {
            type: 'CAR_WASH',
            plate: patente.toUpperCase().trim(),
            washTypeName: selectedWashType.name,
            performedAt: response.data.performed_at || createdCarWash.performed_at,
            amount: selectedWashType.price,
            status: 'PAID',
            operatorName: operator?.name,
            paymentMethod: 'CASH',
            change: change > 0 ? change : undefined,
          };
          try {
            await ticketPrinterService.printCarWashTicket(ticketData);
          } catch (error) {
            console.error('Error imprimiendo ticket:', error);
          }
        }
        
        Alert.alert(
          'Éxito',
          'Lavado de auto registrado y pagado exitosamente',
          [
            {
              text: 'OK',
              onPress: () => {
                setPatente('');
                setShowPaymentModal(false);
                setCreatedCarWash(null);
                setSelectedPaymentMethod(null);
                setAmountPaid('');
                setApprovalCode('');
                setProcessingPayment(false);
              },
            },
          ]
        );
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

  const handleApprovalCodeSubmit = async () => {
    if (!selectedPaymentMethod || !createdCarWash) {
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
        console.log('LavadoAutos (tarjeta manual): Respuesta de getCurrentShift:', shiftResponse);
        if (shiftResponse.success && shiftResponse.data?.shift?.id) {
          activeShiftId = shiftResponse.data.shift.id;
          console.log('LavadoAutos (tarjeta manual): Turno activo encontrado:', activeShiftId);
        } else {
          console.log('LavadoAutos (tarjeta manual): No se encontró turno activo');
        }
      } catch (error) {
        console.error('Error obteniendo turno activo:', error);
      }

      const washAmount = selectedWashType?.price || 0;

      console.log('LavadoAutos (tarjeta manual): Valores antes de construir updateData:', {
        operatorId: operator?.id,
        activeShiftId: activeShiftId,
        approvalCode: approvalCode,
        createdCarWashId: createdCarWash?.id,
      });

      // Actualizar el car wash a PAID con datos adicionales
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
      console.log('LavadoAutos: Actualizando lavado con datos (tarjeta manual):', JSON.stringify(updateData, null, 2));
      const response = await apiService.updateCarWash(createdCarWash.id, updateData);

      if (response.success) {
        // Para pagos manuales con tarjeta, imprimir directamente (no hay comprobante de TUU)
        if (selectedWashType && response.data) {
          const ticketData: CarWashTicketData = {
            type: 'CAR_WASH',
            plate: patente.toUpperCase().trim(),
            washTypeName: selectedWashType.name,
            performedAt: response.data.performed_at || createdCarWash.performed_at,
            amount: selectedWashType.price,
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
        }
        
        Alert.alert(
          'Éxito',
          'Lavado de auto registrado y pagado exitosamente',
          [
            {
              text: 'OK',
              onPress: () => {
                setPatente('');
                setShowPaymentModal(false);
                setCreatedCarWash(null);
                setSelectedPaymentMethod(null);
                setAmountPaid('');
                setApprovalCode('');
                setProcessingPayment(false);
              },
            },
          ]
        );
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

  // Función para manejar la impresión del ticket
  const handlePrintTicket = async () => {
    if (!pendingTicketData) {
      setShowPrintTicketModal(false);
      setPrintTicketCountdown(10);
      handlePaymentSuccess();
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
    handlePaymentSuccess();
  };

  const selectedWashType = washTypes.find((type) => type.id === selectedType);
  const selectedTypeName = selectedWashType ? selectedWashType.name : 'Selecciona un tipo';

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#043476',
    },
    content: {
      flexGrow: 1,
      padding: 20,
      paddingBottom: 0,
    },
    backButton: {
      position: 'absolute',
      top: 20,
      left: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: 20,
      padding: 10,
      zIndex: 1,
    },
    header: {
      alignItems: 'center',
      marginBottom: 40,
    },
    iconContainer: {
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#ffffff',
      marginBottom: 10,
    },
    subtitle: {
      fontSize: 16,
      color: '#b3d9ff',
      textAlign: 'center',
    },
    formContainer: {
      backgroundColor: '#ffffff',
      borderRadius: 16,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
    },
    inputContainer: {
      marginBottom: 20,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: '#043476',
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: '#dee2e6',
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: '#000000',
      backgroundColor: '#ffffff',
    },
    patenteInput: {
      textTransform: 'uppercase',
      letterSpacing: 2,
      textAlign: 'center',
    },
    selectInput: {
      borderWidth: 1,
      borderColor: '#dee2e6',
      borderRadius: 8,
      padding: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#ffffff',
    },
    selectInputText: {
      fontSize: 16,
      color: '#000000',
    },
    dateTimeContainer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    dateButtonReadonly: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8f9fa',
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: '#dee2e6',
      gap: 8,
    },
    timeButtonReadonly: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8f9fa',
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: '#dee2e6',
      gap: 8,
    },
    dateButtonTextReadonly: {
      fontSize: 16,
      color: '#6c757d',
      fontWeight: '500',
    },
    timeButtonTextReadonly: {
      fontSize: 16,
      color: '#6c757d',
      fontWeight: '500',
    },
    summaryContainer: {
      backgroundColor: '#f8f9fa',
      borderRadius: 12,
      padding: 12,
      marginTop: 12,
      marginBottom: 12,
    },
    summaryTotal: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    summaryTotalLabel: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#043476',
    },
    summaryTotalValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#043476',
    },
    button: {
      backgroundColor: '#28a745',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 12,
    },
    buttonDisabled: {
      backgroundColor: 'rgba(40, 167, 69, 0.5)',
    },
    buttonText: {
      color: 'white',
      fontSize: 18,
      fontWeight: 'bold',
    },
    loadingContainer: {
      alignItems: 'center',
      padding: 20,
    },
    loadingText: {
      fontSize: 16,
      color: '#b3d9ff',
      marginTop: 12,
    },
    // Modal styles para dropdown de tipos
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 50,
    },
    modalContainer: {
      backgroundColor: '#ffffff',
      borderRadius: 20,
      maxHeight: '80%',
      minHeight: '50%',
      width: '100%',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#e0e0e0',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#333',
    },
    modalCloseButton: {
      padding: 8,
    },
    modalContent: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      flex: 1,
    },
    modalContentContainer: {
      paddingBottom: 20,
    },
    typeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 18,
      paddingHorizontal: 16,
      borderRadius: 12,
      marginVertical: 6,
      backgroundColor: '#f8f9fa',
      minHeight: 56,
    },
    typeItemSelected: {
      backgroundColor: '#e3f2fd',
      borderWidth: 1,
      borderColor: '#2196f3',
    },
    typeInfo: {
      flex: 1,
    },
    typeName: {
      fontSize: 16,
      fontWeight: '500',
      color: '#333',
    },
    typeDetails: {
      fontSize: 14,
      color: '#6c757d',
    },
    radioButton: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: '#dee2e6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioButtonSelected: {
      borderColor: '#043476',
    },
    radioButtonInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#043476',
    },
    // Modal de opciones de pago
    paymentOptionModalContainer: {
      backgroundColor: '#ffffff',
      borderRadius: 20,
      width: '90%',
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    paymentOptionModalContent: {
      padding: 20,
    },
    paymentOptionButton: {
      backgroundColor: '#ffffff',
      borderRadius: 12,
      padding: 20,
      marginVertical: 8,
      borderWidth: 2,
      borderColor: '#dee2e6',
      alignItems: 'center',
    },
    paymentOptionButtonSelected: {
      borderColor: '#043476',
      backgroundColor: '#e7f0ff',
    },
    paymentOptionText: {
      fontSize: 18,
      fontWeight: '600',
      color: '#043476',
      marginTop: 8,
    },
    paymentMethodButton: {
      backgroundColor: '#ffffff',
      borderRadius: 12,
      padding: 20,
      marginVertical: 8,
      borderWidth: 2,
      borderColor: '#dee2e6',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    paymentMethodButtonSelected: {
      borderColor: '#043476',
      backgroundColor: '#e7f0ff',
    },
    paymentMethodText: {
      fontSize: 18,
      fontWeight: '600',
      color: '#043476',
      marginLeft: 12,
    },
    paymentInput: {
      borderWidth: 1,
      borderColor: '#dee2e6',
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: '#000000',
      backgroundColor: '#ffffff',
      marginTop: 8,
    },
    paymentButton: {
      backgroundColor: '#28a745',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 16,
    },
    paymentButtonDisabled: {
      backgroundColor: 'rgba(40, 167, 69, 0.5)',
    },
    paymentButtonText: {
      color: 'white',
      fontSize: 18,
      fontWeight: 'bold',
    },
    modalAmountText: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#043476',
      textAlign: 'center',
      marginVertical: 16,
    },
    // Estilos para modal de pago mejorado
    paymentModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    paymentModalContainer: {
      backgroundColor: '#ffffff',
      borderRadius: 20,
      width: '95%',
      maxWidth: 500,
      maxHeight: '90%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 12,
    },
    paymentModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 24,
      borderBottomWidth: 1,
      borderBottomColor: '#e9ecef',
    },
    paymentModalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#043476',
    },
    paymentModalCloseButton: {
      padding: 8,
    },
    paymentModalContent: {
      padding: 24,
    },
    paymentModalContentContainer: {
      paddingBottom: 20,
    },
    carWashSummary: {
      backgroundColor: '#f8f9fa',
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
    },
    carWashSummaryTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#043476',
      marginBottom: 12,
      textAlign: 'center',
    },
    carWashSummaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    carWashSummaryLabel: {
      fontSize: 14,
      color: '#6c757d',
      fontWeight: '500',
    },
    carWashSummaryValue: {
      fontSize: 14,
      color: '#000000',
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
    paymentMethodButtonModal: {
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: 20,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#e9ecef',
      minWidth: 120,
    },
    paymentMethodButtonSelectedModal: {
      borderColor: '#043476',
      backgroundColor: '#e7f0ff',
    },
    paymentMethodTextModal: {
      fontSize: 14,
      fontWeight: '600',
      color: '#043476',
      marginTop: 8,
    },
    paymentInputModal: {
      borderWidth: 1,
      borderColor: '#dee2e6',
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: '#000000',
      backgroundColor: '#ffffff',
      marginTop: 8,
    },
    changeText: {
      marginTop: 8,
      fontSize: 16,
      color: '#28a745',
      fontWeight: '600',
    },
    paymentButtonModal: {
      backgroundColor: '#28a745',
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    paymentButtonDisabledModal: {
      backgroundColor: 'rgba(40, 167, 69, 0.5)',
    },
    paymentButtonTextModal: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    loadingSubtext: {
      fontSize: 14,
      color: '#6c757d',
      marginTop: 8,
      textAlign: 'center',
    },
    // Estilos para modales de monto y código
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
    amountInputHint: {
      fontSize: 12,
      color: '#6c757d',
      marginBottom: 20,
      textAlign: 'center',
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
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 30,
    },
    modalContainer: {
      backgroundColor: '#ffffff',
      borderRadius: 20,
      width: '95%',
      maxWidth: 500,
      maxHeight: '90%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 10,
    },
    modalContent: {
      padding: 24,
    },
    alertHeader: {
      alignItems: 'center',
      padding: 24,
      borderBottomWidth: 1,
      borderBottomColor: '#e9ecef',
    },
    alertTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#043476',
      marginTop: 16,
      textAlign: 'center',
    },
    alertText: {
      fontSize: 16,
      color: '#6c757d',
      textAlign: 'center',
      lineHeight: 22,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      padding: 24,
      borderTopWidth: 1,
      borderTopColor: '#e9ecef',
    },
    alertCancelButton: {
      backgroundColor: '#6c757d',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      flex: 1,
    },
    alertCancelButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    alertOpenButton: {
      backgroundColor: '#28a745',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      flex: 1,
    },
    alertOpenButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <IconSymbol size={24} name="arrow.left" color="#ffffff" />
      </TouchableOpacity>
      
      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingBottom: 0 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <STParkLogo size={50} color="#ffffff" showText={false} />
            </View>
            <Text style={styles.title}>Lavado de Autos</Text>
            <Text style={styles.subtitle}>Registrar nuevo lavado</Text>
          </View>

          <View style={styles.formContainer}>
            {/* Campo de Patente */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Patente del Vehículo</Text>
              <TextInput
                style={[styles.input, styles.patenteInput]}
                value={patente}
                onChangeText={setPatente}
                placeholder="Ej: ABC123"
                placeholderTextColor="#6c757d"
                autoCapitalize="characters"
                keyboardType="ascii-capable"
                maxLength={8}
              />
            </View>

            {/* Tipo de Lavado */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Tipo de Lavado</Text>
              {loadingTypes ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#043476" />
                  <Text style={styles.loadingText}>Cargando tipos...</Text>
                </View>
              ) : washTypes.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>No hay tipos de lavado disponibles</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.selectInput}
                  onPress={() => setShowTypeDropdown(true)}
                >
                  <Text style={styles.selectInputText}>
                    {selectedTypeName}
                  </Text>
                  <IconSymbol size={20} name="chevron.down" color="#6c757d" />
                </TouchableOpacity>
              )}
            </View>

            {/* Fecha y Hora - Readonly */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Fecha y Hora</Text>
              <View style={styles.dateTimeContainer}>
                <View style={styles.dateButtonReadonly}>
                  <IconSymbol name="calendar" size={20} color="#6c757d" />
                  <Text style={styles.dateButtonTextReadonly}>
                    {selectedDate.toLocaleDateString('es-CL', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}
                  </Text>
                </View>
                <View style={styles.timeButtonReadonly}>
                  <IconSymbol name="clock.fill" size={20} color="#6c757d" />
                  <Text style={styles.timeButtonTextReadonly}>
                    {selectedDate.toLocaleTimeString('es-CL', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false
                    })}
                  </Text>
                </View>
              </View>
            </View>

            {/* Monto Total */}
            {selectedWashType && (
              <View style={styles.summaryContainer}>
                <View style={styles.summaryTotal}>
                  <Text style={styles.summaryTotalLabel}>Total a Pagar:</Text>
                  <Text style={styles.summaryTotalValue}>
                    ${Math.round(selectedWashType.price).toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                  </Text>
                </View>
              </View>
            )}

            {/* Botón de Envío */}
            <TouchableOpacity
              style={[
                styles.button,
                (loading ||
                  !patente.trim() ||
                  !selectedType ||
                  loadingTypes) &&
                  styles.buttonDisabled,
              ]}
              onPress={handleCreateCarWash}
              disabled={loading || !patente.trim() || !selectedType || loadingTypes}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Registrar Lavado</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareScrollView>

      {/* Modal para seleccionar tipo de lavado */}
      <Modal
        visible={showTypeDropdown}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTypeDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTypeDropdown(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Seleccionar Tipo de Lavado</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowTypeDropdown(false)}
                >
                  <IconSymbol size={24} name="xmark.circle.fill" color="#6c757d" />
                </TouchableOpacity>
              </View>
              <ScrollView 
                style={styles.modalContent}
                contentContainerStyle={styles.modalContentContainer}
                showsVerticalScrollIndicator={true}
                bounces={true}
                keyboardShouldPersistTaps="handled"
              >
                {washTypes.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.typeItem,
                      selectedType === type.id && styles.typeItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedType(type.id);
                      setShowTypeDropdown(false);
                    }}
                  >
                    <View style={styles.typeInfo}>
                      <Text style={styles.typeName}>{type.name}</Text>
                      <Text style={styles.typeDetails}>
                        ${Math.round(type.price).toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                        {type.duration_minutes &&
                          ` • ${type.duration_minutes} min`}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radioButton,
                        selectedType === type.id && styles.radioButtonSelected,
                      ]}
                    >
                      {selectedType === type.id && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modal de selección de opción de pago */}
      <Modal
        visible={showPaymentOptionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPaymentOptionModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPaymentOptionModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.paymentOptionModalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Seleccionar Opción de Pago</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowPaymentOptionModal(false)}
                >
                  <IconSymbol size={24} name="xmark.circle.fill" color="#6c757d" />
                </TouchableOpacity>
              </View>
              <View style={styles.paymentOptionModalContent}>
                <TouchableOpacity
                  style={styles.paymentOptionButton}
                  onPress={handlePayNow}
                >
                  <IconSymbol name="creditcard.fill" size={32} color="#043476" />
                  <Text style={styles.paymentOptionText}>Pagar Ahora</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.paymentOptionButton}
                  onPress={handlePayLater}
                >
                  <IconSymbol name="clock.fill" size={32} color="#043476" />
                  <Text style={styles.paymentOptionText}>Pagar Después (al retirar)</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modal de pago de lavado de autos */}
      <CarWashPaymentModal
        visible={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setCreatedCarWash(null);
        }}
        carWash={createdCarWash}
        onSuccess={handlePaymentSuccess}
        operator={operator}
      />

      {/* Alerta de turno no abierto */}
      <Modal
        visible={showNoShiftAlert}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNoShiftAlert(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.alertHeader}>
              <IconSymbol size={64} name="exclamationmark.triangle.fill" color="#ffc107" />
              <Text style={styles.alertTitle}>Turno No Abierto</Text>
            </View>
            
            <View style={styles.modalContent}>
              <Text style={styles.alertText}>
                No tienes un turno activo. Debes abrir un turno antes de registrar lavados de autos.
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.alertCancelButton}
                onPress={() => setShowNoShiftAlert(false)}
              >
                <Text style={styles.alertCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.alertOpenButton}
                onPress={() => {
                  setShowNoShiftAlert(false);
                  setShowOpenShiftModal(true);
                }}
              >
                <Text style={styles.alertOpenButtonText}>Abrir Turno</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para abrir turno */}
      <OpenShiftModal
        visible={showOpenShiftModal}
        onClose={() => setShowOpenShiftModal(false)}
        onOpen={handleOpenShift}
        loading={openingShift}
      />
    </SafeAreaView>
  );
}
