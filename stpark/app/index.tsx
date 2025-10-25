import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { STParkLogo } from '@/components/STParkLogo';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { router, Link } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '@/services/api';
import { PaymentModal } from '@/components/PaymentModal';
import { useFocusEffect } from '@react-navigation/native';

export default function HomeScreen() {
  const [resumenExpandido, setResumenExpandido] = useState(false);
  const [dailyStats, setDailyStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showActiveSessionsModal, setShowActiveSessionsModal] = useState(false);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [loadingActiveSessions, setLoadingActiveSessions] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const { operator, logout, isAuthenticated, isLoading } = useAuth();

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
  };

  // Función para mostrar sesiones activas
  const handleShowActiveSessions = async () => {
    console.log('=== ABRIENDO MODAL DE SESIONES ACTIVAS ===');
    console.log('Operador actual:', operator);
    console.log('ID del operador:', operator?.id);
    console.log('Estado actual de sesiones activas:', activeSessions);
    console.log('isAuthenticated:', isAuthenticated);
    console.log('isLoading:', isLoading);
    
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
      marginBottom: 30,
    },
    menuItem: {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 16,
      padding: 24,
      marginBottom: 18,
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
    operatorInfo: {
      alignItems: 'center',
      marginBottom: 20,
    },
    operatorName: {
      fontSize: 20,
      color: '#ffffff',
      fontWeight: 'bold',
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
  });

  return (
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
              
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {loadingStats ? '...' : dailyStats?.vehicles_with_debt || 0}
                </Text>
                <Text style={styles.statLabel}>Con Deuda</Text>
              </View>
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

      {/* Modal de Pago */}
      <PaymentModal
        visible={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedSession(null);
        }}
        data={selectedSession}
        onSuccess={handlePaymentSuccess}
        type="checkout"
        operator={operator}
      />
    </SafeAreaView>
  );
}