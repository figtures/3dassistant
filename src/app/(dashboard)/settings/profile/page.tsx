import { isUiV2 } from "@/lib/flags/ui-version.server";
import { ProfileSettingsScreen } from "@/features/settings/profile-screen";
import { SettingsV2Fallback } from "@/features/settings/settings-v2-fallback";

export default async function ProfileSettingsPage() {
  if (!(await isUiV2())) {
    return <SettingsV2Fallback />;
  }
  return <ProfileSettingsScreen />;
}
