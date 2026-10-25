import { createClient } from "@/lib/supabase/client";
import type { CatalogFile, CatalogItem } from "@/types/database";

/** Kapak: catalog_files içindeki ilk görsel (oluşturulma sırasına göre). */
export function getCoverImageFile(files?: CatalogFile[] | null): CatalogFile | null {
  if (!files?.length) return null;
  const images = files.filter((f) => f.file_type === "image");
  images.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  return images[0] ?? null;
}

export async function signCatalogFilePath(
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("catalog-files")
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function signCatalogCoverUrls(
  items: Pick<CatalogItem, "id" | "catalog_files">[]
): Promise<Record<string, string>> {
  const pairs = await Promise.all(
    items.map(async (item) => {
      const file = getCoverImageFile(item.catalog_files);
      if (!file) return null;
      const url = await signCatalogFilePath(file.path);
      return url ? ([item.id, url] as const) : null;
    })
  );
  return Object.fromEntries(pairs.filter(Boolean) as [string, string][]);
}
