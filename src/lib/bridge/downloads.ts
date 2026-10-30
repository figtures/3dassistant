export type BridgePlatform = "darwin-arm64" | "darwin-amd64" | "windows-amd64" | "linux-amd64";

export const BRIDGE_PLATFORM_LABELS: Record<BridgePlatform, string> = {
  "darwin-arm64": "macOS (Apple Silicon)",
  "darwin-amd64": "macOS (Intel)",
  "windows-amd64": "Windows 10/11",
  "linux-amd64": "Linux / Ubuntu (amd64)",
};

export type BridgeDownload = {
  platform: BridgePlatform;
  label: string;
  filename: string;
  url: string;
};

const VERSION = process.env.NEXT_PUBLIC_PRINTFLOW_BRIDGE_VERSION?.trim() || "0.1.0";
const BASE =
  process.env.NEXT_PUBLIC_PRINTFLOW_BRIDGE_BASE_URL?.trim() ||
  "https://cdn.3dasisstant.com/bridge/releases";

export function bridgeInstallersPublished(): boolean {
  const b = process.env.NEXT_PUBLIC_PRINTFLOW_BRIDGE_BASE_URL?.trim();
  if (b) return !b.includes("printflow/printflow-bridge");
  return true;
}

function artifact(platform: BridgePlatform): string {
  switch (platform) {
    case "darwin-arm64":
      return `printflow-bridge_${VERSION}_darwin_arm64.pkg`;
    case "darwin-amd64":
      return `printflow-bridge_${VERSION}_darwin_amd64.pkg`;
    case "windows-amd64":
      return `printflow-bridge_${VERSION}_windows_amd64-setup.exe`;
    case "linux-amd64":
      return `printflow-bridge_${VERSION}_linux_amd64.deb`;
  }
}

export function bridgeDownloads(): BridgeDownload[] {
  const platforms = (Object.keys(BRIDGE_PLATFORM_LABELS) as BridgePlatform[]).map((platform) => ({
    platform,
    label: BRIDGE_PLATFORM_LABELS[platform],
  }));
  return platforms.map(({ platform, label }) => {
    const filename = artifact(platform);
    return {
      platform,
      label,
      filename,
      url: BASE ? `${BASE.replace(/\/$/, "")}/v${VERSION}/${filename}` : "",
    };
  });
}

export function bridgeDeepLinkPair(siteUrl: string, code: string): string {
  const base = siteUrl.replace(/\/$/, "");
  return `printflow://pair?code=${encodeURIComponent(code)}&url=${encodeURIComponent(base)}`;
}
