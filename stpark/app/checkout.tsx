import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { router } from 'expo-router';
import { apiService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { ticketPrinterService, CheckoutTicketData } from '@/services/ticketPrinter';
import { PaymentModal } from '@/components/PaymentModal';

export default function CheckoutScreen() {
  const { operator } = useAuth();
  const [patente, setPatente] = useState('');
  const [loading, setLoading] = useState(false);
  const [sesionEncontrada, setSesionEncontrada] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [estimatedAmount, setEstimatedAmount] = useState<number | null>(null);

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

  // Función para obtener cotización estimada
  const getEstimatedQuote = async (sessionId: number) => {
    setLoadingQuote(true);
    try {
      const response = await apiService.getSessionQuote(sessionId);
      if (response.success && response.data) {
        setEstimatedAmount(response.data.net_amount || response.data.gross_amount || 0);
      }
    } catch (error) {
      console.error('Error obteniendo cotización:', error);
    } finally {
      setLoadingQuote(false);
    }
  };

  const buscarSesion = async () => {
    if (!patente.trim()) {
      Alert.alert('Error', 'Por favor ingresa la patente del vehículo');
      return;
    }

    setLoading(true);
    try {
      console.log('Buscando sesión activa para patente:', patente);
      const response = await apiService.getActiveSessionByPlate(patente.toUpperCase());
      
      if (response.success && response.data) {
        console.log('Sesión encontrada:', response.data);
        setSesionEncontrada(response.data);
        // Obtener cotización estimada
        await getEstimatedQuote(response.data.id);
      } else {
        Alert.alert('No encontrado', 'No se encontró una sesión activa para esta patente');
        setSesionEncontrada(null);
        setEstimatedAmount(null);
      }
    } catch (error) {
      console.error('Error buscando sesión:', error);
      Alert.alert('Error', 'No se pudo conectar con el servidor');
      setSesionEncontrada(null);
      setEstimatedAmount(null);
    } finally {
      setLoading(false);
    }
  };

  const procesarCheckout = () => {
    if (!sesionEncontrada) return;
    setShowPaymentModal(true);
  };

  // Función para manejar éxito del pago
  const handlePaymentSuccess = (result?: any) => {
    // Limpiar estado después del pago exitoso
    setSesionEncontrada(null);
    setPatente('');
    setEstimatedAmount(null);
    setShowPaymentModal(false);
  };


  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#043476',
    },
    content: {
      flexGrow: 1,
      padding: 20,
    },
    header: {
      alignItems: 'center',
      marginBottom: 40,
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
    iconContainer: {
      alignItems: 'center',
      marginBottom: 20,
    },
    formContainer: {
      backgroundColor: '#ffffff',
      borderRadius: 16,
      padding: 20,
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
    },
    button: {
      backgroundColor: '#043476',
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 20,
    },
    buttonDisabled: {
      backgroundColor: '#6c757d',
    },
    buttonText: {
      color: 'white',
      fontSize: 18,
      fontWeight: 'bold',
    },
    checkoutButton: {
      backgroundColor: '#28a745',
    },
    sesionCard: {
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#dee2e6',
      borderRadius: 16,
      padding: 20,
      marginTop: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
    },
    sesionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#043476',
      marginBottom: 15,
      textAlign: 'center',
    },
    sesionInfo: {
      marginBottom: 10,
    },
    sesionLabel: {
      fontSize: 14,
      color: '#6c757d',
      marginBottom: 2,
    },
    sesionValue: {
      fontSize: 16,
      fontWeight: '600',
      color: '#000000',
    },
    montoContainer: {
      backgroundColor: '#043476',
      padding: 15,
      borderRadius: 8,
      marginTop: 15,
    },
    montoText: {
      color: 'white',
      fontSize: 20,
      fontWeight: 'bold',
      textAlign: 'center',
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
    // Estilos del modal de pago
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
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
      shadowRadius: 12,
      elevation: 12,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 24,
      borderBottomWidth: 1,
      borderBottomColor: '#e9ecef',
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#043476',
    },
    modalCloseButton: {
      padding: 8,
    },
    modalContent: {
      padding: 24,
    },
    sessionSummary: {
      backgroundColor: '#f8f9fa',
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
    },
    sessionSummaryTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#043476',
      marginBottom: 16,
    },
    sessionSummaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sessionSummaryLabel: {
      fontSize: 16,
      color: '#6c757d',
    },
    sessionSummaryValue: {
      fontSize: 16,
      fontWeight: '600',
      color: '#000000',
    },
    paymentMethodTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#043476',
      marginBottom: 20,
      textAlign: 'center',
    },
    paymentMethodsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      marginBottom: 24,
    },
    paymentMethodButton: {
      alignItems: 'center',
      padding: 24,
      borderRadius: 16,
      backgroundColor: '#f8f9fa',
      borderWidth: 2,
      borderColor: '#e9ecef',
      width: 140,
      height: 120,
    },
    paymentMethodText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#043476',
      marginTop: 12,
      textAlign: 'center',
    },
    loadingContainer: {
      alignItems: 'center',
      padding: 20,
    },
    loadingText: {
      fontSize: 18,
      color: '#6c757d',
      fontWeight: '600',
    },
    // Estilos del modal de monto
    amountModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    amountModalContainer: {
      backgroundColor: '#ffffff',
      borderRadius: 20,
      width: '90%',
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 12,
    },
    amountModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 24,
      borderBottomWidth: 1,
      borderBottomColor: '#e9ecef',
    },
    amountModalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#043476',
    },
    amountModalCloseButton: {
      padding: 8,
    },
    amountModalContent: {
      padding: 24,
    },
    amountInputContainer: {
      marginBottom: 20,
    },
    amountInputLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: '#043476',
      marginBottom: 12,
    },
    amountInputHint: {
      fontSize: 12,
      color: '#6c757d',
      marginTop: 8,
      fontStyle: 'italic',
    },
    amountInput: {
      borderWidth: 2,
      borderColor: '#e9ecef',
      borderRadius: 12,
      padding: 16,
      fontSize: 18,
      backgroundColor: '#f8f9fa',
      textAlign: 'center',
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    amountInputFocused: {
      borderColor: '#043476',
      backgroundColor: '#ffffff',
    },
    debtAmountInfo: {
      backgroundColor: '#f8f9fa',
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
    },
    debtAmountText: {
      fontSize: 16,
      color: '#6c757d',
      textAlign: 'center',
    },
    debtAmountValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#043476',
      textAlign: 'center',
      marginTop: 4,
    },
    amountModalButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 20,
    },
    amountModalButton: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      marginHorizontal: 8,
    },
    amountModalButtonCancel: {
      backgroundColor: '#6c757d',
    },
    amountModalButtonConfirm: {
      backgroundColor: '#28a745',
    },
    amountModalButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
    },
    // Estilos para modal de vuelto
    changeModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    changeModalContainer: {
      backgroundColor: '#ffffff',
      borderRadius: 24,
      width: '95%',
      maxWidth: 450,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 10,
    },
    changeModalHeader: {
      alignItems: 'center',
      paddingTop: 32,
      paddingHorizontal: 24,
      paddingBottom: 20,
    },
    successIconContainer: {
      marginBottom: 16,
    },
    changeModalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#043476',
      marginBottom: 8,
      textAlign: 'center',
    },
    changeModalSubtitle: {
      fontSize: 16,
      color: '#6c757d',
      textAlign: 'center',
    },
    changeModalContent: {
      paddingHorizontal: 24,
      paddingBottom: 32,
    },
    paymentSummaryContainer: {
      backgroundColor: '#f8f9fa',
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
    },
    paymentSummaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    paymentSummaryLabel: {
      fontSize: 16,
      color: '#6c757d',
      fontWeight: '500',
    },
    paymentSummaryValue: {
      fontSize: 16,
      color: '#043476',
      fontWeight: '600',
    },
    changeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#e8f5e8',
      padding: 16,
      borderRadius: 12,
      marginTop: 8,
      borderWidth: 2,
      borderColor: '#28a745',
    },
    changeLabel: {
      fontSize: 18,
      color: '#28a745',
      fontWeight: 'bold',
    },
    changeValue: {
      fontSize: 24,
      color: '#28a745',
      fontWeight: 'bold',
    },
    changeModalButtons: {
      flexDirection: 'row',
      justifyContent: 'center',
    },
    changeModalButton: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    changeModalButtonConfirm: {
      backgroundColor: '#28a745',
    },
    changeModalButtonText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#ffffff',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <IconSymbol size={24} name="arrow.left" color="#ffffff" />
      </TouchableOpacity>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={true}
          bounces={true}
        >
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <IconSymbol size={50} name="checkmark.circle.fill" color="#ffffff" />
            </View>
            <Text style={styles.title}>Checkout</Text>
            <Text style={styles.subtitle}>Finalizar estacionamiento</Text>
          </View>

          <View style={styles.formContainer}>
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

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={buscarSesion}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Buscando...' : 'Buscar Sesión'}
              </Text>
            </TouchableOpacity>
          </View>

          {sesionEncontrada && (
            <View style={styles.sesionCard}>
              <Text style={styles.sesionTitle}>Sesión Encontrada</Text>
              
              <View style={styles.sesionInfo}>
                <Text style={styles.sesionLabel}>Patente:</Text>
                <Text style={styles.sesionValue}>{sesionEncontrada.plate}</Text>
              </View>
              
              <View style={styles.sesionInfo}>
                <Text style={styles.sesionLabel}>Inicio:</Text>
                <Text style={styles.sesionValue}>
                  {new Date(sesionEncontrada.started_at).toLocaleString('es-CL')}
                </Text>
              </View>
              
              <View style={styles.sesionInfo}>
                <Text style={styles.sesionLabel}>Ubicación:</Text>
                <Text style={styles.sesionValue}>
                  {sesionEncontrada.sector?.name || 'N/A'} - {sesionEncontrada.street?.name || 'N/A'}
                </Text>
              </View>
              
              <View style={styles.sesionInfo}>
                <Text style={styles.sesionLabel}>Tiempo transcurrido:</Text>
                <Text style={styles.sesionValue}>
                  {calculateElapsedTime(sesionEncontrada.started_at)}
                </Text>
              </View>
              
              <View style={styles.montoContainer}>
                <Text style={styles.montoText}>
                  Monto a Pagar: {
                    loadingQuote ? 'Calculando...' : 
                    estimatedAmount ? `$${estimatedAmount.toLocaleString('es-CL')}` : 
                    '$0'
                  }
                </Text>
              </View>
              
              <TouchableOpacity
                style={[styles.button, styles.checkoutButton]}
                onPress={procesarCheckout}
              >
                <Text style={styles.buttonText}>
                  Procesar Checkout
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* PaymentModal unificado */}
      <PaymentModal
        visible={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        data={sesionEncontrada}
        onSuccess={handlePaymentSuccess}
        type="checkout"
        operator={operator}
      />
    </SafeAreaView>
  );
}
