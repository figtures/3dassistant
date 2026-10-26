import { createClient } from "@/lib/supabase/server";
import { isUiV2 } from "@/lib/flags/ui-version.server";
import DashboardLegacyPage from "@/legacy/pages/dashboard-page";
import { DashboardV2 } from "@/features/dashboard/DashboardV2";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const displayName =
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    user?.email?.split("@")[0] ||
    "Kullanıcı";

  if (await isUiV2()) {
    return <DashboardV2 displayName={displayName} />;
  }

  return <DashboardLegacyPage />;
}
