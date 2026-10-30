import { isUiV2 } from "@/lib/flags/ui-version.server";
import { WorkspaceSettingsScreen } from "@/features/settings/workspace-screen";
import { SettingsV2Fallback } from "@/features/settings/settings-v2-fallback";

export default async function WorkspaceSettingsPage() {
  if (!(await isUiV2())) {
    return <SettingsV2Fallback />;
  }
  return <WorkspaceSettingsScreen />;
}
