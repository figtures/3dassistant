import { isUiV2 } from "@/lib/flags/ui-version.server";
import CatalogItemLegacyPage from "@/legacy/pages/catalog-item-page";
import { CatalogItemScreen } from "@/features/catalog/catalog-item-screen";

type Props = { params: Promise<{ id: string }> };

export default async function CatalogItemPage({ params }: Props) {
  const { id } = await params;

  if (await isUiV2()) {
    return <CatalogItemScreen itemId={id} />;
  }

  return <CatalogItemLegacyPage itemId={id} />;
}
