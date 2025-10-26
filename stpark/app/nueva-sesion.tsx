import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { STParkLogo } from '@/components/STParkLogo';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { ticketPrinterService, SessionTicketData } from '../services/ticketPrinter';
import { PaymentModal } from '@/components/PaymentModal';

export default function NuevaSesionScreen() {
  const [patente, setPatente] = useState('');
  const [calle, setCalle] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedStreetId, setSelectedStreetId] = useState<number | null>(null);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingDebts, setPendingDebts] = useState<any[]>([]);
  const [selectedDebt, setSelectedDebt] = useState<any>(null);
  const { operator } = useAuth();

  // Los datos del operador ya están cargados desde el login
  const activeSector = operator?.activeSector;
  const streets = operator?.sectorStreets || [];

  // Seleccionar automáticamente la primera calle si hay calles disponibles
  React.useEffect(() => {
    if (streets.length > 0 && !selectedStreetId) {
      const firstStreet = streets[0];
      setSelectedStreetId(firstStreet.id);
      setCalle(firstStreet.name);
      console.log('Calle seleccionada automáticamente:', firstStreet.name);
    }
  }, [streets, selectedStreetId]);

  // Función para obtener el nombre del sector usando el sector_id
  const getSectorName = (sectorId: number) => {
    if (sectorId && activeSector?.id === sectorId) {
      return activeSector.name;
    } else if (sectorId) {
      return `Sector ${sectorId}`;
    }
    return 'N/A';
  };

  // Función para calcular duración de sesión
  const calculateDuration = (startedAt: string, endedAt: string | null) => {
    const start = new Date(startedAt);
    const end = endedAt ? new Date(endedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // Función para verificar deudas pendientes
  const checkPendingDebts = async (plate: string) => {
    try {
      console.log('Verificando deudas pendientes para patente:', plate);
      const response = await apiService.getDebtsByPlate(plate);
      
      if (response.success && response.data && response.data.length > 0) {
        const pendingDebts = response.data.filter((debt: any) => debt.status === 'PENDING');
        if (pendingDebts.length > 0) {
          setPendingDebts(pendingDebts);
          setShowDebtModal(true);
          return true; // Hay deudas pendientes
        }
      }
      return false; // No hay deudas pendientes
    } catch (error) {
      console.error('Error verificando deudas:', error);
      return false;
    }
  };

  // Función para manejar éxito del pago de deuda
  const handleDebtPaymentSuccess = () => {
    setShowPaymentModal(false);
    setSelectedDebt(null);
    setShowDebtModal(false);
    setPendingDebts([]);
    // Continuar con la creación de la sesión
    createSession();
  };

  // Función para continuar sin pagar deudas
  const continueWithoutPayment = () => {
    setShowDebtModal(false);
    setPendingDebts([]);
    // Continuar con la creación de la sesión
    createSession();
  };

  // Función para liquidar deuda
  const liquidateDebt = (debt: any) => {
    setSelectedDebt(debt);
    setShowDebtModal(false);
    setShowPaymentModal(true);
  };

  // Función para crear sesión (extraída de handleCrearSesion)
  const createSession = async () => {
    setLoading(true);
    try {
      console.log('Creando sesión para patente:', patente.toUpperCase());
      console.log('Operator ID:', operator?.id);
      console.log('Sector ID:', activeSector?.id);
      console.log('Street ID:', selectedStreetId);
      
      const response = await apiService.createParkingSession({
        plate: patente.toUpperCase(),
        sector_id: activeSector?.id || 0,
        street_id: selectedStreetId || 0,
        operator_id: operator?.id || 0,
      });

      console.log('Respuesta del servidor:', response);

      if (response.success) {
        // Intentar imprimir ticket de ingreso
        console.log('Iniciando proceso de impresión de ticket...');
        
        try {
          const selectedStreet = streets.find(street => street.id === selectedStreetId);
          const ticketData: SessionTicketData = {
            type: 'INGRESO',
            plate: patente.toUpperCase(),
            sector: activeSector?.name,
            street: selectedStreet?.name,
            sectorIsPrivate: activeSector?.is_private || false,
            streetAddress: selectedStreet?.full_address || selectedStreet?.name,
            startTime: new Date().toISOString(),
            operatorName: operator?.name
          };
          
          console.log('Datos del ticket:', ticketData);
          
          const printed = await ticketPrinterService.printIngressTicket(ticketData);
          if (printed) {
            console.log('✅ Ticket de ingreso impreso exitosamente');
          } else {
            console.log('❌ No se pudo imprimir el ticket');
          }
        } catch (printError) {
          console.error('❌ Error imprimiendo ticket:', printError);
        }

        Alert.alert(
          'Sesión Creada',
          `Sesión iniciada para patente ${patente.toUpperCase()}\n\nTicket impreso automáticamente`,
          [
            {
              text: 'OK',
              onPress: () => {
                setPatente('');
                setSelectedStreetId(null);
                setCalle('');
              },
            },
          ]
        );
      } else {
        console.error('Error en respuesta:', response);
        Alert.alert('Error', response.message || 'No se pudo crear la sesión');
      }
    } catch (error) {
      console.error('Error creando sesión:', error);
      Alert.alert('Error', 'No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  // Función principal para crear sesión (con validación de deudas)
  const handleCrearSesion = async () => {
    if (!patente.trim() || !operator) {
      Alert.alert('Error', 'Por favor completa la patente');
      return;
    }

    if (!selectedStreetId) {
      Alert.alert('Error', 'Por favor selecciona una calle');
      return;
    }

    if (!activeSector) {
      Alert.alert('Error', 'No se encontró el sector del operador');
      return;
    }

    // Verificar deudas pendientes antes de crear la sesión
    const hasPendingDebts = await checkPendingDebts(patente.toUpperCase());
    
    if (!hasPendingDebts) {
      // No hay deudas pendientes, crear sesión directamente
      await createSession();
    }
    // Si hay deudas pendientes, el modal se mostrará automáticamente
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
    backButton: {
      position: 'absolute',
      top: 20,
      left: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: 20,
      padding: 10,
      zIndex: 1,
    },
    readOnlyInput: {
      borderWidth: 1,
      borderColor: '#dee2e6',
      borderRadius: 8,
      padding: 12,
      backgroundColor: '#f8f9fa',
    },
    readOnlyText: {
      fontSize: 16,
      color: '#6c757d',
    },
    streetsContainer: {
      maxHeight: 150,
      borderWidth: 1,
      borderColor: '#dee2e6',
      borderRadius: 8,
      backgroundColor: '#ffffff',
    },
    streetButton: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#e9ecef',
    },
    streetButtonSelected: {
      backgroundColor: '#043476',
    },
    streetButtonText: {
      fontSize: 16,
      color: '#000000',
    },
    streetButtonTextSelected: {
      color: '#ffffff',
      fontWeight: '600',
    },
    noStreetsContainer: {
      borderWidth: 1,
      borderColor: '#dee2e6',
      borderRadius: 8,
      padding: 20,
      backgroundColor: '#f8f9fa',
      alignItems: 'center',
    },
    noStreetsText: {
      fontSize: 14,
      color: '#6c757d',
      textAlign: 'center',
    },
    selectedStreetInfo: {
      fontSize: 12,
      color: '#28a745',
      marginTop: 8,
      fontWeight: '600',
    },
    // Estilos para modales
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
    debtWarningContainer: {
      alignItems: 'center',
      marginBottom: 24,
    },
    debtWarningTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#043476',
      marginTop: 16,
      marginBottom: 8,
      textAlign: 'center',
    },
    debtWarningText: {
      fontSize: 16,
      color: '#6c757d',
      textAlign: 'center',
      lineHeight: 22,
    },
    debtsList: {
      maxHeight: 200,
      marginBottom: 24,
    },
    debtItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#f8f9fa',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderLeftWidth: 4,
      borderLeftColor: '#ffc107',
    },
    debtInfo: {
      flex: 1,
    },
    debtHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    debtAmount: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#043476',
    },
    debtDate: {
      fontSize: 14,
      color: '#6c757d',
      marginBottom: 4,
    },
    debtLocation: {
      fontSize: 12,
      color: '#6c757d',
      marginBottom: 4,
    },
    debtDuration: {
      fontSize: 12,
      color: '#6c757d',
      fontWeight: '500',
    },
    payDebtButton: {
      backgroundColor: '#28a745',
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    payDebtButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    modalActions: {
      gap: 12,
    },
    continueButton: {
      backgroundColor: '#6c757d',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    continueButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
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
      
      <KeyboardAwareScrollView>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <STParkLogo size={50} color="#ffffff" showText={false} />
            </View>
            <Text style={styles.title}>Ingreso Vehiculo</Text>
            <Text style={styles.subtitle}>Iniciar estacionamiento</Text>
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

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Sector</Text>
              <View style={styles.readOnlyInput}>
                <Text style={styles.readOnlyText}>
                  {activeSector?.name || 'No asignado'}
                </Text>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Calle</Text>
              {streets.length === 0 ? (
                <View style={styles.noStreetsContainer}>
                  <Text style={styles.noStreetsText}>
                    No hay calles disponibles en este sector
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.streetsContainer} nestedScrollEnabled>
                  {streets.map((street) => (
                    <TouchableOpacity
                      key={street.id}
                      style={[
                        styles.streetButton,
                        selectedStreetId === street.id && styles.streetButtonSelected
                      ]}
                      onPress={() => {
                        setSelectedStreetId(street.id);
                        setCalle(street.name);
                        console.log('Calle seleccionada:', street.name, 'ID:', street.id);
                      }}
                    >
                      <Text style={[
                        styles.streetButtonText,
                        selectedStreetId === street.id && styles.streetButtonTextSelected
                      ]}>
                        {street.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              {selectedStreetId && (
                <Text style={styles.selectedStreetInfo}>
                  Calle seleccionada: {calle}
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleCrearSesion}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Creando...' : 'Iniciar Estacionamiennto'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareScrollView>

      {/* Modal de Deudas Pendientes */}
      <Modal
        visible={showDebtModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDebtModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Deudas Pendientes</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowDebtModal(false)}
              >
                <IconSymbol size={24} name="xmark.circle.fill" color="#6c757d" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <View style={styles.debtWarningContainer}>
                <IconSymbol size={48} name="exclamationmark.triangle.fill" color="#ffc107" />
                <Text style={styles.debtWarningTitle}>
                  Vehículo con Deudas Pendientes
                </Text>
                <Text style={styles.debtWarningText}>
                  La patente {patente.toUpperCase()} tiene {pendingDebts.length} deuda(s) pendiente(s):
                </Text>
              </View>

              <ScrollView style={styles.debtsList}>
                {pendingDebts.map((debt, index) => (
                  <View key={debt.id} style={styles.debtItem}>
                    <View style={styles.debtInfo}>
                      <View style={styles.debtHeader}>
                        <Text style={styles.debtAmount}>
                          ${parseFloat(debt.principal_amount).toLocaleString('es-CL')}
                        </Text>
                        <TouchableOpacity
                          style={styles.payDebtButton}
                          onPress={() => liquidateDebt(debt)}
                        >
                          <Text style={styles.payDebtButtonText}>Liquidar</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.debtDate}>
                        {new Date(debt.created_at).toLocaleDateString('es-CL')}
                      </Text>
                      {debt.parking_session && (
                        <>
                          <Text style={styles.debtLocation}>
                            {getSectorName(debt.parking_session.sector_id)}
                          </Text>
                          <Text style={styles.debtDuration}>
                            Duración: {calculateDuration(debt.parking_session.started_at, debt.parking_session.ended_at)}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.continueButton}
                  onPress={continueWithoutPayment}
                >
                  <Text style={styles.continueButtonText}>Continuar Sin Pagar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* PaymentModal para liquidar deudas */}
      <PaymentModal
        visible={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedDebt(null);
        }}
        data={selectedDebt}
        onSuccess={handleDebtPaymentSuccess}
        type="debt"
        operator={operator}
      />
    </SafeAreaView>
  );
}
