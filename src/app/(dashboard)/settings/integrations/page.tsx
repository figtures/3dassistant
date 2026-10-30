import { isUiV2 } from "@/lib/flags/ui-version.server";
import { IntegrationsSettingsScreen } from "@/features/settings/integrations-screen";
import { SettingsV2Fallback } from "@/features/settings/settings-v2-fallback";

export default async function IntegrationsSettingsPage() {
  if (!(await isUiV2())) {
    return <SettingsV2Fallback />;
  }
  return <IntegrationsSettingsScreen />;
}
