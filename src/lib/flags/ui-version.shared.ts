export type UiVersion = "v1" | "v2";

export const UI_COOKIE = "pf_ui";

export const UI_COOKIE_MAX_AGE = 31536000;

export type UiVersionEnv = {
  UI_V2_DEFAULT?: string;
  NEXT_PUBLIC_UI_V2_DEFAULT?: string;
};

export function parseUiParam(v: string | null): UiVersion | null {
  if (v === "v1" || v === "v2") return v;
  return null;
}

export function readUiV2DefaultFromEnv(env?: UiVersionEnv): boolean {
  const raw =
    env?.UI_V2_DEFAULT ??
    env?.NEXT_PUBLIC_UI_V2_DEFAULT ??
    process.env.UI_V2_DEFAULT ??
    process.env.NEXT_PUBLIC_UI_V2_DEFAULT;
  return raw === "true" || raw === "1";
}

export function resolveUiVersion(opts: {
  cookie?: string | null;
  env?: UiVersionEnv | string | null;
}): UiVersion {
  const fromCookie = parseUiParam(opts.cookie ?? null);
  if (fromCookie) return fromCookie;

  if (typeof opts.env === "string" || opts.env === null) {
    return opts.env === "true" ? "v2" : "v1";
  }

  return readUiV2DefaultFromEnv(opts.env) ? "v2" : "v1";
}
