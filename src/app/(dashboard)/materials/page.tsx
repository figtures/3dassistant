import { isUiV2 } from "@/lib/flags/ui-version.server";
import MaterialsLegacyPage from "@/legacy/pages/materials-page";
import { MaterialsV2 } from "@/features/materials/materials-screen";

export default async function MaterialsPage() {
  if (await isUiV2()) {
    return <MaterialsV2 />;
  }
  return <MaterialsLegacyPage />;
}
