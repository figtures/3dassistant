import { getAuthUser } from "@/lib/supabase/get-auth-user";
import { isUiV2 } from "@/lib/flags/ui-version.server";
import DashboardLegacyPage from "@/legacy/pages/dashboard-page";
import { DashboardV2 } from "@/features/dashboard/DashboardV2";

export default async function DashboardPage() {
  const user = await getAuthUser();

  const displayName =
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    user?.email?.split("@")[0] ||
    "Kullanıcı";

  if (await isUiV2()) {
    return <DashboardV2 displayName={displayName} />;
  }

  return <DashboardLegacyPage />;
}
