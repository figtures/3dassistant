import type { CloudDevice, NormalizedTelemetry, PrinterVendor } from "./types";

const MOCK_DEVICES: Record<PrinterVendor, CloudDevice[]> = {
  bambu: [
    { id: "bambu-mock-x1c", name: "X1 Carbon (Demo)", model: "X1 Carbon", online: true },
    { id: "bambu-mock-p1s", name: "P1S (Demo)", model: "P1S", online: true },
    { id: "bambu-mock-a1", name: "A1 (Demo)", model: "A1", online: true },
    { id: "bambu-mock-a1mini", name: "A1 mini (Demo)", model: "A1 mini", online: true },
    { id: "bambu-mock-h2d", name: "H2D (Demo)", model: "H2D", online: false },
  ],
  prusa: [
    { id: "prusa-mock-mk4", name: "MK4 (Demo)", model: "MK4", online: true },
    { id: "prusa-mock-xl", name: "XL (Demo)", model: "XL", online: false },
  ],
  creality: [
    { id: "creality-mock-k1max", name: "K1 Max (Demo)", model: "K1 Max", online: true },
    { id: "creality-mock-k1c", name: "K1C (Demo)", model: "K1C", online: true },
    { id: "creality-mock-k2plus", name: "K2 Plus (Demo)", model: "K2 Plus", online: true },
    { id: "creality-mock-v3ke", name: "Ender-3 V3 KE (Demo)", model: "Ender-3 V3 KE", online: false },
    { id: "creality-mock-e5max", name: "Ender-5 Max (Demo)", model: "Ender-5 Max", online: true },
  ],
};

let mockProgress = 42;

/** Yalnızca yerel geliştirme — production'da asla mock kullanılmaz. */
export function isCloudMockEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" && process.env.PRINTER_CLOUD_MOCK === "true"
  );
}

export function mockListDevices(vendor: PrinterVendor): CloudDevice[] {
  return MOCK_DEVICES[vendor].map((d) => ({ ...d }));
}

export function mockFetchTelemetry(deviceId: string): NormalizedTelemetry {
  mockProgress = (mockProgress + 3) % 100;
  const printing = mockProgress > 10 && mockProgress < 95;
  return {
    connectionStatus: "connected",
    printerState: printing ? "printing" : "idle",
    jobName: printing ? "Demo parça — vase.gcode.3mf" : null,
    progressPercent: printing ? mockProgress : null,
    printTimeSeconds: printing ? mockProgress * 12 : null,
    errorMessage: null,
    raw: { mock: true, deviceId },
  };
}
