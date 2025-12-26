
export enum Parity {
  None = 'none',
  Even = 'even',
  Odd = 'odd'
}

export enum StopBits {
  One = 1,
  Two = 2
}

export enum DataBits {
  Seven = 7,
  Eight = 8
}

export enum FlowControl {
  None = 'none',
  Hardware = 'hardware'
}

export interface SerialConfig {
  baudRate: number;
  dataBits: DataBits;
  stopBits: StopBits;
  parity: Parity;
  bufferSize: number;
  flowControl: FlowControl;
}

export interface SendConfig {
  isHex: boolean;
  addCRLF: boolean;
  autoRepeat: boolean;
  repeatInterval: number;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'rx' | 'tx' | 'info' | 'error';
  data: string;
  hex: string;
}

export interface QuickCommand {
  id: string;
  label: string;
  content: string;
  isHex: boolean;
}

export type AIProvider = 'gemini' | 'deepseek' | 'openai' | 'grok' | 'custom';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface SerialState {
  isConnected: boolean;
  port: SerialPort | null;
  config: SerialConfig;
  sendConfig: SendConfig;
  logs: LogEntry[];
  isHexMode: boolean;
  autoScroll: boolean;
  showTimestamp: boolean;
  dtr: boolean;
  rts: boolean;
  rxCount: number;
  txCount: number;
  aiConfig: AIConfig;
  showAiSettings: boolean;
}

// Global Web Serial API types (simplified)
export interface SerialPort {
  open(options: { baudRate: number; dataBits?: number; stopBits?: number; parity?: string; bufferSize?: number; flowControl?: string }): Promise<void>;
  close(): Promise<void>;
  setSignals(signals: { dataTerminalReady?: boolean; requestToSend?: boolean; break?: boolean }): Promise<void>;
  getSignals(): Promise<{ dataTerminalReady: boolean; requestToSend: boolean; dataCarrierDetect: boolean; clearToSend: boolean; ringIndicator: boolean; dataSetReady: boolean }>;
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  getInfo(): { usbVendorId?: number; usbProductId?: number };
}

declare global {
  interface Navigator {
    serial: {
      requestPort(): Promise<SerialPort>;
      getPorts(): Promise<SerialPort[]>;
      addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions
      ): void;
      removeEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | EventListenerOptions
      ): void;
    };
  }
}
