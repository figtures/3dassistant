/** Kanonik site kökü — metadata, sitemap, robots. */
export function getSiteBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://3dasisstant.com"
  );
}
