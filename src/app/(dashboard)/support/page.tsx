import { isUiV2 } from "@/lib/flags/ui-version.server";
import SupportLegacyPage from "@/legacy/pages/support-page";
import { SupportV2 } from "@/features/support/support-screen";

export default async function SupportTicketsPage() {
  if (await isUiV2()) {
    return <SupportV2 />;
  }
  return <SupportLegacyPage />;
}
