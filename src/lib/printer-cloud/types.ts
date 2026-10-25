export type PrinterVendor = "bambu" | "prusa" | "creality";

export type IntegrationAccountStatus = "active" | "error" | "disconnected";

export type ConnectionStatus = "connected" | "disconnected" | "error" | "never";

export type PrinterState =
  | "printing"
  | "paused"
  | "idle"
  | "error"
  | "offline"
  | "unknown";

export interface NormalizedTelemetry {
  connectionStatus: ConnectionStatus;
  printerState: PrinterState;
  jobName: string | null;
  progressPercent: number | null;
  printTimeSeconds: number | null;
  errorMessage: string | null;
  bedTempC?: number | null;
  nozzleTempC?: number | null;
  chamberTempC?: number | null;
  cameraStreamUrl?: string | null;
  raw: Record<string, unknown>;
}

export interface CloudDevice {
  id: string;
  name: string;
  model: string | null;
  online: boolean;
}

export interface VendorCredentials {
  vendor: PrinterVendor;
  apiKey: string | null;
  accessToken: string | null;
  refreshToken: string | null;
}

export interface VendorAdapter {
  vendor: PrinterVendor;
  listDevices(credentials: VendorCredentials): Promise<CloudDevice[]>;
  fetchTelemetry(
    credentials: VendorCredentials,
    deviceId: string
  ): Promise<NormalizedTelemetry>;
}

export const VENDOR_LABELS: Record<PrinterVendor, string> = {
  bambu: "Bambu Lab",
  prusa: "Prusa",
  creality: "Creality",
};

/**
 * Müşteriye açık üreticiler. Partner OAuth varsa o kullanılır;
 * yoksa hesap girişi (jeton saklanır, şifre saklanmaz).
 */
export const VENDOR_LIVE: Record<PrinterVendor, boolean> = {
  bambu: true,
  creality: true,
  prusa: false,
};

export const VENDOR_PRIMARY_TILES: PrinterVendor[] = ["bambu", "creality"];

export type VendorAuthMode = "oauth" | "account" | "none";

export type VendorProviderInfo = {
  vendor: PrinterVendor;
  label: string;
  available: boolean;
  comingSoon: boolean;
  auth: VendorAuthMode;
};

export function isPrinterVendor(value: string): value is PrinterVendor {
  return value === "bambu" || value === "prusa" || value === "creality";
}
