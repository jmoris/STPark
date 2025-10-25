// Ejemplo de uso del sistema de impresión integrado con Sunmi como fallback
// Este archivo muestra cómo usar el ticketPrinterService actualizado

import { ticketPrinterService } from './services/ticketPrinter';

// Ejemplo de datos para ticket de ingreso
const ingressData = {
  plate: 'ABC123',
  sector: 'Sector A',
  street: 'Calle Principal',
  sectorIsPrivate: false,
  startTime: new Date().toISOString(),
  type: 'INGRESO' as const
};

// Ejemplo de datos para ticket de checkout
const checkoutData = {
  plate: 'ABC123',
  sector: 'Sector A',
  street: 'Calle Principal',
  sectorIsPrivate: false,
  startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 horas atrás
  endTime: new Date().toISOString(),
  duration: '2 horas',
  amount: 2000,
  paymentMethod: 'CASH' as const,
  type: 'CHECKOUT' as const
};

// Función para probar la impresión de tickets
export const testTicketPrinting = async () => {
  try {
    console.log('=== Probando sistema de impresión integrado ===');
    
    // 1. Verificar qué impresoras están disponibles
    const availablePrinters = await ticketPrinterService.getAvailablePrinters();
    console.log('Impresoras disponibles:', availablePrinters);
    
    if (availablePrinters.bluetooth) {
      console.log('✓ Impresora Bluetooth disponible:', availablePrinters.bluetoothInfo);
    }
    
    if (availablePrinters.sunmi) {
      console.log('✓ Impresora Sunmi disponible:', availablePrinters.sunmiInfo);
    }
    
    if (!availablePrinters.bluetooth && !availablePrinters.sunmi) {
      console.log('⚠️ No hay impresoras disponibles');
      return;
    }
    
    // 2. Imprimir ticket de prueba
    console.log('\n--- Imprimiendo ticket de prueba ---');
    const testResult = await ticketPrinterService.printTestTicket();
    console.log('Resultado ticket de prueba:', testResult ? '✓ Éxito' : '✗ Falló');
    
    // 3. Imprimir ticket de ingreso
    console.log('\n--- Imprimiendo ticket de ingreso ---');
    const ingressResult = await ticketPrinterService.printIngressTicket(ingressData);
    console.log('Resultado ticket de ingreso:', ingressResult ? '✓ Éxito' : '✗ Falló');
    
    // 4. Imprimir ticket de checkout
    console.log('\n--- Imprimiendo ticket de checkout ---');
    const checkoutResult = await ticketPrinterService.printCheckoutTicket(checkoutData);
    console.log('Resultado ticket de checkout:', checkoutResult ? '✓ Éxito' : '✗ Falló');
    
    // 5. Imprimir texto personalizado
    console.log('\n--- Imprimiendo texto personalizado ---');
    const customText = `
================================
      MENSAJE PERSONALIZADO
================================
Este es un texto de prueba
para verificar que la impresión
funciona correctamente.

Fecha: ${new Date().toLocaleString('es-CL')}
================================
`;
    const customResult = await ticketPrinterService.printCustomText(customText);
    console.log('Resultado texto personalizado:', customResult ? '✓ Éxito' : '✗ Falló');
    
    console.log('\n=== Pruebas completadas ===');
    
  } catch (error) {
    console.error('Error durante las pruebas:', error);
  }
};

// Función para mostrar información del sistema de impresión
export const showPrinterInfo = async () => {
  try {
    console.log('=== Información del Sistema de Impresión ===');
    
    const availablePrinters = await ticketPrinterService.getAvailablePrinters();
    
    console.log('\n📱 Estado de las impresoras:');
    
    if (availablePrinters.bluetooth) {
      console.log(`✓ Bluetooth: ${availablePrinters.bluetoothInfo?.name} (${availablePrinters.bluetoothInfo?.address})`);
    } else {
      console.log('✗ Bluetooth: No disponible');
    }
    
    if (availablePrinters.sunmi) {
      console.log('✓ Sunmi: Disponible');
      if (availablePrinters.sunmiInfo) {
        console.log('  Información del dispositivo:', availablePrinters.sunmiInfo);
      }
    } else {
      console.log('✗ Sunmi: No disponible');
    }
    
    console.log('\n🔄 Orden de prioridad:');
    console.log('1. Impresora Bluetooth (si está conectada)');
    console.log('2. Impresora Sunmi (como fallback)');
    console.log('3. Error si ninguna está disponible');
    
    console.log('\n📋 Funciones disponibles:');
    console.log('• printIngressTicket() - Ticket de ingreso');
    console.log('• printCheckoutTicket() - Ticket de salida');
    console.log('• printTestTicket() - Ticket de prueba');
    console.log('• printCustomText() - Texto personalizado');
    console.log('• getAvailablePrinters() - Verificar impresoras');
    
  } catch (error) {
    console.error('Error obteniendo información:', error);
  }
};

// Exportar las funciones para uso en otros archivos
export { ingressData, checkoutData };
