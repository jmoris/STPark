import { Platform } from 'react-native';

// Importación condicional para evitar errores de linking
let SunmiPrinter: any = null;
let SunmiPrinterAlign: any = null;
let SunmiPrinterFontSize: any = null;
let SunmiPrinterStyle: any = null;
let getPrinterModal: any = null;

try {
  const sunmiModule = require('@es-webdev/react-native-sunmi-printer');
  SunmiPrinter = sunmiModule.SunmiPrinter;
  SunmiPrinterAlign = sunmiModule.SunmiPrinterAlign;
  SunmiPrinterFontSize = sunmiModule.SunmiPrinterFontSize;
  SunmiPrinterStyle = sunmiModule.SunmiPrinterStyle;
  getPrinterModal = sunmiModule.getPrinterModal;
} catch (error) {
  console.log('Sunmi Printer module not available:', error);
}

export interface SunmiTicketData {
  plate: string;
  sector?: string;
  street?: string;
  sectorIsPrivate?: boolean;
  streetAddress?: string;
  startTime?: string;
  endTime?: string;
  duration?: string;
  amount?: number;
  paymentMethod?: 'CASH' | 'CARD' | 'TRANSFER';
  operatorName?: string;
  approvalCode?: string;
  change?: number;
}

export interface SunmiSessionTicketData extends SunmiTicketData {
  type: 'INGRESO';
}

export interface SunmiCheckoutTicketData extends SunmiTicketData {
  type: 'CHECKOUT';
}

class SunmiPrinterService {
  private isAvailable: boolean = false;
  private printerModal: any = null;

  constructor() {
    this.initializeSunmiPrinter();
  }

  private async initializeSunmiPrinter(): Promise<void> {
    try {
      console.log('🚀 Inicializando Sunmi Printer...');
      console.log('📱 Platform:', Platform.OS);
      
      // Solo funciona en Android
      if (Platform.OS !== 'android') {
        console.log('❌ Sunmi Printer solo está disponible en Android');
        this.isAvailable = false;
        return;
      }

      console.log('📦 Verificando módulo Sunmi...');
      console.log('SunmiPrinter disponible:', !!SunmiPrinter);
      console.log('getPrinterModal disponible:', !!getPrinterModal);

      // Verificar que el módulo esté disponible
      if (!SunmiPrinter || !getPrinterModal) {
        console.log('❌ Sunmi Printer module not properly linked');
        console.log('💡 Solución: Ejecutar npx expo prebuild y rebuild la app');
        this.isAvailable = false;
        return;
      }

      console.log('🔧 Obteniendo modal de la impresora...');
      // Obtener el modal de la impresora
      this.printerModal = await getPrinterModal();
      
      if (this.printerModal) {
        this.isAvailable = true;
        console.log('✅ Sunmi Printer inicializada correctamente');
        console.log('🖨️ Modal de impresora:', this.printerModal);
      } else {
        console.log('❌ No se pudo obtener el modal de Sunmi Printer');
        this.isAvailable = false;
      }
    } catch (error) {
      console.error('❌ Error inicializando Sunmi Printer:', error);
      this.isAvailable = false;
    }
  }

  // Verificar si Sunmi Printer está disponible
  public isSunmiAvailable(): boolean {
    const available = this.isAvailable && Platform.OS === 'android';
    console.log('🔍 Sunmi Printer disponible:', available, {
      isAvailable: this.isAvailable,
      platform: Platform.OS,
      sunmiModule: !!SunmiPrinter,
      getPrinterModal: !!getPrinterModal
    });
    return available;
  }

  // Formatear fecha y hora
  private formatDateTime(dateString?: string): string {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('es-CL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      return 'N/A';
    }
  }

  // Formatear monto
  private formatAmount(amount?: number): string {
    if (!amount) return '$0';
    return `$${amount.toLocaleString('es-CL')}`;
  }

  // Determinar qué información de ubicación mostrar
  private getLocationInfo(data: SunmiTicketData): string {
    if (data.sectorIsPrivate && data.streetAddress) {
      return `Estacionamiento: ${data.streetAddress}`;
    } else if (data.street) {
      return `Calle: ${data.street}`;
    } else if (data.sector) {
      return `Sector: ${data.sector}`;
    }
    return 'Ubicación: N/A';
  }

  // Imprimir ticket de ingreso usando Sunmi
  async printIngressTicket(data: SunmiSessionTicketData): Promise<boolean> {
    try {
      console.log('🖨️ === INICIANDO IMPRESIÓN SUNMI ===');
      console.log('📋 Datos del ticket:', data);
      
      if (!this.isSunmiAvailable() || !SunmiPrinter) {
        console.log('❌ Sunmi Printer no está disponible o no está correctamente linked');
        console.log('🔍 Estado actual:', {
          isAvailable: this.isAvailable,
          platform: Platform.OS,
          sunmiModule: !!SunmiPrinter,
          getPrinterModal: !!getPrinterModal
        });
        return false;
      }

      console.log('✅ Sunmi Printer disponible, procediendo con la impresión...');
      console.log('📝 Imprimiendo ticket de ingreso con Sunmi Printer...');
      
      const startTime = this.formatDateTime(data.startTime);
      const locationInfo = this.getLocationInfo(data);
      
      console.log('📅 Hora formateada:', startTime);
      console.log('📍 Información de ubicación:', locationInfo);

      // Configurar impresora
      console.log('⚙️ Configurando impresora...');
      await SunmiPrinter.setAlignment(SunmiPrinterAlign.CENTER);
      await SunmiPrinter.setFontSize(SunmiPrinterFontSize.FONT_SIZE_24);
      await SunmiPrinter.setFontStyle(SunmiPrinterStyle.BOLD);
      await SunmiPrinter.printText('TICKET DE INGRESO\n');
      
      await SunmiPrinter.setFontSize(SunmiPrinterFontSize.FONT_SIZE_16);
      await SunmiPrinter.setFontStyle(SunmiPrinterStyle.NORMAL);
      await SunmiPrinter.printText('================================\n');
      await SunmiPrinter.printText('            STPark\n');
      await SunmiPrinter.printText('  Sistema de Estacionamiento\n\n');
      
      await SunmiPrinter.setAlignment(SunmiPrinterAlign.LEFT);
      await SunmiPrinter.printText(`Patente: ${data.plate}\n`);
      await SunmiPrinter.printText(`${locationInfo}\n`);
      await SunmiPrinter.printText(`Hora Ingreso: ${startTime}\n\n`);
      
      await SunmiPrinter.setAlignment(SunmiPrinterAlign.CENTER);
      await SunmiPrinter.printText('================================\n');
      await SunmiPrinter.printText('   Gracias por su preferencia\n');
      await SunmiPrinter.printText('================================\n\n');
      
      // Alimentar papel y cortar
      console.log('📄 Alimentando papel y cortando...');
      await SunmiPrinter.lineWrap(3);
      await SunmiPrinter.cutPaper();
      
      console.log('✅ Ticket de ingreso impreso exitosamente con Sunmi');
      return true;
    } catch (error) {
      console.error('❌ Error imprimiendo ticket de ingreso con Sunmi:', error);
      console.error('📊 Detalles del error:', {
        message: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        data: data
      });
      return false;
    }
  }

  // Imprimir ticket de checkout usando Sunmi
  async printCheckoutTicket(data: SunmiCheckoutTicketData): Promise<boolean> {
    try {
      if (!this.isSunmiAvailable() || !SunmiPrinter) {
        console.log('Sunmi Printer no está disponible o no está correctamente linked');
        return false;
      }

      console.log('Imprimiendo ticket de checkout con Sunmi Printer...');
      
      const startTime = this.formatDateTime(data.startTime);
      const endTime = this.formatDateTime(data.endTime);
      const locationInfo = this.getLocationInfo(data);

      // Configurar impresora
      await SunmiPrinter.setAlignment(SunmiPrinterAlign.CENTER);
      await SunmiPrinter.setFontSize(SunmiPrinterFontSize.FONT_SIZE_24);
      await SunmiPrinter.setFontStyle(SunmiPrinterStyle.BOLD);
      await SunmiPrinter.printText('TICKET DE SALIDA\n');
      
      await SunmiPrinter.setFontSize(SunmiPrinterFontSize.FONT_SIZE_16);
      await SunmiPrinter.setFontStyle(SunmiPrinterStyle.NORMAL);
      await SunmiPrinter.printText('================================\n');
      await SunmiPrinter.printText('            STPark\n');
      await SunmiPrinter.printText('  Sistema de Estacionamiento\n\n');
      
      await SunmiPrinter.setAlignment(SunmiPrinterAlign.LEFT);
      await SunmiPrinter.printText(`Patente: ${data.plate}\n`);
      await SunmiPrinter.printText(`${locationInfo}\n`);
      await SunmiPrinter.printText(`Ingreso: ${startTime}\n`);
      await SunmiPrinter.printText(`Salida: ${endTime}\n`);
      await SunmiPrinter.printText(`Duracion: ${data.duration || 'N/A'}\n\n`);
      await SunmiPrinter.printText(`Monto a pagar: ${this.formatAmount(data.amount)}\n\n`);
      
      await SunmiPrinter.setAlignment(SunmiPrinterAlign.CENTER);
      await SunmiPrinter.printText('================================\n');
      await SunmiPrinter.printText('    Gracias por su preferencia\n');
      await SunmiPrinter.printText('================================\n\n');
      
      // Imprimir texto adicional
      await SunmiPrinter.setFontSize(SunmiPrinterFontSize.FONT_SIZE_12);
      await SunmiPrinter.printText('No valido como documento fiscal\n\n');
      
      // Alimentar papel y cortar
      await SunmiPrinter.lineWrap(3);
      await SunmiPrinter.cutPaper();
      
      console.log('Ticket de checkout impreso exitosamente con Sunmi');
      return true;
    } catch (error) {
      console.error('Error imprimiendo ticket de checkout con Sunmi:', error);
      return false;
    }
  }

  // Imprimir ticket de prueba
  async printTestTicket(): Promise<boolean> {
    try {
      if (!this.isSunmiAvailable() || !SunmiPrinter) {
        console.log('Sunmi Printer no está disponible o no está correctamente linked');
        return false;
      }

      console.log('Imprimiendo ticket de prueba con Sunmi Printer...');
      
      await SunmiPrinter.setAlignment(SunmiPrinterAlign.CENTER);
      await SunmiPrinter.setFontSize(SunmiPrinterFontSize.FONT_SIZE_24);
      await SunmiPrinter.setFontStyle(SunmiPrinterStyle.BOLD);
      await SunmiPrinter.printText('TICKET DE PRUEBA\n');
      
      await SunmiPrinter.setFontSize(SunmiPrinterFontSize.FONT_SIZE_16);
      await SunmiPrinter.setFontStyle(SunmiPrinterStyle.NORMAL);
      await SunmiPrinter.printText('========================\n');
      
      await SunmiPrinter.setAlignment(SunmiPrinterAlign.LEFT);
      await SunmiPrinter.printText(`Fecha: ${new Date().toLocaleString('es-CL')}\n`);
      await SunmiPrinter.printText('Patente: ABCD12\n\n');
      await SunmiPrinter.printText('¡Gracias por su preferencia!\n');
      
      await SunmiPrinter.setAlignment(SunmiPrinterAlign.CENTER);
      await SunmiPrinter.printText('========================\n\n');
      
      // Alimentar papel y cortar
      await SunmiPrinter.lineWrap(3);
      await SunmiPrinter.cutPaper();
      
      console.log('Ticket de prueba impreso exitosamente con Sunmi');
      return true;
    } catch (error) {
      console.error('Error imprimiendo ticket de prueba con Sunmi:', error);
      return false;
    }
  }

  // Imprimir texto personalizado
  async printCustomText(text: string): Promise<boolean> {
    try {
      if (!this.isSunmiAvailable() || !SunmiPrinter) {
        console.log('Sunmi Printer no está disponible o no está correctamente linked');
        return false;
      }

      console.log('Imprimiendo texto personalizado con Sunmi Printer:', text);
      
      await SunmiPrinter.setAlignment(SunmiPrinterAlign.LEFT);
      await SunmiPrinter.setFontSize(SunmiPrinterFontSize.FONT_SIZE_16);
      await SunmiPrinter.setFontStyle(SunmiPrinterStyle.NORMAL);
      await SunmiPrinter.printText(`${text}\n\n`);
      
      // Alimentar papel y cortar
      await SunmiPrinter.lineWrap(2);
      await SunmiPrinter.cutPaper();
      
      console.log('Texto personalizado impreso exitosamente con Sunmi');
      return true;
    } catch (error) {
      console.error('Error imprimiendo texto personalizado con Sunmi:', error);
      return false;
    }
  }

  // Obtener información del dispositivo Sunmi
  async getDeviceInfo(): Promise<any> {
    try {
      if (!this.isSunmiAvailable() || !SunmiPrinter) {
        return null;
      }

      const deviceInfo = await SunmiPrinter.getDeviceInfo();
      return deviceInfo;
    } catch (error) {
      console.error('Error obteniendo información del dispositivo Sunmi:', error);
      return null;
    }
  }

  // Verificar estado de la impresora
  async getPrinterStatus(): Promise<any> {
    try {
      if (!this.isSunmiAvailable() || !SunmiPrinter) {
        return null;
      }

      const status = await SunmiPrinter.getPrinterStatus();
      return status;
    } catch (error) {
      console.error('Error obteniendo estado de la impresora Sunmi:', error);
      return null;
    }
  }
}

export const sunmiPrinterService = new SunmiPrinterService();
