import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { STParkLogo } from '@/components/STParkLogo';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { CONFIG } from '../config/app';
import { apiService, Operator } from '../services/api';
import { tenantConfigService } from '@/services/tenantConfig';
import NetInfo from '@react-native-community/netinfo';

export default function LoginScreen() {
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingOperators, setLoadingOperators] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [operatorInfo, setOperatorInfo] = useState<any>(null);
  const [showOperatorSelector, setShowOperatorSelector] = useState(false);
  const [showFloatingButton, setShowFloatingButton] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [autoHideTimer, setAutoHideTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [serviceStatus, setServiceStatus] = useState<'Conectado' | 'Desconectado'>('Desconectado');
  const [networkStatus, setNetworkStatus] = useState<'Conectado' | 'Desconectado'>('Desconectado');
  const [serviceCheckTimer, setServiceCheckTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const [showTenantConfigModal, setShowTenantConfigModal] = useState(false);
  const [tenantInput, setTenantInput] = useState('');
  const [tenantConfigLoading, setTenantConfigLoading] = useState(false);
  const { login, operator } = useAuth();
  const { tenantConfig, isLoading: tenantLoading } = useTenant();
  const pinInputRef = useRef<TextInput>(null);

  // Cargar operadores al montar el componente
  useEffect(() => {
    loadOperators();
  }, []);

  // Mostrar modal de tenant si no está configurado
  useEffect(() => {
    if (!tenantLoading && !tenantConfig.isValid) {
      console.log('No hay tenant configurado, mostrando modal de configuración');
      setShowTenantConfigModal(true);
    } else if (!tenantLoading && tenantConfig.isValid) {
      console.log('Tenant configurado correctamente:', tenantConfig.tenant);
      setShowTenantConfigModal(false);
    }
  }, [tenantLoading, tenantConfig.isValid]);

  // Detectar estado de la red y manejar timer de verificación del servicio
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: any) => {
      const isConnected = state.isConnected && state.isInternetReachable;
      setNetworkStatus(isConnected ? 'Conectado' : 'Desconectado');
      
      console.log('Estado de red:', isConnected ? 'Conectado' : 'Desconectado');
      console.log('Tipo de conexión:', state.type);
      
      if (isConnected) {
        // Si hay red, iniciar timer de verificación del servicio cada 30s
        console.log('Iniciando verificación periódica del servicio cada 30s');
        const timer = setInterval(() => {
          console.log('Verificación automática del servicio...');
          loadOperators();
        }, 30000);
        setServiceCheckTimer(timer);
      } else {
        // Si no hay red, parar timer y marcar servicio como ERROR
        console.log('Sin conexión de red, deteniendo verificación del servicio');
        if (serviceCheckTimer) {
          clearInterval(serviceCheckTimer);
          setServiceCheckTimer(null);
        }
        setServiceStatus('Desconectado');
      }
    });

    return () => {
      unsubscribe();
      if (serviceCheckTimer) {
        clearInterval(serviceCheckTimer);
      }
    };
  }, []); // Removido serviceCheckTimer de las dependencias

  // Recargar operadores cuando se regresa de configuración
  useFocusEffect(
    React.useCallback(() => {
      console.log('=== PANTALLA DE LOGIN ENFOCADA ===');
      console.log('Timestamp:', new Date().toISOString());
      console.log('Recargando operadores...');
      loadOperators();
    }, [])
  );

  // Limpiar timers al desmontar el componente
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
      if (autoHideTimer) {
        clearTimeout(autoHideTimer);
      }
      if (serviceCheckTimer) {
        clearInterval(serviceCheckTimer);
      }
    };
  }, [longPressTimer, autoHideTimer, serviceCheckTimer]);

  // Función para manejar la presión larga en la esquina inferior derecha
  const handleLongPressStart = () => {
    console.log('=== INICIANDO PRESIÓN LARGA ===');
    console.log('Timestamp:', new Date().toISOString());
    const timer = setTimeout(() => {
      console.log('=== PRESIÓN LARGA COMPLETADA ===');
      console.log('Mostrando botón flotante');
      setShowFloatingButton(true);
      const hideTimer = setTimeout(() => {
        console.log('Auto-ocultando botón flotante después de 10s');
        setShowFloatingButton(false);
      }, 10000); // 10 segundos
      setAutoHideTimer(hideTimer);
    }, 5000); // 5 segundos
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    console.log('=== PRESIÓN LARGA CANCELADA ===');
    console.log('Timestamp:', new Date().toISOString());
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      setAutoHideTimer(null);
    }
  };

  // Función para ocultar el botón flotante
  const hideFloatingButton = () => {
    setShowFloatingButton(false);
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      setAutoHideTimer(null);
    }
  };

  // Función para navegar a configuración
  const navigateToConfig = () => {
    hideFloatingButton();
    router.push('/configuracion');
  };

  // Función para manejar el guardado del tenant
  const handleTenantSave = async () => {
    if (!tenantInput.trim()) {
      Alert.alert('Error', 'El tenant es requerido');
      return;
    }

    // Validar formato del tenant (solo letras, números y guiones)
    const tenantRegex = /^[a-zA-Z0-9-]+$/;
    if (!tenantRegex.test(tenantInput.trim())) {
      Alert.alert('Error', 'El tenant solo puede contener letras, números y guiones');
      return;
    }

    setTenantConfigLoading(true);
    try {
      await tenantConfigService.setTenant(tenantInput.trim());
      console.log('Tenant configurado exitosamente:', tenantInput.trim());
      setShowTenantConfigModal(false);
      setTenantInput('');
      // Recargar operadores después de configurar el tenant
      loadOperators();
    } catch (error) {
      console.error('Error configurando tenant:', error);
      Alert.alert('Error', 'No se pudo configurar el tenant');
    } finally {
      setTenantConfigLoading(false);
    }
  };

  const loadOperators = async () => {
    console.log('=== INICIANDO CARGA DE OPERADORES ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('URL base del servidor:', CONFIG.API_BASE_URL);
    setLoadingOperators(true);
    try {
      console.log('Llamando a apiService.getAllOperators()...');
      const response = await apiService.getAllOperators();
      console.log('Respuesta del API:', response);
      
      if (response.success && response.data) {
        setOperators(response.data);
        // Solo actualizar estado del servicio si hay red
        if (networkStatus === 'Conectado') {
          setServiceStatus('Conectado');
        }
        console.log('Operadores cargados exitosamente:', response.data.length);
        console.log('Lista de operadores:', response.data);
      } else {
        // Solo actualizar estado del servicio si hay red
        if (networkStatus === 'Conectado') {
          setServiceStatus('Desconectado');
        }
        console.error('Error en respuesta del API:', response);
        Alert.alert('Error', `No se pudieron cargar los operadores: ${response.message || 'Error desconocido'}`);
      }
    } catch (error) {
      // Solo actualizar estado del servicio si hay red
      if (networkStatus === 'Conectado') {
        setServiceStatus('Desconectado');
      }
      console.error('Error cargando operadores:', error);
      Alert.alert('Error de Red', 'No se pudo conectar con el servidor. Verifica que el backend esté ejecutándose y la IP sea correcta.');
    } finally {
      setLoadingOperators(false);
      console.log('=== FINALIZADA CARGA DE OPERADORES ===');
    }
  };

  const handleLogin = async () => {
    if (!selectedOperator) {
      Alert.alert('Error', 'Selecciona un operador');
      return;
    }

    if (!pin.trim()) {
      Alert.alert('Error', 'Ingresa tu PIN');
      return;
    }

    setLoading(true);
    try {
      const success = await login(selectedOperator.id, pin);
      if (success) {
        setOperatorInfo(operator);
        setShowSuccessModal(true);
      } else {
        Alert.alert('Error', 'Credenciales incorrectas');
      }
    } catch (error) {
      console.error('Error en login:', error);
      Alert.alert('Error', 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessConfirm = () => {
    setShowSuccessModal(false);
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <STParkLogo />
            </View>
            <Text style={styles.title}>STPark</Text>
            <Text style={styles.subtitle}>Sistema de Gestión de Estacionamientos</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Operador</Text>
              <TouchableOpacity
                style={styles.operatorSelector}
                onPress={() => setShowOperatorSelector(true)}
              >
                <Text style={[
                  styles.operatorSelectorText,
                  !selectedOperator && styles.operatorSelectorPlaceholder
                ]}>
                  {loadingOperators 
                    ? 'Cargando operadores...' 
                    : selectedOperator 
                      ? selectedOperator.name
                      : 'Selecciona un operador'
                  }
                </Text>
                <IconSymbol name="chevron.down" size={20} color="#6c757d" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>PIN de Acceso</Text>
              <TextInput
                ref={pinInputRef}
                style={[styles.input, styles.pinInput]}
                value={pin}
                onChangeText={(text) => {
                  // Solo permitir números
                  const numericText = text.replace(/[^0-9]/g, '');
                  setPin(numericText);
                }}
                placeholder="123456"
                keyboardType="numeric"
                maxLength={6}
                secureTextEntry={true}
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                (!selectedOperator || !pin.trim() || loading) && styles.buttonDisabled
              ]}
              onPress={handleLogin}
              disabled={!selectedOperator || !pin.trim() || loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Iniciando Sesión...' : 'Iniciar Sesión'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Selecciona tu operador y PIN asignado
            </Text>
            <View style={styles.statusRow}>
              <View style={styles.serviceStatusContainer}>
                <IconSymbol 
                  name={serviceStatus === 'Conectado' ? 'checkmark.circle.fill' : 'xmark.circle.fill'} 
                  size={16} 
                  color={serviceStatus === 'Conectado' ? '#28a745' : '#dc3545'} 
                />
                <Text style={styles.footerText}>
                  Servicio: 
                </Text>
                <Text style={[
                  styles.footerText,
                  { color: serviceStatus === 'Conectado' ? '#28a745' : '#dc3545' }
                ]}>
                  {serviceStatus}
                </Text>
              </View>
              
              <View style={styles.serviceStatusContainer}>
                <IconSymbol 
                  name={networkStatus === 'Conectado' ? 'wifi' : 'wifi.slash'} 
                  size={16} 
                  color={networkStatus === 'Conectado' ? '#28a745' : '#dc3545'} 
                />
                <Text style={styles.footerText}>
                  Red: 
                </Text>
                <Text style={[
                  styles.footerText,
                  { color: networkStatus === 'Conectado' ? '#28a745' : '#dc3545' }
                ]}>
                  {networkStatus}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Modal selector de operadores */}
      <Modal
        visible={showOperatorSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowOperatorSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Operador</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowOperatorSelector(false)}
              >
                <IconSymbol name="xmark" size={24} color="#6c757d" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              {operators.map((op) => (
                <TouchableOpacity
                  key={op.id}
                  style={[
                    styles.operatorItem,
                    selectedOperator?.id === op.id && styles.operatorItemSelected
                  ]}
                  onPress={() => {
                    setSelectedOperator(op);
                    setShowOperatorSelector(false);
                    // Enfocar el campo PIN después de seleccionar
                    setTimeout(() => {
                      pinInputRef.current?.focus();
                    }, 100);
                  }}
                >
                  <View style={styles.operatorItemContent}>
                    <Text style={styles.operatorItemName}>{op.name}</Text>
                  </View>
                  {selectedOperator?.id === op.id && (
                    <IconSymbol name="checkmark" size={20} color="#28a745" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de login exitoso */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContainer}>
            <View style={styles.successModalHeader}>
              <View style={styles.successIconContainer}>
                <IconSymbol name="checkmark.circle.fill" size={48} color="#28a745" />
              </View>
              <Text style={styles.successModalTitle}>¡Bienvenido!</Text>
              <Text style={styles.successModalSubtitle}>Sesión iniciada correctamente</Text>
            </View>
            
            <View style={styles.successModalContent}>
              <View style={styles.operatorInfoContainer}>
                <View style={styles.operatorInfoRow}>
                  <Text style={styles.operatorInfoLabel}>Operador:</Text>
                  <Text style={styles.operatorInfoValue}>{operatorInfo?.name}</Text>
                </View>
                <View style={styles.operatorInfoRow}>
                  <Text style={styles.operatorInfoLabel}>Email:</Text>
                  <Text style={styles.operatorInfoValue}>{operatorInfo?.email}</Text>
                </View>
                <View style={styles.operatorInfoRow}>
                  <Text style={styles.operatorInfoLabel}>Sector Activo:</Text>
                  <Text style={styles.operatorInfoValue}>
                    {operatorInfo?.activeSector?.name || 'Sin asignar'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.successModalButtons}>
                <TouchableOpacity
                  style={[styles.successModalButton, styles.successModalButtonConfirm]}
                  onPress={handleSuccessConfirm}
                >
                  <Text style={styles.successModalButtonText}>Continuar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Área invisible para detectar presión larga en esquina inferior derecha */}
      <TouchableOpacity
        style={styles.longPressArea}
        onPressIn={handleLongPressStart}
        onPressOut={handleLongPressEnd}
        activeOpacity={1}
      />

      {/* Botón flotante de configuración */}
      {showFloatingButton && (
        <TouchableOpacity
          style={styles.floatingConfigButton}
          onPress={navigateToConfig}
          activeOpacity={0.8}
        >
          <IconSymbol size={24} name="gear" color="#ffffff" />
        </TouchableOpacity>
      )}

      {/* Modal de configuración de tenant */}
      <Modal
        visible={showTenantConfigModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          console.log('No se puede cerrar el modal sin configurar el tenant');
        }}
      >
        <View style={styles.tenantModalOverlay}>
          <View style={styles.tenantModalContainer}>
            <View style={styles.tenantModalContent}>
              <Text style={styles.tenantModalTitle}>Configuración de Tenant</Text>
              <Text style={styles.tenantModalDescription}>
                Para continuar, necesitas configurar el tenant (identificador de la empresa) 
                que utilizarás para acceder al sistema.
              </Text>
              <View style={styles.tenantInputContainer}>
                <Text style={styles.tenantInputLabel}>Nombre del Tenant</Text>
                <TextInput
                  style={styles.tenantInput}
                  value={tenantInput}
                  onChangeText={setTenantInput}
                  placeholder="Ej: acme, empresa1, etc."
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!tenantConfigLoading}
                />
                <Text style={styles.tenantInputHelp}>
                  Solo se permiten letras, números y guiones
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.tenantSaveButton,
                  (!tenantInput.trim() || tenantConfigLoading) && styles.tenantSaveButtonDisabled
                ]}
                onPress={handleTenantSave}
                disabled={!tenantInput.trim() || tenantConfigLoading}
              >
                <Text style={styles.tenantSaveButtonText}>
                  {tenantConfigLoading ? 'Configurando...' : 'Configurar Tenant'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#043476',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#b3d9ff',
    textAlign: 'center',
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 12, // Reducido de 20 a 12 para menos espacio entre elementos
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 6, // Reducido de 8 a 6 para menos espacio entre label e input
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    fontSize: 16,
    color: '#ffffff',
  },
  operatorSelector: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  operatorSelectorText: {
    fontSize: 16,
    color: '#ffffff',
    flex: 1,
  },
  operatorSelectorPlaceholder: {
    color: '#b3d9ff',
  },
  pinInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 2,
  },
  button: {
    backgroundColor: '#28a745',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12, // Reducido de 20 a 12 para menos espacio
  },
  buttonDisabled: {
    backgroundColor: 'rgba(40, 167, 69, 0.5)',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  footer: {
    alignItems: 'center',
    marginTop: 20, // Reducido de 30 a 20 para menos espacio
    paddingBottom: 100, // Margen inferior para evitar que la barra de navegación oculte el contenido
  },
  footerText: {
    fontSize: 14,
    color: '#b3d9ff',
    textAlign: 'center',
  },
  serviceStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  // Estilos para modal de login exitoso
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successModalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginHorizontal: 20,
    maxWidth: 300,
  },
  successIcon: {
    marginBottom: 20,
  },
  successModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#28a745',
    marginBottom: 10,
    textAlign: 'center',
  },
  successModalSubtitle: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 20,
  },
  successModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successModalContent: {
    width: '100%',
  },
  operatorInfoContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  operatorInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  operatorInfoLabel: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  operatorInfoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  successModalButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  successModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  successModalButtonConfirm: {
    backgroundColor: '#28a745',
  },
  successModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Estilos para modal selector de operadores
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
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
  },
  operatorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginVertical: 4,
    backgroundColor: '#f8f9fa',
  },
  operatorItemSelected: {
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#2196f3',
  },
  operatorItemContent: {
    flex: 1,
  },
  operatorItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  // Estilos para área de presión larga y botón flotante
  longPressArea: {
    position: 'absolute',
    bottom: 120, // Aumentado para evitar la barra de navegación
    right: 20,
    width: 120,
    height: 120,
    backgroundColor: 'transparent',
    zIndex: 9999,
  },
  floatingConfigButton: {
    position: 'absolute',
    bottom: 140, // Aumentado para evitar la barra de navegación
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    zIndex: 10000,
  },
  // Estilos para modal de tenant
  tenantModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tenantModalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 30,
    marginHorizontal: 20,
    maxWidth: 400,
    width: '100%',
  },
  tenantModalContent: {
    alignItems: 'center',
  },
  tenantModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  tenantModalDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  tenantInputContainer: {
    width: '100%',
    marginBottom: 24,
  },
  tenantInputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  tenantInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    fontSize: 16,
    color: '#333',
  },
  tenantInputHelp: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  tenantSaveButton: {
    backgroundColor: '#28a745',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
  },
  tenantSaveButtonDisabled: {
    backgroundColor: 'rgba(40, 167, 69, 0.5)',
  },
  tenantSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});