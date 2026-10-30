import { getAuthUser } from "@/lib/supabase/get-auth-user";
import { isUiV2 } from "@/lib/flags/ui-version.server";

export default async function DashboardPage() {
  const user = await getAuthUser();

  const displayName =
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    user?.email?.split("@")[0] ||
    "Kullanıcı";

  if (await isUiV2()) {
    const { DashboardV2 } = await import("@/features/dashboard/DashboardV2");
    return <DashboardV2 displayName={displayName} />;
  }

  const { default: DashboardLegacyPage } = await import(
    "@/legacy/pages/dashboard-page"
  );
  return <DashboardLegacyPage />;
}
