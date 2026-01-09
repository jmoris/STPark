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
  ScrollView,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { apiService } from '@/services/api';
import { CONFIG } from '@/config/app';
import { ticketPrinterService, CheckoutTicketData } from '@/services/ticketPrinter';
import { getCurrentDateInSantiago } from '@/utils/dateUtils';
import { tuuPaymentsService, isDevelopmentMode } from '@/services/tuuPayments';
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
  const [showPrintTicketModal, setShowPrintTicketModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [pendingTicketData, setPendingTicketData] = useState<CheckoutTicketData | null>(null);
  const [printTicketCountdown, setPrintTicketCountdown] = useState(10);
  const [paymentSummary, setPaymentSummary] = useState<any>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'CASH' | 'CARD' | null>(null);
  const [amountPaid, setAmountPaid] = useState('');
  const [approvalCode, setApprovalCode] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [estimatedAmount, setEstimatedAmount] = useState<number | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [useTuuPosPayment, setUseTuuPosPayment] = useState<boolean>(false); // Cargado desde configuración del tenant
  const [quoteBreakdown, setQuoteBreakdown] = useState<any[] | null>(null); // Breakdown de la cotización para obtener monto mínimo
  const [availableDiscounts, setAvailableDiscounts] = useState<any[]>([]);
  const [selectedDiscountId, setSelectedDiscountId] = useState<number | null>(null);
  const [selectedDiscount, setSelectedDiscount] = useState<any | null>(null);
  const [loadingDiscounts, setLoadingDiscounts] = useState(false);
  const [discountCode, setDiscountCode] = useState('');
  const [quoteEndedAt, setQuoteEndedAt] = useState<string | null>(null); // Guardar ended_at de la cotización
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
            const printed = await ticketPrinterService.printCheckoutTicket(pendingTicketData);
            if (printed) {
              console.log('Ticket impreso exitosamente');
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
      setShowDiscountModal(false);
      setPendingTicketData(null);
      setPrintTicketCountdown(10);
      setSelectedPaymentMethod(null);
      setAmountPaid('');
      setApprovalCode('');
      setPaymentSummary(null);
      setEstimatedAmount(null);
      setQuoteBreakdown(null);
      setSelectedDiscountId(null);
      setSelectedDiscount(null);
      setDiscountCode('');
      setQuoteEndedAt(null);
      tuuPaymentProcessedRef.current = false;
      console.log('PaymentModal: Modal cerrado, reseteando estado');
    } else if (data) {
      console.log('PaymentModal: Modal abierto, reseteando tuuPaymentProcessed');
      // Resetear el ref cuando se abre el modal con nuevos datos
      tuuPaymentProcessedRef.current = false;
      // Cargar descuentos y obtener cotización cuando se abre el modal
      if (type === 'checkout') {
        loadDiscounts();
      }
      getEstimatedQuote();
      
      // Siempre mostrar el modal de método de pago primero
      // El usuario seleccionará el método y luego se procesará con TUU si corresponde
      setShowPaymentMethod(true);
    }
  }, [visible, data]);

  // Función para cargar descuentos disponibles
  const loadDiscounts = async () => {
    setLoadingDiscounts(true);
    try {
      const response = await apiService.getSessionDiscounts();
      if (response.success && response.data) {
        // Filtrar solo descuentos activos y vigentes
        const now = new Date();
        const validDiscounts = (response.data || []).filter((discount: any) => {
          if (!discount.is_active) return false;
          if (discount.valid_from && new Date(discount.valid_from) > now) return false;
          if (discount.valid_until && new Date(discount.valid_until) < now) return false;
          return true;
        });
        setAvailableDiscounts(validDiscounts);
      }
    } catch (error) {
      console.error('PaymentModal: Error cargando descuentos:', error);
    } finally {
      setLoadingDiscounts(false);
    }
  };

  // Función para obtener cotización estimada
  const getEstimatedQuote = async (discountIdOverride?: number | null, discountCodeOverride?: string) => {
    if (!data) {
      console.log('PaymentModal: No hay data para obtener cotización');
      return;
    }
    
    console.log('PaymentModal: Obteniendo cotización para:', type, 'ID:', data.id);
    setLoadingQuote(true);
    try {
      let response;
      if (type === 'checkout') {
        // Para checkout, obtener cotización de la sesión con descuento si está seleccionado
        // Usar los parámetros override si se proporcionan (para evitar problemas de timing con state)
        const activeDiscountId = discountIdOverride !== undefined ? discountIdOverride : selectedDiscountId;
        const activeDiscountCode = discountCodeOverride !== undefined ? discountCodeOverride : discountCode;
        
        const quoteParams: any = {};
        if (activeDiscountId) {
          quoteParams.discount_id = activeDiscountId;
          console.log('PaymentModal: Usando discount_id:', activeDiscountId);
        } else if (activeDiscountCode) {
          quoteParams.discount_code = activeDiscountCode;
          console.log('PaymentModal: Usando discount_code:', activeDiscountCode);
        } else {
          console.log('PaymentModal: Sin descuento aplicado');
        }
        
        console.log('PaymentModal: Llamando a getSessionQuote para sesión:', data.id, 'con params:', quoteParams);
        response = await apiService.getSessionQuote(data.id, quoteParams);
        console.log('PaymentModal: Respuesta de cotización:', response);
        
        // Log detallado de la respuesta
        if (response.success && response.data) {
          console.log('PaymentModal: Detalles de cotización:', {
            gross_amount: response.data.gross_amount,
            discount_amount: response.data.discount_amount,
            net_amount: response.data.net_amount,
            discount_id_used: activeDiscountId,
            discount_code_used: activeDiscountCode
          });
        }
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
        console.log('PaymentModal: Monto final obtenido:', amount, '(net_amount:', response.data.net_amount, ', gross_amount:', response.data.gross_amount, ')');
        setEstimatedAmount(amount);
        // Guardar breakdown para obtener monto mínimo
        if (response.data.breakdown) {
          setQuoteBreakdown(response.data.breakdown);
        }
        // Guardar ended_at de la cotización para usarlo en el checkout
        // Esto asegura que la duración calculada en checkout sea la misma que en la cotización
        if (response.data.ended_at) {
          setQuoteEndedAt(response.data.ended_at);
          console.log('PaymentModal: ended_at de cotización guardado:', response.data.ended_at);
        }
        // NO procesar automáticamente con TUU aquí
        // El pago con TUU se iniciará solo cuando el usuario seleccione "Tarjeta"
      } else {
        console.log('PaymentModal: Error en respuesta de cotización:', response);
        Alert.alert('Error', response.message || 'Error al obtener cotización');
      }
    } catch (error) {
      console.error('PaymentModal: Error obteniendo cotización:', error);
      Alert.alert('Error', 'Error al obtener cotización. Por favor intenta nuevamente.');
    } finally {
      setLoadingQuote(false);
    }
  };

  // Función para manejar cambio de descuento
  const handleDiscountChange = (discountId: number | null) => {
    console.log('PaymentModal: Cambiando descuento a:', discountId);
    
    // Actualizar estado
    setSelectedDiscountId(discountId);
    if (discountId) {
      const discount = availableDiscounts.find((d: any) => d.id === discountId);
      setSelectedDiscount(discount || null);
      setDiscountCode(''); // Limpiar código si se selecciona un descuento
      console.log('PaymentModal: Descuento seleccionado:', discount);
    } else {
      setSelectedDiscount(null);
      console.log('PaymentModal: Descuento removido');
    }
    
    // Cerrar modal de descuentos
    setShowDiscountModal(false);
    
    // Recalcular cotización con el nuevo descuento (pasar directamente el discountId para evitar problemas de timing)
    if (type === 'checkout' && data?.id) {
      getEstimatedQuote(discountId, undefined);
    }
  };

  // Función para aplicar código de descuento
  const handleApplyDiscountCode = () => {
    const code = discountCode.trim();
    if (code) {
      console.log('PaymentModal: Aplicando código de descuento:', code);
      setSelectedDiscountId(null);
      setSelectedDiscount(null);
      // Cerrar modal de descuentos
      setShowDiscountModal(false);
      // Recalcular cotización con el código (pasar directamente el código para evitar problemas de timing)
      if (type === 'checkout' && data?.id) {
        // Usar setTimeout para asegurar que el estado se actualice primero
        setTimeout(() => {
          getEstimatedQuote(null, code);
        }, 100);
      }
    }
  };

  // Función para quitar descuento
  const handleRemoveDiscount = () => {
    console.log('PaymentModal: Quitando descuento');
    setSelectedDiscountId(null);
    setSelectedDiscount(null);
    setDiscountCode('');
    // Recalcular cotización sin descuento (pasar null explícitamente)
    if (type === 'checkout' && data?.id) {
      getEstimatedQuote(null, undefined);
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
      // obtener version de la app desde expo-constants
      const version = CONFIG.VERSION;
  
      tuuPaymentData.extraData.sourceVersion = version;
      tuuPaymentData.extraData.customFields = [
        { name: 'patente', value: String(plateValue), print: false },
        { name: 'tipo', value: String(tipoValue), print: false },
      ];

      console.log('PaymentModal: Datos de pago TUU:', JSON.stringify(tuuPaymentData));
      
      // Iniciar pago con TUU directamente (sin reintentos)
      // No pasar isDevelopment para que use la configuración automática
      const isDevMode = isDevelopmentMode();
      console.log(`PaymentModal: Llamando a tuuPaymentsService.startPayment (modo ${isDevMode ? 'DEV' : 'PROD'})`);
      const tuuResult = await tuuPaymentsService.startPayment(
        tuuPaymentData
        // No pasar isDevelopment para usar la configuración automática
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
        // Usar el mismo ended_at de la cotización para que la duración sea consistente
        // Si no está disponible (no debería pasar), usar el actual
        const endedAt = quoteEndedAt || getCurrentDateInSantiago();
        console.log('PaymentModal: Usando ended_at para checkout:', endedAt, '(de cotización:', quoteEndedAt ? 'SÍ' : 'NO', ')');
        const paymentData: any = {
          payment_method: 'CARD',
          // amount ya no es necesario, el backend calcula net_amount internamente
          // Para tarjeta, el monto se cobra exactamente (no hay vuelto)
          ended_at: endedAt,
          approval_code: approvalCode || undefined,
          operator_id: operator.id, // Operador que hace el checkout (REQUERIDO)
        };

        // Agregar descuento si está seleccionado
        if (selectedDiscountId) {
          paymentData.discount_id = selectedDiscountId;
        } else if (discountCode.trim()) {
          paymentData.discount_code = discountCode.trim();
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

        // Preparar datos del ticket para mostrar modal de impresión
        try {
          if (type === 'checkout') {
            // Ticket para checkout de sesión
            const endTime = response.data.session?.ended_at || getCurrentDateInSantiago();
            const startTime = data.started_at;
            const isFullDay = data.is_full_day || response.data.session?.is_full_day || false;
            const duration = isFullDay ? 'Día completo' : calculateElapsedTime(startTime, endTime);

            // Obtener información del descuento desde la respuesta
            const sessionDiscountTuu = response.data?.session?.discount || response.data?.quote?.discount_id ? 
              (response.data?.session?.discount || null) : null;
            const quoteDataTuu = response.data?.quote || response.data?.session || {};
            
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
              // No incluir datos de pago porque TUU ya imprime el comprobante
              minAmount: getMinAmountFromBreakdown(),
              isFullDay: isFullDay,
              // Datos de descuento si está aplicado
              discountName: sessionDiscountTuu?.name || selectedDiscount?.name || undefined,
              discountDescription: sessionDiscountTuu?.description || selectedDiscount?.description || undefined,
              discountAmount: quoteDataTuu.discount_amount || response.data?.session?.discount_amount || undefined,
              grossAmount: quoteDataTuu.gross_amount || response.data?.session?.gross_amount || undefined,
              netAmount: quoteDataTuu.net_amount || response.data?.session?.net_amount || paymentAmount || undefined,
              // Datos de FacturaPi si están disponibles (para pagos en efectivo con boleta electrónica)
              ted: response.data?.payment?.ted || response.data?.ted || undefined,
              folio: response.data?.payment?.folio || undefined,
              tenantRut: response.data?.payment?.tenant_rut || undefined,
              tenantRazonSocial: response.data?.payment?.tenant_razon_social || undefined,
              tenantGiro: response.data?.payment?.tenant_giro || undefined,
              tenantDireccion: response.data?.payment?.tenant_direccion || undefined,
              tenantComuna: response.data?.payment?.tenant_comuna || undefined,
              ivaAmount: response.data?.payment?.iva_amount !== undefined ? response.data.payment.iva_amount : undefined,
              sucsii: response.data?.payment?.sucsii || undefined,
            };

            setPendingTicketData(ticketData);
            setPrintTicketCountdown(10);
            setShowPrintTicketModal(true);
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
                // No incluir datos de pago porque TUU ya imprime el comprobante
                minAmount: getMinAmountFromBreakdown(),
                isFullDay: isFullDay,
                // TED de FacturaPi si está disponible (para pagos en efectivo con boleta electrónica)
                ted: response.data?.payment?.ted || response.data?.ted || undefined,
              };
              
              setPendingTicketData(ticketData);
              setShowPrintTicketModal(true);
            } else {
              showSuccessAndClose();
            }
          }
        } catch (printError) {
          console.error('Error preparando datos del ticket:', printError);
          showSuccessAndClose();
        }
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
                  // Usar isDevelopmentMode() para detectar automáticamente el entorno
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
          // amount ya no es necesario, el backend calcula net_amount internamente
          // Solo enviar amount_paid para calcular vuelto en efectivo
          ended_at: endedAt,
          operator_id: operator.id, // Operador que hace el checkout (REQUERIDO)
        };

        // Agregar descuento si está seleccionado
        if (selectedDiscountId) {
          paymentData.discount_id = selectedDiscountId;
        } else if (discountCode.trim()) {
          paymentData.discount_code = discountCode.trim();
        }

        // Para efectivo, enviar amount_paid (monto recibido) para calcular vuelto
        // El backend calculará net_amount internamente y lo usará para crear el pago
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
            
            // Obtener información del descuento desde la respuesta
            const sessionDiscount = response.data?.session?.discount || response.data?.quote?.discount_id ? 
              (response.data?.session?.discount || null) : null;
            const quoteData = response.data?.quote || response.data?.session || {};
            
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
              // Datos de descuento si está aplicado
              discountName: sessionDiscount?.name || selectedDiscount?.name || undefined,
              discountDescription: sessionDiscount?.description || selectedDiscount?.description || undefined,
              discountAmount: quoteData.discount_amount || response.data?.session?.discount_amount || undefined,
              grossAmount: quoteData.gross_amount || response.data?.session?.gross_amount || undefined,
              netAmount: quoteData.net_amount || response.data?.session?.net_amount || estimatedAmount || undefined,
              // Datos de FacturaPi si están disponibles (para pagos en efectivo con boleta electrónica)
              ted: response.data?.payment?.ted || response.data?.ted || undefined,
              folio: response.data?.payment?.folio || undefined,
              tenantRut: response.data?.payment?.tenant_rut || undefined,
              tenantRazonSocial: response.data?.payment?.tenant_razon_social || undefined,
              tenantGiro: response.data?.payment?.tenant_giro || undefined,
              tenantDireccion: response.data?.payment?.tenant_direccion || undefined,
              tenantComuna: response.data?.payment?.tenant_comuna || undefined,
              ivaAmount: response.data?.payment?.iva_amount !== undefined ? response.data.payment.iva_amount : undefined,
              sucsii: response.data?.payment?.sucsii || undefined,
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
                // Datos de FacturaPi si están disponibles (para pagos en efectivo con boleta electrónica)
                ted: response.data?.payment?.ted || response.data?.ted || undefined,
                folio: response.data?.payment?.folio || undefined,
                tenantRut: response.data?.payment?.tenant_rut || undefined,
                ivaAmount: response.data?.payment?.iva_amount !== undefined ? response.data.payment.iva_amount : undefined,
                sucsii: response.data?.payment?.sucsii || undefined,
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
      const printed = await ticketPrinterService.printCheckoutTicket(pendingTicketData);
      if (printed) {
        console.log('Ticket impreso exitosamente');
      }
    } catch (printError) {
      console.error('Error imprimiendo ticket:', printError);
    }
    setPendingTicketData(null);
    showSuccessAndClose();
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

  // Función para obtener texto descriptivo del descuento
  const getDiscountDisplayValue = (discount: any): string => {
    const formatCurrency = (value: number) => {
      return Math.round(value).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };
    
    if (discount.discount_type === 'AMOUNT') {
      return `$${formatCurrency(discount.value || 0)}`;
    } else if (discount.discount_type === 'PERCENTAGE') {
      const maxInfo = discount.max_amount ? ` (máx: $${formatCurrency(discount.max_amount)})` : '';
      return `${discount.value || 0}%${maxInfo}`;
    } else if (discount.discount_type === 'PRICING_PROFILE') {
      const parts: string[] = [];
      if (discount.minute_value) {
        parts.push(`$ Min: $${formatCurrency(discount.minute_value)}`);
      }
      if (discount.min_amount) {
        parts.push(`Mín: $${formatCurrency(discount.min_amount)}`);
      }
      if (discount.minimum_duration) {
        parts.push(`Tpo mín: ${discount.minimum_duration} min`);
      }
      return parts.length > 0 ? parts.join(', ') : 'Perfil personalizado';
    }
    return '-';
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
                  <Text style={styles.sessionSummaryValue} numberOfLines={1}>{dataInfo.location}</Text>
                </View>
                {type === 'checkout' && data?.operator?.name && (
                  <View style={styles.sessionSummaryRow}>
                    <Text style={styles.sessionSummaryLabel}>Operador que recibió:</Text>
                    <Text style={styles.sessionSummaryValue} numberOfLines={1}>{data.operator.name}</Text>
                  </View>
                )}
                <View style={styles.sessionSummaryRow}>
                  <Text style={styles.sessionSummaryLabel}>
                    {type === 'checkout' ? 'Tiempo:' : 'Fecha:'}
                  </Text>
                  <Text style={styles.sessionSummaryValue}>{dataInfo.time}</Text>
                </View>
              </View>

              {/* Botón para aplicar descuento - Solo para checkout */}
              {type === 'checkout' && (
                <TouchableOpacity
                  style={styles.discountButton}
                  onPress={() => setShowDiscountModal(true)}
                >
                  <IconSymbol name="tag.fill" size={18} color="#007bff" />
                  <Text style={styles.discountButtonText}>
                    {selectedDiscount || discountCode ? 'Cambiar descuento' : 'Aplicar descuento'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Mostrar descuento aplicado de forma compacta - Solo para checkout */}
              {type === 'checkout' && (selectedDiscount || discountCode) && (
                <View style={styles.discountAppliedCompact}>
                  {/* Primera línea: Icono y nombre del descuento */}
                  <View style={styles.discountAppliedRow}>
                    <IconSymbol name="checkmark.circle.fill" size={14} color="#28a745" />
                    <Text style={styles.discountAppliedCompactText} numberOfLines={1}>
                      {selectedDiscount ? selectedDiscount.name : `Código: ${discountCode}`}
                    </Text>
                  </View>
                  {/* Segunda línea: Valores del descuento */}
                  {selectedDiscount && (
                    <Text style={styles.discountAppliedCompactValue} numberOfLines={1}>
                      {getDiscountDisplayValue(selectedDiscount)}
                    </Text>
                  )}
                </View>
              )}

              {/* Mostrar mensaje de recalculando */}
              {type === 'checkout' && loadingQuote && (
                <Text style={styles.discountRecalculatingText}>
                  Recalculando con descuento...
                </Text>
              )}

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

      {/* Modal de Descuentos - Solo para checkout */}
      {type === 'checkout' && (
        <Modal
          visible={showDiscountModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowDiscountModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Aplicar Descuento</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowDiscountModal(false)}
                >
                  <IconSymbol size={24} name="xmark.circle.fill" color="#6c757d" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalContent}>
                {loadingDiscounts ? (
                  <Text style={styles.discountLoadingText}>Cargando descuentos...</Text>
                ) : (
                  <>
                    {/* Selector de descuentos */}
                    <View style={styles.discountSelectorContainer}>
                      <Text style={styles.discountLabel}>Seleccionar descuento:</Text>
                      <ScrollView style={styles.discountList} nestedScrollEnabled>
                        <TouchableOpacity
                          style={[
                            styles.discountOption,
                            selectedDiscountId === null && styles.discountOptionSelected
                          ]}
                          onPress={() => handleDiscountChange(null)}
                        >
                          <Text style={[
                            styles.discountOptionText,
                            selectedDiscountId === null && styles.discountOptionTextSelected
                          ]}>
                            Ninguno
                          </Text>
                          {selectedDiscountId === null && (
                            <IconSymbol name="checkmark.circle.fill" size={20} color="#28a745" />
                          )}
                        </TouchableOpacity>
                        {availableDiscounts.map((discount: any) => (
                          <TouchableOpacity
                            key={discount.id}
                            style={[
                              styles.discountOption,
                              selectedDiscountId === discount.id && styles.discountOptionSelected
                            ]}
                            onPress={() => handleDiscountChange(discount.id)}
                          >
                            <View style={styles.discountOptionContent}>
                              <Text style={[
                                styles.discountOptionText,
                                selectedDiscountId === discount.id && styles.discountOptionTextSelected
                              ]}>
                                {discount.name}
                              </Text>
                              {discount.description && (
                                <Text style={styles.discountOptionDescription}>
                                  {discount.description}
                                </Text>
                              )}
                              <Text style={styles.discountOptionSubtext}>
                                {getDiscountDisplayValue(discount)}
                              </Text>
                            </View>
                            {selectedDiscountId === discount.id && (
                              <IconSymbol name="checkmark.circle.fill" size={20} color="#28a745" />
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>

                    {/* Separador */}
                    <View style={styles.discountDivider}>
                      <View style={styles.discountDividerLine} />
                      <Text style={styles.discountDividerText}>O</Text>
                      <View style={styles.discountDividerLine} />
                    </View>

                    {/* Campo para código de descuento */}
                    <View style={styles.discountCodeContainer}>
                      <Text style={styles.discountLabel}>Ingresar código de descuento:</Text>
                      <View style={styles.discountCodeInputContainer}>
                        <TextInput
                          style={styles.discountCodeInput}
                          value={discountCode}
                          onChangeText={setDiscountCode}
                          placeholder="Ingresa código"
                          placeholderTextColor="#6c757d"
                          autoCapitalize="characters"
                        />
                        <TouchableOpacity
                          style={[
                            styles.discountCodeButton,
                            discountCode.trim() && styles.discountCodeButtonActive
                          ]}
                          onPress={handleApplyDiscountCode}
                          disabled={!discountCode.trim()}
                        >
                          <IconSymbol 
                            name="checkmark" 
                            size={18} 
                            color={discountCode.trim() ? "#fff" : "#6c757d"} 
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Botón para quitar descuento si hay uno aplicado */}
                    {(selectedDiscount || discountCode) && (
                      <TouchableOpacity
                        style={styles.removeDiscountButton}
                        onPress={handleRemoveDiscount}
                      >
                        <IconSymbol name="xmark.circle.fill" size={18} color="#dc3545" />
                        <Text style={styles.removeDiscountButtonText}>Quitar descuento</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}
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
    marginBottom: 12,
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
  // Estilos para selector de descuentos
  discountSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  discountSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#043476',
    marginBottom: 12,
  },
  discountLoadingText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    paddingVertical: 8,
  },
  discountSelectorContainer: {
    marginBottom: 12,
  },
  discountLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#043476',
    marginBottom: 8,
  },
  discountList: {
    maxHeight: 150,
    marginBottom: 8,
  },
  discountOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  discountOptionSelected: {
    backgroundColor: '#e7f3ff',
    borderColor: '#007bff',
    borderWidth: 2,
  },
  discountOptionContent: {
    flex: 1,
  },
  discountOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#043476',
    marginBottom: 4,
  },
  discountOptionTextSelected: {
    color: '#007bff',
  },
  discountOptionSubtext: {
    fontSize: 12,
    color: '#6c757d',
  },
  discountCodeContainer: {
    marginTop: 12,
  },
  discountCodeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  discountCodeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  discountCodeButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  discountInfoContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#e7f3ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#b3d9ff',
  },
  discountInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  discountInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007bff',
  },
  discountInfoDescription: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
  },
  discountRecalculatingText: {
    fontSize: 12,
    color: '#007bff',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  // Estilos compactos para descuento
  discountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#e7f3ff',
    borderWidth: 1,
    borderColor: '#007bff',
    marginTop: 8,
    marginBottom: 6,
  },
  discountButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007bff',
  },
  discountAppliedCompact: {
    flexDirection: 'column',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#d4edda',
    borderWidth: 1,
    borderColor: '#28a745',
    marginBottom: 8,
    gap: 4,
  },
  discountAppliedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  discountAppliedCompactText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#155724',
  },
  discountAppliedCompactValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#155724',
    marginLeft: 18, // Alinear con el texto de arriba (icono 14px + gap 4px)
  },
  discountDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  discountDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#dee2e6',
  },
  discountDividerText: {
    marginHorizontal: 12,
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  discountOptionDescription: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
    marginBottom: 4,
  },
  removeDiscountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f8d7da',
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  removeDiscountButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc3545',
  },
  discountCodeButtonActive: {
    backgroundColor: '#28a745',
  },
});

