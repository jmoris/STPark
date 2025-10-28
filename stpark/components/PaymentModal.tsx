import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { apiService } from '@/services/api';
import { ticketPrinterService, CheckoutTicketData } from '@/services/ticketPrinter';

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
    } else if (data) {
      // Mostrar el modal de método de pago cuando se abre
      setShowPaymentMethod(true);
      // Obtener cotización cuando se abre el modal
      getEstimatedQuote();
    }
  }, [visible, data]);

  // Función para obtener cotización estimada
  const getEstimatedQuote = async () => {
    if (!data) return;
    
    setLoadingQuote(true);
    try {
      let response;
      if (type === 'checkout') {
        // Para checkout, obtener cotización de la sesión
        response = await apiService.getSessionQuote(data.id);
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
        setEstimatedAmount(response.data.net_amount || response.data.gross_amount || 0);
      }
    } catch (error) {
      console.error('Error obteniendo cotización:', error);
    } finally {
      setLoadingQuote(false);
    }
  };

  // Función para manejar método de pago
  const handlePaymentMethod = (method: 'CASH' | 'CARD') => {
    setSelectedPaymentMethod(method);
    setShowPaymentMethod(false);
    
    if (method === 'CASH') {
      setShowAmountModal(true);
    } else if (method === 'CARD') {
      // Para tarjeta, pedir código de autorización
      setShowApprovalCodeModal(true);
    }
  };

  // Función para procesar pago
  const processPayment = async () => {
    if (!data || !selectedPaymentMethod) return;
    
    setProcessingPayment(true);
    try {
      let response;
      
      if (type === 'checkout') {
        // Procesar checkout de sesión
        const paymentData: any = {
          payment_method: selectedPaymentMethod,
          amount: estimatedAmount || 0,
        };

        if (selectedPaymentMethod === 'CASH' && amountPaid) {
          paymentData.amount_paid = parseFloat(amountPaid);
        } else if (selectedPaymentMethod === 'CARD' && approvalCode) {
          paymentData.approval_code = approvalCode;
        }

        response = await apiService.checkoutSession(data.id, paymentData);
      } else {
        // Procesar pago de deuda
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
          }
          
          // Crear respuesta agregada
          response = {
            success: true,
            data: {
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
            const endTime = new Date().toISOString();
            const startTime = data.started_at;
            const duration = calculateElapsedTime(startTime);
            
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
                parseFloat(amountPaid) - (estimatedAmount || 0) : undefined
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
            const paymentTime = new Date().toISOString();
            // Si hay múltiples deudas, tomar la primera para la información
            const debt = data.debts && data.debts.length > 0 ? data.debts[0] : data;
            const parkingSession = debt.parking_session || response.data.parking_session;
            
            console.log('PaymentModal - debt:', debt);
            console.log('PaymentModal - parkingSession:', parkingSession);
            console.log('PaymentModal - sector:', parkingSession?.sector);
            console.log('PaymentModal - street:', parkingSession?.street);
            
            if (parkingSession && parkingSession.started_at) {
              const startTime = parkingSession.started_at;
              const endTime = paymentTime;
              const duration = calculateElapsedTime(startTime);
              
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
                  parseFloat(amountPaid) - (estimatedAmount || 0) : undefined
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
  const calculateElapsedTime = (startedAt: string) => {
    const start = new Date(startedAt);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  if (!data) return null;

  // Función para obtener el título del modal según el tipo
  const getModalTitle = () => {
    return type === 'checkout' ? 'Procesar Checkout' : 'Pagar Deuda';
  };

  // Función para obtener información específica según el tipo
  const getDataInfo = () => {
    console.log('PaymentModal - Tipo:', type);
    console.log('PaymentModal - Data:', data);
    console.log('PaymentModal - Parking Session:', data?.parking_session);
    
    if (type === 'checkout') {
      return {
        title: 'Resumen de Sesión',
        plate: data.plate,
        location: `${data.sector?.name || 'N/A'} - ${data.street?.name || 'N/A'}`,
        time: calculateElapsedTime(data.started_at),
        amount: loadingQuote ? 'Calculando...' : 
                estimatedAmount ? `$${estimatedAmount.toLocaleString('es-CL')}` : 
                '$0'
      };
    } else {
      // Para deudas, obtener el nombre del sector usando el sector_id
      let sectorName = 'N/A';
      if (data.parking_session?.sector_id && operator?.activeSector?.id === data.parking_session.sector_id) {
        sectorName = operator.activeSector.name;
      } else if (data.parking_session?.sector_id) {
        // Si no coincide con el sector activo, usar un nombre genérico o hacer una consulta
        sectorName = `Sector ${data.parking_session.sector_id}`;
      }
      
      return {
        title: 'Resumen de Deuda',
        plate: data.plate,
        location: sectorName,
        time: new Date(data.created_at).toLocaleDateString('es-CL'),
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
    fontSize: 16,
    color: '#6c757d',
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

