import type { MetadataRoute } from "next";
import { getSiteBaseUrl } from "@/lib/site-base-url";

/** Arama motorlarına kapalı uygulama ve dahili rotalar. */
const DISALLOW = [
  "/api/",
  "/dashboard",
  "/onboarding",
  "/machines",
  "/planning",
  "/orders",
  "/materials",
  "/catalog",
  "/customers",
  "/faults",
  "/procurement",
  "/calendar",
  "/billing",
  "/support",
  "/settings",
  "/invite/",
  "/auth/",
  "/design-tokens",
] as const;

export default function robots(): MetadataRoute.Robots {
  const base = getSiteBaseUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...DISALLOW],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
