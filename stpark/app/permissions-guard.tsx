import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Linking,
  AppState,
  AppStateStatus,
  Modal,
} from 'react-native';
import { bluetoothPermissionsService } from '../services/bluetoothPermissions';

export default function PermissionsGuard({ children }: { children: React.ReactNode }) {
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const checkPermissions = async () => {
    setIsChecking(true);
    try {
      const granted = await bluetoothPermissionsService.checkNearbyDevicesPermission();
      setHasPermissions(granted);
      setIsChecking(false);
    } catch (error) {
      console.error('Error verificando permisos:', error);
      setHasPermissions(false);
      setIsChecking(false);
    }
  };

  const requestPermissions = async () => {
    setIsChecking(true);
    try {
      const granted = await bluetoothPermissionsService.requestNearbyDevicesPermission();
      setHasPermissions(granted);
      setIsChecking(false);
      
      // Si aún no están otorgados, verificar de nuevo después de un breve delay
      if (!granted) {
        setTimeout(() => {
          checkPermissions();
        }, 1000);
      } else {
        // Si se otorgaron permisos, esperar un momento para que el flujo continúe
        console.log('Permisos otorgados, permitiendo que el flujo continúe');
      }
    } catch (error) {
      console.error('Error solicitando permisos:', error);
      setHasPermissions(false);
      setIsChecking(false);
    }
  };

    useEffect(() => {
    // Verificar permisos al montar el componente
    checkPermissions();

    // Listener para cuando la app vuelve al foreground (después de ir a configuración)
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {                                                                
      if (nextAppState === 'active') {
        // Cuando la app vuelve a estar activa, verificar permisos de nuevo después de un breve delay
        // para dar tiempo a que el sistema actualice los permisos
        setTimeout(() => {
          checkPermissions();
        }, 500);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

    // Renderizar children siempre para que el flujo continúe
  // Mostrar modal de permisos si no están otorgados (solo en Android)
  const shouldShowPermissionModal = Platform.OS === 'android' && hasPermissions === false && !isChecking;
  
  return (
    <>
      {children}
      
      {/* Modal de permisos - solo en Android y si no están otorgados */}
      {Platform.OS === 'android' && (
        <Modal
          visible={shouldShowPermissionModal}
          transparent={false}
          animationType="fade"
          onRequestClose={() => {
            // No permitir cerrar el modal sin otorgar permisos
          }}
        >
          <SafeAreaView style={styles.container}>
            {isChecking ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#ffffff" />
                <Text style={styles.loadingText}>Verificando permisos...</Text>
              </View>
            ) : (
              <View style={styles.permissionContainer}>
                <View style={styles.iconContainer}>
                  <Text style={styles.icon}>📱</Text>
                </View>
                <Text style={styles.title}>Permiso de Dispositivos Cercanos Requerido</Text>                                                                          
                <Text style={styles.description}>
                  Esta aplicación necesita acceso a dispositivos cercanos (Bluetooth) para conectarse a impresoras térmicas.                                          
                </Text>
                <Text style={styles.description}>
                  Por favor, habilita el permiso de "Dispositivos cercanos" en la configuración de tu dispositivo.                                                    
                </Text>
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={requestPermissions}
                    disabled={isChecking}
                  >
                    <Text style={styles.primaryButtonText}>Solicitar Permiso</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => {
                      Linking.openSettings();
                    }}
                    disabled={isChecking}
                  >
                    <Text style={styles.secondaryButtonText}>Abrir Configuración</Text>                                                                               
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={checkPermissions}
                    disabled={isChecking}
                  >
                    <Text style={styles.retryButtonText}>Verificar Nuevamente</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </SafeAreaView>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#043476',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    marginBottom: 24,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#b3d9ff',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    marginTop: 32,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#043476',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#b3d9ff',
    fontSize: 14,
    fontWeight: '500',
  },
});
