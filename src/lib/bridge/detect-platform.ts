import type { BridgePlatform } from "./downloads";
import { BRIDGE_PLATFORM_LABELS } from "./downloads";

export type BridgePlatformDetection =
  | { status: "known"; platform: BridgePlatform; label: string; macAmbiguous?: boolean }
  | { status: "unknown"; label: string; hint: string };

export type DetectBridgePlatformInput = {
  userAgent?: string;
  navigatorPlatform?: string;
  /** User-Agent Client Hints `architecture` (Chromium). */
  architecture?: string | null;
};

function known(platform: BridgePlatform, extra?: { macAmbiguous?: boolean }): BridgePlatformDetection {
  return {
    status: "known",
    platform,
    label: BRIDGE_PLATFORM_LABELS[platform],
    ...extra,
  };
}

/** Saf taraf: sunucu/test için senkron OS → installer anahtarı. */
export function detectBridgePlatform(input: DetectBridgePlatformInput): BridgePlatformDetection {
  const ua = (input.userAgent ?? "").toLowerCase();
  const platform = input.navigatorPlatform ?? "";
  const arch = (input.architecture ?? "").toLowerCase();

  const isAndroid = ua.includes("android");
  const isIOS = /iphone|ipad|ipod/.test(ua);

  if (isAndroid || isIOS) {
    return {
      status: "unknown",
      label: "Mobil cihaz",
      hint: "Köprü yalnızca Windows, macOS veya Linux masaüstünde çalışır.",
    };
  }

  if (/win32|win64|windows/.test(ua) || platform === "Win32") {
    return known("windows-amd64");
  }

  if (ua.includes("linux") && !isAndroid) {
    return known("linux-amd64");
  }

  const isMac =
    ua.includes("mac os x") ||
    ua.includes("macintosh") ||
    platform.startsWith("Mac") ||
    platform === "MacIntel";

  if (isMac) {
    if (arch === "arm" || arch === "aarch64") {
      return known("darwin-arm64");
    }
    if (arch === "x86" || arch === "x86_64") {
      return known("darwin-amd64");
    }
    if (ua.includes("intel mac")) {
      return known("darwin-amd64");
    }
    return known("darwin-arm64", { macAmbiguous: true });
  }

  return {
    status: "unknown",
    label: "Tanınmayan sistem",
    hint: "Aşağıdan platform seçin veya geliştirme kurulumunu kullanın.",
  };
}

type NavigatorWithHints = Navigator & {
  userAgentData?: {
    getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }>;
  };
};

/** Tarayıcıda Client Hints ile mümkün olduğunca kesin tespit. */
export async function detectBridgePlatformInBrowser(): Promise<BridgePlatformDetection> {
  if (typeof navigator === "undefined") {
    return {
      status: "unknown",
      label: "Tarayıcı dışı",
      hint: "Panelden installer listesini manuel seçin.",
    };
  }

  let architecture: string | null = null;
  const uad = (navigator as NavigatorWithHints).userAgentData;
  if (uad?.getHighEntropyValues) {
    try {
      const hints = await uad.getHighEntropyValues(["architecture"]);
      architecture = hints.architecture ?? null;
    } catch {
      /* Client Hints reddedildi */
    }
  }

  return detectBridgePlatform({
    userAgent: navigator.userAgent,
    navigatorPlatform: navigator.platform,
    architecture,
  });
}
