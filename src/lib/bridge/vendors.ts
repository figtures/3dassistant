export type BridgeVendor =
  | "bambu"
  | "creality"
  | "anycubic"
  | "elegoo"
  | "flashforge"
  | "snapmaker"
  | "klipper"
  | "octoprint"
  | "prusalink";

export const BRIDGE_VENDORS: BridgeVendor[] = [
  "bambu",
  "creality",
  "anycubic",
  "elegoo",
  "flashforge",
  "snapmaker",
  "klipper",
  "octoprint",
  "prusalink",
];

export const BRIDGE_VENDOR_LABELS: Record<BridgeVendor, string> = {
  bambu: "Bambu Lab",
  creality: "Creality",
  anycubic: "Anycubic",
  elegoo: "Elegoo",
  flashforge: "Flashforge",
  snapmaker: "Snapmaker",
  klipper: "Klipper (Moonraker)",
  octoprint: "OctoPrint",
  prusalink: "Prusa (PrusaLink)",
};

export function parseBridgeVendor(value: string | undefined | null): BridgeVendor | null {
  const v = value?.trim().toLowerCase();
  if (BRIDGE_VENDORS.includes(v as BridgeVendor)) return v as BridgeVendor;
  return null;
}

export function isBridgeVendor(value: string): value is BridgeVendor {
  return parseBridgeVendor(value) !== null;
}
