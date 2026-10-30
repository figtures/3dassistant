export type ConnectVendor = "bambu" | "creality" | "prusa" | "other";

export type ConnectMethod = "cloud" | "bridge" | "manual";

export type LiveDataFeatures = {
  temps: boolean;
  progress: boolean;
  camera: boolean;
};

export type MethodOption = {
  id: ConnectMethod;
  label: string;
  summary: string;
  needsCloudPlan: boolean;
  setupMinutes: number;
  live: LiveDataFeatures;
  recommended?: boolean;
  badge?: string;
};

const CLOUD_LIVE: LiveDataFeatures = { temps: true, progress: true, camera: true };
const BRIDGE_LIVE: LiveDataFeatures = { temps: true, progress: true, camera: true };
const MANUAL_LIVE: LiveDataFeatures = { temps: false, progress: false, camera: false };

export const CONNECT_VENDOR_LABELS: Record<ConnectVendor, string> = {
  bambu: "Bambu Lab",
  creality: "Creality",
  prusa: "Prusa",
  other: "Diğer / Klipper",
};

export const CONNECT_VENDORS: ConnectVendor[] = ["bambu", "creality", "prusa", "other"];

/** Üretici → bağlantı yöntemleri (03 §5.2). */
export function methodsForVendor(vendor: ConnectVendor): MethodOption[] {
  switch (vendor) {
    case "bambu":
      return [
        {
          id: "cloud",
          label: "Bambu hesabıyla bağlan",
          summary: "Wi‑Fi ile Bambu uygulamasına bağlı yazıcılar; ek kurulum gerekmez.",
          needsCloudPlan: true,
          setupMinutes: 2,
          live: CLOUD_LIVE,
          recommended: true,
          badge: "Önerilen",
        },
        {
          id: "bridge",
          label: "Atölye köprüsü (LAN)",
          summary: "Yerel ağda en hızlı canlı veri; tek PC kurulumu.",
          needsCloudPlan: true,
          setupMinutes: 5,
          live: BRIDGE_LIVE,
        },
        {
          id: "manual",
          label: "Elle ekle",
          summary: "Yalnızca planlama; canlı takip sonra bağlanabilir.",
          needsCloudPlan: false,
          setupMinutes: 1,
          live: MANUAL_LIVE,
        },
      ];
    case "creality":
      return [
        {
          id: "cloud",
          label: "Creality Cloud hesabı",
          summary: "Creality Cloud’a kayıtlı yazıcılar hesabınızdan listelenir.",
          needsCloudPlan: true,
          setupMinutes: 2,
          live: CLOUD_LIVE,
          recommended: true,
          badge: "Önerilen",
        },
        {
          id: "bridge",
          label: "Atölye köprüsü",
          summary: "LAN üzerinden otomatik keşif.",
          needsCloudPlan: true,
          setupMinutes: 5,
          live: BRIDGE_LIVE,
        },
        {
          id: "manual",
          label: "Elle ekle",
          summary: "Canlı takip olmadan makine kartı oluşturun.",
          needsCloudPlan: false,
          setupMinutes: 1,
          live: MANUAL_LIVE,
        },
      ];
    case "prusa":
      return [
        {
          id: "bridge",
          label: "Atölye köprüsü (PrusaLink)",
          summary: "PrusaLink veya yerel ağ üzerinden bağlantı.",
          needsCloudPlan: true,
          setupMinutes: 5,
          live: BRIDGE_LIVE,
          recommended: true,
          badge: "Önerilen",
        },
        {
          id: "manual",
          label: "Elle ekle",
          summary: "Planlama için yalnızca ad ve model.",
          needsCloudPlan: false,
          setupMinutes: 1,
          live: MANUAL_LIVE,
        },
      ];
    case "other":
      return [
        {
          id: "bridge",
          label: "Atölye köprüsü (Moonraker / OctoPrint)",
          summary: "Klipper ve OctoPrint yazıcıları yerel ağda bulunur.",
          needsCloudPlan: true,
          setupMinutes: 5,
          live: BRIDGE_LIVE,
          recommended: true,
          badge: "Önerilen",
        },
        {
          id: "manual",
          label: "Elle ekle",
          summary: "Canlı takip olmadan devam edin.",
          needsCloudPlan: false,
          setupMinutes: 1,
          live: MANUAL_LIVE,
        },
      ];
    default: {
      const _exhaustive: never = vendor;
      return _exhaustive;
    }
  }
}

export function vendorToPrinterCloudVendor(
  vendor: ConnectVendor
): "bambu" | "creality" | null {
  if (vendor === "bambu") return "bambu";
  if (vendor === "creality") return "creality";
  return null;
}

export function isMethodAvailable(
  option: MethodOption,
  cloudMonitoring: boolean
): boolean {
  if (option.needsCloudPlan && !cloudMonitoring) return false;
  return true;
}
