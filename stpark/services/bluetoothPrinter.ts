import { Alert, Platform } from 'react-native';
// @ts-ignore - Tipos no disponibles para esta librería
import { 
  Printer, 
  PrinterConstants,
  DiscoveryPortType
} from 'react-native-esc-pos-printer';
import { bluetoothDevicesService, BluetoothDevice } from './bluetoothDevices';
import { bluetoothPermissionsService } from './bluetoothPermissions';

// Interfaces para react-native-esc-pos-printer
export interface PrinterDevice {
  device_name: string;
  inner_mac_address: string;
  connected?: boolean;
  target?: string;
}

export interface BluetoothPrinterService {
  scanForDevices(): Promise<PrinterDevice[]>;
  connectToPrinter(device?: PrinterDevice): Promise<boolean>;
  connectToSpecificPrinter(macAddress: string, deviceName?: string): Promise<boolean>;
  disconnect(): Promise<boolean>;
  printTestTicket(): Promise<boolean>;
  printParkingTicket(data: any): Promise<boolean>;
  printPaymentReceipt(data: any): Promise<boolean>;
  printCustomText(text: string): Promise<boolean>;
  isConnected(): boolean;
  getConnectedDevice(): PrinterDevice | null;
  addPairedDevice(name: string, macAddress: string): void;
}

class BluetoothPrinterServiceImpl implements BluetoothPrinterService {
  private connected: boolean = false;
  private connectedDevice: PrinterDevice | null = null;
  private isExpoGo: boolean = false;
  private libraryAvailable: boolean = false;
  private pairedDevices: PrinterDevice[] = [];
  private printerInstance: Printer | null = null;
  private discoveryInstance: any = null;

  constructor() {
    this.detectEnvironment();
    this.initializeDiscovery();
    this.loadPairedDevices(); // Este método es async pero no podemos usar await en constructor
    console.log('BluetoothPrinterService initialized. Expo Go:', this.isExpoGo, 'Library Available:', this.libraryAvailable, 'Platform:', Platform.OS);
  }

  private detectEnvironment(): void {
    // Detectar si estamos en Expo Go (web) o en app nativa
    this.isExpoGo = Platform.OS === 'web';
    
    // En Android/iOS nativo, siempre considerar que la librería está disponible
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      this.isExpoGo = false;
      this.libraryAvailable = true; // Forzar disponibilidad en builds nativos
    }
    
    console.log('Environment detection:', {
      platform: Platform.OS,
      isExpoGo: this.isExpoGo,
      libraryAvailable: this.libraryAvailable,
      isDev: typeof __DEV__ !== 'undefined' ? __DEV__ : 'undefined',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'
    });
  }

  private initializeDiscovery(): void {
    if (this.libraryAvailable) {
      console.log('Discovery system initialized - using manual device management');
    }
  }


  public addPairedDevice(name: string, macAddress: string): void {
    const newDevice: PrinterDevice = {
      device_name: name,
      inner_mac_address: macAddress
    };
    const exists = this.pairedDevices.some(device =>
      device.inner_mac_address === macAddress
    );
    if (!exists) {
      this.pairedDevices.push(newDevice);
      console.log('Dispositivo agregado:', newDevice);
      
      // Guardar en AsyncStorage para persistencia
      this.savePairedDevices();
    }
  }

  private async savePairedDevices(): Promise<void> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('paired_bluetooth_devices', JSON.stringify(this.pairedDevices));
      console.log('Dispositivos guardados en AsyncStorage');
    } catch (error) {
      console.error('Error guardando dispositivos:', error);
    }
  }

  private async loadPairedDevices(): Promise<void> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const savedDevices = await AsyncStorage.getItem('paired_bluetooth_devices');
      if (savedDevices) {
        this.pairedDevices = JSON.parse(savedDevices);
        console.log('Dispositivos cargados desde AsyncStorage:', this.pairedDevices);
      } else {
        // Dispositivos por defecto si no hay guardados
        this.pairedDevices = [];
      }
    } catch (error) {
      console.error('Error cargando dispositivos:', error);
      this.pairedDevices = [];
    }
  }


  async scanForDevices(): Promise<PrinterDevice[]> {
    console.log('Iniciando escaneo con react-native-esc-pos-printer');

    if (this.isExpoGo) {
      Alert.alert(
        'Modo Web',
        'En modo web no se pueden escanear dispositivos Bluetooth reales. Usa la app nativa para Bluetooth.',
        [{ text: 'OK' }]
      );
      return [];
    }

    if (!this.libraryAvailable) {
      Alert.alert(
        'Librería No Disponible',
        'La librería de impresión térmica no está disponible.\n\nVerifica que:\n• Estés usando un build nativo\n• La librería esté correctamente instalada',
        [{ text: 'OK' }]
      );
      return [];
    }

    try {
      // Verificar permisos antes de escanear
      const hasPermissions = await bluetoothPermissionsService.checkAllPermissions();
      if (!hasPermissions) {
        const granted = await bluetoothPermissionsService.requestAllPermissions();
        if (!granted) {
          Alert.alert(
            'Permisos Requeridos',
            'Se necesitan permisos de Bluetooth para escanear dispositivos.\n\nVe a Configuración del dispositivo y habilita:\n• Bluetooth\n• Ubicación',
            [{ text: 'OK' }]
          );
          return [];
        }
      }

      // Intentar obtener dispositivos emparejados del sistema
      console.log('Obteniendo dispositivos Bluetooth emparejados...');
      let discoveredPrinters: any[] = [];
      
      try {
        // Intentar usar la API de react-native-esc-pos-printer para obtener dispositivos emparejados
        if (Platform.OS === 'android') {
          console.log('Intentando obtener dispositivos emparejados del sistema Android...');
          
          // Verificar permisos específicamente para esta operación
          const hasBluetoothConnect = await bluetoothPermissionsService.checkBluetoothPermissions();
          if (!hasBluetoothConnect) {
            console.log('Permisos de Bluetooth no otorgados, solicitando...');
            const granted = await bluetoothPermissionsService.requestBluetoothPermissions();
            if (!granted) {
              console.log('Permisos de Bluetooth denegados, usando solo dispositivos manuales');
              Alert.alert(
                'Permisos de Bluetooth Requeridos',
                'Para ver dispositivos Bluetooth emparejados, necesitas otorgar permisos de Bluetooth.\n\nVe a Configuración > Aplicaciones > STPark > Permisos y habilita Bluetooth.',
                [{ text: 'OK' }]
              );
            } else {
              console.log('Permisos de Bluetooth otorgados, intentando obtener dispositivos...');
              // Intentar obtener dispositivos después de otorgar permisos
              try {
                const { NativeModules } = require('react-native');
                if (NativeModules.BluetoothManager) {
                  const pairedDevices = await NativeModules.BluetoothManager.getBondedDevices();
                  console.log('Dispositivos emparejados del sistema:', pairedDevices);
                  
                  if (pairedDevices && pairedDevices.length > 0) {
                    discoveredPrinters = pairedDevices.map((device: any) => ({
                      deviceName: device.name || 'Dispositivo Desconocido',
                      target: device.address || device.macAddress,
                      address: device.address || device.macAddress
                    }));
                  }
                }
              } catch (bluetoothError) {
                console.log('Error accediendo a dispositivos Bluetooth:', bluetoothError);
              }
            }
          }
        }
      } catch (nativeError) {
        console.log('Error obteniendo dispositivos del sistema:', nativeError);
        // Continuar con dispositivos manuales si falla la API nativa
      }
      
      // Combinar con dispositivos agregados manualmente
      console.log('Dispositivos emparejados manualmente:', this.pairedDevices);

      // Procesar impresoras descubiertas
      let printerDevices: PrinterDevice[] = [];
      if (discoveredPrinters && discoveredPrinters.length > 0) {
        printerDevices = discoveredPrinters.map((printer: any) => ({
          device_name: printer.deviceName || printer.name || 'Impresora Desconocida',
          inner_mac_address: printer.target || printer.address || 'MAC_DESCONOCIDA',
          target: printer.target || printer.address
        }));
      }

      // Combinar con dispositivos guardados manualmente
      const allDevices = [...printerDevices, ...this.pairedDevices];
      
      // Eliminar duplicados por MAC address
      const uniqueDevices = allDevices.filter((device, index, self) => 
        index === self.findIndex(d => d.inner_mac_address === device.inner_mac_address)
      );

      if (uniqueDevices.length > 0) {
        Alert.alert(
          'Dispositivos Disponibles',
          `Se encontraron ${uniqueDevices.length} dispositivo(s) disponible(s).\n\n${this.pairedDevices.length > 0 ? `• ${this.pairedDevices.length} guardado(s) manualmente\n` : ''}\nSelecciona uno para conectarte.`,
          [{ text: 'OK' }]
        );

        return uniqueDevices;
      } else {
        Alert.alert(
          'Sin Dispositivos Encontrados',
          'No se encontraron impresoras Bluetooth disponibles.\n\nPara agregar una impresora:\n• Ve a Configuración - Bluetooth\n• Empareja tu impresora térmica\n• Asegúrate de que esté encendida\n• Usa el botón "Agregar Dispositivo" para guardar la dirección MAC\n\nNota: El escaneo automático está temporalmente deshabilitado.',
          [{ text: 'OK' }]
        );
        return [];
      }
    } catch (error) {
      console.error('Error escaneando dispositivos:', error);
      Alert.alert(
        'Error',
        'No se pudieron escanear las impresoras Bluetooth.\n\nVerifica que:\n• Bluetooth esté habilitado\n• Tengas permisos de ubicación\n• La impresora esté encendida y emparejada',
        [{ text: 'OK' }]
      );
      return [];
    }
  }

  async connectToPrinter(device?: PrinterDevice): Promise<boolean> {
    try {
      // Verificar permisos de Bluetooth antes de conectar
      const hasPermissions = await bluetoothPermissionsService.checkAllPermissions();
      if (!hasPermissions) {
        console.log('Solicitando permisos de Bluetooth...');
        const permissionsGranted = await bluetoothPermissionsService.requestAllPermissions();
        if (!permissionsGranted) {
          Alert.alert(
            'Permisos Requeridos',
            'Esta app necesita permisos de Bluetooth y ubicación para conectarse a impresoras térmicas.\n\nVe a Configuración del dispositivo para habilitar los permisos.',
            [{ text: 'OK' }]
          );
          return false;
        }
      }

      // Si no se proporciona un dispositivo, usar la impresora seleccionada
      let targetDevice = device;
      if (!targetDevice) {
        const selectedPrinter = await bluetoothDevicesService.getSelectedPrinter();
        if (!selectedPrinter) {
          Alert.alert(
            'Sin Impresora Seleccionada',
            'No hay una impresora seleccionada.\n\nVe a Configuración > Impresora para seleccionar una impresora Bluetooth.',
            [{ text: 'OK' }]
          );
          return false;
        }
        
        // Convertir BluetoothDevice a PrinterDevice
        targetDevice = {
          device_name: selectedPrinter.name,
          inner_mac_address: selectedPrinter.address
        };
      }

      console.log('Conectando a:', targetDevice.device_name, targetDevice.inner_mac_address);

      if (this.isExpoGo) {
        // Solo simular en modo web/Expo Go
        console.log('Conexión simulada exitosa (modo web)');
      this.connected = true;
        this.connectedDevice = targetDevice;
        Alert.alert('Conectado', `Conectado a ${targetDevice.device_name} (modo web)`);
      return true;
    }

      // Usar la librería real para conectar
      try {
        console.log('Creando instancia de impresora con target:', targetDevice.target || targetDevice.inner_mac_address);
        
        // Crear instancia de impresora
        this.printerInstance = new Printer({
          target: targetDevice.target || targetDevice.inner_mac_address,
          deviceName: targetDevice.device_name,
        });

        console.log('Instancia de impresora creada, intentando conectar...');

        // Intentar conectar usando el sistema de cola de tareas
        await this.printerInstance.addQueueTask(async () => {
          console.log('Ejecutando tarea de conexión...');
          
          try {
            // Intentar conectar hasta que esté online
            await Printer.tryToConnectUntil(
              this.printerInstance!,
              (status) => {
                console.log('Estado de conexión:', status);
                return status.online.statusCode === PrinterConstants.TRUE;
              }
            );
            
            console.log('Conectado exitosamente a:', targetDevice.device_name);
      this.connected = true;
            this.connectedDevice = targetDevice;
            
            Alert.alert('Conectado', `Conectado exitosamente a ${targetDevice.device_name}`);
            return true;
          } catch (connectionError) {
            console.error('Error en tryToConnectUntil:', connectionError);
            throw connectionError;
          }
        });

      return true;
      } catch (printError) {
        console.error('Error en conexión:', printError);
        this.connected = false;
        this.connectedDevice = null;
        this.printerInstance = null;
        
        let errorMessage = 'Error desconocido';
        if (printError instanceof Error) {
          errorMessage = printError.message;
          
          // Mensajes más específicos según el tipo de error
          if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
            errorMessage = 'Timeout de conexión. La impresora no responde.';
          } else if (errorMessage.includes('permission') || errorMessage.includes('PERMISSION')) {
            errorMessage = 'Sin permisos de Bluetooth. Ve a Configuración del dispositivo.';
          } else if (errorMessage.includes('not found') || errorMessage.includes('NOT_FOUND')) {
            errorMessage = 'Dispositivo no encontrado. Verifica que esté emparejado.';
          } else if (errorMessage.includes('busy') || errorMessage.includes('BUSY')) {
            errorMessage = 'Dispositivo ocupado. Puede estar conectado a otra app.';
          }
        }
        
        Alert.alert(
          'Error de Conexión',
          `No se pudo conectar a "${targetDevice.device_name}".\n\nVerifica que:\n• La impresora esté encendida\n• Esté emparejada en Bluetooth\n• No esté conectada a otro dispositivo\n• Esté dentro del rango\n\nError: ${errorMessage}`,
          [{ text: 'OK' }]
        );
        return false;
      }
    } catch (error) {
      console.error('Error conectando:', error);
      Alert.alert('Error', 'Error al conectar con la impresora');
      return false;
    }
  }

  async disconnect(): Promise<boolean> {
    console.log('Desconectando impresora');

    if (this.isExpoGo) {
      // Solo simular en modo web/Expo Go
      console.log('Desconexión simulada (modo web)');
      this.connected = false;
      this.connectedDevice = null;
      Alert.alert('Desconectado', 'Impresora desconectada (modo web)');
      return true;
    }

    try {
      if (this.printerInstance) {
        await this.printerInstance.disconnect();
        this.printerInstance = null;
      }
      
      this.connected = false;
      this.connectedDevice = null;
      console.log('Desconectado exitosamente');
      Alert.alert('Desconectado', 'Impresora desconectada exitosamente');
      return true;
    } catch (error) {
      console.error('Error desconectando:', error);
      Alert.alert('Error', 'Error al desconectar la impresora');
      return false;
    }
  }

  async printTestTicket(): Promise<boolean> {
    if (!this.connected || !this.printerInstance) {
      Alert.alert('Error', 'No hay impresora conectada');
      return false;
    }

    if (this.isExpoGo) {
      // Solo simular en modo web/Expo Go
      Alert.alert(
        'Ticket de Prueba Impreso', 
        'En modo web. En app nativa se imprimiría:\n\n--- TICKET DE PRUEBA ---\n\nFecha: ' + new Date().toLocaleString('es-CL') + '\nPatente: ABCD12\n\n¡Gracias por su preferencia!'
      );
      return true;
    }

    try {
      console.log('Imprimiendo ticket de prueba...');

      await this.printerInstance.addQueueTask(async () => {
        // Verificar conexión antes de imprimir
        await Printer.tryToConnectUntil(
          this.printerInstance!,
          (status) => status.online.statusCode === PrinterConstants.TRUE
        );

        // Configurar impresora según la API correcta
        await (this.printerInstance as any).addTextAlign((PrinterConstants as any).ALIGN.CENTER);
        await (this.printerInstance as any).addTextSize({ width: 2, height: 2 });
        await (this.printerInstance as any).addText('TICKET DE PRUEBA\n');
        
        await (this.printerInstance as any).addTextSize({ width: 1, height: 1 });
        await (this.printerInstance as any).addText('========================\n');
        
        await (this.printerInstance as any).addTextAlign((PrinterConstants as any).ALIGN.LEFT);
        await (this.printerInstance as any).addText(`Fecha: ${new Date().toLocaleString('es-CL')}\n`);
        await (this.printerInstance as any).addText('Patente: ABCD12\n');
        await (this.printerInstance as any).addText('\n');
        await (this.printerInstance as any).addText('¡Gracias por su preferencia!\n');
        
        // Alimentar papel y cortar
        await (this.printerInstance as any).addFeedLine(3);
        await (this.printerInstance as any).addCut();
        
        // Enviar datos
        const result = await this.printerInstance!.sendData();
        console.log('Resultado de impresión:', result);
        
        Alert.alert('Éxito', 'Ticket de prueba impreso exitosamente');
        return result;
      });

      return true;
    } catch (error) {
      console.error('Error imprimiendo ticket de prueba:', error);
      
      let errorMessage = 'No se pudo imprimir el ticket de prueba';
      
      if (error instanceof Error) {
        if (error.message?.includes('Bluetooth')) {
          errorMessage = 'Error de Bluetooth. Verifica que la impresora esté emparejada y encendida.';
        } else if (error.message?.includes('MAC')) {
          errorMessage = 'Error de dirección MAC. Verifica que la impresora esté correctamente configurada.';
        } else if (error.message?.includes('timeout')) {
          errorMessage = 'Timeout de conexión. La impresora no responde.';
        }
      }
      
      Alert.alert('Error de Impresión', `${errorMessage}\n\nDetalles: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      return false;
    }
  }

  async printParkingTicket(data: any): Promise<boolean> {
    if (!this.connected || !this.printerInstance) {
      Alert.alert('Error', 'No hay impresora conectada');
      return false;
    }

    if (this.isExpoGo) {
      Alert.alert('Ticket Impreso', 'En modo web. En app nativa se imprimiría el ticket de estacionamiento.');
      return true;
    }

    try {
      console.log('Imprimiendo ticket de estacionamiento...');

      await this.printerInstance.addQueueTask(async () => {
        // Verificar conexión antes de imprimir
        await Printer.tryToConnectUntil(
          this.printerInstance!,
          (status) => status.online.statusCode === PrinterConstants.TRUE
        );

        // Configurar impresora
        await (this.printerInstance as any).addTextAlign((PrinterConstants as any).ALIGN.CENTER);
        await (this.printerInstance as any).addTextSize({ width: 2, height: 2 });
        await (this.printerInstance as any).addText('STPARK\n');
        
        await (this.printerInstance as any).addTextSize({ width: 1, height: 1 });
        await (this.printerInstance as any).addText('TICKET DE INGRESO\n');
        await (this.printerInstance as any).addText('========================\n');
        
        await (this.printerInstance as any).addTextAlign((PrinterConstants as any).ALIGN.LEFT);
        await (this.printerInstance as any).addText(`Patente: ${data.plate}\n`);
        await (this.printerInstance as any).addText(`Fecha: ${data.date}\n`);
        await (this.printerInstance as any).addText(`Hora: ${data.time}\n`);
        await (this.printerInstance as any).addText(`Sector: ${data.sector}\n`);
        await (this.printerInstance as any).addText(`Calle: ${data.street}\n`);
        await (this.printerInstance as any).addText('\n');
        await (this.printerInstance as any).addText('¡Gracias por usar STPark!\n');
        
        // Alimentar papel y cortar
        await (this.printerInstance as any).addFeedLine(3);
        await (this.printerInstance as any).addCut();
        
        // Enviar datos
        const result = await this.printerInstance!.sendData();
        console.log('Resultado de impresión:', result);
        
        return result;
      });

      return true;
    } catch (error) {
      console.error('Error imprimiendo ticket:', error);
      Alert.alert('Error', 'No se pudo imprimir el ticket');
      return false;
    }
  }

  async printPaymentReceipt(data: any): Promise<boolean> {
    if (!this.connected || !this.printerInstance) {
      Alert.alert('Error', 'No hay impresora conectada');
      return false;
    }

    if (this.isExpoGo) {
      Alert.alert('Recibo Impreso', 'En modo web. En app nativa se imprimiría el recibo de pago.');
      return true;
    }

    try {
      console.log('Imprimiendo recibo de pago...');

      await this.printerInstance.addQueueTask(async () => {
        // Verificar conexión antes de imprimir
        await Printer.tryToConnectUntil(
          this.printerInstance!,
          (status) => status.online.statusCode === PrinterConstants.TRUE
        );

        // Configurar impresora
        await (this.printerInstance as any).addTextAlign((PrinterConstants as any).ALIGN.CENTER);
        await (this.printerInstance as any).addTextSize({ width: 2, height: 2 });
        await (this.printerInstance as any).addText('STPARK\n');
        
        await (this.printerInstance as any).addTextSize({ width: 1, height: 1 });
        await (this.printerInstance as any).addText('RECIBO DE PAGO\n');
        await (this.printerInstance as any).addText('========================\n');
        
        await (this.printerInstance as any).addTextAlign((PrinterConstants as any).ALIGN.LEFT);
        await (this.printerInstance as any).addText(`Patente: ${data.plate}\n`);
        await (this.printerInstance as any).addText(`Fecha: ${data.date}\n`);
        await (this.printerInstance as any).addText(`Hora: ${data.time}\n`);
        await (this.printerInstance as any).addText(`Monto: $${data.amount}\n`);
        await (this.printerInstance as any).addText(`Método: ${data.paymentMethod}\n`);
        await (this.printerInstance as any).addText('\n');
        await (this.printerInstance as any).addText('¡Gracias por su pago!\n');
        
        // Alimentar papel y cortar
        await (this.printerInstance as any).addFeedLine(3);
        await (this.printerInstance as any).addCut();
        
        // Enviar datos
        const result = await this.printerInstance!.sendData();
        console.log('Resultado de impresión:', result);
        
        return result;
      });

      return true;
    } catch (error) {
      console.error('Error imprimiendo recibo:', error);
      Alert.alert('Error', 'No se pudo imprimir el recibo');
      return false;
    }
  }

  // Verificar si hay una impresora conectada
  isConnected(): boolean {
    return this.connected;
  }

  // Obtener dispositivo conectado
  getConnectedDevice(): PrinterDevice | null {
    return this.connectedDevice;
  }

  // Conectar a una impresora específica por dirección MAC
  async connectToSpecificPrinter(macAddress: string, deviceName?: string): Promise<boolean> {
    try {
      console.log('Conectando a impresora específica:', macAddress);

      // Verificar permisos de Bluetooth antes de conectar
      const hasPermissions = await bluetoothPermissionsService.checkAllPermissions();
      if (!hasPermissions) {
        console.log('Solicitando permisos de Bluetooth...');
        const permissionsGranted = await bluetoothPermissionsService.requestAllPermissions();
        if (!permissionsGranted) {
          Alert.alert(
            'Permisos Requeridos',
            'Esta app necesita permisos de Bluetooth y ubicación para conectarse a impresoras térmicas.\n\nVe a Configuración del dispositivo para habilitar los permisos.',
            [{ text: 'OK' }]
          );
          return false;
        }
      }

      // Crear objeto dispositivo con la MAC proporcionada
      const targetDevice: PrinterDevice = {
        device_name: deviceName || `Impresora ${macAddress}`,
        inner_mac_address: macAddress,
        target: macAddress
      };

      console.log('Conectando a:', targetDevice.device_name, targetDevice.inner_mac_address);

      if (this.isExpoGo) {
        // Solo simular en modo web/Expo Go
        console.log('Conexión simulada exitosa (modo web)');
        this.connected = true;
        this.connectedDevice = targetDevice;
        Alert.alert('Conectado', `Conectado a ${targetDevice.device_name} (modo web)`);
        return true;
      }

      // Usar la librería real para conectar
      try {
        console.log('Creando instancia de impresora con MAC:', macAddress);
        
        // Crear instancia de impresora
        this.printerInstance = new Printer({
          target: macAddress,
          deviceName: targetDevice.device_name,
        });

        console.log('Instancia de impresora creada, intentando conectar...');

        // Intentar conectar usando el sistema de cola de tareas
        await this.printerInstance.addQueueTask(async () => {
          console.log('Ejecutando tarea de conexión...');
          
          try {
            // Intentar conectar hasta que esté online
            await Printer.tryToConnectUntil(
              this.printerInstance!,
              (status) => {
                console.log('Estado de conexión:', status);
                return status.online.statusCode === PrinterConstants.TRUE;
              }
            );
            
            console.log('Conectado exitosamente a:', targetDevice.device_name);
            this.connected = true;
            this.connectedDevice = targetDevice;
            
            Alert.alert('Conectado', `Conectado exitosamente a ${targetDevice.device_name}`);
            return true;
          } catch (connectionError) {
            console.error('Error en tryToConnectUntil:', connectionError);
            throw connectionError;
          }
        });

        return true;
      } catch (printError) {
        console.error('Error en conexión:', printError);
        this.connected = false;
        this.connectedDevice = null;
        this.printerInstance = null;
        
        let errorMessage = 'Error desconocido';
        if (printError instanceof Error) {
          errorMessage = printError.message;
          
          // Mensajes más específicos según el tipo de error
          if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
            errorMessage = 'Timeout de conexión. La impresora no responde.';
          } else if (errorMessage.includes('permission') || errorMessage.includes('PERMISSION')) {
            errorMessage = 'Sin permisos de Bluetooth. Ve a Configuración del dispositivo.';
          } else if (errorMessage.includes('not found') || errorMessage.includes('NOT_FOUND')) {
            errorMessage = 'Dispositivo no encontrado. Verifica que esté emparejado.';
          } else if (errorMessage.includes('busy') || errorMessage.includes('BUSY')) {
            errorMessage = 'Dispositivo ocupado. Puede estar conectado a otra app.';
          }
        }
        
        Alert.alert(
          'Error de Conexión',
          `No se pudo conectar a la impresora con MAC "${macAddress}".\n\nVerifica que:\n• La impresora esté encendida\n• Esté emparejada en Bluetooth\n• No esté conectada a otro dispositivo\n• Esté dentro del rango\n\nError: ${errorMessage}`,
          [{ text: 'OK' }]
        );
        return false;
      }
    } catch (error) {
      console.error('Error conectando a impresora específica:', error);
      Alert.alert('Error', 'Error al conectar con la impresora específica');
      return false;
    }
  }

  // Imprimir texto personalizado
  async printCustomText(text: string): Promise<boolean> {
    if (!this.connected || !this.printerInstance) {
      Alert.alert('Error', 'No hay impresora conectada');
      return false;
    }

    if (this.isExpoGo) {
      // Solo simular en modo web/Expo Go
      Alert.alert(
        'Texto Impreso', 
        `En modo web. En app nativa se imprimiría:\n\n${text}`
      );
      return true;
    }

    try {
      console.log('Imprimiendo texto personalizado:', text);

      await this.printerInstance.addQueueTask(async () => {
        // Verificar conexión antes de imprimir
        await Printer.tryToConnectUntil(
          this.printerInstance!,
          (status) => status.online.statusCode === PrinterConstants.TRUE
        );

        // Configurar impresora
        await (this.printerInstance as any).addTextAlign((PrinterConstants as any).ALIGN.LEFT);
        await (this.printerInstance as any).addTextSize({ width: 1, height: 1 });
        await (this.printerInstance as any).addText(`${text}\n`);
        
        // Alimentar papel y cortar
        await (this.printerInstance as any).addFeedLine(2);
        await (this.printerInstance as any).addCut();
        
        // Enviar datos
        const result = await this.printerInstance!.sendData();
        console.log('Resultado de impresión:', result);
        
        Alert.alert('Éxito', 'Texto impreso exitosamente');
        return result;
      });

      return true;
    } catch (error) {
      console.error('Error imprimiendo texto personalizado:', error);
      
      let errorMessage = 'No se pudo imprimir el texto';
      
      if (error instanceof Error) {
        if (error.message?.includes('Bluetooth')) {
          errorMessage = 'Error de Bluetooth. Verifica que la impresora esté emparejada y encendida.';
        } else if (error.message?.includes('MAC')) {
          errorMessage = 'Error de dirección MAC. Verifica que la impresora esté correctamente configurada.';
        } else if (error.message?.includes('timeout')) {
          errorMessage = 'Timeout de conexión. La impresora no responde.';
        }
      }
      
      Alert.alert('Error de Impresión', `${errorMessage}\n\nDetalles: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      return false;
    }
  }

  // Verificar conexión real con la impresora
  async verifyConnection(): Promise<boolean> {
    if (!this.connected || !this.connectedDevice || !this.printerInstance) {
      return false;
    }

    if (this.isExpoGo) {
      return true; // En modo web, asumir que está conectada
    }

    try {
      // Verificar estado de conexión usando la librería real
      const status = await (this.printerInstance as any).getPrinterStatus();
      const isOnline = status.online.statusCode === PrinterConstants.TRUE;
      
      if (!isOnline) {
        this.connected = false;
        this.connectedDevice = null;
        this.printerInstance = null;
      }
      
      return isOnline;
    } catch (error) {
      console.error('Error verificando conexión:', error);
      // Si falla la verificación, marcar como desconectada
      this.connected = false;
      this.connectedDevice = null;
      this.printerInstance = null;
      return false;
    }
  }
}

// Exportar instancia singleton
export const bluetoothPrinterService = new BluetoothPrinterServiceImpl();

// Exponer el servicio globalmente para el frontend web
if (typeof window !== 'undefined') {
  (window as any).bluetoothPrinterService = bluetoothPrinterService;
}