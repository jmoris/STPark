import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { STParkLogo } from '@/components/STParkLogo';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { CONFIG } from '../config/app';
import { apiService } from '../services/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [operatorInfo, setOperatorInfo] = useState<any>(null);
  const { login, operator } = useAuth();
  const pinInputRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    if (!email.trim() || !pin.trim()) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    if (pin.length !== CONFIG.PIN_LENGTH) {
      Alert.alert('Error', `El PIN debe tener ${CONFIG.PIN_LENGTH} dígitos`);
      return;
    }

    setLoading(true);
    try {
      console.log('Intentando login con:', { email: email.trim(), pin: pin.trim() });
      const success = await login(email.trim(), pin.trim());
      
      if (success) {
        console.log('Login exitoso');
        // Obtener información del operador
        setOperatorInfo({
          name: operator?.name || 'Operador',
          email: email.trim(),
        });
        setShowSuccessModal(true);
      } else {
        console.log('Login fallido');
        Alert.alert('Error', 'Credenciales inválidas');
      }
    } catch (error) {
      console.error('Error en login:', error);
      Alert.alert('Error', 'No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleDebugConnection = async () => {
    try {
      console.log('🔍 DEBUG: Probando conectividad con el backend...');
      console.log('🔍 DEBUG: URL del backend:', CONFIG.API_BASE_URL);
      
      // Probar conectividad básica al servidor Laravel
      const testUrl = CONFIG.API_BASE_URL.replace('/api', '');
      console.log('🔍 DEBUG: URL de prueba:', testUrl);
      
      // Crear AbortController para timeout personalizado
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos
      
      const response = await fetch(testUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'STPark-Mobile-App/1.0',
        },
      });
      
      clearTimeout(timeoutId);
      
      console.log('🔍 DEBUG: Response status:', response.status);
      console.log('🔍 DEBUG: Response ok:', response.ok);
      console.log('🔍 DEBUG: Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        // Si el servidor responde, probar el endpoint de API específico
        console.log('🔍 DEBUG: Probando endpoint de autenticación...');
        const apiController = new AbortController();
        const apiTimeoutId = setTimeout(() => apiController.abort(), 15000);
        
        const apiResponse = await fetch(`${CONFIG.API_BASE_URL}/auth/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'STPark-Mobile-App/1.0',
          },
          signal: apiController.signal,
        });
        
        clearTimeout(apiTimeoutId);
        
        console.log('🔍 DEBUG: API Response status:', apiResponse.status);
        console.log('🔍 DEBUG: API Response headers:', Object.fromEntries(apiResponse.headers.entries()));
        
        if (apiResponse.status === 200 || apiResponse.status === 401) {
          // 401 es esperado sin token
          Alert.alert(
            '✅ Conectividad OK',
            `Backend accesible en:\n${CONFIG.API_BASE_URL}\n\n✅ Servidor Laravel: OK\n✅ API Endpoint: OK\n✅ Permisos de red: OK\n\nStatus: ${apiResponse.status}`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            '⚠️ Problema con API',
            `Servidor accesible pero API con problemas:\n${CONFIG.API_BASE_URL}\n\nStatus: ${apiResponse.status}\n\nPosible problema de configuración del backend.`,
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert(
          '⚠️ Problema de Conectividad',
          `Backend responde pero con error:\n${CONFIG.API_BASE_URL}\n\nStatus: ${response.status}\n\nEl servidor está funcionando pero hay un problema de configuración.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error:any) {
      console.error('🔍 DEBUG: Error de conectividad:', error);
      
      let errorMessage = 'Error desconocido';
      let suggestions = '';
      let isNetworkIssue = false;
      
      if (error.name === 'AbortError') {
        errorMessage = 'Timeout de conexión';
        suggestions = 'El servidor tarda mucho en responder. Verifica:\n• Que el backend esté funcionando\n• Que no haya firewall bloqueando\n• Que la IP sea correcta';
      } else if (error instanceof TypeError && error.message.includes('Network request failed')) {
        errorMessage = 'No se puede conectar al servidor';
        suggestions = 'Problema de red. Verifica:\n• Misma red WiFi que la computadora\n• Backend ejecutándose en 192.168.1.34:8000\n• Permisos de red en Android\n• Firewall del router';
        isNetworkIssue = true;
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = 'Error de red';
        suggestions = 'Verifica la conexión a internet y permisos de red';
        isNetworkIssue = true;
      } else {
        errorMessage = `Error: ${error.message}`;
        suggestions = 'Error inesperado. Revisa los logs de la consola.';
      }
      
      Alert.alert(
        '❌ Error de Conectividad',
        `${errorMessage}\n\n${suggestions}\n\nURL intentada: ${CONFIG.API_BASE_URL}`,
        [
          { text: 'OK' },
          { 
            text: 'Ver Config', 
            onPress: () => {
              Alert.alert(
                'Configuración Actual',
                `URL del Backend:\n${CONFIG.API_BASE_URL}\n\nPara cambiar la IP:\n1. Edita config/app.ts\n2. Reconstruye la app\n3. Reinstala el APK`,
                [{ text: 'OK' }]
              );
            }
          },
          ...(isNetworkIssue ? [{
            text: 'Soluciones',
            onPress: () => {
              Alert.alert(
                'Soluciones para Problemas de Red',
                `1. Verifica que el backend esté ejecutándose:\n   php artisan serve --host=0.0.0.0 --port=8000\n\n2. Prueba desde el navegador:\n   http://192.168.1.34:8000\n\n3. Verifica permisos de red en Android\n\n4. Desactiva firewall temporalmente\n\n5. Reinicia el router WiFi`,
                [{ text: 'OK' }]
              );
            }
          }] : [])
        ]
      );
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#043476',
    },
    content: {
      flex: 1,
      padding: 20,
      justifyContent: 'center',
    },
    header: {
      alignItems: 'center',
      marginBottom: 60,
    },
    title: {
      fontSize: 32,
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
      marginBottom: 30,
    },
    formContainer: {
      backgroundColor: '#ffffff',
      borderRadius: 16,
      padding: 30,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
    },
    inputContainer: {
      marginBottom: 25,
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
      padding: 15,
      fontSize: 16,
      color: '#000000',
      backgroundColor: '#ffffff',
    },
    pinInput: {
      textAlign: 'center',
      letterSpacing: 8,
      fontSize: 20,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    button: {
      backgroundColor: '#043476',
      padding: 18,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 10,
    },
    buttonDisabled: {
      backgroundColor: '#6c757d',
    },
    buttonText: {
      color: 'white',
      fontSize: 18,
      fontWeight: 'bold',
    },
    footer: {
      alignItems: 'center',
      marginTop: 30,
    },
    footerText: {
      fontSize: 14,
      color: '#b3d9ff',
      textAlign: 'center',
    },
    // Estilos para modal de login exitoso
    successModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    successModalContainer: {
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
    successModalHeader: {
      alignItems: 'center',
      paddingTop: 32,
      paddingHorizontal: 24,
      paddingBottom: 20,
    },
    successIconContainer: {
      marginBottom: 16,
    },
    successModalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#043476',
      marginBottom: 8,
      textAlign: 'center',
    },
    successModalSubtitle: {
      fontSize: 16,
      color: '#6c757d',
      textAlign: 'center',
    },
    successModalContent: {
      paddingHorizontal: 24,
      paddingBottom: 32,
    },
    operatorInfoContainer: {
      backgroundColor: '#f8f9fa',
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
    },
    operatorInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    operatorInfoLabel: {
      fontSize: 16,
      color: '#6c757d',
      fontWeight: '500',
    },
    operatorInfoValue: {
      fontSize: 16,
      color: '#043476',
      fontWeight: '600',
    },
    successModalButtons: {
      flexDirection: 'row',
      justifyContent: 'center',
    },
    successModalButton: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    successModalButtonConfirm: {
      backgroundColor: '#28a745',
    },
    successModalButtonText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#ffffff',
    },
    debugButton: {
      backgroundColor: '#6c757d',
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 15,
    },
    debugButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <STParkLogo size={80} color="#ffffff" showText={true} />
            </View>
            <Text style={styles.subtitle}>Sistema de Gestión de Estacionamiento</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email del Operador</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="operador@stpark.cl"
                placeholderTextColor="#6c757d"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={true}
                returnKeyType="next"
                onSubmitEditing={() => {
                  pinInputRef.current?.focus();
                }}
              />
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
                placeholderTextColor="#6c757d"
                keyboardType="numeric"
                maxLength={CONFIG.PIN_LENGTH}
                secureTextEntry={true}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                autoComplete="off"
                textContentType="none"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Iniciando Sesión...' : 'Iniciar Sesión'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.debugButton}
              onPress={handleDebugConnection}
            >
              <Text style={styles.debugButtonText}>
                🔍 Probar Conectividad
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Ingresa con tu email y PIN asignado
            </Text>
            <Text style={styles.footerText}>
              {'\n'}Backend: {CONFIG.API_BASE_URL}
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Modal de login exitoso */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowSuccessModal(false);
          setOperatorInfo(null);
          router.replace('/');
        }}
      >
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContainer}>
            <View style={styles.successModalHeader}>
              <View style={styles.successIconContainer}>
                <IconSymbol size={36} name="checkmark.circle.fill" color="#28a745" />
              </View>
              <Text style={styles.successModalTitle}>¡Login Exitoso!</Text>
              <Text style={styles.successModalSubtitle}>
                Bienvenido al sistema
              </Text>
            </View>
            
            {operatorInfo && (
              <View style={styles.successModalContent}>
                <View style={styles.operatorInfoContainer}>
                  <View style={styles.operatorInfoRow}>
                    <Text style={styles.operatorInfoLabel}>Operador:</Text>
                    <Text style={styles.operatorInfoValue}>
                      {operatorInfo.name}
                    </Text>
                  </View>
                  
                  <View style={styles.operatorInfoRow}>
                    <Text style={styles.operatorInfoLabel}>Email:</Text>
                    <Text style={styles.operatorInfoValue}>
                      {operatorInfo.email}
                    </Text>
                  </View>
                </View>

                <View style={styles.successModalButtons}>
                  <TouchableOpacity
                    style={[styles.successModalButton, styles.successModalButtonConfirm]}
                    onPress={() => {
                      setShowSuccessModal(false);
                      setOperatorInfo(null);
                      router.replace('/');
                    }}
                  >
                    <Text style={styles.successModalButtonText}>Continuar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
