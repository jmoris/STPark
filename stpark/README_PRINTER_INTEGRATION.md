# Sistema de Impresión Integrado STPark

## Descripción

El sistema de impresión de STPark ahora incluye soporte para impresoras Sunmi como fallback cuando no hay impresora Bluetooth conectada. Esto garantiza que los tickets siempre se puedan imprimir si hay al menos una impresora disponible.

## Características

### ✅ Impresoras Soportadas
- **Bluetooth**: Impresoras térmicas Bluetooth (prioridad alta)
- **Sunmi**: Impresoras integradas Sunmi (fallback automático)

### 🔄 Orden de Prioridad
1. **Impresora Bluetooth** - Si está conectada y configurada
2. **Impresora Sunmi** - Como fallback automático
3. **Error** - Si ninguna impresora está disponible

### 📋 Funciones Disponibles

#### Verificación de Impresoras
```typescript
// Verificar qué impresoras están disponibles
const availablePrinters = await ticketPrinterService.getAvailablePrinters();
console.log(availablePrinters);
// Resultado: { bluetooth: true/false, sunmi: true/false, bluetoothInfo: {...}, sunmiInfo: {...} }
```

#### Impresión de Tickets
```typescript
// Ticket de ingreso
const ingressData = {
  plate: 'ABC123',
  sector: 'Sector A',
  startTime: new Date().toISOString(),
  type: 'INGRESO' as const
};
await ticketPrinterService.printIngressTicket(ingressData);

// Ticket de checkout
const checkoutData = {
  plate: 'ABC123',
  amount: 2000,
  paymentMethod: 'CASH' as const,
  type: 'CHECKOUT' as const
};
await ticketPrinterService.printCheckoutTicket(checkoutData);
```

#### Impresión de Prueba
```typescript
// Ticket de prueba
await ticketPrinterService.printTestTicket();

// Texto personalizado
await ticketPrinterService.printCustomText('Mi texto personalizado');
```

## Configuración

### Impresora Bluetooth
1. Ve a **Configuración > Impresora**
2. Selecciona una impresora Bluetooth emparejada
3. La impresora Bluetooth tendrá prioridad sobre Sunmi

### Impresora Sunmi
- **Automática**: Se detecta automáticamente en dispositivos Android con impresora Sunmi integrada
- **Sin configuración**: No requiere configuración adicional
- **Fallback**: Se usa automáticamente cuando Bluetooth no está disponible

## Uso en el Código

### Importar el Servicio
```typescript
import { ticketPrinterService } from './services/ticketPrinter';
```

### Ejemplo Completo
```typescript
// Verificar impresoras disponibles
const printers = await ticketPrinterService.getAvailablePrinters();

if (printers.bluetooth) {
  console.log('Usando impresora Bluetooth:', printers.bluetoothInfo?.name);
} else if (printers.sunmi) {
  console.log('Usando impresora Sunmi como fallback');
} else {
  console.log('No hay impresoras disponibles');
}

// Imprimir ticket (automáticamente elegirá la mejor opción)
const success = await ticketPrinterService.printIngressTicket(ticketData);
if (success) {
  console.log('Ticket impreso exitosamente');
} else {
  console.log('Error al imprimir ticket');
}
```

## Archivos Modificados

### Nuevos Archivos
- `services/sunmiPrinter.ts` - Servicio para impresoras Sunmi
- `services/printerExample.ts` - Ejemplos de uso
- `README_PRINTER_INTEGRATION.md` - Esta documentación

### Archivos Actualizados
- `services/ticketPrinter.ts` - Integración con Sunmi como fallback

## Compatibilidad

### Plataformas
- **Android**: Soporte completo para Bluetooth y Sunmi
- **iOS**: Solo soporte para Bluetooth (Sunmi no disponible)
- **Web**: Modo simulado para desarrollo

### Dispositivos Sunmi
- Compatible con dispositivos Sunmi que tienen impresora térmica integrada
- Detección automática del hardware
- Sin configuración adicional requerida

## Troubleshooting

### Problemas Comunes

#### "No hay impresoras disponibles"
- Verifica que Bluetooth esté habilitado
- Asegúrate de que la impresora Bluetooth esté emparejada
- En dispositivos Sunmi, verifica que la impresora esté funcionando

#### "Error al imprimir con Sunmi"
- Verifica que el dispositivo sea compatible con Sunmi
- Asegúrate de que la impresora Sunmi esté encendida
- Revisa los permisos de la aplicación

#### "Bluetooth no se conecta"
- Verifica permisos de Bluetooth y ubicación
- Asegúrate de que la impresora esté emparejada
- Intenta desconectar y reconectar la impresora

### Logs de Debug
El sistema incluye logs detallados para facilitar el debugging:
```typescript
// Los logs muestran qué impresora se está usando
console.log('Usando impresora Bluetooth para ticket de ingreso');
console.log('Usando Sunmi Printer como fallback');
console.log('No se pudo imprimir el ticket - ninguna impresora disponible');
```

## Beneficios

### ✅ Ventajas
- **Redundancia**: Siempre hay una opción de impresión disponible
- **Automático**: No requiere intervención del usuario
- **Transparente**: El código existente funciona sin cambios
- **Robusto**: Manejo de errores mejorado
- **Flexible**: Soporte para múltiples tipos de impresoras

### 🎯 Casos de Uso
- **Impresora Bluetooth desconectada**: Automáticamente usa Sunmi
- **Dispositivo Sunmi sin Bluetooth**: Usa impresora integrada
- **Desarrollo**: Modo simulado para testing
- **Producción**: Máxima confiabilidad de impresión

## Próximos Pasos

1. **Testing**: Probar en dispositivos reales con ambas impresoras
2. **Optimización**: Mejorar la detección automática de impresoras
3. **UI**: Agregar indicadores visuales del tipo de impresora en uso
4. **Configuración**: Permitir configurar preferencias de impresora

---

*Documentación actualizada para STPark v1.0.0*
