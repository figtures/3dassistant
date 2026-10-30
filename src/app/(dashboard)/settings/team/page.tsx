import { isUiV2 } from "@/lib/flags/ui-version.server";
import { TeamScreen } from "@/features/team/team-screen";
import { SettingsV2Fallback } from "@/features/settings/settings-v2-fallback";

export default async function TeamSettingsPage() {
  if (!(await isUiV2())) {
    return <SettingsV2Fallback />;
  }
  return <TeamScreen />;
}
