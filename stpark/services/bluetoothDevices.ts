import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BluetoothDevice {
  id: string;
  name: string;
  address: string;
  connected: boolean;
  paired: boolean;
}

export interface BluetoothDevicesService {
  getPairedDevices(): Promise<BluetoothDevice[]>;
  selectPrinter(device: BluetoothDevice): Promise<boolean>;
  getSelectedPrinter(): Promise<BluetoothDevice | null>;
  clearSelectedPrinter(): Promise<void>;
}

class BluetoothDevicesServiceImpl implements BluetoothDevicesService {
  private readonly SELECTED_PRINTER_KEY = 'selected_bluetooth_printer';

  /**
   * Obtener dispositivos Bluetooth emparejados
   */
  async getPairedDevices(): Promise<BluetoothDevice[]> {
    try {
      console.log('Obteniendo dispositivos Bluetooth emparejados...');

      if (Platform.OS === 'web') {
        // En web, mostrar mensaje informativo
        Alert.alert(
          'Modo Web',
          'En modo web no se pueden obtener dispositivos Bluetooth reales.\n\nUsa la app nativa para acceder a dispositivos Bluetooth emparejados.',
          [{ text: 'OK' }]
        );
        return [];
      }

      // En Android/iOS, intentar obtener dispositivos reales
      const pairedDevices = await this.getNativePairedDevices();
      
      console.log('Dispositivos emparejados encontrados:', pairedDevices);
      
      if (pairedDevices.length === 0) {
        Alert.alert(
          'Sin Dispositivos Emparejados',
          'No se encontraron dispositivos Bluetooth emparejados.\n\nPara emparejar una impresora:\n• Ve a Configuración > Bluetooth\n• Busca tu impresora térmica\n• Toca para emparejar\n• Asegúrate de que esté encendida\n• Luego vuelve aquí y recarga la lista',
          [{ text: 'OK' }]
        );
        return [];
      }
      
      return pairedDevices.map((device, index) => ({
        id: device.address || `device_${index}`,
        name: device.name || 'Dispositivo Desconocido',
        address: device.address || '',
        connected: false, // Por ahora siempre false
        paired: true
      }));

    } catch (error) {
      console.error('Error obteniendo dispositivos emparejados:', error);
      Alert.alert(
        'Error',
        'No se pudieron obtener los dispositivos Bluetooth emparejados.\n\nVerifica que:\n• Bluetooth esté habilitado\n• Tengas permisos de Bluetooth\n• Haya dispositivos emparejados',
        [{ text: 'OK' }]
      );
      return [];
    }
  }

  /**
   * Obtener dispositivos emparejados usando API nativa
   */
  private async getNativePairedDevices(): Promise<any[]> {
    try {
      console.log('Obteniendo dispositivos nativos...');
      
      // Por ahora, retornar lista vacía para forzar el mensaje de instrucciones
      // En una implementación real, aquí se usaría la API nativa de Bluetooth
      return [];
      
    } catch (error) {
      console.error('Error obteniendo dispositivos nativos:', error);
      throw error;
    }
  }

  /**
   * Seleccionar una impresora
   */
  async selectPrinter(device: BluetoothDevice): Promise<boolean> {
    try {
      console.log('Seleccionando impresora:', device.name, device.address);
      
      // Guardar en AsyncStorage
      await AsyncStorage.setItem(this.SELECTED_PRINTER_KEY, JSON.stringify(device));
      
      Alert.alert(
        'Impresora Seleccionada',
        `Se seleccionó "${device.name}" como impresora.\n\nDirección MAC: ${device.address}`,
        [{ text: 'OK' }]
      );
      
      return true;
    } catch (error) {
      console.error('Error seleccionando impresora:', error);
      Alert.alert('Error', 'No se pudo seleccionar la impresora');
      return false;
    }
  }

  /**
   * Obtener la impresora seleccionada
   */
  async getSelectedPrinter(): Promise<BluetoothDevice | null> {
    try {
      const stored = await AsyncStorage.getItem(this.SELECTED_PRINTER_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      return null;
    } catch (error) {
      console.error('Error obteniendo impresora seleccionada:', error);
      return null;
    }
  }

  /**
   * Limpiar la impresora seleccionada
   */
  async clearSelectedPrinter(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.SELECTED_PRINTER_KEY);
      console.log('Impresora seleccionada eliminada');
    } catch (error) {
      console.error('Error limpiando impresora seleccionada:', error);
    }
  }

  /**
   * Verificar si hay una impresora seleccionada
   */
  async hasSelectedPrinter(): Promise<boolean> {
    const printer = await this.getSelectedPrinter();
    return printer !== null;
  }

  /**
   * Obtener información de la impresora seleccionada
   */
  async getSelectedPrinterInfo(): Promise<string> {
    const printer = await this.getSelectedPrinter();
    if (printer) {
      return `${printer.name} (${printer.address})`;
    }
    return 'Ninguna impresora seleccionada';
  }
}

// Exportar instancia singleton
export const bluetoothDevicesService = new BluetoothDevicesServiceImpl();
