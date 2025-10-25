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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { router } from 'expo-router';
import { apiService } from '../services/api';
import { PaymentModal } from '@/components/PaymentModal';

export default function ConsultasScreen() {
  const [patente, setPatente] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<any>(null);
  const [tipoConsulta, setTipoConsulta] = useState<'sesiones' | 'deudas'>('sesiones');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<any>(null);

  const buscarInformacion = async () => {
    if (!patente.trim()) {
      Alert.alert('Error', 'Por favor ingresa la patente del vehículo');
      return;
    }

    setLoading(true);
    try {
      console.log('Buscando información para patente:', patente.toUpperCase());
      console.log('Tipo de consulta:', tipoConsulta);
      
      if (tipoConsulta === 'sesiones') {
        const response = await apiService.getSessionsByPlate(patente.toUpperCase());
        console.log('Respuesta sesiones:', response);
        
        if (response.success && response.data) {
          setResultados(response.data);
        } else {
          Alert.alert('Error', response.message || 'No se pudieron obtener las sesiones');
          setResultados([]);
        }
      } else {
        const response = await apiService.getDebtsByPlate(patente.toUpperCase());
        console.log('Respuesta deudas:', response);
        
        if (response.success && response.data) {
          setResultados(response.data);
        } else {
          Alert.alert('Error', response.message || 'No se pudieron obtener las deudas');
          setResultados([]);
        }
      }
    } catch (error) {
      console.error('Error en consulta:', error);
      Alert.alert('Error', 'No se pudo conectar con el servidor');
      setResultados(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePayDebt = async (debt: any) => {
    setSelectedDebt(debt);
    setShowPaymentModal(true);
  };

  // Función para manejar éxito del pago
  const handlePaymentSuccess = (result?: any) => {
    // Recargar las deudas para mostrar el estado actualizado
    buscarInformacion();
    setShowPaymentModal(false);
    setSelectedDebt(null);
  };

  const renderResults = () => {
    if (!resultados) return null;

    return (
      <View style={styles.resultadosContainer}>
        <Text style={styles.resultadosTitle}>
          {tipoConsulta === 'sesiones' ? 'Sesiones Encontradas' : 'Deudas Encontradas'}
        </Text>
        
        {resultados.length > 0 ? (
          resultados
            .sort((a: any, b: any) => {
              if (tipoConsulta === 'sesiones') {
                return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
              } else {
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              }
            })
            .map((item: any) => (
            <View key={item.id} style={styles.resultCard}>
              {tipoConsulta === 'sesiones' ? (
                <>
                  <View style={styles.resultHeader}>
                    <Text style={styles.resultTitle}>Sesión #{item.id}</Text>
                    <Text style={[styles.statusBadge, item.status === 'COMPLETED' ? styles.statusFinalized : styles.statusActive]}>
                      {item.status === 'COMPLETED' ? 'Finalizada' : 'Activa'}
                    </Text>
                  </View>
                  
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultLabel}>Patente:</Text>
                    <Text style={styles.resultValue}>{item.plate}</Text>
                  </View>
                  
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultLabel}>Inicio:</Text>
                    <Text style={styles.resultValue}>{new Date(item.started_at).toLocaleString('es-CL')}</Text>
                  </View>
                  
                  {item.finished_at && (
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultLabel}>Fin:</Text>
                      <Text style={styles.resultValue}>{new Date(item.finished_at).toLocaleString('es-CL')}</Text>
                    </View>
                  )}
                  
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultLabel}>Ubicación:</Text>
                    <Text style={styles.resultValue}>
                      {item.sector?.name || 'N/A'} - {item.street?.name || 'N/A'}
                    </Text>
                  </View>
                  
                  {item.total_amount && (
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultLabel}>Monto:</Text>
                      <Text style={styles.resultValue}>${item.total_amount.toLocaleString('es-CL')}</Text>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <View style={styles.resultHeader}>
                    <Text style={styles.resultTitle}>Deuda #{item.id}</Text>
                    <Text style={[styles.statusBadge, item.status === 'SETTLED' ? styles.statusFinalized : styles.statusPending]}>
                      {item.status === 'SETTLED' ? 'Pagada' : 'Pendiente'}
                    </Text>
                  </View>
                  
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultLabel}>Patente:</Text>
                    <Text style={styles.resultValue}>{item.plate}</Text>
                  </View>
                  
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultLabel}>Fecha:</Text>
                    <Text style={styles.resultValue}>{new Date(item.created_at).toLocaleDateString('es-CL')}</Text>
                  </View>
                  
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultLabel}>Origen:</Text>
                    <Text style={styles.resultValue}>{item.origin === 'SESSION' ? 'Sesión de Estacionamiento' : 'Manual'}</Text>
                  </View>
                  
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultLabel}>Monto:</Text>
                    <Text style={styles.resultValue}>${parseFloat(item.principal_amount).toLocaleString('es-CL')}</Text>
                  </View>
                  
                  {item.settled_at && (
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultLabel}>Pagada el:</Text>
                      <Text style={styles.resultValue}>{new Date(item.settled_at).toLocaleString('es-CL')}</Text>
                    </View>
                  )}
                  
                  {item.parking_session && (
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultLabel}>Sesión:</Text>
                      <Text style={styles.resultValue}>#{item.parking_session.id} - {item.parking_session.sector?.name || 'N/A'}</Text>
                    </View>
                  )}
                  
                  {item.status === 'PENDING' && (
                    <TouchableOpacity
                      style={styles.payButton}
                      onPress={() => handlePayDebt(item)}
                    >
                      <Text style={styles.payButtonText}>Pagar Deuda</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No se encontraron {tipoConsulta === 'sesiones' ? 'sesiones' : 'deudas'} para esta patente
            </Text>
          </View>
        )}
      </View>
    );
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
    tipoConsultaContainer: {
      flexDirection: 'row',
      marginBottom: 20,
      backgroundColor: '#ffffff',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#dee2e6',
    },
    tipoConsultaButton: {
      flex: 1,
      padding: 12,
      alignItems: 'center',
    },
    tipoConsultaButtonActive: {
      backgroundColor: '#043476',
    },
    tipoConsultaText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#6c757d',
    },
    tipoConsultaTextActive: {
      color: 'white',
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
    resultadosContainer: {
      marginTop: 20,
    },
    resultadosTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#043476',
      marginBottom: 15,
    },
    resultCard: {
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#dee2e6',
      borderRadius: 16,
      padding: 15,
      marginBottom: 15,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
    },
    resultHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    resultTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#043476',
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 'bold',
    },
    statusCompleted: {
      backgroundColor: '#28a745',
      color: 'white',
    },
    statusFinalized: {
      backgroundColor: '#6c757d',
      color: 'white',
    },
    statusActive: {
      backgroundColor: '#007bff',
      color: 'white',
    },
    statusPending: {
      backgroundColor: '#ffc107',
      color: 'black',
    },
    resultInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 5,
    },
    resultLabel: {
      fontSize: 14,
      color: '#6c757d',
      flex: 1,
    },
    resultValue: {
      fontSize: 14,
      fontWeight: '600',
      color: '#000000',
      flex: 2,
      textAlign: 'right',
    },
    emptyState: {
      alignItems: 'center',
      padding: 40,
    },
    emptyStateText: {
      fontSize: 16,
      color: '#6c757d',
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
    payButton: {
      backgroundColor: '#28a745',
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 12,
    },
    payButtonDisabled: {
      backgroundColor: '#6c757d',
    },
    payButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
    },
    // Estilos del modal
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
    debtSummary: {
      backgroundColor: '#f8f9fa',
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
    },
    debtSummaryTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#043476',
      marginBottom: 16,
    },
    debtSummaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    debtSummaryLabel: {
      fontSize: 16,
      color: '#6c757d',
    },
    debtSummaryValue: {
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
              <IconSymbol size={50} name="magnifyingglass.circle.fill" color="#ffffff" />
            </View>
            <Text style={styles.title}>Consultas</Text>
            <Text style={styles.subtitle}>Buscar por patente</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.tipoConsultaContainer}>
              <TouchableOpacity
                style={[styles.tipoConsultaButton, tipoConsulta === 'sesiones' && styles.tipoConsultaButtonActive]}
                onPress={() => setTipoConsulta('sesiones')}
              >
                <Text style={[styles.tipoConsultaText, tipoConsulta === 'sesiones' && styles.tipoConsultaTextActive]}>
                  Sesiones
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tipoConsultaButton, tipoConsulta === 'deudas' && styles.tipoConsultaButtonActive]}
                onPress={() => setTipoConsulta('deudas')}
              >
                <Text style={[styles.tipoConsultaText, tipoConsulta === 'deudas' && styles.tipoConsultaTextActive]}>
                  Deudas
                </Text>
              </TouchableOpacity>
            </View>

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
              onPress={buscarInformacion}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Buscando...' : `Buscar ${tipoConsulta === 'sesiones' ? 'Sesiones' : 'Deudas'}`}
              </Text>
            </TouchableOpacity>
          </View>

          {renderResults()}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* PaymentModal unificado */}
      <PaymentModal
        visible={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        data={selectedDebt}
        onSuccess={handlePaymentSuccess}
        type="debt"
      />
        </SafeAreaView>
      );
    }
