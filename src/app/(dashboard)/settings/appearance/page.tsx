import { isUiV2 } from "@/lib/flags/ui-version.server";
import { AppearanceSettingsScreen } from "@/features/settings/appearance-screen";
import { SettingsV2Fallback } from "@/features/settings/settings-v2-fallback";

export default async function AppearanceSettingsPage() {
  if (!(await isUiV2())) {
    return <SettingsV2Fallback />;
  }
  return <AppearanceSettingsScreen />;
}
