import { Alert, Platform } from 'react-native';
import { check, request, PERMISSIONS, RESULTS, Permission } from 'react-native-permissions';

export interface BluetoothPermissionsService {
  checkBluetoothPermissions(): Promise<boolean>;
  requestBluetoothPermissions(): Promise<boolean>;
  checkLocationPermissions(): Promise<boolean>;
  requestLocationPermissions(): Promise<boolean>;
}

class BluetoothPermissionsServiceImpl implements BluetoothPermissionsService {
  
  /**
   * Verificar permisos de Bluetooth
   */
  async checkBluetoothPermissions(): Promise<boolean> {
    try {
      console.log('Verificando permisos de Bluetooth...');
      
      if (Platform.OS === 'ios') {
        return await this.checkIOSBluetoothPermissions();
      } else if (Platform.OS === 'android') {
        return await this.checkAndroidBluetoothPermissions();
      }
      
      return true; // Para web
    } catch (error) {
      console.error('Error verificando permisos de Bluetooth:', error);
      return false;
    }
  }

  /**
   * Verificar permisos de Bluetooth en Android
   */
  private async checkAndroidBluetoothPermissions(): Promise<boolean> {
    try {
      // Para Android 12+ (API 31+)
      if (Number(Platform.Version) >= 31) {
        const bluetoothConnect = await check(PERMISSIONS.ANDROID.BLUETOOTH_CONNECT);
        const bluetoothScan = await check(PERMISSIONS.ANDROID.BLUETOOTH_SCAN);
        
        console.log('Permisos Android 12+:');
        console.log('- BLUETOOTH_CONNECT:', bluetoothConnect);
        console.log('- BLUETOOTH_SCAN:', bluetoothScan);
        
        return bluetoothConnect === RESULTS.GRANTED && bluetoothScan === RESULTS.GRANTED;
      } else {
        // Para versiones anteriores de Android - usar permisos básicos
        const location = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
        
        console.log('Permisos Android <12:');
        console.log('- ACCESS_FINE_LOCATION:', location);
        
        return location === RESULTS.GRANTED;
      }
    } catch (error) {
      console.error('Error verificando permisos Android:', error);
      return false;
    }
  }

  /**
   * Verificar permisos de Bluetooth en iOS
   */
  private async checkIOSBluetoothPermissions(): Promise<boolean> {
    try {
      // iOS maneja los permisos de Bluetooth automáticamente
      // Solo necesitamos verificar que Bluetooth esté habilitado
      return true;
    } catch (error) {
      console.error('Error verificando permisos iOS:', error);
      return false;
    }
  }

  /**
   * Solicitar permisos de Bluetooth
   */
  async requestBluetoothPermissions(): Promise<boolean> {
    try {
      console.log('Solicitando permisos de Bluetooth...');
      
      if (Platform.OS === 'ios') {
        return await this.requestIOSBluetoothPermissions();
      } else if (Platform.OS === 'android') {
        return await this.requestAndroidBluetoothPermissions();
      }
      
      return true; // Para web
    } catch (error) {
      console.error('Error solicitando permisos de Bluetooth:', error);
      return false;
    }
  }

  /**
   * Solicitar permisos de Bluetooth en Android
   */
  private async requestAndroidBluetoothPermissions(): Promise<boolean> {
    try {
      // Para Android 12+ (API 31+)
      if (Number(Platform.Version) >= 31) {
        const bluetoothConnectResult = await request(PERMISSIONS.ANDROID.BLUETOOTH_CONNECT);
        const bluetoothScanResult = await request(PERMISSIONS.ANDROID.BLUETOOTH_SCAN);
        
        console.log('Resultados permisos Android 12+:');
        console.log('- BLUETOOTH_CONNECT:', bluetoothConnectResult);
        console.log('- BLUETOOTH_SCAN:', bluetoothScanResult);
        
        const granted = bluetoothConnectResult === RESULTS.GRANTED && bluetoothScanResult === RESULTS.GRANTED;
        
        if (!granted) {
          Alert.alert(
            'Permisos de Bluetooth Requeridos',
            'Esta app necesita permisos de Bluetooth para conectarse a impresoras térmicas.\n\nVe a Configuración > Aplicaciones > STPark > Permisos y habilita Bluetooth.',
            [{ text: 'OK' }]
          );
        }
        
        return granted;
      } else {
        // Para versiones anteriores de Android - solicitar ubicación
        const locationResult = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
        
        console.log('Resultados permisos Android <12:');
        console.log('- ACCESS_FINE_LOCATION:', locationResult);
        
        const granted = locationResult === RESULTS.GRANTED;
        
        if (!granted) {
          Alert.alert(
            'Permisos de Ubicación Requeridos',
            'Esta app necesita permisos de ubicación para usar Bluetooth en versiones anteriores de Android.\n\nVe a Configuración > Aplicaciones > STPark > Permisos y habilita Ubicación.',
            [{ text: 'OK' }]
          );
        }
        
        return granted;
      }
    } catch (error) {
      console.error('Error solicitando permisos Android:', error);
      return false;
    }
  }

  /**
   * Solicitar permisos de Bluetooth en iOS
   */
  private async requestIOSBluetoothPermissions(): Promise<boolean> {
    try {
      // iOS maneja los permisos de Bluetooth automáticamente
      // Solo necesitamos verificar que Bluetooth esté habilitado
      return true;
    } catch (error) {
      console.error('Error solicitando permisos iOS:', error);
      return false;
    }
  }

  /**
   * Verificar permisos de ubicación (necesarios para escaneo Bluetooth)
   */
  async checkLocationPermissions(): Promise<boolean> {
    try {
      if (Platform.OS !== 'android') {
        return true; // No necesario en iOS/web
      }

      const fineLocation = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
      const coarseLocation = await check(PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION);
      
      console.log('Permisos de ubicación:');
      console.log('- ACCESS_FINE_LOCATION:', fineLocation);
      console.log('- ACCESS_COARSE_LOCATION:', coarseLocation);
      
      return fineLocation === RESULTS.GRANTED || coarseLocation === RESULTS.GRANTED;
    } catch (error) {
      console.error('Error verificando permisos de ubicación:', error);
      return false;
    }
  }

  /**
   * Solicitar permisos de ubicación
   */
  async requestLocationPermissions(): Promise<boolean> {
    try {
      if (Platform.OS !== 'android') {
        return true; // No necesario en iOS/web
      }

      const fineLocationResult = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
      
      console.log('Resultado permiso ubicación:', fineLocationResult);
      
      const granted = fineLocationResult === RESULTS.GRANTED;
      
      if (!granted) {
        Alert.alert(
          'Permiso de Ubicación Requerido',
          'Esta app necesita permiso de ubicación para escanear dispositivos Bluetooth.\n\nVe a Configuración > Aplicaciones > STPark > Permisos y habilita Ubicación.',
          [{ text: 'OK' }]
        );
      }
      
      return granted;
    } catch (error) {
      console.error('Error solicitando permisos de ubicación:', error);
      return false;
    }
  }

  /**
   * Verificar todos los permisos necesarios
   */
  async checkAllPermissions(): Promise<boolean> {
    const bluetoothOk = await this.checkBluetoothPermissions();
    const locationOk = await this.checkLocationPermissions();
    
    console.log('Estado de permisos:');
    console.log('- Bluetooth:', bluetoothOk);
    console.log('- Ubicación:', locationOk);
    
    return bluetoothOk && locationOk;
  }

  /**
   * Solicitar todos los permisos necesarios
   */
  async requestAllPermissions(): Promise<boolean> {
    const bluetoothOk = await this.requestBluetoothPermissions();
    const locationOk = await this.requestLocationPermissions();
    
    return bluetoothOk && locationOk;
  }
}

// Exportar instancia singleton
export const bluetoothPermissionsService = new BluetoothPermissionsServiceImpl();
