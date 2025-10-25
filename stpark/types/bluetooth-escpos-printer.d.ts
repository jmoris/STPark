// Tipos para react-native-bluetooth-escpos-printer
declare module 'react-native-bluetooth-escpos-printer' {
  export interface PrintTextOptions {
    encoding?: string;
    codepage?: number;
    widthtimes?: number;
    heigthtimes?: number;
    fonttype?: number;
  }

  export interface AlignOptions {
    LEFT: number;
    CENTER: number;
    RIGHT: number;
  }

  export interface FontTypeOptions {
    FONT_A: number;
    FONT_B: number;
  }

  export interface FontMulOptions {
    MUL_1: number;
    MUL_2: number;
    MUL_3: number;
    MUL_4: number;
  }

  export interface RotationOptions {
    ROTATION_0: number;
    ROTATION_90: number;
    ROTATION_180: number;
    ROTATION_270: number;
  }

  export interface EECOptions {
    LEVEL_L: number;
    LEVEL_M: number;
    LEVEL_Q: number;
    LEVEL_H: number;
  }

  export interface BarcodeTypeOptions {
    UPC_A: number;
    UPC_E: number;
    EAN13: number;
    EAN8: number;
    CODE39: number;
    ITF: number;
    CODABAR: number;
    CODE93: number;
    CODE128: number;
    CODE11: number;
    MSI: number;
  }

  export interface BitmapModeOptions {
    OVERWRITE: number;
    OR: number;
    XOR: number;
  }

  export interface DirectionOptions {
    FORWARD: number;
    BACKWARD: number;
  }

  export interface TearOptions {
    ON: number;
    OFF: number;
  }

  export interface TextOptions {
    text: string;
    x: number;
    y: number;
    fonttype: number;
    rotation: number;
    xscal: number;
    yscal: number;
  }

  export interface QRCodeOptions {
    x: number;
    y: number;
    level: number;
    width: number;
    rotation: number;
    code: string;
  }

  export interface BarcodeOptions {
    x: number;
    y: number;
    type: number;
    height: number;
    readable: number;
    rotation: number;
    code: string;
    wide?: number;
    narrow?: number;
  }

  export interface ImageOptions {
    x: number;
    y: number;
    mode: number;
    width: number;
    image: string;
  }

  export interface PrintLabelOptions {
    width: number;
    height: number;
    gap: number;
    direction: number;
    reference: number[];
    tear: number;
    sound: number;
    text?: TextOptions[];
    qrcode?: QRCodeOptions[];
    barcode?: BarcodeOptions[];
    image?: ImageOptions[];
  }

  export interface BluetoothEscposPrinter {
    ALIGN: AlignOptions;
    FONTTYPE: FontTypeOptions;
    FONTMUL: FontMulOptions;
    ROTATION: RotationOptions;
    EEC: EECOptions;
    BARCODETYPE: BarcodeTypeOptions;
    BITMAP_MODE: BitmapModeOptions;
    DIRECTION: DirectionOptions;
    TEAR: TearOptions;

    printerInit(): Promise<void>;
    printAndFeed(feed: number): Promise<void>;
    printerLeftSpace(sp: number): Promise<void>;
    printerLineSpace(sp: number): Promise<void>;
    printerUnderLine(line: number): Promise<void>;
    printerAlign(align: number): Promise<void>;
    printText(text: string, options?: PrintTextOptions): Promise<void>;
    printColumn(columnWidths: number[], columnAligns: number[], columnTexts: string[], options?: PrintTextOptions): Promise<void>;
    setWidth(width: number): Promise<void>;
    printPic(base64encodeStr: string, options?: { width?: number; left?: number }): Promise<void>;
    setfTest(): Promise<void>;
    rotate(): Promise<void>;
    setBlob(weight: number): Promise<void>;
    printQRCode(content: string, size: number, correctionLevel: number): Promise<void>;
    printBarCode(str: string, nType: number, nWidthX: number, nHeight: number, nHriFontType: number, nHriFontPosition: number): Promise<void>;
    opendDrawer(m: number, t1: number, t2: number): Promise<void>;
  }

  export interface BluetoothTscPrinter {
    ALIGN: AlignOptions;
    FONTTYPE: FontTypeOptions;
    FONTMUL: FontMulOptions;
    ROTATION: RotationOptions;
    EEC: EECOptions;
    BARCODETYPE: BarcodeTypeOptions;
    BITMAP_MODE: BitmapModeOptions;
    DIRECTION: DirectionOptions;
    TEAR: TearOptions;

    printLabel(options: PrintLabelOptions): Promise<void>;
  }

  const BluetoothEscposPrinter: BluetoothEscposPrinter;
  const BluetoothTscPrinter: BluetoothTscPrinter;

  export default BluetoothEscposPrinter;
  export { BluetoothTscPrinter };
}
