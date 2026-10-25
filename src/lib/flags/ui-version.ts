import "server-only";
import { cookies } from "next/headers";
import {
  resolveUiVersion,
  UI_COOKIE,
  type UiVersion,
} from "@/lib/flags/ui-version.shared";

export {
  parseUiParam,
  readUiV2DefaultFromEnv,
  resolveUiVersion,
  UI_COOKIE,
  UI_COOKIE_MAX_AGE,
  type UiVersion,
  type UiVersionEnv,
} from "@/lib/flags/ui-version.shared";

export async function getUiVersion(): Promise<UiVersion> {
  const jar = await cookies();
  return resolveUiVersion({
    cookie: jar.get(UI_COOKIE)?.value ?? null,
    env: {
      UI_V2_DEFAULT: process.env.UI_V2_DEFAULT,
      NEXT_PUBLIC_UI_V2_DEFAULT: process.env.NEXT_PUBLIC_UI_V2_DEFAULT,
    },
  });
}

export async function isUiV2(): Promise<boolean> {
  return (await getUiVersion()) === "v2";
}
