export type AdapterType = "octoprint" | "moonraker" | "manual";

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

export interface AdapterCredentials {
  adapterType: AdapterType;
  baseUrl: string | null;
  apiKey: string | null;
}
