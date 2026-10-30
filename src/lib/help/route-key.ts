/** pathname → `src/content/help/<key>.ts` dosya anahtarı */
export function helpRouteKeyFromPathname(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "dashboard";

  const [root, second] = segments;

  if (root === "machines") {
    if (second === "connect") return "machines-connect";
    if (second) return "machines-detail";
    return "machines";
  }

  if (root === "catalog" && second) return "catalog-detail";
  if (root === "customers" && second) return "customers-detail";
  if (root === "support" && second === "admin") return "support-admin";
  if (root === "support" && second) return "support-ticket";

  return root;
}
