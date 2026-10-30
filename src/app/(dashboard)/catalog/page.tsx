import { isUiV2 } from "@/lib/flags/ui-version.server";
import CatalogLegacyPage from "@/legacy/pages/catalog-page";
import { CatalogV2 } from "@/features/catalog/catalog-screen";

export default async function CatalogPage() {
  if (await isUiV2()) {
    return <CatalogV2 />;
  }
  return <CatalogLegacyPage />;
}
