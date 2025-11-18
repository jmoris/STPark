import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReactNativePosPrinter, ThermalPrinterDevice } from 'react-native-thermal-pos-printer';
import { systemConfigService } from './systemConfig';
import { TuuPrinter, type Align } from 'react-native-tuu-printer';

export interface TicketData {
  plate: string;
  sector?: string;
  street?: string;
  sectorIsPrivate?: boolean; // Nuevo campo para indicar si el sector es privado
  streetAddress?: string; // Nuevo campo para la dirección de la calle
  startTime?: string;
  endTime?: string;
  duration?: string;
  amount?: number;
  paymentMethod?: 'CASH' | 'CARD' | 'TRANSFER';
  operatorName?: string;
  approvalCode?: string;
  change?: number;
}

export interface SessionTicketData extends TicketData {
  type: 'INGRESO';
}

export interface CheckoutTicketData extends TicketData {
  type: 'CHECKOUT';
  // Campos adicionales para pagos con TUU
  authCode?: string; // Código de autorización de TUU
  transactionMethod?: string; // Método de transacción (ej: "DEBITO", "CREDITO")
  last4?: string; // Últimos 4 dígitos de la tarjeta
}

export interface ShiftCloseTicketData {
  type: 'SHIFT_CLOSE';
  shiftId?: string;
  openedAt?: string;
  closedAt?: string;
  operatorName?: string;
  sectorName?: string;
  openingFloat?: number;
  cashCollected?: number;
  cashWithdrawals?: number;
  cashDeposits?: number;
  cashExpected?: number;
  cashDeclared?: number;
  cashOverShort?: number;
  totalTransactions?: number;
  paymentsByMethod?: Array<{
    method: string;
    collected: number;
    count: number;
  }>;
}

class TicketPrinterService {
  private selectedPrinter: ThermalPrinterDevice | null = null;

  // Verificar si la impresora TUU está conectada
  private async isTuuPrinterConnected(): Promise<boolean> {
    try {
      await TuuPrinter.init();
      return true;
    } catch (error) {
      return false;
    }
  }

  // Imprimir ticket de ingreso con TUU
  private async printIngressTicketWithTuu(data: SessionTicketData): Promise<boolean> {
    try {
      await TuuPrinter.init();
      const startTime = this.formatDateTime(data.startTime);
      const locationInfo = this.getLocationInfo(data);
      const systemName = await this.getSystemName();
      
      await TuuPrinter.addTextLine('=============================', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('TICKET DE INGRESO', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('=============================', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addBlankLines(1);
      await TuuPrinter.addTextLine(systemName, {align: 0, size: 24, bold: true, italic: false});
      await TuuPrinter.addBlankLines(1);
      await TuuPrinter.addTextLine(`Patente: ${data.plate}`, {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine(locationInfo, {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addBlankLines(1);
      await TuuPrinter.addTextLine(`Hora Ingreso: ${startTime}`, {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addBlankLines(1);
      await TuuPrinter.addTextLine('=============================', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('Gracias por su preferencia', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('=============================', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addBlankLines(5);
      await TuuPrinter.beginPrint();
      return true;
    } catch (error) {
      console.error('Error imprimiendo con TUU:', error);
      return false;
    }
  }

  // Imprimir ticket de checkout con TUU
  private async printCheckoutTicketWithTuu(data: CheckoutTicketData): Promise<boolean> {
    try {
      await TuuPrinter.init();
      const startTime = this.formatDateTime(data.startTime);
      const endTime = this.formatDateTime(data.endTime);
      const locationInfo = this.getLocationInfo(data);
      const systemName = await this.getSystemName();
      
      await TuuPrinter.addTextLine('=============================', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('TICKET DE SALIDA', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('=============================', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addBlankLines(1);
      await TuuPrinter.addTextLine(systemName, {align: 0, size: 24, bold: true, italic: false});
      await TuuPrinter.addBlankLines(1);
      await TuuPrinter.addTextLine(`Patente: ${data.plate}`, {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addBlankLines(1);
      await TuuPrinter.addTextLine(locationInfo, {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine(`Ingreso: ${startTime}`, {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine(`Salida: ${endTime}`, {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine(`Duracion: ${data.duration || 'N/A'}`, {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addBlankLines(1);
      await TuuPrinter.addTextLine(`Monto a pagar: ${this.formatAmount(data.amount)}`, {align: 0, size: 24, bold: false, italic: false});
      
      // Si el pago fue con TUU, mostrar información adicional
      if (data.authCode || data.transactionMethod || data.last4) {
        await TuuPrinter.addBlankLines(1);
        await TuuPrinter.addTextLine('=============================', {align: 1, size: 24, bold: false, italic: false});
        if (data.authCode) {
          await TuuPrinter.addTextLine(`Cod. Autorizacion: ${data.authCode}`, {align: 0, size: 24, bold: false, italic: false});
        }
        if (data.transactionMethod) {
          await TuuPrinter.addTextLine(`Metodo: ${data.transactionMethod}`, {align: 0, size: 24, bold: false, italic: false});
        }
        if (data.last4) {
          await TuuPrinter.addTextLine(`Tarjeta: ****${data.last4}`, {align: 0, size: 24, bold: false, italic: false});
        }
      }
      
      await TuuPrinter.addBlankLines(1);
      await TuuPrinter.addTextLine('=============================', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('   Gracias por su preferencia', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('=============================', {align: 1, size: 24, bold: false, italic: false});
      // Si el pago fue con TUU, mostrar "Valido como Boleta", sino "No valido como documento fiscal"
      const fiscalText = (data.authCode || data.transactionMethod || data.last4) 
        ? 'Valido como Boleta' 
        : 'No valido como documento fiscal';
      await TuuPrinter.addTextLine(fiscalText, {align: 1, size: 20, bold: false, italic: false});
      await TuuPrinter.addBlankLines(5);
      await TuuPrinter.beginPrint();
      return true;
    } catch (error) {
      console.error('Error imprimiendo con TUU:', error);
      return false;
    }
  }

  // Imprimir ticket de cierre de turno con TUU
  private async printShiftCloseTicketWithTuu(data: ShiftCloseTicketData): Promise<boolean> {
    try {
      await TuuPrinter.init();
      const openedAt = this.formatDateTime(data.openedAt);
      const closedAt = this.formatDateTime(data.closedAt);
      const systemName = await this.getSystemName();
      
      await TuuPrinter.addTextLine('=============================', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('CIERRE DE TURNO', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('=============================', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addBlankLines(1);
      await TuuPrinter.addTextLine(systemName, {align: 0, size: 24, bold: true, italic: false});
      await TuuPrinter.addBlankLines(1);
      await TuuPrinter.addTextLine(`Operador: ${data.operatorName || 'N/A'}`, {align: 0, size: 24, bold: false, italic: false});
      if (data.sectorName) {
        await TuuPrinter.addTextLine(`Sector: ${data.sectorName}`, {align: 0, size: 24, bold: false, italic: false});
      }
      await TuuPrinter.addTextLine(`Turno: ${data.shiftId ? data.shiftId.substring(0, 8) : 'N/A'}`, {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addBlankLines(1);
      await TuuPrinter.addTextLine(`Apertura: ${openedAt}`, {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine(`Cierre: ${closedAt}`, {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('------------------------------------------------------', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addBlankLines(1);
      await TuuPrinter.addTextLine('RESUMEN FINANCIERO:', {align: 0, size: 24, bold: true, italic: false});
      await TuuPrinter.addTextLine(`Fondo Inicial: ${this.formatAmount(data.openingFloat)}`, {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine(`Efectivo Cobrado: ${this.formatAmount(data.cashCollected)}`, {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine(`Retiros: ${this.formatAmount(data.cashWithdrawals)}`, {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine(`Depositos: ${this.formatAmount(data.cashDeposits)}`, {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('------------------------------------------------------', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine(`Efectivo Esperado: ${this.formatAmount(data.cashExpected)}`, {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine(`Efectivo Contado: ${this.formatAmount(data.cashDeclared)}`, {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('------------------------------------------------------', {align: 1, size: 24, bold: false, italic: false});
      
      if (data.cashOverShort !== undefined && data.cashOverShort !== 0) {
        const overShortLabel = data.cashOverShort > 0 ? 'SOBRA' : 'FALTA';
        await TuuPrinter.addTextLine(`${overShortLabel}: ${this.formatAmount(Math.abs(data.cashOverShort))}`, {align: 0, size: 24, bold: false, italic: false});
        await TuuPrinter.addTextLine('------------------------------------------------------', {align: 1, size: 24, bold: false, italic: false});
      }
      
      await TuuPrinter.addTextLine('', {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('RESUMEN DE TRANSACCIONES:', {align: 0, size: 24, bold: true, italic: false});
      
      if (data.paymentsByMethod && data.paymentsByMethod.length > 0) {
        for (const payment of data.paymentsByMethod) {
          const methodName = payment.method === 'CASH' ? 'Efectivo' : 
                            payment.method === 'CARD' ? 'Tarjeta' : 
                            payment.method;
          await TuuPrinter.addTextLine(`${methodName}: ${this.formatAmount(payment.collected)} (${payment.count} trans.)`, {align: 0, size: 24, bold: false, italic: false});
        }
      }
      
      let totalTransactions = data.totalTransactions || 0;
      if (totalTransactions === 0 && data.paymentsByMethod && data.paymentsByMethod.length > 0) {
        totalTransactions = data.paymentsByMethod.reduce((sum, payment) => sum + (payment.count || 0), 0);
      }
      await TuuPrinter.addTextLine(`Total Transacciones: ${totalTransactions}`, {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('', {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('=============================', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('FIN DE TURNO', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('=============================', {align: 1, size: 24, bold: false, italic: false});
      await TuuPrinter.addTextLine('', {align: 0, size: 24, bold: false, italic: false});
      await TuuPrinter.addBlankLines(5);
      await TuuPrinter.beginPrint();
      return true;
    } catch (error) {
      console.error('Error imprimiendo con TUU:', error);
      return false;
    }
  }

  // Cargar la impresora seleccionada
  private async loadSelectedPrinter() {
    try {
      const savedPrinter = await AsyncStorage.getItem('selectedPrinter');
      if (savedPrinter) {
        const printerInfo = JSON.parse(savedPrinter);
        console.log('Impresora cargada:', printerInfo);
        
        // Buscar el dispositivo en la lista actual
        const devices = await ReactNativePosPrinter.getDeviceList();
        const device = devices.find((d: any) => {
          const deviceAddress = d.device?.address || d.address || d.macAddress;
          return deviceAddress === printerInfo.address;
        });
        
        if (device) {
          try {
            // Crear instancia de ThermalPrinterDevice usando el dispositivo nativo
            const nativeDevice = (device as any).device || device;
            console.log('Dispositivo nativo encontrado:', nativeDevice);
            
            // Validar que el dispositivo nativo tenga las propiedades necesarias
            if (!nativeDevice.address || !nativeDevice.name) {
              console.error('Dispositivo nativo no tiene las propiedades necesarias:', nativeDevice);
              return false;
            }
            
            this.selectedPrinter = new ThermalPrinterDevice(nativeDevice);
            console.log('Instancia de ThermalPrinterDevice creada exitosamente');
            return true;
          } catch (createError) {
            console.error('Error creando instancia de ThermalPrinterDevice:', createError);
            return false;
          }
        } else {
          console.log('Dispositivo no encontrado en la lista actual');
          return false;
        }
      }
      return false;
    } catch (error) {
      console.error('Error cargando impresora:', error);
      return false;
    }
  }

  // Conectar a la impresora si no está conectada
  private async ensureConnected(): Promise<boolean> {
    try {
      if (!this.selectedPrinter) {
        const loaded = await this.loadSelectedPrinter();
        if (!loaded) {
          console.log('No hay impresora seleccionada');
          return false;
        }
      }

      // Verificar que la instancia existe
      if (!this.selectedPrinter) {
        console.error('No se pudo crear la instancia de ThermalPrinterDevice');
        return false;
      }

      // Verificar si está conectada usando el método de la clase
      const isConnected = await this.selectedPrinter.checkConnectionStatus();
      if (isConnected) {
        console.log('Impresora ya está conectada');
        return true;
      }

      // Intentar conectar
      console.log('Conectando a la impresora...');
      await this.selectedPrinter.connect({
        timeout: 5000,
        encoding: 'UTF-8'
      });
      
      console.log('Conectado exitosamente a la impresora');
      return true;
    } catch (error) {
      console.error('Error conectando a la impresora:', error);
      return false;
    }
  }

  // Formatear fecha y hora en zona horaria America/Santiago
  private formatDateTime(dateString?: string): string {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      // Convertir a zona horaria America/Santiago
      return date.toLocaleString('es-CL', {
        timeZone: 'America/Santiago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'N/A';
    }
  }

  // Formatear monto
  private formatAmount(amount?: number): string {
    if (!amount && amount !== 0) return '$0';
    // Usar Intl.NumberFormat para formato chileno correcto (puntos como separador de miles, sin decimales)
    // El formato ya incluye el símbolo $ automáticamente
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  }

  // Obtener nombre del sistema
  private async getSystemName(): Promise<string> {
    try {
      return await systemConfigService.getSystemName();
    } catch (error) {
      console.error('Error obteniendo nombre del sistema:', error);
      return 'STPark - Sistema de Gestión de Estacionamientos';
    }
  }

  // Determinar qué información de ubicación mostrar
  private getLocationInfo(data: TicketData): string {
    // Siempre mostrar solo la dirección de la calle (sin sector)
    if (data.streetAddress) {
      // Si hay dirección completa de la calle, usarla
      return `Estacionamiento: ${data.streetAddress}`;
    } else if (data.street) {
      // Si solo hay nombre de calle, usarlo
      return `Estacionamiento: ${data.street}`;
    }
    return 'Ubicación: N/A';
  }

  // Generar ticket de ingreso
  private async generateIngressTicket(data: SessionTicketData): Promise<string> {
    const startTime = this.formatDateTime(data.startTime);
    const locationInfo = this.getLocationInfo(data);
    
    // Obtener nombre del sistema
    const systemName = await this.getSystemName();
    
    return `
================================
       TICKET DE INGRESO                
================================

${systemName}

Patente: ${data.plate}
${locationInfo}
Hora Ingreso: ${startTime}

================================
   Gracias por su preferencia
================================

`;
  }

  // Generar ticket de checkout
  private async generateCheckoutTicket(data: CheckoutTicketData): Promise<string> {
    const startTime = this.formatDateTime(data.startTime);
    const endTime = this.formatDateTime(data.endTime);
    const locationInfo = this.getLocationInfo(data);
    
    // Obtener nombre del sistema
    const systemName = await this.getSystemName();
    
    return `
================================
        TICKET DE SALIDA              
================================

${systemName}

Patente: ${data.plate}

${locationInfo}
Ingreso: ${startTime}
Salida: ${endTime}
Duracion: ${data.duration || 'N/A'}

Monto a pagar: ${this.formatAmount(data.amount)}
${data.authCode || data.transactionMethod || data.last4 ? `
--- Pago con TUU ---
${data.authCode ? `Cod. Autorizacion: ${data.authCode}` : ''}
${data.transactionMethod ? `Metodo: ${data.transactionMethod}` : ''}
${data.last4 ? `Tarjeta: ****${data.last4}` : ''}
` : ''}
================================
   Gracias por su preferencia
================================`
  }

  // Imprimir ticket de ingreso
  async printIngressTicket(data: SessionTicketData): Promise<boolean> {
    try {
      console.log('Iniciando impresión de ticket de ingreso...');
      
      // Intentar primero con TUU
      const tuuConnected = await this.isTuuPrinterConnected();
      if (tuuConnected) {
        console.log('Usando impresora TUU para ticket de ingreso');
        const printed = await this.printIngressTicketWithTuu(data);
        if (printed) {
          console.log('Ticket de ingreso impreso exitosamente con TUU');
          return true;
        }
        console.log('Error imprimiendo con TUU, intentando Bluetooth...');
      }
      
      // Si TUU no está disponible o falló, usar Bluetooth
      const connected = await this.ensureConnected();
      if (!connected) {
        console.log('No hay impresora Bluetooth conectada');
        return false;
      }

      console.log('Usando impresora Bluetooth para ticket de ingreso');
      const ticketText = await this.generateIngressTicket(data);
      console.log('Ticket generado:', ticketText);
      
      // Imprimir ticket principal
      await this.selectedPrinter!.printText(ticketText);
      console.log('Ticket de ingreso impreso exitosamente con Bluetooth');
      return true;
    } catch (error) {
      console.error('Error imprimiendo ticket de ingreso:', error);
      return false;
    }
  }

  // Generar ticket de cierre de turno
  private async generateShiftCloseTicket(data: ShiftCloseTicketData): Promise<string> {
    const openedAt = this.formatDateTime(data.openedAt);
    const closedAt = this.formatDateTime(data.closedAt);
    const systemName = await this.getSystemName();
    
    let ticket = `
================================
    CIERRE DE TURNO
================================

${systemName}

Operador: ${data.operatorName || 'N/A'}
${data.sectorName ? `Sector: ${data.sectorName}` : ''}
Turno: ${data.shiftId ? data.shiftId.substring(0, 8) : 'N/A'}

Apertura: ${openedAt}
Cierre: ${closedAt}
--------------------------------

RESUMEN FINANCIERO:
Fondo Inicial: ${this.formatAmount(data.openingFloat)}
Efectivo Cobrado: ${this.formatAmount(data.cashCollected)}
Retiros: ${this.formatAmount(data.cashWithdrawals)}
Depositos: ${this.formatAmount(data.cashDeposits)}
--------------------------------
Efectivo Esperado: ${this.formatAmount(data.cashExpected)}
Efectivo Contado: ${this.formatAmount(data.cashDeclared)}
--------------------------------
`;

    if (data.cashOverShort !== undefined && data.cashOverShort !== 0) {
      const overShortLabel = data.cashOverShort > 0 ? 'SOBRA' : 'FALTA';
      ticket += `${overShortLabel}: ${this.formatAmount(Math.abs(data.cashOverShort))}
--------------------------------
`;
    }

    ticket += `
RESUMEN DE TRANSACCIONES:
`;

    // Calcular total de transacciones sumando los count de cada método de pago
    let totalTransactions = data.totalTransactions || 0;
    if (totalTransactions === 0 && data.paymentsByMethod && data.paymentsByMethod.length > 0) {
      totalTransactions = data.paymentsByMethod.reduce((sum, payment) => sum + (payment.count || 0), 0);
    }

    if (data.paymentsByMethod && data.paymentsByMethod.length > 0) {
      data.paymentsByMethod.forEach((payment) => {
        const methodName = payment.method === 'CASH' ? 'Efectivo' : 
                          payment.method === 'CARD' ? 'Tarjeta' : 
                          payment.method;
        ticket += `${methodName}: ${this.formatAmount(payment.collected)} (${payment.count} trans.)
`;
      });
    }

    ticket += `
Total Transacciones: ${totalTransactions}

================================
          FIN DE TURNO
================================

`;

    return ticket;
  }

  // Imprimir ticket de checkout
  async printCheckoutTicket(data: CheckoutTicketData): Promise<boolean> {
    try {
      console.log('Iniciando impresión de ticket de checkout...');
      
      // Intentar primero con TUU
      const tuuConnected = await this.isTuuPrinterConnected();
      if (tuuConnected) {
        console.log('Usando impresora TUU para ticket de checkout');
        const printed = await this.printCheckoutTicketWithTuu(data);
        if (printed) {
          console.log('Ticket de checkout impreso exitosamente con TUU');
          return true;
        }
        console.log('Error imprimiendo con TUU, intentando Bluetooth...');
      }
      
      // Si TUU no está disponible o falló, usar Bluetooth
      const connected = await this.ensureConnected();
      if (!connected) {
        console.log('No hay impresora Bluetooth conectada');
        return false;
      }

      console.log('Usando impresora Bluetooth para ticket de checkout');
      const ticketText = await this.generateCheckoutTicket(data);
      console.log('Ticket generado:', ticketText);
      
      // Imprimir ticket principal
      await this.selectedPrinter!.printText(ticketText);
      
      // Si el pago fue con TUU, mostrar "Valido como Boleta", sino "No valido como documento fiscal"
      const fiscalText = (data.authCode || data.transactionMethod || data.last4) 
        ? 'Valido como Boleta' 
        : 'No valido como documento fiscal';
      const fiscalFooter = `${fiscalText}
      
      
      `;
      await this.selectedPrinter!.printText(fiscalFooter, {align: 'CENTER', size: 8});
      
      console.log('Ticket de checkout impreso exitosamente con Bluetooth');
      return true;
    } catch (error) {
      console.error('Error imprimiendo ticket de checkout:', error);
      return false;
    }
  }

  // Imprimir ticket de cierre de turno
  async printShiftCloseTicket(data: ShiftCloseTicketData): Promise<boolean> {
    try {
      console.log('Iniciando impresión de ticket de cierre de turno...');
      
      // Intentar primero con TUU
      const tuuConnected = await this.isTuuPrinterConnected();
      if (tuuConnected) {
        console.log('Usando impresora TUU para ticket de cierre de turno');
        const printed = await this.printShiftCloseTicketWithTuu(data);
        if (printed) {
          console.log('Ticket de cierre de turno impreso exitosamente con TUU');
          return true;
        }
        console.log('Error imprimiendo con TUU, intentando Bluetooth...');
      }
      
      // Si TUU no está disponible o falló, usar Bluetooth
      const connected = await this.ensureConnected();
      if (!connected) {
        console.log('No hay impresora Bluetooth conectada');
        return false;
      }

      console.log('Usando impresora Bluetooth para ticket de cierre de turno');
      const ticketText = await this.generateShiftCloseTicket(data);
      console.log('Ticket generado:', ticketText);
      
      // Imprimir ticket
      await this.selectedPrinter!.printText(ticketText);
      
      console.log('Ticket de cierre de turno impreso exitosamente con Bluetooth');
      return true;
    } catch (error) {
      console.error('Error imprimiendo ticket de cierre de turno:', error);
      return false;
    }
  }

  // Verificar si hay impresora configurada
  async hasPrinterConfigured(): Promise<boolean> {
    try {
      const savedPrinter = await AsyncStorage.getItem('selectedPrinter');
      return !!savedPrinter;
    } catch (error) {
      console.error('Error verificando impresora configurada:', error);
      return false;
    }
  }

  // Obtener información de la impresora configurada
  async getPrinterInfo(): Promise<{name: string, address: string} | null> {
    try {
      const savedPrinter = await AsyncStorage.getItem('selectedPrinter');
      if (savedPrinter) {
        const printerInfo = JSON.parse(savedPrinter);
        return {
          name: printerInfo.name,
          address: printerInfo.address
        };
      }
      return null;
    } catch (error) {
      console.error('Error obteniendo información de impresora:', error);
      return null;
    }
  }

  // Verificar qué tipos de impresoras están disponibles
  async getAvailablePrinters(): Promise<{
    bluetooth: boolean;
    bluetoothInfo?: {name: string, address: string};
  }> {
    const result = {
      bluetooth: false,
      bluetoothInfo: undefined as {name: string, address: string} | undefined
    };

    try {
      // Verificar Bluetooth
      const bluetoothConfigured = await this.hasPrinterConfigured();
      if (bluetoothConfigured) {
        const bluetoothInfo = await this.getPrinterInfo();
        if (bluetoothInfo) {
          result.bluetooth = true;
          result.bluetoothInfo = bluetoothInfo;
        }
      }

      return result;
    } catch (error) {
      console.error('Error verificando impresoras disponibles:', error);
      return result;
    }
  }

  // Imprimir ticket de prueba usando Bluetooth
  async printTestTicket(): Promise<boolean> {
    try {
      console.log('Iniciando impresión de ticket de prueba...');
      
      // Conectar a impresora Bluetooth
      const connected = await this.ensureConnected();
      if (!connected) {
        console.log('No hay impresora Bluetooth conectada');
        return false;
      }

      console.log('Usando impresora Bluetooth para ticket de prueba');
      const testText = `
================================
      TICKET DE PRUEBA
================================
            STPark
  Sistema de Estacionamiento

Fecha: ${new Date().toLocaleString('es-CL')}
Patente: ABCD12

================================
   Gracias por su preferencia
================================

`;
      await this.selectedPrinter!.printText(testText);
      console.log('Ticket de prueba impreso exitosamente con Bluetooth');
      return true;
    } catch (error) {
      console.error('Error imprimiendo ticket de prueba:', error);
      return false;
    }
  }

  // Imprimir texto personalizado usando Bluetooth
  async printCustomText(text: string): Promise<boolean> {
    try {
      console.log('Iniciando impresión de texto personalizado...');
      
      // Conectar a impresora Bluetooth
      const connected = await this.ensureConnected();
      if (!connected) {
        console.log('No hay impresora Bluetooth conectada');
        return false;
      }

      console.log('Usando impresora Bluetooth para texto personalizado');
      await this.selectedPrinter!.printText(text);
      console.log('Texto personalizado impreso exitosamente con Bluetooth');
      return true;
    } catch (error) {
      console.error('Error imprimiendo texto personalizado:', error);
      return false;
    }
  }
}

export const ticketPrinterService = new TicketPrinterService();