import {
  readUiV2DefaultFromEnv,
  resolveUiVersion,
  UI_COOKIE,
  type UiVersion,
} from "@/lib/flags/ui-version.shared";

function readUiCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${UI_COOKIE}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

/** İstemci bileşenlerinde UI sürümünü okur (SSR'da env varsayılanı). */
export function getClientUiVersion(): UiVersion {
  if (typeof document !== "undefined") {
    const fromDom = document.documentElement.dataset.ui;
    if (fromDom === "v1" || fromDom === "v2") return fromDom;
    return resolveUiVersion({
      cookie: readUiCookie(),
      env: {
        UI_V2_DEFAULT: process.env.UI_V2_DEFAULT,
        NEXT_PUBLIC_UI_V2_DEFAULT: process.env.NEXT_PUBLIC_UI_V2_DEFAULT,
      },
    });
  }
  return readUiV2DefaultFromEnv() ? "v2" : "v1";
}

export function isUiV2(): boolean {
  return getClientUiVersion() === "v2";
}
