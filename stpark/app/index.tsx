import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { STParkLogo } from '@/components/STParkLogo';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { router, Link } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { tenantConfigService } from '../services/tenantConfig';
import { apiService } from '@/services/api';
import { PaymentModal } from '@/components/PaymentModal';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativePosPrinter, { ThermalPrinterDevice } from 'react-native-thermal-pos-printer';

export default function HomeScreen() {
  const [resumenExpandido, setResumenExpandido] = useState(false);
  const [dailyStats, setDailyStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showActiveSessionsModal, setShowActiveSessionsModal] = useState(false);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [loadingActiveSessions, setLoadingActiveSessions] = useState(false);
  const [showDebtsModal, setShowDebtsModal] = useState(false);
  const [debtsByPlate, setDebtsByPlate] = useState<any[]>([]);
  const [loadingDebts, setLoadingDebts] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [printerConnecting, setPrinterConnecting] = useState(false);
  const [printerInfo, setPrinterInfo] = useState<string>('');
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [showTenantConfigModal, setShowTenantConfigModal] = useState(false);
  const [tenantInput, setTenantInput] = useState('');
  const [tenantConfigLoading, setTenantConfigLoading] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editProfileName, setEditProfileName] = useState('');
  const [editProfilePin, setEditProfilePin] = useState('');
  const [editProfileLoading, setEditProfileLoading] = useState(false);
  const { operator, logout, updateOperator } = useAuth();
  const { tenantConfig, isLoading: tenantLoading, setTenant, refreshTenantConfig } = useTenant();

  // Verificar si hay tenant configurado al cargar la pantalla
  useEffect(() => {
    if (!tenantLoading && !tenantConfig.isValid) {
      console.log('No hay tenant configurado, mostrando modal de configuración');
      setShowTenantConfigModal(true);
    } else if (!tenantLoading && tenantConfig.isValid) {
      console.log('Tenant configurado correctamente:', tenantConfig.tenant);
      setShowTenantConfigModal(false);
    }
  }, [tenantLoading, tenantConfig.isValid]);


  // Función para manejar la configuración del tenant desde el modal
  const handleTenantSave = async () => {
    if (!tenantInput.trim()) {
      alert('El tenant es requerido');
      return;
    }

    if (tenantInput.trim().length < 2) {
      alert('El tenant debe tener al menos 2 caracteres');
      return;
    }

    // Validar que solo contenga letras, números y guiones
    const tenantRegex = /^[a-zA-Z0-9-_]+$/;
    if (!tenantRegex.test(tenantInput.trim())) {
      alert('Solo se permiten letras, números y guiones');
      return;
    }

    setTenantConfigLoading(true);

    try {
      // Usar el servicio directamente como en configuración
      await tenantConfigService.setTenant(tenantInput.trim());
      console.log('Tenant configurado exitosamente:', tenantInput.trim());
      
      // Actualizar el contexto manualmente
      await refreshTenantConfig();
      
      setShowTenantConfigModal(false);
      setTenantInput('');
      
      // Esperar un momento para que el contexto se actualice
      setTimeout(async () => {
        // Recargar todos los datos con el nuevo tenant
        console.log('Recargando datos con el nuevo tenant...');
        await loadDailyStats();
        await loadActiveSessions();
        await loadSelectedPrinter();
      }, 500);
      
    } catch (error) {
      console.error('Error configurando tenant:', error);
      alert('Error al configurar el tenant');
    } finally {
      setTenantConfigLoading(false);
    }
  };

  // Función para cargar la impresora seleccionada guardada
  const loadSelectedPrinter = async () => {
    try {
      const savedPrinter = await AsyncStorage.getItem('selectedPrinter');
      if (savedPrinter) {
        try {
          const savedPrinterObject = JSON.parse(savedPrinter);
          console.log("Impresora guardada:", savedPrinterObject);
          
          // Verificar si la impresora realmente está conectada
          try {
            const devices = await ReactNativePosPrinter.getDeviceList();
            console.log("Dispositivos disponibles:", devices);
            
            // Buscar el dispositivo por dirección MAC
            const connectedDevice = devices.find((d: any) => {
              const deviceAddress = d.device?.address || d.address || d.macAddress;
              return deviceAddress === savedPrinterObject.address;
            });
            
            console.log("Dispositivo encontrado:", connectedDevice);
            
            if (connectedDevice) {
              // Crear instancia de ThermalPrinterDevice para poder usar sus métodos
              try {
                const nativeDevice = (connectedDevice as any).device || connectedDevice;
                console.log('Dispositivo nativo:', nativeDevice);
                
                // Validar que tenga las propiedades necesarias
                if (!nativeDevice.address || !nativeDevice.name) {
                  console.error('Dispositivo nativo no tiene las propiedades necesarias');
                  setPrinterConnected(false);
                  setPrinterInfo('Error de configuración');
                  return;
                }
                
                // Crear instancia de ThermalPrinterDevice
                const printerDevice = new ThermalPrinterDevice(nativeDevice);
                console.log('Instancia de ThermalPrinterDevice creada');
                
                // Verificar si está conectada
                const isConnected = await printerDevice.checkConnectionStatus();
                console.log("Estado de conexión:", isConnected);
                
                if (isConnected) {
                  console.log("Impresora ya está conectada, no es necesario reconectar");
                  setPrinterConnected(true);
                  setPrinterInfo(savedPrinterObject.name || 'Impresora conectada');
                } else {
                  // Solo intentar reconectar si NO está conectada
                  console.log("Impresora no conectada, intentando conectar...");
                  try {
                    await printerDevice.connect({ 
                      timeout: 5000, 
                      encoding: 'UTF-8' 
                    });
                    console.log("Reconectado exitosamente");
                    setPrinterConnected(true);
                    setPrinterInfo(savedPrinterObject.name || 'Impresora conectada');
                  } catch (reconnectError) {
                    console.log("No se pudo reconectar automáticamente:", reconnectError);
                    setPrinterConnected(false);
                    setPrinterInfo('Impresora desconectada');
                  }
                }
              } catch (createError) {
                console.error('Error creando instancia de ThermalPrinterDevice:', createError);
                setPrinterConnected(false);
                setPrinterInfo('Error de conexión');
              }
            } else {
              console.log("Dispositivo no encontrado en la lista");
              setPrinterConnected(false);
              setPrinterInfo('Impresora no encontrada');
            }
          } catch (deviceError) {
            console.error('Error verificando dispositivos:', deviceError);
            setPrinterConnected(false);
            setPrinterInfo('Error de conexión');
          }
        } catch (parseError) {
          console.error('Error parseando impresora guardada:', parseError);
          setPrinterConnected(false);
          setPrinterInfo('Error de configuración');
        }
      } else {
        console.log("No hay impresora guardada");
        setPrinterConnected(false);
        setPrinterInfo('Sin impresora configurada');
      }
    } catch (error) {
      console.error('Error cargando impresora guardada:', error);
      setPrinterConnected(false);
      setPrinterInfo('Error de conexión');
    }
  };
  // Función para cargar estadísticas del día
  const loadDailyStats = async () => {
    setLoadingStats(true);
    try {
      console.log('Cargando estadísticas del día...');
      const response = await apiService.getDailyStats();
      if (response.success) {
        console.log('Estadísticas cargadas:', response.data);
        setDailyStats(response.data);
      } else {
        console.error('Error cargando estadísticas:', response.message);
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  // Función para cargar sesiones activas del operador
  const loadActiveSessions = async () => {
    if (!operator) {
      console.log('No hay operador disponible');
      return;
    }
    
    setLoadingActiveSessions(true);
    try {
      console.log('Cargando sesiones activas del operador:', operator.id);
      const response = await apiService.getActiveSessionsByOperator(operator.id);
      console.log('Respuesta completa del API:', response);
      
      if (response.success) {
        console.log('Sesiones activas cargadas:', response.data);
        console.log('Cantidad de sesiones:', response.data?.length || 0);
        setActiveSessions(response.data || []);
        console.log('Estado actualizado con setActiveSessions');
      } else {
        console.error('Error cargando sesiones activas:', response.message);
        setActiveSessions([]);
      }
    } catch (error) {
      console.error('Error cargando sesiones activas:', error);
      setActiveSessions([]);
    } finally {
      setLoadingActiveSessions(false);
    }
  };

  // Función para manejar checkout de sesión
  const handleCheckoutSession = (session: any) => {
    console.log('Iniciando checkout para sesión:', session);
    setSelectedSession(session);
    setShowPaymentModal(true);
  };

  // Función para manejar éxito del pago
  const handlePaymentSuccess = () => {
    // Recargar datos después del pago exitoso
    loadActiveSessions();
    loadDailyStats();
    loadDebtsByPlate();
  };

  // Función para cargar deudas agrupadas por placa
  const loadDebtsByPlate = async () => {
    setLoadingDebts(true);
    try {
      console.log('Cargando deudas agrupadas por placa...');
      const response = await apiService.getPendingDebtsGroupedByPlate();
      
      if (response.success) {
        console.log('Deudas cargadas:', response.data);
        setDebtsByPlate(response.data || []);
      } else {
        console.error('Error cargando deudas:', response.message);
        setDebtsByPlate([]);
      }
    } catch (error) {
      console.error('Error cargando deudas:', error);
      setDebtsByPlate([]);
    } finally {
      setLoadingDebts(false);
    }
  };

  // Función para mostrar deudas
  const handleShowDebts = async () => {
    console.log('=== ABRIENDO MODAL DE DEUDAS ===');
    
    // Abrir el modal primero para mostrar el estado de carga
    setShowDebtsModal(true);
    
    // Luego cargar las deudas
    await loadDebtsByPlate();
  };

  // Función para liquidar una deuda específica
  const handleLiquidateDebt = (debt: any) => {
    console.log('Liquidando deuda:', debt);
    setSelectedSession(debt);
    setShowPaymentModal(true);
  };

  // Función para mostrar sesiones activas
  const handleShowActiveSessions = async () => {
    console.log('=== ABRIENDO MODAL DE SESIONES ACTIVAS ===');
    console.log('Operador actual:', operator);
    console.log('ID del operador:', operator?.id);
    console.log('Estado actual de sesiones activas:', activeSessions);
    
    // Si no hay operador, intentar verificar el estado de auth
    if (!operator) {
      console.log('No hay operador, verificando estado de autenticación...');
      // Aquí podrías llamar a checkAuthStatus si estuviera disponible
      return;
    }
    
    // Abrir el modal primero para mostrar el estado de carga
    setShowActiveSessionsModal(true);
    
    // Luego cargar las sesiones
    await loadActiveSessions();
    
    console.log('Sesiones cargadas después de loadActiveSessions:', activeSessions);
  };

  // Cargar estadísticas cuando se enfoca la pantalla
  useFocusEffect(
    React.useCallback(() => {
      loadDailyStats();
      setTimeout(() => {
        loadSelectedPrinter();
      }, 1000);
    }, [])
  );

  const menuItems = [
    {
      title: 'Entrada',
      description: 'Iniciar estacionamiento',
      icon: 'plus.circle.fill',
      route: '/nueva-sesion',
      color: '#ffffff',
    },
    {
      title: 'Salida',
      description: 'Finalizar estacionamiento',
      icon: 'checkmark.circle.fill',
      route: '/checkout',
      color: '#ffffff',
    },
    {
      title: 'Consultas',
      description: 'Ver sesiones y deudas',
      icon: 'magnifyingglass.circle.fill',
      route: '/consultas',
      color: '#ffffff',
    },
  ];

  const handleMenuPress = (route: string) => {
    router.push(route as any);
  };


  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const handleEditProfileOpen = () => {
    if (!operator) return;
    setEditProfileName(operator.name);
    setEditProfilePin('');
    setShowEditProfileModal(true);
  };

  const handleEditProfileClose = () => {
    setShowEditProfileModal(false);
    setEditProfileName('');
    setEditProfilePin('');
  };

  const handleEditProfileSave = async () => {
    if (!operator) return;

    setEditProfileLoading(true);

    try {
      const pinToUpdate = editProfilePin.trim();
      const result = await updateOperator(
        operator.id,
        editProfileName.trim(),
        pinToUpdate !== '' ? pinToUpdate : undefined
      );

      if (result) {
        Alert.alert('Éxito', 'Perfil actualizado correctamente');
        handleEditProfileClose();
      } else {
        Alert.alert('Error', 'No se pudo actualizar el perfil');
      }
    } catch (error) {
      console.error('Error actualizando perfil:', error);
      Alert.alert('Error', 'Error al actualizar el perfil');
    } finally {
      setEditProfileLoading(false);
    }
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
      marginBottom: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#ffffff',
      marginBottom: 10,
    },
    subtitle: {
      fontSize: 20,
      color: '#b3d9ff',
      textAlign: 'center',
      fontWeight: '500',
    },
    iconContainer: {
      alignItems: 'center',
      marginBottom: 20,
    },
    menuContainer: {
      marginBottom: 15,
      marginTop: 8, // Espacio adicional desde el header
    },
    menuItem: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 16,
      padding: 24,
      marginBottom: 12, // Reducido de 18 a 12 para menos espacio entre botones del menú
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    menuIcon: {
      marginRight: 20,
    },
    menuTextContainer: {
      flex: 1,
    },
    menuTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: '#ffffff',
      marginBottom: 6,
    },
    menuDescription: {
      fontSize: 16,
      color: '#b3d9ff',
      fontWeight: '500',
    },
    dashboardContainer: {
      backgroundColor: '#ffffff',
      borderRadius: 16,
      padding: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
    },
    dashboardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    refreshButton: {
      backgroundColor: '#f8f9fa',
      borderRadius: 24,
      padding: 12,
      minWidth: 44,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#043476',
    },
    dashboardTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#043476',
    },
    expandButton: {
      backgroundColor: '#e9ecef',
      borderRadius: 24,
      padding: 12,
      minWidth: 44,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#dee2e6',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginTop: 20,
    },
    statItem: {
      width: '48%',
      backgroundColor: '#f8f9fa',
      borderRadius: 16,
      padding: 20,
      marginBottom: 15,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    statNumber: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#043476',
      marginBottom: 8,
    },
    statLabel: {
      fontSize: 14,
      color: '#6c757d',
      textAlign: 'center',
      fontWeight: '500',
    },
    logoutButton: {
      position: 'absolute',
      top: 20,
      right: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: 20,
      padding: 10,
      zIndex: 1,
    },
    configButton: {
      position: 'absolute',
      top: 20,
      left: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: 20,
      padding: 10,
      zIndex: 1,
    },
    editProfileButton: {
      position: 'absolute',
      top: 20,
      right: 70,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: 20,
      padding: 10,
      zIndex: 1,
    },
    operatorInfo: {
      alignItems: 'center',
      marginBottom: 12,
    },
    operatorName: {
      fontSize: 20,
      color: '#ffffff',
      fontWeight: 'bold',
    },
    printerStatusContainer: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 12,
      padding: 16,
      marginTop: 20,
      alignItems: 'center',
    },
    printerStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    printerStatusIndicator: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: 8,
    },
    printerStatusConnected: {
      backgroundColor: '#28a745',
    },
    printerStatusDisconnected: {
      backgroundColor: '#dc3545',
    },
    printerStatusText: {
      fontSize: 14,
      color: '#ffffff',
      fontWeight: '500',
      flex: 1,
      textAlign: 'center',
    },
    // Estilos del modal
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
      height: '85%',
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
    modalBody: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 20,
    },
    loadingContainer: {
      alignItems: 'center',
      padding: 40,
    },
    loadingText: {
      fontSize: 16,
      color: '#6c757d',
      marginTop: 16,
    },
    sessionsList: {
      flex: 1,
    },
    sessionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      borderLeftWidth: 4,
      borderLeftColor: '#043476',
    },
    sessionInfo: {
      flex: 1,
    },
    sessionPlate: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#043476',
      marginBottom: 4,
    },
    sessionSector: {
      fontSize: 14,
      color: '#6c757d',
      marginBottom: 4,
    },
    sessionTime: {
      fontSize: 12,
      color: '#6c757d',
    },
    checkoutButton: {
      backgroundColor: '#28a745',
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    checkoutButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    checkoutInfo: {
      backgroundColor: '#f8f9fa',
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
    },
    checkoutPlate: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#043476',
      marginBottom: 8,
      textAlign: 'center',
    },
    checkoutSector: {
      fontSize: 14,
      color: '#6c757d',
      marginBottom: 4,
      textAlign: 'center',
    },
    checkoutTime: {
      fontSize: 14,
      color: '#6c757d',
      marginBottom: 4,
      textAlign: 'center',
    },
    checkoutDuration: {
      fontSize: 16,
      fontWeight: '600',
      color: '#043476',
      textAlign: 'center',
    },
    checkoutActions: {
      gap: 12,
    },
    checkoutConfirmButton: {
      backgroundColor: '#28a745',
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    checkoutButtonDisabled: {
      backgroundColor: '#6c757d',
    },
    checkoutConfirmButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    checkoutCancelButton: {
      backgroundColor: '#6c757d',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    checkoutCancelButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    emptyState: {
      alignItems: 'center',
      padding: 40,
    },
    emptyStateText: {
      fontSize: 16,
      color: '#6c757d',
      textAlign: 'center',
      lineHeight: 22,
    },
    // Estilos del modal de configuración de tenant
    tenantModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    tenantModalContainer: {
      backgroundColor: '#ffffff',
      borderRadius: 20,
      width: '95%',
      maxWidth: 500,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 12,
    },
    tenantModalContent: {
      padding: 24,
    },
    tenantModalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 16,
      color: '#333',
    },
    tenantModalDescription: {
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 24,
      color: '#666',
      lineHeight: 22,
    },
    tenantInputContainer: {
      marginBottom: 24,
    },
    tenantInputLabel: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
      color: '#333',
    },
    tenantInput: {
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      backgroundColor: '#f9f9f9',
    },
    tenantInputHelp: {
      fontSize: 12,
      color: '#666',
      marginTop: 4,
    },
    tenantSaveButton: {
      backgroundColor: '#007AFF',
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
    },
    tenantSaveButtonDisabled: {
      backgroundColor: '#ccc',
    },
    tenantSaveButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    // Estilos para el estado de carga del tenant
    tenantLoadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#043476',
    },
    tenantLoadingText: {
      fontSize: 18,
      color: '#ffffff',
      marginTop: 16,
      fontWeight: '500',
    },
  });

  // Si está cargando la configuración del tenant, mostrar estado de carga
  if (tenantLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.tenantLoadingContainer}>
          <Text style={styles.tenantLoadingText}>Cargando configuración...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.container}>
      <Link href="/configuracion" asChild>
        <TouchableOpacity style={styles.configButton}>
          <IconSymbol size={24} name="gear" color="#ffffff" />
        </TouchableOpacity>
      </Link>
      
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <IconSymbol size={24} name="power" color="#ffffff" />
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.editProfileButton}
        onPress={handleEditProfileOpen}
      >
        <IconSymbol size={24} name="person.circle" color="#ffffff" />
      </TouchableOpacity>
      
      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
        bounces={true}
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <STParkLogo size={60} color="#ffffff" showText={true} />
          </View>
          <Text style={styles.subtitle}>
            Sistema de Gestión de Estacionamiento
          </Text>
          
          {operator && (
            <View style={styles.operatorInfo}>
              <Text style={styles.operatorName}>{operator.name}</Text>
            </View>
          )}
        </View>

        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={() => handleMenuPress(item.route)}
            >
              <View style={styles.menuIcon}>
                <IconSymbol size={28} name={item.icon as any} color={item.color} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuDescription}>{item.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.dashboardContainer}>
          <View style={styles.dashboardHeader}>
            <Text style={styles.dashboardTitle}>Resumen del Día</Text>
            <View style={styles.headerButtons}>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={loadDailyStats}
                disabled={loadingStats}
              >
                <IconSymbol 
                  size={20} 
                  name="arrow.clockwise" 
                  color={loadingStats ? "#6c757d" : "#043476"} 
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.expandButton}
                onPress={() => setResumenExpandido(!resumenExpandido)}
              >
                <IconSymbol 
                  size={20} 
                  name={resumenExpandido ? "minus.circle.fill" : "plus.circle.fill"} 
                  color="#000000" 
                />
              </TouchableOpacity>
            </View>
          </View>
          
          {resumenExpandido && (
            <View style={styles.statsGrid}>
              <TouchableOpacity style={styles.statItem} onPress={handleShowActiveSessions}>
                <Text style={styles.statNumber}>
                  {loadingStats ? '...' : dailyStats?.active_vehicles || 0}
                </Text>
                <Text style={styles.statLabel}>Vehículos Activos</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.statItem} onPress={handleShowDebts}>
                <Text style={styles.statNumber}>
                  {loadingStats ? '...' : dailyStats?.vehicles_with_debt || 0}
                </Text>
                <Text style={styles.statLabel}>Con Deuda</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal para mostrar sesiones activas */}
      <Modal
        visible={showActiveSessionsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowActiveSessionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sesiones Activas</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowActiveSessionsModal(false)}
              >
                <IconSymbol size={24} name="xmark.circle.fill" color="#6c757d" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              {(() => {
                console.log('=== RENDERIZANDO MODAL ===');
                console.log('loadingActiveSessions:', loadingActiveSessions);
                console.log('activeSessions.length:', activeSessions.length);
                console.log('activeSessions:', activeSessions);
                
                if (loadingActiveSessions) {
                  console.log('Mostrando estado de carga');
                  return (
                    <View style={styles.loadingContainer}>
                      <Text style={styles.loadingText}>Cargando sesiones activas...</Text>
                    </View>
                  );
                } else if (activeSessions.length > 0) {
                  console.log('Mostrando lista de sesiones');
                  return (
                    <FlatList
                      data={activeSessions}
                      keyExtractor={(item) => item.id.toString()}
                      renderItem={({ item }) => (
                        <View style={styles.sessionItem}>
                          <View style={styles.sessionInfo}>
                            <Text style={styles.sessionPlate}>{item.plate}</Text>
                            <Text style={styles.sessionSector}>
                              {item.sector?.name || 'N/A'} - {item.street?.name || 'N/A'}
                            </Text>
                            <Text style={styles.sessionTime}>
                              Ingreso: {new Date(item.started_at).toLocaleString('es-CL')}
                            </Text>
                          </View>
                          <TouchableOpacity 
                            style={styles.checkoutButton}
                            onPress={() => handleCheckoutSession(item)}
                          >
                            <IconSymbol size={20} name="creditcard.fill" color="#fff" />
                            <Text style={styles.checkoutButtonText}>Checkout</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      style={styles.sessionsList}
                    />
                  );
                } else {
                  console.log('Mostrando estado vacío');
                  return (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>
                        No hay sesiones activas para este operador
                      </Text>
                    </View>
                  );
                }
              })()}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Deudas */}
      <Modal
        visible={showDebtsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDebtsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Deudas Pendientes</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowDebtsModal(false)}
              >
                <IconSymbol size={24} name="xmark.circle.fill" color="#6c757d" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              {loadingDebts ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Cargando deudas...</Text>
                </View>
              ) : debtsByPlate.length > 0 ? (
                <FlatList
                  data={debtsByPlate}
                  keyExtractor={(item) => item.plate}
                  renderItem={({ item }) => (
                    <View style={styles.sessionItem}>
                      <View style={styles.sessionInfo}>
                        <Text style={styles.sessionPlate}>{item.plate}</Text>
                        <Text style={styles.sessionSector}>
                          Total: ${item.total_amount.toLocaleString('es-CL')}
                        </Text>
                        <Text style={styles.sessionTime}>
                          {item.debts.length} {item.debts.length === 1 ? 'deuda' : 'deudas'} pendiente{item.debts.length > 1 ? 's' : ''}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.checkoutButton}
                        onPress={() => {
                          // Mostrar las deudas individuales de esta placa
                          setSelectedSession({ plate: item.plate, debts: item.debts });
                          setShowDebtsModal(false);
                          setShowPaymentModal(true);
                        }}
                      >
                        <IconSymbol size={20} name="creditcard.fill" color="#fff" />
                        <Text style={styles.checkoutButtonText}>Liquidar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  style={styles.sessionsList}
                />
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    No hay deudas pendientes
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Pago */}
      <PaymentModal
        visible={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedSession(null);
        }}
        data={selectedSession}
        onSuccess={handlePaymentSuccess}
        type={selectedSession?.debts ? "debt" : "checkout"}
        operator={operator}
      />

      {/* Modal de Configuración de Tenant */}
      <Modal
        visible={showTenantConfigModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          // No permitir cerrar el modal sin configurar el tenant
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

      {/* Modal de Edición de Perfil */}
      <Modal
        visible={showEditProfileModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleEditProfileClose}
      >
        <View style={styles.tenantModalOverlay}>
          <View style={styles.tenantModalContainer}>
            <View style={styles.tenantModalContent}>
              <Text style={styles.tenantModalTitle}>Editar Perfil</Text>
              
              <View style={styles.tenantInputContainer}>
                <Text style={styles.tenantInputLabel}>Nombre</Text>
                <TextInput
                  style={styles.tenantInput}
                  value={editProfileName}
                  onChangeText={setEditProfileName}
                  placeholder="Nombre completo"
                  editable={!editProfileLoading}
                />
              </View>

              <View style={styles.tenantInputContainer}>
                <Text style={styles.tenantInputLabel}>Email</Text>
                <TextInput
                  style={[styles.tenantInput, { backgroundColor: '#e0e0e0' }]}
                  value={operator?.email || ''}
                  editable={false}
                />
                <Text style={styles.tenantInputHelp}>
                  El email no se puede modificar
                </Text>
              </View>

              <View style={styles.tenantInputContainer}>
                <Text style={styles.tenantInputLabel}>Empresa (Tenant)</Text>
                <TextInput
                  style={[styles.tenantInput, { backgroundColor: '#e0e0e0' }]}
                  value={tenantConfig.tenant || ''}
                  editable={false}
                />
                <Text style={styles.tenantInputHelp}>
                  El tenant no se puede modificar
                </Text>
              </View>

              <View style={styles.tenantInputContainer}>
                <Text style={styles.tenantInputLabel}>Nueva Contraseña (dejar vacío para no cambiar)</Text>
                <TextInput
                  style={styles.tenantInput}
                  value={editProfilePin}
                  onChangeText={setEditProfilePin}
                  placeholder="Ingrese nueva contraseña (6 dígitos)"
                  secureTextEntry={true}
                  editable={!editProfileLoading}
                  maxLength={6}
                />
                <Text style={styles.tenantInputHelp}>
                  Debe tener 6 dígitos
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={[styles.tenantSaveButton, { flex: 1, backgroundColor: '#6c757d' }]}
                  onPress={handleEditProfileClose}
                  disabled={editProfileLoading}
                >
                  <Text style={styles.tenantSaveButtonText}>
                    Cancelar
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tenantSaveButton,
                    { flex: 1 },
                    (!editProfileName.trim() || editProfileLoading) && styles.tenantSaveButtonDisabled
                  ]}
                  onPress={handleEditProfileSave}
                  disabled={!editProfileName.trim() || editProfileLoading}
                >
                  <Text style={styles.tenantSaveButtonText}>
                    {editProfileLoading ? 'Guardando...' : 'Guardar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      </SafeAreaView>
    </View>
  );
}