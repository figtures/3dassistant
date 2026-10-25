import { isCloudMockEnabled } from "./mock";
import { getVendorOAuthConfig, vendorUsesOAuth } from "./oauth/config";
import { VENDOR_LIVE, type PrinterVendor, type VendorAuthMode } from "./types";

export type VendorConnectMode = "oauth" | "account" | "mock" | "unavailable";

/** Bambu ve Creality, partner OAuth yokken hesap girişi ile bağlanır. */
export function vendorSupportsAccountLogin(vendor: PrinterVendor): boolean {
  return vendor === "bambu" || vendor === "creality";
}

export function getVendorConnectMode(vendor: PrinterVendor): VendorConnectMode {
  if (!VENDOR_LIVE[vendor]) return "unavailable";
  if (isCloudMockEnabled()) return "mock";
  if (vendorUsesOAuth(vendor) && getVendorOAuthConfig(vendor).enabled) return "oauth";
  if (vendorSupportsAccountLogin(vendor)) return "account";
  return "unavailable";
}

export function authModeFromConnect(mode: VendorConnectMode): VendorAuthMode {
  if (mode === "oauth" || mode === "mock") return "oauth";
  if (mode === "account") return "account";
  return "none";
}
