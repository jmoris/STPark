declare module 'react-native-thermal-printer' {
  export interface PrintBluetoothConfig {
    payload: string;
    printerNbrCharactersPerLine?: number;
    autoCut?: boolean;
    openCashbox?: boolean;
    mmFeedPaper?: number;
    printerDpi?: number;
    printerWidthMM?: number;
  }

  export interface PrintTcpConfig {
    ip: string;
    port: number;
    payload: string;
    printerNbrCharactersPerLine?: number;
    autoCut?: boolean;
    openCashbox?: boolean;
    mmFeedPaper?: number;
    printerDpi?: number;
    printerWidthMM?: number;
    timeout?: number;
  }

  export interface DefaultConfig {
    ip: string;
    port: number;
    payload: string;
    autoCut: boolean;
    openCashbox: boolean;
    mmFeedPaper: number;
    printerDpi: number;
    printerWidthMM: number;
    printerNbrCharactersPerLine: number;
    timeout: number;
  }

  export default class ThermalPrinterModule {
    static defaultConfig: DefaultConfig;
    static printBluetooth(config: PrintBluetoothConfig): Promise<void>;
    static printTcp(config: PrintTcpConfig): Promise<void>;
  }
}