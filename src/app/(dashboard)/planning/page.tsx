import { isUiV2 } from "@/lib/flags/ui-version.server";
import PlanningLegacyPage from "@/legacy/pages/planning-page";
import { PlanningV2 } from "@/features/planning/PlanningV2";

export default async function PlanningPage() {
  if (await isUiV2()) {
    return <PlanningV2 />;
  }
  return <PlanningLegacyPage />;
}
