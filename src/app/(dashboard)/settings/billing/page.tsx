import { isUiV2 } from "@/lib/flags/ui-version.server";
import { BillingV2 } from "@/features/billing/billing-screen";
import { SettingsV2Fallback } from "@/features/settings/settings-v2-fallback";

export default async function SettingsBillingPage() {
  if (!(await isUiV2())) {
    return <SettingsV2Fallback />;
  }
  return <BillingV2 />;
}
