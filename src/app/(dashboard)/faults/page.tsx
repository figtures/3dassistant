import { isUiV2 } from "@/lib/flags/ui-version.server";
import FaultsLegacyPage from "@/legacy/pages/faults-page";
import { FaultsV2 } from "@/features/faults/faults-screen";

export default async function FaultsPage() {
  if (await isUiV2()) {
    return <FaultsV2 />;
  }
  return <FaultsLegacyPage />;
}
