// Configuración de la aplicación
const DEFAULT_API_BASE_URL = 'http://192.168.1.34:8000/api';

export const CONFIG = {
  // URL del backend - cambiar según el entorno
  // API_BASE_URL: 'http://restapp.test:8000/api',
  
  // Para desarrollo local con dispositivo físico, usar la IP de tu computadora:
  API_BASE_URL: DEFAULT_API_BASE_URL,
  
  // Para producción, usar la URL real del servidor:
  // API_BASE_URL: 'https://api.stpark.cl/api',
  
  // Configuración de la app
  APP_NAME: 'STPark',
  VERSION: '1.0.0',
  
  // Configuración de autenticación
  PIN_LENGTH: 6,
  
  // Credenciales de prueba (solo para desarrollo)
  TEST_CREDENTIALS: [
    { email: 'jperez@stpark', pin: '123456', name: 'Juan Pérez' },
    { email: 'maria.gonzalez@stpark.cl', pin: '654321', name: 'María González' },
    { email: 'clopez@stpark', pin: '111111', name: 'Carlos López' },
  ],
};

// Función para obtener la URL del servidor (con soporte para URL personalizada)
export const getServerUrl = async (): Promise<string> => {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const customUrl = await AsyncStorage.getItem('custom_server_url');
    return customUrl || DEFAULT_API_BASE_URL;
  } catch (error) {
    console.error('Error obteniendo URL del servidor:', error);
    return DEFAULT_API_BASE_URL;
  }
};

// Función para actualizar la URL del servidor en tiempo real
export const updateServerUrl = (newUrl: string) => {
  CONFIG.API_BASE_URL = newUrl;
};
