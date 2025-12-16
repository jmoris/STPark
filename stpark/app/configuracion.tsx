import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { router } from 'expo-router';
import { CONFIG, updateServerUrl } from '@/config/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTenant } from '../contexts/TenantContext';
import { ReactNativePosPrinter, ThermalPrinterDevice } from 'react-native-thermal-pos-printer';
import { Platform } from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { bluetoothDevicesService } from '@/services/bluetoothDevices';
import { bluetoothPrinterService } from '@/services/bluetoothPrinter';
import { PrinterStatus } from 'react-native-thermal-pos-printer/src/types/printer';

import { TuuPrinter } from 'react-native-tuu-printer';

export default function ConfiguracionScreen() {
  const { tenantConfig, setTenant } = useTenant();
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanningDevices, setScanningDevices] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [impresoraConectada, setImpresoraConectada] = useState(false);
  const [selectedPrinterInfo, setSelectedPrinterInfo] = useState<{name: string, address: string, deviceObject?: any} | null>(null);
  const [notificacionesActivas, setNotificacionesActivas] = useState(true);
  const [modoOscuro, setModoOscuro] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [connectingDevice, setConnectingDevice] = useState<string | null>(null);
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceMac, setNewDeviceMac] = useState('');
  const [showDevicesModal, setShowDevicesModal] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [showServerModal, setShowServerModal] = useState(false);
  const [newServerUrl, setNewServerUrl] = useState('');
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [newTenant, setNewTenant] = useState('');
  const [pairedDevices, setPairedDevices] = useState<any[]>([]);
  const [loadingPairedDevices, setLoadingPairedDevices] = useState(false);
  const [tuuPrinterConnected, setTuuPrinterConnected] = useState(false);
  
  useEffect(() => {
    loadCustomServerUrl();
    loadSelectedPrinter();
    checkTuuPrinterConnection();
  }, []);

  // Función para verificar si hay una impresora TUU conectada
  const checkTuuPrinterConnection = async () => {
    try {
      await TuuPrinter.init();
      setTuuPrinterConnected(true);
      setImpresoraConectada(true);
      console.log('Impresora TUU detectada y conectada');
    } catch (error) {
      setTuuPrinterConnected(false);
      console.log('No hay impresora TUU conectada');
    }
  };

  // Función para refrescar el estado de la impresora
  const refreshPrinterStatus = async () => {
    console.log("Refrescando estado de la impresora...");
    await loadSelectedPrinter();
  };

  // Función para cargar la impresora seleccionada guardada
  const loadSelectedPrinter = async () => {
    try {
      const savedPrinter = await AsyncStorage.getItem('selectedPrinter');
      if (savedPrinter) {
        try {
          const savedPrinterObject = JSON.parse(savedPrinter);
          console.log("Impresora guardada:", savedPrinterObject);
          
          // Cargar la información de la impresora guardada
          setSelectedPrinterInfo(savedPrinterObject);
          
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
              // Verificar si está realmente conectado
              const isConnected = connectedDevice.isConnected && connectedDevice.isConnected();
              console.log("Estado de conexión:", isConnected);
              
              if (isConnected) {
                setImpresoraConectada(true);
                console.log("Impresora conectada correctamente");
              } else {
                // Intentar reconectar automáticamente
                console.log("Intentando reconectar automáticamente...");
                try {
                  await connectedDevice.connect({ 
                    timeout: 5000, 
                    encoding: 'UTF-8' 
                  });
                  setImpresoraConectada(true);
                  console.log("Reconectado automáticamente");
                } catch (reconnectError) {
                  console.log("No se pudo reconectar automáticamente:", reconnectError);
                  setImpresoraConectada(false);
                }
              }
            } else {
              console.log("Dispositivo no encontrado en la lista");
              setImpresoraConectada(false);
            }
          } catch (deviceError) {
            console.error('Error verificando dispositivos:', deviceError);
            setImpresoraConectada(false);
          }
        } catch (parseError) {
          console.error('Error parseando impresora guardada:', parseError);
          setImpresoraConectada(false);
          setSelectedPrinterInfo(null);
        }
      } else {
        console.log("No hay impresora guardada");
        setImpresoraConectada(false);
        setSelectedPrinterInfo(null);
      }
    } catch (error) {
      console.error('Error cargando impresora guardada:', error);
      setImpresoraConectada(false);
      setSelectedPrinterInfo(null);
    }
  };

  const checkBluetoothStatus = async () => {
    console.log("Checking Bluetooth status...");
    try {
      const devices = await ReactNativePosPrinter.getDeviceList();
      console.log("Devices found:", devices);
      
      if (devices && devices.length > 0) {
        // Verificar si hay algún dispositivo realmente conectado
        const connectedDevices = devices.filter((device: any) => {
          return device.isConnected && device.isConnected();
        });
        
        if (connectedDevices.length > 0) {
          console.log("Connected devices:", connectedDevices);
          setImpresoraConectada(true);
        } else {
          console.log("No devices are actually connected");
          setImpresoraConectada(false);
        }
      } else {
        console.log("No devices found");
        setImpresoraConectada(false);
      }
    } catch (error) {
      console.error("Error checking Bluetooth status:", error);
      setImpresoraConectada(false);
    }
  };

  // Función simple para obtener dispositivos Bluetooth emparejados
  const getPairedBluetoothDevices = async () => {
    try {
      console.log('Obteniendo dispositivos Bluetooth emparejados...');
      
      if (Platform.OS !== 'android') {
        Alert.alert('Info', 'Esta función solo está disponible en Android');
        return [];
      }

      // Verificar permisos de Bluetooth
      const bluetoothConnectPermission = await check(PERMISSIONS.ANDROID.BLUETOOTH_CONNECT);
      const bluetoothScanPermission = await check(PERMISSIONS.ANDROID.BLUETOOTH_SCAN);
      
      if (bluetoothConnectPermission !== RESULTS.GRANTED || bluetoothScanPermission !== RESULTS.GRANTED) {
        console.log('Solicitando permisos de Bluetooth...');
        
        const connectResult = await request(PERMISSIONS.ANDROID.BLUETOOTH_CONNECT);
        const scanResult = await request(PERMISSIONS.ANDROID.BLUETOOTH_SCAN);
        
        if (connectResult !== RESULTS.GRANTED || scanResult !== RESULTS.GRANTED) {
          Alert.alert(
            'Permisos Requeridos',
            'Se necesitan permisos de Bluetooth para ver dispositivos emparejados.\n\nVe a Configuración > Aplicaciones > STPark > Permisos y habilita Bluetooth.',
            [{ text: 'OK' }]
          );
          return [];
        }
      }

      // Usar ReactNativePosPrinter directamente
      console.log('Usando ReactNativePosPrinter para obtener dispositivos...');
      const devices = await ReactNativePosPrinter.getDeviceList();
      console.log('Dispositivos encontrados:', devices);
      
      if (devices && devices.length > 0) {
        return devices.map((device: any) => ({
          name: device.deviceName || device.name || 'Dispositivo',
          address: device.macAddress || device.address || 'Sin dirección',
          type: 'bluetooth'
        }));
      }
      
      return [];
      
      Alert.alert(
        'Estado de Bluetooth',
        'La librería de Bluetooth está funcionando correctamente.\n\nSin embargo, no se pudieron obtener dispositivos automáticamente.\n\nEsto puede deberse a:\n• No hay dispositivos Bluetooth emparejados\n• Los permisos no están completamente otorgados\n• La impresora no está en modo emparejamiento\n\nPuedes:\n• Emparejar tu impresora desde Configuración del teléfono\n• Agregar dispositivos manualmente con el botón "Agregar"\n• Verificar permisos con el botón "🔧 Probar Librería"',
        [{ text: 'OK' }]
      );
      
      return [];
      
    } catch (error) {
      console.error('Error obteniendo dispositivos Bluetooth:', error);
      Alert.alert(
        'Error',
        `No se pudieron obtener los dispositivos Bluetooth: ${error instanceof Error ? error.message : String(error)}`,
        [{ text: 'OK' }]
      );
      return [];
    }
  };

  // Función para probar la obtención de dispositivos Bluetooth
  const handleTestPairedDevices = async () => {
    setLoadingPairedDevices(true);
    try {
      const devices = await getPairedBluetoothDevices();
      setPairedDevices(devices);
      
      if (devices.length > 0) {
        Alert.alert(
          'Dispositivos Encontrados',
          `Se encontraron ${devices.length} dispositivo(s) Bluetooth emparejado(s):\n\n${devices.map((d: any) => `• ${d.name} (${d.address})`).join('\n')}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Sin Dispositivos',
          'No se encontraron dispositivos Bluetooth emparejados.\n\nAsegúrate de que:\n• Bluetooth esté habilitado\n• Tengas dispositivos emparejados\n• Los permisos estén otorgados',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error en prueba de dispositivos:', error);
      Alert.alert('Error', `Error obteniendo dispositivos: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoadingPairedDevices(false);
    }
  };

  const loadCustomServerUrl = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const customUrl = await AsyncStorage.getItem('custom_server_url');
      if (customUrl) {
        updateServerUrl(customUrl);
      }
    } catch (error) {
      console.error('Error cargando URL personalizada:', error);
    }
  };

  const checkPrinterStatus = () => {
    setImpresoraConectada(false);
  };

  const handleScanDevices = async () => {
    setScanningDevices(true);
    setAvailableDevices([]);
    try {
      console.log('Iniciando escaneo de dispositivos...');
      
      // Verificar permisos
      const bluetoothConnect = await check(PERMISSIONS.ANDROID.BLUETOOTH_CONNECT);
      const bluetoothScan = await check(PERMISSIONS.ANDROID.BLUETOOTH_SCAN);
      
      if (bluetoothConnect !== RESULTS.GRANTED || bluetoothScan !== RESULTS.GRANTED) {
        Alert.alert('Permisos Requeridos', 'Se necesitan permisos de Bluetooth para escanear dispositivos');
        return;
      }

      // Obtener dispositivos usando ReactNativePosPrinter
      const devices = await ReactNativePosPrinter.getDeviceList();
      console.log('Dispositivos encontrados:', devices);
      
      if (devices && devices.length > 0) {
        setAvailableDevices(devices);
        console.log('Dispositivos cargados en el modal:', devices.length);
      } else {
        setAvailableDevices([]);
        console.log('No se encontraron dispositivos');
      }
    } catch (error) {
      console.error('Error escaneando dispositivos:', error);
      Alert.alert('Error', 'No se pudieron obtener los dispositivos Bluetooth');
      setAvailableDevices([]);
    } finally {
      setScanningDevices(false);
    }
  };

  const handleSelectDevice = async (device: any) => {
    try {
      // Guardar directamente el objeto del dispositivo seleccionado
      const deviceAddress = device.device?.address || device.address;
      setSelectedDevice(device);
      setConnectingDevice(deviceAddress);

      console.log('Dispositivo seleccionado:', device);
      console.log('Dirección del dispositivo:', deviceAddress);

      // Usar directamente el objeto del dispositivo para conectar
      // Esto evita problemas de comparación por dirección MAC
      try {
        await device.connect({ 
          timeout: 5000, 
          encoding: 'UTF-8' 
        });
        console.log('Conectado exitosamente al dispositivo');
        
        // Imprimir texto de prueba
        const testText = `
================================
    CONEXIÓN EXITOSA
================================

STPark App
Fecha: ${new Date().toLocaleString('es-CL')}

Dispositivo: ${device.device?.name || device.name || 'Dispositivo'}
Dirección: ${deviceAddress}

¡Conexión establecida correctamente!

================================
`;
        
        await device.printText(testText);
        console.log('Texto de prueba enviado');
        
      } catch (connectError) {
        console.error('Error conectando directamente:', connectError);
        throw new Error(`Error de conexión: ${connectError instanceof Error ? connectError.message : String(connectError)}`);
      }
      
      // Guardar información específica de la impresora seleccionada
      const printerInfo = {
        name: device.device?.name || device.name || 'Dispositivo',
        address: deviceAddress,
        // Guardar también el objeto completo del dispositivo para uso futuro
        deviceObject: device
      };
      
      // Guardar en AsyncStorage
      await AsyncStorage.setItem('selectedPrinter', JSON.stringify(printerInfo));
      
      // Actualizar estado de conexión
      setSelectedPrinterInfo(printerInfo);
      setImpresoraConectada(true);
      
      console.log('Información de impresora guardada:', printerInfo);

      Alert.alert(
        'Dispositivo Conectado',
        `Se conectó exitosamente a:\n${printerInfo.name}\n\nDirección: ${printerInfo.address}\n\nYa puedes usar la impresora.`,
        [{ text: 'OK', onPress: () => setShowDeviceModal(false) }]
      );

      
    } catch (error) {
      console.error('Error conectando al dispositivo:', error);
      Alert.alert(
        'Error de Conexión',
        `No se pudo conectar al dispositivo:\n\n${error instanceof Error ? error.message : String(error)}\n\nAsegúrate de que el dispositivo esté encendido y disponible.`
      );
    } finally {
      setConnectingDevice(null);
    }
  };

  // Función para probar la impresora conectada
  const testConnectedPrinter = async () => {
    try {
      console.log('Probando impresora conectada...');
      
      if (!selectedPrinterInfo) {
        Alert.alert(
          'Sin Impresora Seleccionada',
          'No hay ninguna impresora seleccionada.\n\nPrimero conecta una impresora usando el botón "Buscar Dispositivos".',
          [{ text: 'OK' }]
        );
        return;
      }

      if (Platform.OS !== 'android') {
        Alert.alert('Info', 'Esta función solo está disponible en Android');
        return;
      }

      // Verificar permisos básicos
      const bluetoothConnect = await check(PERMISSIONS.ANDROID.BLUETOOTH_CONNECT);
      const bluetoothScan = await check(PERMISSIONS.ANDROID.BLUETOOTH_SCAN);
      
      if (bluetoothConnect !== RESULTS.GRANTED || bluetoothScan !== RESULTS.GRANTED) {
        Alert.alert('Permisos Requeridos', 'Se necesitan permisos de Bluetooth para imprimir');
        return;
      }

      try {
        let deviceToUse: ThermalPrinterDevice | null = null;
        
        // Buscar el dispositivo por dirección MAC
        console.log('Buscando dispositivo por dirección MAC...');
        const devices = await ReactNativePosPrinter.getDeviceList();
        console.log('Dispositivos disponibles:', devices);
        
        if (!devices || devices.length === 0) {
          Alert.alert(
            'Sin Dispositivos',
            'No hay dispositivos Bluetooth disponibles.\n\nLa conexión se perdió.',
            [{ text: 'OK' }]
          );
          setImpresoraConectada(false);
          return;
        }

        const foundDevice = devices.find((d: any) => {
          const deviceAddress = (d as any).device?.address || (d as any).address;
          return deviceAddress === selectedPrinterInfo.address;
        });
        
        if (!foundDevice) {
          Alert.alert(
            'Impresora No Encontrada',
            `No se encontró la impresora guardada:\n${selectedPrinterInfo.name}\n\nDirección: ${selectedPrinterInfo.address}\n\nPuede que se haya desconectado. Vuelve a conectarla.`,
            [{ text: 'OK' }]
          );
          setImpresoraConectada(false);
          return;
        }

        // Crear instancia de ThermalPrinterDevice
        const nativeDevice = (foundDevice as any).device || foundDevice;
        deviceToUse = new ThermalPrinterDevice(nativeDevice);
        console.log('Dispositivo creado para prueba:', deviceToUse);
        
        // Verificar conexión y conectar si es necesario
        const isConnected = await deviceToUse.checkConnectionStatus();
        if (!isConnected) {
          console.log('Dispositivo no conectado, intentando conectar...');
          try {
            await deviceToUse.connect();
            console.log('Conectado exitosamente a la impresora');
            
            // Actualizar el estado de conexión
            setImpresoraConectada(true);
            
          } catch (connectError) {
            console.error('Error conectando a la impresora:', connectError);
            Alert.alert(
              'Error de Conexión',
              `No se pudo conectar a la impresora:\n\n${selectedPrinterInfo.name}\n\nDirección: ${selectedPrinterInfo.address}\n\nError: ${connectError instanceof Error ? connectError.message : String(connectError)}\n\nAsegúrate de que:\n• La impresora esté encendida\n• Esté en modo de emparejamiento\n• Esté cerca del dispositivo`,
              [{ text: 'OK' }]
            );
            setImpresoraConectada(false);
            return;
          }
        } else {
          console.log('Dispositivo ya está conectado');
        }
        
        // Intentar imprimir directamente
        console.log('Intentando imprimir directamente...');
        try {
          // Imprimir ticket de prueba
          const testText = `
================================
        TICKET DE PRUEBA
================================

STPark App
Fecha: ${new Date().toLocaleString('es-CL')}

Impresora: ${selectedPrinterInfo.name}
Dirección: ${selectedPrinterInfo.address}

Este es un ticket de prueba para
verificar que la impresora funciona
correctamente.

================================
        ¡IMPRESIÓN EXITOSA!
================================

`;
          
          await deviceToUse.printText(testText);
          console.log('Ticket de prueba enviado a impresora');
          
          Alert.alert(
            'Prueba Exitosa',
            `Se envió un ticket de prueba a:\n${selectedPrinterInfo.name}\n\nDirección: ${selectedPrinterInfo.address}\n\nRevisa tu impresora para ver el resultado.`,
            [{ text: 'OK' }]
          );
          
        } catch (printError) {
          console.error('Error al imprimir:', printError);
          Alert.alert(
            'Error de Impresión',
            `No se pudo imprimir en la impresora:\n\n${selectedPrinterInfo.name}\n\nError: ${printError instanceof Error ? printError.message : String(printError)}\n\nPosibles causas:\n• La impresora no está realmente conectada\n• Está siendo usada por otra aplicación\n• Hay un problema de comunicación`,
            [{ text: 'OK' }]
          );
        }
        
      } catch (libraryError) {
        console.error('Error con la impresión:', libraryError);
        Alert.alert('Error', `Error al imprimir: ${libraryError instanceof Error ? libraryError.message : String(libraryError)}`);
      }
      
    } catch (error) {
      console.error('Error general:', error);
      Alert.alert('Error', `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const testTuuPrinter = async () => {
    try {
      console.log('Iniciando prueba de impresión...');
      await TuuPrinter.init();  
      await TuuPrinter.addTextLine('=============================', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('TICKET DE PRUEBA', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('=============================', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('STPark App', {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('Fecha: ' + new Date().toLocaleString('es-CL'), {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addBlankLines(1);
      await TuuPrinter.addTextLine('Este es un ticket de prueba para verificar que la impresora funciona correctamente.', {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addBlankLines(1);
      await TuuPrinter.addTextLine('=============================', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('IMPRESIÓN EXITOSA', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('=============================', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addBlankLines(1);
      // Agregar timbre PDF417
      const testPdf417Data = '<TED version=\"1.0\"><DD><RE>77192227-9</RE><TD>39</TD><F>478</F><FE>2025-12-15</FE><RR>66666666-6</RR><RSR>66666666-6</RSR><MNT>500</MNT><IT1>Estacionamiento</IT1><CAF version=\"1.0\"><DA><RE>77192227-9</RE><RS>INGENIERIA Y CONSTRUCCION SOLUCIONTOTAL</RS><TD>39</TD><RNG><D>477</D><H>481</H></RNG><FA>2025-12-15</FA><RSAPK><M>t+xZCSFbOp/5Na6dLuqwTCbkFs++CroilzEYhg+GppwkP9NO5c6Ah41u65ymaiDy08HAQgm+KyQDHNmlt7e9sw==</M><E>Aw==</E></RSAPK><IDK>100</IDK></DA><FRMA algoritmo=\"SHA1withRSA\">CaoNU3QLABD1bvH+t7QhSnk8tCViMUhpqHQCWYAMe0zvME1/eydhoxAt/zFxsybL90hc0LmI0fBYwHQPobRs/g==</FRMA></CAF><TSTED>2025-12-15T01:41:35</TSTED></DD><FRMT algoritmo=\"SHA1withRSA\">BGOs+0HIjx43qKlxTPZC6+JI1V6BFzGtgF+jtXnElEIjSrBjoa/U3l1usRswkgRFq2w+yZPypT6g1IqrjU+lVg==</FRMT></TED>';
      await TuuPrinter.addPdf417(testPdf417Data, { align: 1, width: 384, height: 192 });
      await TuuPrinter.addBlankLines(5);
      await TuuPrinter.beginPrint();
    } catch (error) {
      console.error('Error al probar la impresora:', error);
      Alert.alert('Error', `Error al probar la impresora: ${error instanceof Error ? error.message : String(error)}`);
    }
    
  };

  const testPrinter = async () => {
    let tuuPrinter = true;
    try{
      await TuuPrinter.init();
    } catch (error) {
      tuuPrinter = false;
    }

    console.log('TuuPrinter:', tuuPrinter);
    if(tuuPrinter){
      setTuuPrinterConnected(true);
      setImpresoraConectada(true);
      testTuuPrinter();
      return;
    }
    if(!tuuPrinter){
      setTuuPrinterConnected(false);
      testConnectedPrinter();
      return;
    }
  }

  // Función para desconectar la impresora
  const disconnectPrinter = async () => {
    try {
      console.log('Desconectando impresora...');
      
      if (!impresoraConectada) {
        Alert.alert('Info', 'No hay ninguna impresora conectada');
        return;
      }

      // Obtener dispositivos y desconectar el conectado
      const devices = await ReactNativePosPrinter.getDeviceList();
      const connectedDevice = devices.find((d: any) => (d as any).connected);
      
      if (connectedDevice) {
        try {
          await connectedDevice.disconnect();
          console.log('Dispositivo desconectado');
        } catch (disconnectError) {
          console.log('Error al desconectar:', disconnectError);
        }
      }
      
      // Limpiar información guardada
      await AsyncStorage.removeItem('selectedPrinter');
      
      // Actualizar estado
      setImpresoraConectada(false);
      setSelectedDevice(null);
      setSelectedPrinterInfo(null);
      
      Alert.alert(
        'Desconectado',
        'La impresora se ha desconectado correctamente.',
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('Error desconectando:', error);
      Alert.alert('Error', `Error al desconectar: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Función para reconectar la impresora guardada
  const reconnectSavedPrinter = async () => {
    try {
      if (!selectedPrinterInfo) {
        Alert.alert('Error', 'No hay ninguna impresora guardada para reconectar');
        return;
      }

      console.log('Reconectando impresora guardada:', selectedPrinterInfo);
      
      // Obtener dispositivos disponibles
      const devices = await ReactNativePosPrinter.getDeviceList();
      const targetDevice = devices.find((d: any) => {
        const deviceAddress = (d as any).device?.address || (d as any).address;
        return deviceAddress === selectedPrinterInfo.address;
      });

      if (!targetDevice) {
        Alert.alert(
          'Impresora No Encontrada',
          `No se encontró la impresora guardada:\n\n${selectedPrinterInfo.name}\n\nDirección: ${selectedPrinterInfo.address}\n\nAsegúrate de que esté encendida y emparejada.`,
          [{ text: 'OK' }]
        );
        return;
      }

      // Intentar conectar
      try {
        await targetDevice.connect({ 
          timeout: 5000, 
          encoding: 'UTF-8' 
        });
        console.log('Reconectado exitosamente');
        
        // Verificar conexión
        const devicesAfterConnect = await ReactNativePosPrinter.getDeviceList();
        const connectedDevice = devicesAfterConnect.find((d: any) => {
          const deviceAddress = (d as any).device?.address || (d as any).address;
          return deviceAddress === selectedPrinterInfo.address && (d as any).connected;
        });

        if (connectedDevice) {
          setImpresoraConectada(true);
          Alert.alert(
            'Reconectado',
            `Se reconectó exitosamente a:\n${selectedPrinterInfo.name}`,
            [{ text: 'OK' }]
          );
        } else {
          throw new Error('No se pudo establecer la conexión');
        }

      } catch (connectError) {
        console.error('Error reconectando:', connectError);
        Alert.alert(
          'Error de Reconexión',
          `No se pudo reconectar a la impresora:\n\n${selectedPrinterInfo.name}\n\nError: ${connectError instanceof Error ? connectError.message : String(connectError)}\n\nAsegúrate de que:\n• La impresora esté encendida\n• Esté cerca del dispositivo\n• No esté siendo usada por otra app`,
          [{ text: 'OK' }]
        );
      }

    } catch (error) {
      console.error('Error general reconectando:', error);
      Alert.alert('Error', `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleAddDevice = async () => {
    if (!newDeviceName.trim() || !newDeviceMac.trim()) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    // Validar formato de MAC address básico
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(newDeviceMac)) {
      Alert.alert('Error', 'Formato de dirección MAC inválido. Usa formato: XX:XX:XX:XX:XX:XX');
      return;
    }

    setShowDeviceModal(false);
  };    

  const handleTestPrint = async () => {
    try {
      console.log('Iniciando prueba de impresión...');
      
      // Verificar si hay una impresora seleccionada
      const selectedPrinter = await bluetoothDevicesService.getSelectedPrinter();
      if (!selectedPrinter) {
        Alert.alert(
          'Sin Impresora Seleccionada',
          'No hay una impresora seleccionada.\n\nVe a Configuración > Impresora para seleccionar una impresora Bluetooth.',
          [{ text: 'OK' }]
        );
        return;
      }

      console.log('Impresora seleccionada:', selectedPrinter);

      // Conectar a la impresora seleccionada
      const connected = await bluetoothPrinterService.connectToPrinter();
      if (!connected) {
        Alert.alert(
          'Error de Conexión',
          `No se pudo conectar a la impresora:\n\n${selectedPrinter.name}\n\nDirección: ${selectedPrinter.address}\n\nAsegúrate de que:\n• La impresora esté encendida\n• Esté emparejada en Bluetooth\n• No esté conectada a otro dispositivo`,
          [{ text: 'OK' }]
        );
        return;
      }

      // Texto de prueba para imprimir
      const testText = `
================================
        PRUEBA DE IMPRESIÓN
================================

STPark App
Fecha: ${new Date().toLocaleString('es-CL')}

Impresora: ${selectedPrinter.name}
Dirección: ${selectedPrinter.address}

Este es un ticket de prueba para
verificar que la impresora funciona
correctamente.

================================
¡Gracias por usar STPark!
================================`;

      // Imprimir el texto de prueba
      const printed = await bluetoothPrinterService.printCustomText(testText);
      
      if (printed) {
        Alert.alert(
          'Prueba Exitosa',
          `Se conectó e imprimió exitosamente en:\n\n${selectedPrinter.name}\nDirección: ${selectedPrinter.address}\n\nRevisa tu impresora para ver el ticket de prueba.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Error de Impresión',
          'No se pudo imprimir el texto de prueba. Verifica que la impresora esté funcionando correctamente.',
          [{ text: 'OK' }]
        );
      }

    } catch (error) {
      console.error('Error en prueba de impresión:', error);
      Alert.alert(
        'Error',
        `Error durante la prueba de impresión:\n\n${error instanceof Error ? error.message : 'Error desconocido'}`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleTestTicket = async () => {
    Alert.alert('Éxito', 'Ticket de prueba impreso correctamente');
  };

  // Ejemplo de conexión específica por MAC
  const handleConnectSpecificPrinter = async () => {
    try {
      // Ejemplo con una MAC específica (cambia por la de tu impresora)
      const macAddress = '00:11:22:33:44:55';
      const deviceName = 'Mi Impresora Térmica';
      
      console.log('Conectando a impresora específica:', macAddress);
      
      // Conectar a la impresora específica
      const connected = await bluetoothPrinterService.connectToSpecificPrinter(macAddress, deviceName);
      
      if (connected) {
        // Si se conectó exitosamente, imprimir un texto de prueba
        const testText = `¡Conectado a impresora específica!\n\nMAC: ${macAddress}\nNombre: ${deviceName}\nFecha: ${new Date().toLocaleString('es-CL')}\n\n¡Funciona perfectamente!`;
        
        await bluetoothPrinterService.printCustomText(testText);
        
        Alert.alert(
          'Conexión Exitosa',
          `Conectado e impreso en:\n${deviceName}\nMAC: ${macAddress}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error en conexión específica:', error);
      Alert.alert(
        'Error',
        'No se pudo conectar a la impresora específica. Verifica que la MAC sea correcta y la impresora esté emparejada.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleOpenServerModal = async () => {
    // Cargar la URL actual del servidor
    const currentUrl = await AsyncStorage.getItem('custom_server_url') || CONFIG.API_BASE_URL;
    setNewServerUrl(currentUrl);
    setShowServerModal(true);
  };

  const handleSaveServer = async () => {
    if (!newServerUrl.trim()) {
      Alert.alert('Error', 'La URL del servidor no puede estar vacía');
      return;
    }

    // Validar formato de URL
    const urlPattern = /^https?:\/\/.+/;
    if (!urlPattern.test(newServerUrl.trim())) {
      Alert.alert('Error', 'La URL debe comenzar con http:// o https://');
      return;
    }

    try {
      // Guardar la nueva URL del servidor
      await AsyncStorage.setItem('custom_server_url', newServerUrl.trim());
      
      // Actualizar la configuración
      updateServerUrl(newServerUrl.trim());
      
      Alert.alert(
        'Servidor Actualizado', 
        `El servidor se ha cambiado a: ${newServerUrl.trim()}`,
        [{ text: 'OK', onPress: () => setShowServerModal(false) }]
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la configuración del servidor');
    }
  };

  const handleResetServer = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.removeItem('custom_server_url');
      
      // Restaurar la configuración original
      updateServerUrl('http://192.168.1.34:8000/api');
      
      Alert.alert(
        'Servidor Restaurado',
        'Se ha restaurado la configuración original del servidor.',
        [{ text: 'OK', onPress: () => setShowServerModal(false) }]
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudo restaurar la configuración del servidor');
    }
  };

  const handleSaveTenant = async () => {
    if (!newTenant.trim()) {
      Alert.alert('Error', 'El estacionamiento es requerido');
      return;
    }

    if (newTenant.trim().length < 2) {
      Alert.alert('Error', 'El estacionamiento debe tener al menos 2 caracteres');
      return;
    }

    // Validar que solo contenga letras, números y guiones
    const tenantRegex = /^[a-zA-Z0-9-_]+$/;
    if (!tenantRegex.test(newTenant.trim())) {
      Alert.alert('Error', 'Solo se permiten letras, números y guiones');
      return;
    }

    try {
      const success = await setTenant(newTenant.trim());
      if (success) {
        Alert.alert(
          'Estacionamiento Actualizado',
          `El estacionamiento se ha cambiado a: ${newTenant.trim()}\n\nSe ha cerrado la sesión del operador para reconectarse con el nuevo estacionamiento.`,
          [{ text: 'OK', onPress: () => setShowTenantModal(false) }]
        );
        setNewTenant('');
      } else {
        Alert.alert('Error', 'No se pudo guardar la configuración del estacionamiento');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la configuración del estacionamiento');
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
      marginBottom: 40,
    },
    title: {
      fontSize: 28,
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
      marginBottom: 20,
    },
    backButton: {
      position: 'absolute',
      top: 20,
      left: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: 20,
      padding: 10,
      zIndex: 1,
    },
    configSection: {
      backgroundColor: '#ffffff',
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#043476',
      marginBottom: 15,
    },
    configItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#e9ecef',
    },
    configItemLast: {
      borderBottomWidth: 0,
    },
    configLabel: {
      fontSize: 16,
      color: '#000000',
      flex: 1,
    },
    configValue: {
      fontSize: 14,
      color: '#6c757d',
    },
    configButton: {
      backgroundColor: '#043476',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    configButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },
    statusIndicator: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: 8,
    },
    statusConnected: {
      backgroundColor: '#28a745',
    },
    statusDisconnected: {
      backgroundColor: '#dc3545',
    },
    statusText: {
      fontSize: 14,
      fontWeight: '600',
      flexWrap: 'wrap',
      textAlign: 'left',
    },
    statusContainer: {
      flex: 1,
    },
    statusHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    statusConnectedText: {
      color: '#28a745',
    },
    statusDisconnectedText: {
      color: '#dc3545',
    },
    infoSection: {
      backgroundColor: '#f8f9fa',
      borderRadius: 12,
      padding: 16,
      marginTop: 10,
    },
    infoTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#043476',
      marginBottom: 8,
    },
    infoText: {
      fontSize: 12,
      color: '#6c757d',
      lineHeight: 18,
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
    modalContent: {
      backgroundColor: '#ffffff',
      borderRadius: 12,
      padding: 0,
      flex: 1,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    modalBody: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 20,
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
    loadingContainer: {
      alignItems: 'center',
      padding: 40,
    },
    loadingText: {
      fontSize: 16,
      color: '#6c757d',
      marginTop: 16,
    },
    retryButton: {
      backgroundColor: '#043476',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 8,
    },
    retryButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    halfButton: {
      flex: 1,
      minWidth: 100,
    },
    addButton: {
      backgroundColor: '#28A745',
    },
    inputLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: '#333',
      marginBottom: 8,
      marginTop: 16,
    },
    textInput: {
      borderWidth: 1,
      borderColor: '#DDD',
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      backgroundColor: '#FFF',
      color: '#333',
    },
    helpText: {
      fontSize: 14,
      color: '#666',
      marginTop: 16,
      lineHeight: 20,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 24,
    },
    modalButton: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: '#F8F9FA',
      borderWidth: 1,
      borderColor: '#DDD',
    },
    confirmButton: {
      backgroundColor: '#007AFF',
    },
    cancelButtonText: {
      color: '#666',
      fontSize: 16,
      fontWeight: '600',
    },
    confirmButtonText: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '600',
    },
    closeButton: {
      padding: 8,
    },
    closeButtonText: {
      fontSize: 18,
      color: '#666',
    },
    selectedDeviceItem: {
      backgroundColor: '#E3F2FD',
      borderColor: '#2196F3',
      borderWidth: 2,
    },
    selectedIndicator: {
      backgroundColor: '#2196F3',
      borderRadius: 12,
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedText: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: 'bold',
    },
    deviceStatus: {
      fontSize: 12,
      color: '#666',
      marginTop: 2,
    },
    selectedPrinterActions: {
      marginTop: 20,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: '#DDD',
    },
    clearButton: {
      backgroundColor: '#FF5722',
    },
    clearButtonText: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '600',
    },
    emptyState: {
      alignItems: 'center',
      padding: 40,
    },
    emptyStateText: {
      fontSize: 16,
      color: '#666',
      textAlign: 'center',
      lineHeight: 22,
    },
    permissionsButton: {
      backgroundColor: '#FF9800',
      marginTop: 10,
    },
    testButton: {
      backgroundColor: '#4CAF50',
      marginTop: 10,
    },
    diagnosticButton: {
      backgroundColor: '#2196F3',
      marginTop: 10,
    },
    infoButton: {
      backgroundColor: '#9C27B0',
      marginTop: 10,
    },
    printButton: {
      backgroundColor: '#FF5722',
      marginTop: 10,
    },
    deviceButton: {
      backgroundColor: '#4CAF50',
      marginTop: 10,
    },
    disconnectButton: {
      backgroundColor: '#F44336',
      marginTop: 10,
    },
    reconnectButton: {
      backgroundColor: '#FF9800',
      marginTop: 10,
    },
    // Estilos para la lista de dispositivos
    deviceListContainer: {
      flex: 1,
      marginTop: 10,
    },
    deviceListTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#333',
      marginBottom: 10,
      textAlign: 'center',
    },
    deviceList: {
      flex: 1,
    },
    deviceItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 15,
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
      backgroundColor: '#fff',
    },
    deviceItemSelected: {
      backgroundColor: '#e3f2fd',
    },
    deviceInfo: {
      flex: 1,
    },
    deviceName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#333',
      marginBottom: 4,
    },
    deviceAddress: {
      fontSize: 14,
      color: '#666',
    },
    deviceAction: {
      marginLeft: 10,
    },
    // Estilos para el modal del servidor
    modalDescription: {
      fontSize: 16,
      color: '#666',
      marginBottom: 20,
      textAlign: 'center',
      lineHeight: 22,
    },
    currentServerText: {
      fontSize: 14,
      color: '#666',
      fontStyle: 'italic',
      textAlign: 'center',
    },
    modalFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 20,
      gap: 10,
    },
    resetButton: {
      backgroundColor: '#FF9800',
    },
    resetButtonText: {
      color: '#FFF',
      fontSize: 14,
      fontWeight: '600',
    },
    saveButton: {
      backgroundColor: '#4CAF50',
    },
    saveButtonText: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '600',
    },
    // Estilos para modal de cambiar estacionamiento (compacto)
    tenantModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    tenantModalContainer: {
      backgroundColor: '#ffffff',
      borderRadius: 20,
      padding: 24,
      marginHorizontal: 20,
      maxWidth: 400,
      width: '100%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 12,
    },
    tenantModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    tenantModalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#043476',
      flex: 1,
    },
    tenantModalCloseButton: {
      padding: 4,
    },
    tenantModalBody: {
      marginBottom: 20,
    },
    tenantModalDescription: {
      fontSize: 14,
      color: '#666',
      marginBottom: 16,
      lineHeight: 20,
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
      marginBottom: 12,
    },
    tenantCurrentText: {
      fontSize: 14,
      color: '#666',
      fontStyle: 'italic',
      textAlign: 'center',
    },
    tenantModalFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 8,
    },
    tenantModalButton: {
      flex: 1,
      padding: 14,
      borderRadius: 8,
      alignItems: 'center',
    },
    tenantModalButtonFullWidth: {
      width: '100%',
      padding: 14,
      borderRadius: 8,
      alignItems: 'center',
    },
    tenantModalCancelButton: {
      backgroundColor: '#F8F9FA',
      borderWidth: 1,
      borderColor: '#DDD',
    },
    tenantModalSaveButton: {
      backgroundColor: '#4CAF50',
    },
    tenantModalCancelButtonText: {
      color: '#666',
      fontSize: 16,
      fontWeight: '600',
    },
    tenantModalSaveButtonText: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '600',
    },
    tenantModalResetButton: {
      backgroundColor: '#FF9800',
    },
    tenantModalResetButtonText: {
      color: '#FFF',
      fontSize: 14,
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <IconSymbol size={24} name="arrow.left" color="#ffffff" />
      </TouchableOpacity>
      
      <KeyboardAwareScrollView>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <IconSymbol size={50} name="gear" color="#ffffff" />
          </View>
          <Text style={styles.title}>Configuración</Text>
          <Text style={styles.subtitle}>Ajustes y preferencias de la aplicación</Text>
        </View>

        {/* Sección de Impresora */}
        <View style={styles.configSection}>
          <Text style={styles.sectionTitle}>Configuración de Impresora</Text>
          
          <View style={styles.configItem}>
            <View style={styles.statusContainer}>
              <View style={styles.statusHeader}>
                <View style={[
                  styles.statusIndicator,
                  tuuPrinterConnected || impresoraConectada ? styles.statusConnected : styles.statusDisconnected
                ]} />
                <Text style={styles.configLabel}>Estado de conexión</Text>
              </View>
              <Text style={[
                styles.statusText,
                tuuPrinterConnected || impresoraConectada ? styles.statusConnectedText : styles.statusDisconnectedText
              ]} numberOfLines={2}>
                {tuuPrinterConnected 
                  ? 'Conectada (Impresora TUU)' 
                  : impresoraConectada && selectedPrinterInfo 
                    ? `Conectada a ${selectedPrinterInfo.name}` 
                    : selectedPrinterInfo 
                      ? `Guardada: ${selectedPrinterInfo.name}\n(No conectada)`
                      : 'Desconectada'}
              </Text>
            </View>
          </View>

          {/* Botón para refrescar estado de la impresora - Solo visible si NO hay impresora TUU */}
          {!tuuPrinterConnected && (
            <View style={styles.configItem}>
              <Text style={styles.configLabel}>Refrescar Estado</Text>
              <TouchableOpacity
                style={[styles.configButton, styles.diagnosticButton]}
                onPress={refreshPrinterStatus}
              >
                <Text style={styles.configButtonText}>🔄 Refrescar</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Botón para reconectar impresora guardada - Solo visible si NO hay impresora TUU */}
          {!tuuPrinterConnected && selectedPrinterInfo && !impresoraConectada && (
            <View style={styles.configItem}>
              <Text style={styles.configLabel}>Reconectar Impresora</Text>
              <TouchableOpacity
                style={[styles.configButton, styles.reconnectButton]}
                onPress={reconnectSavedPrinter}
              >
                <Text style={styles.configButtonText}>🔄 Reconectar</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Botón para buscar dispositivos - Solo visible si NO hay impresora TUU */}
          {!tuuPrinterConnected && (
            <View style={styles.configItem}>
              <Text style={styles.configLabel}>Buscar Dispositivos</Text>
              <TouchableOpacity
                style={[styles.configButton, styles.deviceButton]}
                onPress={() => {
                  setShowDeviceModal(true);
                  handleScanDevices();
                }}
              >
                <Text style={styles.configButtonText}>📱 Buscar Dispositivos</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Información de impresora Bluetooth - Solo visible si NO hay impresora TUU */}
          {!tuuPrinterConnected && (
            <>
              <View style={styles.configItem}>
                <Text style={styles.configLabel}>Impresora Seleccionada</Text>
                <Text style={styles.configValue}>
                  {selectedPrinterInfo ? selectedPrinterInfo.name : 'Ninguna seleccionada'}
                </Text>
              </View>

              {selectedPrinterInfo && (
                <View style={styles.configItem}>
                  <Text style={styles.configLabel}>Dirección MAC</Text>
                  <Text style={styles.configValue}>
                    {selectedPrinterInfo.address}
                  </Text>
                </View>
              )}

              <View style={styles.configItem}>
                <Text style={styles.configLabel}>Estado de Conexión</Text>
                <Text style={styles.configValue}>
                  {impresoraConectada ? 'Conectada' : 'Desconectada'}
                </Text>
              </View>
            </>
          )}

          {/* Botón para probar impresora conectada */}
          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Probar Impresora</Text>
            <TouchableOpacity
              style={[styles.configButton, styles.testButton]}
              onPress={testPrinter}
            >
              <Text style={styles.configButtonText}>🖨️ Probar Impresora</Text>
            </TouchableOpacity>
          </View>

          {/* Botón para desconectar impresora - Solo visible si NO hay impresora TUU */}
          {!tuuPrinterConnected && (
            <View style={styles.configItem}>
              <Text style={styles.configLabel}>Desconectar</Text>
              <TouchableOpacity
                style={[styles.configButton, styles.disconnectButton]}
                onPress={disconnectPrinter}
              >
                <Text style={styles.configButtonText}>🔌 Desconectar</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>Información</Text>
            <Text style={styles.infoText}>
              {tuuPrinterConnected 
                ? 'La impresora TUU está conectada y lista para imprimir tickets de estacionamiento y recibos de pago. No se requiere configuración adicional de Bluetooth.'
                : 'La impresora se usa para imprimir tickets de estacionamiento y recibos de pago. Asegúrate de que esté encendida y en modo de emparejamiento antes de conectar.'}
            </Text>
          </View>
        </View>

        {/* Sección de Aplicación */}
        <View style={styles.configSection}>
          <Text style={styles.sectionTitle}>Aplicación</Text>
          

          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Estacionamiento</Text>
            <TouchableOpacity
              style={styles.configButton}
              onPress={() => {
                setNewTenant(tenantConfig.tenant);
                setShowTenantModal(true);
              }}
            >
              <Text style={styles.configButtonText}>Cambiar</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.configItem, styles.configItemLast]}>
            <Text style={styles.configLabel}>Servidor</Text>
            <TouchableOpacity
              style={styles.configButton}
              onPress={handleOpenServerModal}
            >
              <Text style={styles.configButtonText}>Cambiar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Información de la App */}
        <View style={styles.configSection}>
          <Text style={styles.sectionTitle}>Información</Text>
          
          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Versión</Text>
            <Text style={styles.configValue}>{CONFIG.VERSION}</Text>
          </View>

          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Estacionamiento</Text>
            <Text style={styles.configValue}>{tenantConfig.tenant || 'No configurado'}</Text>
          </View>

          <View style={styles.configItem}>
            <Text style={styles.configLabel}>Servidor</Text>
            <Text style={styles.configValue}>{CONFIG.API_BASE_URL}</Text>
          </View>

          <View style={[styles.configItem, styles.configItemLast]}>
            <Text style={styles.configLabel}>Desarrollado por</Text>
            <Text style={styles.configValue}>SoluciónTotal Chile</Text>
          </View>
        </View>
      </KeyboardAwareScrollView>

      {/* Modal de dispositivos Bluetooth */}
      <Modal
        visible={showDeviceModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDeviceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Dispositivos Bluetooth</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowDeviceModal(false)}
              >
                <IconSymbol size={24} name="xmark.circle.fill" color="#6c757d" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              {scanningDevices ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#043476" />
                  <Text style={styles.loadingText}>Escaneando dispositivos...</Text>
                </View>
              ) : availableDevices.length > 0 ? (
                <View style={styles.deviceListContainer}>
                  <Text style={styles.deviceListTitle}>
                    Dispositivos Encontrados ({availableDevices.length})
                  </Text>
                  <ScrollView style={styles.deviceList}>
                    {availableDevices.map((device, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.deviceItem,
                          selectedDevice === device && styles.deviceItemSelected
                        ]}
                        onPress={() => handleSelectDevice(device)}
                        disabled={connectingDevice === (device.device?.address || device.address)}
                      >
                        <View style={styles.deviceInfo}>
                          <Text style={styles.deviceName}>
                            {device.device?.name || device.name || 'Dispositivo'}
                          </Text>
                          <Text style={styles.deviceAddress}>
                            {device.device?.address || device.address || 'Sin dirección'}
                          </Text>
                        </View>
                        <View style={styles.deviceAction}>
                          {connectingDevice === (device.device?.address || device.address) ? (
                            <ActivityIndicator size="small" color="#043476" />
                          ) : (
                            <IconSymbol size={20} name="chevron.right" color="#043476" />
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    No se encontraron dispositivos Bluetooth disponibles
                  </Text>
                  <Text style={[styles.emptyStateText, { fontSize: 14, marginTop: 10 }]}>
                    Para usar impresoras Bluetooth:{'\n'}
                    • Empareja la impresora en Configuración del dispositivo{'\n'}
                    • Asegúrate de que esté encendida y en modo emparejamiento{'\n'}
                    • Luego vuelve a escanear aquí
                  </Text>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={handleScanDevices}
                  >
                    <Text style={styles.retryButtonText}>Reintentar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para agregar dispositivo */}
      <Modal
        visible={showAddDeviceModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddDeviceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Agregar Dispositivo Bluetooth</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowAddDeviceModal(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Nombre del Dispositivo</Text>
              <TextInput
                style={styles.textInput}
                value={newDeviceName}
                onChangeText={setNewDeviceName}
                placeholder="Ej: Impresora Térmica"
                placeholderTextColor="#999"
              />

              <Text style={styles.inputLabel}>Dirección MAC</Text>
              <TextInput
                style={styles.textInput}
                value={newDeviceMac}
                onChangeText={setNewDeviceMac}
                placeholder="XX:XX:XX:XX:XX:XX"
                placeholderTextColor="#999"
                autoCapitalize="characters"
              />

              <Text style={styles.helpText}>
                Para encontrar la dirección MAC de tu impresora:{'\n'}
                • Ve a Configuración - Bluetooth{'\n'}
                • Busca tu impresora emparejada{'\n'}
                • Toca el ícono de información (i){'\n'}
                • Copia la dirección MAC
              </Text>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowAddDeviceModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={handleAddDevice}
                >
                  <Text style={styles.confirmButtonText}>Agregar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para dispositivos Bluetooth emparejados */}
      <Modal
        visible={showDevicesModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDevicesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Dispositivos Bluetooth Emparejados</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowDevicesModal(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {loadingDevices ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <Text style={styles.loadingText}>Cargando dispositivos...</Text>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    No se encontraron dispositivos Bluetooth emparejados
                  </Text>
                  <Text style={[styles.emptyStateText, { fontSize: 14, marginTop: 10 }]}>
                    Para emparejar dispositivos:{'\n'}
                    • Ve a Configuración - Bluetooth{'\n'}
                    • Busca y empareja tu impresora térmica{'\n'}
                    • Asegúrate de que esté encendida{'\n'}
                    • Luego vuelve a cargar esta lista
                  </Text>
                  <TouchableOpacity
                    style={styles.retryButton}
                  >
                    <Text style={styles.retryButtonText}>Recargar</Text>
                  </TouchableOpacity>
                </View>
              )}
                <View style={styles.selectedPrinterActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.clearButton]}
                  >
                    <Text style={styles.clearButtonText}>Deseleccionar</Text>
                  </TouchableOpacity>
                </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para cambiar servidor */}
      <Modal
        visible={showServerModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowServerModal(false)}
      >
        <View style={styles.tenantModalOverlay}>
          <View style={styles.tenantModalContainer}>
            <View style={styles.tenantModalHeader}>
              <Text style={styles.tenantModalTitle}>Cambiar Servidor</Text>
              <TouchableOpacity
                style={styles.tenantModalCloseButton}
                onPress={() => setShowServerModal(false)}
              >
                <IconSymbol size={24} name="xmark.circle.fill" color="#6c757d" />
              </TouchableOpacity>
            </View>

            <View style={styles.tenantModalBody}>
              <Text style={styles.tenantModalDescription}>
                Ingresa la nueva URL del servidor. Debe comenzar con http:// o https://
              </Text>
              
              <Text style={styles.tenantInputLabel}>URL del Servidor:</Text>
              <TextInput
                style={styles.tenantInput}
                value={newServerUrl}
                onChangeText={setNewServerUrl}
                placeholder="https://mi-servidor.com"
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />

              <Text style={styles.tenantCurrentText}>
                Servidor actual: {CONFIG.API_BASE_URL}
              </Text>
            </View>

            <View>
              <TouchableOpacity
                style={[styles.tenantModalButtonFullWidth, styles.tenantModalSaveButton, { marginBottom: 12 }]}
                onPress={handleSaveServer}
              >
                <Text style={styles.tenantModalSaveButtonText}>Guardar</Text>
              </TouchableOpacity>
              
              <View style={styles.tenantModalFooter}>
                <TouchableOpacity
                  style={[styles.tenantModalButton, styles.tenantModalResetButton]}
                  onPress={handleResetServer}
                >
                  <Text style={styles.tenantModalResetButtonText}>Restaurar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.tenantModalButton, styles.tenantModalCancelButton]}
                  onPress={() => setShowServerModal(false)}
                >
                  <Text style={styles.tenantModalCancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para cambiar tenant */}
      <Modal
        visible={showTenantModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTenantModal(false)}
      >
        <View style={styles.tenantModalOverlay}>
          <View style={styles.tenantModalContainer}>
            <View style={styles.tenantModalHeader}>
              <Text style={styles.tenantModalTitle}>Cambiar Estacionamiento</Text>
              <TouchableOpacity
                style={styles.tenantModalCloseButton}
                onPress={() => setShowTenantModal(false)}
              >
                <IconSymbol size={24} name="xmark.circle.fill" color="#6c757d" />
              </TouchableOpacity>
            </View>

            <View style={styles.tenantModalBody}>
              <Text style={styles.tenantModalDescription}>
                Ingresa el nuevo nombre del estacionamiento. Solo se permiten letras, números y guiones.
              </Text>
              
              <Text style={styles.tenantInputLabel}>Nombre del Estacionamiento:</Text>
              <TextInput
                style={styles.tenantInput}
                value={newTenant}
                onChangeText={setNewTenant}
                placeholder="Ej: acme, empresa1, etc."
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.tenantCurrentText}>
                Estacionamiento actual: {tenantConfig.tenant || 'No configurado'}
              </Text>
            </View>

            <View style={styles.tenantModalFooter}>
              <TouchableOpacity
                style={[styles.tenantModalButton, styles.tenantModalCancelButton]}
                onPress={() => setShowTenantModal(false)}
              >
                <Text style={styles.tenantModalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.tenantModalButton, styles.tenantModalSaveButton]}
                onPress={handleSaveTenant}
              >
                <Text style={styles.tenantModalSaveButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
