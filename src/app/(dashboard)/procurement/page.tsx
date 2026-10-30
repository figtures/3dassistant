import { isUiV2 } from "@/lib/flags/ui-version.server";
import ProcurementLegacyPage from "@/legacy/pages/procurement-page";
import { ProcurementV2 } from "@/features/procurement/procurement-screen";

export default async function ProcurementPage() {
  if (await isUiV2()) {
    return <ProcurementV2 />;
  }
  return <ProcurementLegacyPage />;
}
