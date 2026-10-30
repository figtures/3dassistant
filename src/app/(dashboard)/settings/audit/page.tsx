import { isUiV2 } from "@/lib/flags/ui-version.server";
import { requireWorkspaceSession } from "@/lib/workspace/active";
import { isWorkspaceAdminRole } from "@/lib/workspace/roles";
import { SettingsV2Fallback } from "@/features/settings/settings-v2-fallback";
import { redirect } from "next/navigation";

export default async function AuditSettingsPage() {
  if (!(await isUiV2())) {
    return <SettingsV2Fallback />;
  }

  const session = await requireWorkspaceSession();
  if (!session.ok) {
    redirect("/login");
  }

  if (!isWorkspaceAdminRole(session.role)) {
    redirect("/settings/profile");
  }

  return (
    <div className="space-y-2 pb-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
        Denetim kaydı
      </h1>
      <p className="max-w-xl text-sm text-muted-foreground">
        Denetim günlüğü tablosu P3-06 ile eklenecek. Ekip değişiklikleri şimdilik
        çalışma alanı üyeleri ekranından izlenebilir.
      </p>
    </div>
  );
}
