import { isUiV2 } from "@/lib/flags/ui-version.server";
import BillingLegacyPage from "@/legacy/pages/billing-page";
import { BillingV2 } from "@/features/billing/billing-screen";

export default async function BillingPage() {
  if (await isUiV2()) {
    return <BillingV2 />;
  }
  return <BillingLegacyPage />;
}
