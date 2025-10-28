declare module 'react-native-bluetooth-escpos-printer' {
  interface PrinterSize {
    width: number;
    height: number;
  }

  interface PrintTextOptions {
    width?: number;
    height?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  }

  interface PrintQRCodeOptions {
    width?: number;
    height?: number;
    alignment?: number;
  }

  const BluetoothEscposPrinter: {
    scanDevices(): Promise<Array<{ name: string; address: string }>>;
    connectPrinter(address: string): Promise<void>;
    disconnect(): Promise<void>;
    setPrinterSize(size: number): Promise<void>;
    setAlignment(alignment: number): Promise<void>;
    printText(text: string, options?: PrintTextOptions): Promise<void>;
    printQRCode(data: string, width?: number, height?: number, options?: PrintQRCodeOptions): Promise<void>;
    printImage(imagePath: string, options?: any): Promise<void>;
    cutPaper(): Promise<void>;
    openCashBox(): Promise<void>;
  };

  export default BluetoothEscposPrinter;
}


















