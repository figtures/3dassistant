import { isUiV2 } from "@/lib/flags/ui-version.server";
import { NotificationPreferencesScreen } from "@/features/notifications/preferences-screen";
import { SettingsV2Fallback } from "@/features/settings/settings-v2-fallback";

export default async function NotificationsSettingsPage() {
  if (!(await isUiV2())) {
    return <SettingsV2Fallback />;
  }
  return <NotificationPreferencesScreen />;
}
