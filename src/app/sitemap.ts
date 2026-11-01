import type { MetadataRoute } from "next";
import { getSiteBaseUrl } from "@/lib/site-base-url";

const PUBLIC_PATHS = [
  "/",
  "/pricing",
  "/status",
  "/changelog",
  "/login",
  "/register",
  "/legal/kvkk",
  "/legal/privacy",
  "/legal/terms",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteBaseUrl();
  const lastModified = new Date();

  return PUBLIC_PATHS.map((path) => ({
    url: path === "/" ? base : `${base}${path}`,
    lastModified,
    changeFrequency: path === "/" || path === "/pricing" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/pricing" ? 0.9 : 0.6,
  }));
}
