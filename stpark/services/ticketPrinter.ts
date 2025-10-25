import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReactNativePosPrinter, ThermalPrinterDevice } from 'react-native-thermal-pos-printer';

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
}

class TicketPrinterService {
  private selectedPrinter: ThermalPrinterDevice | null = null;

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
  private getLocationInfo(data: TicketData): string {
    if (data.sectorIsPrivate && data.streetAddress) {
      // Para sectores privados, mostrar la dirección de la calle
      return `Estacionamiento: ${data.streetAddress}`;
    } else if (data.street) {
      // Para sectores públicos, mostrar solo el nombre de la calle
      return `Calle: ${data.street}`;
    } else if (data.sector) {
      // Fallback al sector si no hay información de calle
      return `Sector: ${data.sector}`;
    }
    return 'Ubicación: N/A';
  }

  // Generar ticket de ingreso
  private generateIngressTicket(data: SessionTicketData): string {
    const startTime = this.formatDateTime(data.startTime);
    const locationInfo = this.getLocationInfo(data);
    
    return `
================================
      TICKET DE INGRESO
================================
            STPark
  Sistema de Estacionamiento

Patente: ${data.plate}
${locationInfo}
Hora Ingreso: ${startTime}

================================
   Gracias por su preferencia
================================

`;
  }

  // Generar ticket de checkout
  private generateCheckoutTicket(data: CheckoutTicketData): string {
    const startTime = this.formatDateTime(data.startTime);
    const endTime = this.formatDateTime(data.endTime);
    const locationInfo = this.getLocationInfo(data);
    
    return `
================================
      TICKET DE SALIDA
================================
            STPark
  Sistema de Estacionamiento

Patente: ${data.plate}
${locationInfo}
Ingreso: ${startTime}
Salida: ${endTime}
Duracion: ${data.duration || 'N/A'}

Monto a pagar: ${this.formatAmount(data.amount)}

================================
    Gracias por su preferencia
================================`
  }

  // Imprimir ticket de ingreso
  async printIngressTicket(data: SessionTicketData): Promise<boolean> {
    try {
      console.log('Iniciando impresión de ticket de ingreso...');
      
      const connected = await this.ensureConnected();
      if (!connected) {
        console.log('No se pudo conectar a la impresora');
        return false;
      }

      const ticketText = this.generateIngressTicket(data);
      console.log('Ticket generado:', ticketText);
      
      // Imprimir ticket principal
      await this.selectedPrinter!.printText(ticketText);
      console.log('Ticket de ingreso impreso exitosamente');
      
      return true;
    } catch (error) {
      console.error('Error imprimiendo ticket de ingreso:', error);
      return false;
    }
  }

  // Imprimir ticket de checkout
  async printCheckoutTicket(data: CheckoutTicketData): Promise<boolean> {
    try {
      console.log('Iniciando impresión de ticket de checkout...');
      
      const connected = await this.ensureConnected();
      if (!connected) {
        console.log('No se pudo conectar a la impresora');
        return false;
      }

      const ticketText = this.generateCheckoutTicket(data);
      console.log('Ticket generado:', ticketText);
      
      // Imprimir ticket principal
      await this.selectedPrinter!.printText(ticketText);
      
      const noValido = `No valido como documento fiscal
      
      
      `;
      await this.selectedPrinter!.printText(noValido, {align: 'CENTER', size: 8});
      
      console.log('Ticket de checkout impreso exitosamente');
      
      return true;
    } catch (error) {
      console.error('Error imprimiendo ticket de checkout:', error);
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
}

export const ticketPrinterService = new TicketPrinterService();
