import { isUiV2 } from "@/lib/flags/ui-version.server";
import MachinesLegacyPage from "@/legacy/pages/machines-page";
import { MachinesV2 } from "@/features/machines/MachinesV2";

export default async function MachinesPage() {
  if (await isUiV2()) {
    return <MachinesV2 />;
  }
  return <MachinesLegacyPage />;
}
