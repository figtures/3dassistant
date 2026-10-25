import { bambuAdapter } from "./adapters/bambu";
import { crealityAdapter } from "./adapters/creality";
import { prusaAdapter } from "./adapters/prusa";
import type { PrinterVendor, VendorAdapter } from "./types";

const adapters: Record<PrinterVendor, VendorAdapter> = {
  bambu: bambuAdapter,
  prusa: prusaAdapter,
  creality: crealityAdapter,
};

export function getVendorAdapter(vendor: PrinterVendor): VendorAdapter {
  return adapters[vendor];
}

export * from "./types";
export { isCloudMockEnabled } from "./mock";
