import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { STParkLogo } from '@/components/STParkLogo';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
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
  const [showTenantConfigModal, setShowTenantConfigModal] = useState(false);
  const [tenantInput, setTenantInput] = useState('');
  const [tenantConfigLoading, setTenantConfigLoading] = useState(false);
  const [serviceCheckTimer, setServiceCheckTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const { login, operator, logout } = useAuth();
  const { tenantConfig, isLoading: tenantLoading, setTenant } = useTenant();
  const insets = useSafeAreaInsets();
  const pinInputRef = useRef<TextInput>(null);
  const tenantConfigRef = useRef({ isValid: tenantConfig.isValid, loading: tenantLoading });
  const serviceCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLongPressingRef = useRef(false);
  const modalsRef = useRef({
    showTenantConfigModal,
    showSuccessModal,
    showOperatorSelector,
  });

  // Mantener refs actualizadas
  useEffect(() => {
    tenantConfigRef.current = { isValid: tenantConfig.isValid, loading: tenantLoading };
  }, [tenantConfig.isValid, tenantLoading]);

  // Mantener refs de modales actualizadas
  useEffect(() => {
    modalsRef.current = {
      showTenantConfigModal,
      showSuccessModal,
      showOperatorSelector,
    };
  }, [showTenantConfigModal, showSuccessModal, showOperatorSelector]);

  // Gestionar modal de tenant
  useEffect(() => {
    if (!tenantLoading && !tenantConfig.isValid) {
      console.log('No hay tenant configurado, mostrando modal de configuración');
      setShowTenantConfigModal(true);
      setLoadingOperators(false);
    } else if (!tenantLoading && tenantConfig.isValid) {
      console.log('Tenant configurado correctamente:', tenantConfig.tenant);
      setShowTenantConfigModal(false);
    }
  }, [tenantLoading, tenantConfig.isValid]);

  // Detectar estado de la red
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: any) => {
      const isConnected = state.isConnected && state.isInternetReachable;
      setNetworkStatus(isConnected ? 'Conectado' : 'Desconectado');
      
      console.log('Estado de red:', isConnected ? 'Conectado' : 'Desconectado');
      
      // Si no hay red, marcar servicio como desconectado
      if (!isConnected) {
        setServiceStatus('Desconectado');
      }
      
      // Usar refs para acceder a los valores actuales
      if (isConnected && !tenantConfigRef.current.loading && tenantConfigRef.current.isValid) {
        // Iniciar timer de verificación del servicio cada 30s
        if (!serviceCheckTimerRef.current) {
          console.log('Iniciando verificación periódica del servicio cada 30s');
          const timer = setInterval(() => {
            console.log('Verificación automática del servicio...');
            loadOperators();
          }, 30000);
          serviceCheckTimerRef.current = timer;
          setServiceCheckTimer(timer);
        }
      } else {
        // Detener timer si no hay red o tenant
        if (serviceCheckTimerRef.current) {
          console.log('Deteniendo verificación del servicio');
          clearInterval(serviceCheckTimerRef.current);
          serviceCheckTimerRef.current = null;
          setServiceCheckTimer(null);
        }
        setServiceStatus('Desconectado');
      }
    });

    return () => {
      unsubscribe();
      if (serviceCheckTimerRef.current) {
        clearInterval(serviceCheckTimerRef.current);
      }
    };
  }, []); // Solo se ejecuta al montar

  // Cargar operadores al montar y cuando cambia el tenant
  useEffect(() => {
    if (!tenantLoading && tenantConfig.isValid) {
      loadOperators();
    }
  }, [tenantLoading, tenantConfig.isValid, tenantConfig.tenant]);

  // Solo verificar estado de red cuando la pantalla recibe foco
  useFocusEffect(
    React.useCallback(() => {
      console.log('=== PANTALLA DE LOGIN ENFOCADA ===');
      
      // Manejar el botón atrás de Android
      // Primero cerrar modales si están abiertos, luego prevenir navegación hacia atrás
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        // Usar refs para acceder a los valores actuales sin causar re-renders
        const modals = modalsRef.current;
        
        // Si hay un modal de tenant abierto, no permitir cerrarlo (es obligatorio)
        if (modals.showTenantConfigModal) {
          console.log('Modal de tenant abierto, no se puede cerrar');
          return true; // Prevenir acción por defecto
        }
        
        // Si hay un modal de éxito abierto, no permitir cerrarlo (debe usar el botón Continuar)
        if (modals.showSuccessModal) {
          console.log('Modal de éxito abierto, no se puede cerrar');
          return true; // Prevenir acción por defecto
        }
        
        // Si hay un modal de selector de operadores abierto, cerrarlo
        if (modals.showOperatorSelector) {
          console.log('Cerrando modal de selector de operadores');
          setShowOperatorSelector(false);
          return true; // Prevenir acción por defecto
        }
        
        // Si no hay modales abiertos, prevenir que retroceda desde el login
        // Esto hace que el login sea la primera página y no se pueda retroceder más atrás
        return true;
      });
      
      // Verificar estado de red inmediatamente
      NetInfo.fetch().then((state: any) => {
        const isConnected = state.isConnected && state.isInternetReachable;
        setNetworkStatus(isConnected ? 'Conectado' : 'Desconectado');
        console.log('Estado de red al enfocar:', isConnected ? 'Conectado' : 'Desconectado');
        
        if (!isConnected) {
          setServiceStatus('Desconectado');
        } else if (tenantConfig.isValid) {
          // Si hay red y tenant configurado, hacer una verificación del servicio
          loadOperators();
        }
      });
      
      return () => {
        console.log('=== PANTALLA DE LOGIN PERDIÓ EL FOCO ===');
        // Remover el listener cuando la pantalla pierde el foco
        backHandler.remove();
        // Limpiar el estado de los botones flotantes cuando se sale de la pantalla
        setShowFloatingButton(false);
        // Limpiar timers si existen
        if (longPressTimer) {
          clearTimeout(longPressTimer);
        }
        if (autoHideTimer) {
          clearTimeout(autoHideTimer);
        }
      };
    }, [tenantConfig.isValid, tenantConfig.tenant, longPressTimer, autoHideTimer])
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
      if (serviceCheckTimerRef.current) {
        clearInterval(serviceCheckTimerRef.current);
      }
    };
  }, [longPressTimer, autoHideTimer]);

  // Función para manejar la presión larga en la esquina inferior derecha
  const handleLongPressStart = () => {
    console.log('=== INICIANDO PRESIÓN LARGA ===');
    console.log('Timestamp:', new Date().toISOString());
    isLongPressingRef.current = true;
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
    isLongPressingRef.current = false;
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

  // Función para manejar logout
  const handleLogout = async () => {
    hideFloatingButton();
    try {
      await logout();
      // El logout ya limpia la sesión, solo necesitamos navegar al login
      router.replace('/login');
    } catch (error) {
      console.error('Error en logout:', error);
    }
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
      const success = await setTenant(tenantInput.trim());
      if (success) {
        console.log('Tenant configurado exitosamente:', tenantInput.trim());
        setShowTenantConfigModal(false);
        setTenantInput('');
        // Los operadores se recargarán automáticamente mediante useEffect
        // que depende de tenantConfig.tenant
      } else {
        Alert.alert('Error', 'No se pudo configurar el tenant');
      }
    } catch (error) {
      console.error('Error configurando tenant:', error);
      Alert.alert('Error', 'No se pudo configurar el tenant');
    } finally {
      setTenantConfigLoading(false);
    }
  };

  const loadOperators = async () => {
    // Evitar llamadas múltiples simultáneas
    if (loadingOperators) {
      console.log('Operadores ya se están cargando, omitiendo llamada duplicada');
      return;
    }
    
    // No cargar operadores si no hay tenant configurado
    if (!tenantConfig.isValid) {
      console.log('No hay tenant configurado, omitiendo carga de operadores');
      setLoadingOperators(false); // Asegurar que el estado se resetee
      return;
    }
    
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
        // Actualizar estado del servicio basado en el resultado
        setServiceStatus('Conectado');
        console.log('Operadores cargados exitosamente:', response.data.length);
        console.log('Lista de operadores:', response.data);
      } else {
        // El servicio no está funcionando correctamente
        setServiceStatus('Desconectado');
        console.error('Error en respuesta del API:', response);
        // Mostrar alerta solo si no es una verificación automática
        // (La verificación automática ocurre cada 30s, no queremos alertas cada vez)
      }
    } catch (error) {
      // El servicio no está disponible
      setServiceStatus('Desconectado');
      console.error('Error cargando operadores:', error);
      // No mostrar alertas en verificaciones automáticas
      // Solo mostraremos alertas en cargas manuales o iniciales
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
    <>
      <SafeAreaView style={styles.container}>
        <KeyboardAwareScrollView>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <STParkLogo size={60} color="#ffffff" showText={false} />
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
              <View style={[styles.serviceStatusContainer, styles.statusItem]}>
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
              
              <View style={[styles.serviceStatusContainer, styles.statusItem]}>
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
      </KeyboardAwareScrollView>

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
            
            <ScrollView 
              style={styles.modalContent}
              contentContainerStyle={styles.modalContentContainer}
              showsVerticalScrollIndicator={true}
              bounces={true}
              keyboardShouldPersistTaps="handled"
            >
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
        onRequestClose={() => {
          // El modal de éxito no se puede cerrar con el botón atrás
          // Debe usar el botón "Continuar" para proceder
        }}
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
      <Pressable
        style={[
          styles.longPressArea,
          { bottom: insets.bottom, right: 0 }
        ]}
        onPressIn={handleLongPressStart}
        onPressOut={handleLongPressEnd}
      />

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
              <Text style={styles.tenantModalTitle}>Configuración de Estacionamiento</Text>
              <Text style={styles.tenantModalDescription}>
                Para continuar, necesitas configurar el estacionamiento (identificador de la empresa) 
                que utilizarás para acceder al sistema.
              </Text>
              <View style={styles.tenantInputContainer}>
                <Text style={styles.tenantInputLabel}>Nombre del Estacionamiento</Text>
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
                  {tenantConfigLoading ? 'Configurando...' : 'Configurar Estacionamiento'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </SafeAreaView>

      {/* Botón flotante de configuración - Fijo en pantalla completamente fuera de cualquier contenedor */}
      {showFloatingButton && (
        <View style={styles.fixedButtonsWrapper} pointerEvents="box-none">
          <TouchableOpacity
            style={[
              styles.floatingButton,
              styles.floatingConfigButton,
              { 
                bottom: insets.bottom + 20, 
                right: 30
              }
            ]}
            onPress={navigateToConfig}
            activeOpacity={0.8}
          >
            <IconSymbol size={24} name="gear" color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#043476',
  },
  fixedButtonsWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    pointerEvents: 'box-none',
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
  statusItem: {
    gap: 4,
    paddingHorizontal: 12,
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 50,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    maxHeight: '60%',
    minHeight: '35%',
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
    paddingBottom: 20, // Espacio adicional al final para evitar que el contenido quede pegado
  },
  operatorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginVertical: 6,
    backgroundColor: '#f8f9fa',
    minHeight: 56, // Altura mínima para mejor usabilidad táctil
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
    width: 144, // Aumentado 20% (de 120 a 144)
    height: 144, // Aumentado 20% (de 120 a 144)
    backgroundColor: 'transparent',
    zIndex: 9999,
  },
  floatingButton: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
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
  floatingConfigButton: {
    backgroundColor: '#007AFF',
  },
  floatingLogoutButton: {
    backgroundColor: '#dc3545',
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