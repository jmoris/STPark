// Archivo de prueba para verificar el estado de Sunmi Printer
import { sunmiPrinterService } from './sunmiPrinter';
import { Platform } from 'react-native';

export const testSunmiPrinter = async () => {
  console.log('🧪 === PRUEBA DE SUNMI PRINTER ===');
  console.log('📱 Platform:', Platform.OS);
  
  try {
    // Verificar disponibilidad
    const isAvailable = sunmiPrinterService.isSunmiAvailable();
    console.log('🔍 Sunmi disponible:', isAvailable);
    
    if (isAvailable) {
      // Intentar obtener información del dispositivo
      console.log('📊 Obteniendo información del dispositivo...');
      const deviceInfo = await sunmiPrinterService.getDeviceInfo();
      console.log('📱 Información del dispositivo:', deviceInfo);
      
      // Intentar obtener estado de la impresora
      console.log('🖨️ Obteniendo estado de la impresora...');
      const printerStatus = await sunmiPrinterService.getPrinterStatus();
      console.log('📊 Estado de la impresora:', printerStatus);
      
      // Intentar imprimir ticket de prueba
      console.log('🧪 Imprimiendo ticket de prueba...');
      const testResult = await sunmiPrinterService.printTestTicket();
      console.log('✅ Resultado del ticket de prueba:', testResult);
    } else {
      console.log('❌ Sunmi Printer no está disponible');
      console.log('💡 Posibles causas:');
      console.log('   - No es un dispositivo Android');
      console.log('   - La librería no está correctamente linked');
      console.log('   - No hay impresora Sunmi integrada');
      console.log('   - Falta ejecutar npx expo prebuild');
    }
    
  } catch (error) {
    console.error('❌ Error en prueba de Sunmi:', error);
  }
  
  console.log('🏁 === FIN DE PRUEBA ===');
};

// Función para verificar el estado del módulo
export const checkSunmiModule = () => {
  console.log('🔍 === VERIFICACIÓN DEL MÓDULO SUNMI ===');
  
  try {
    const sunmiModule = require('@es-webdev/react-native-sunmi-printer');
    console.log('✅ Módulo Sunmi cargado correctamente');
    console.log('📦 Exports disponibles:', Object.keys(sunmiModule));
    
    // Verificar exports específicos
    const exports = {
      SunmiPrinter: !!sunmiModule.SunmiPrinter,
      SunmiPrinterAlign: !!sunmiModule.SunmiPrinterAlign,
      SunmiPrinterFontSize: !!sunmiModule.SunmiPrinterFontSize,
      SunmiPrinterStyle: !!sunmiModule.SunmiPrinterStyle,
      getPrinterModal: !!sunmiModule.getPrinterModal
    };
    
    console.log('📋 Exports específicos:', exports);
    
    return exports;
  } catch (error) {
    console.error('❌ Error cargando módulo Sunmi:', error);
    console.log('💡 Solución: Ejecutar npx expo prebuild y rebuild la app');
    return null;
  }
};
