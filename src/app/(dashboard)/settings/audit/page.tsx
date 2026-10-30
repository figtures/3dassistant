import { isUiV2 } from "@/lib/flags/ui-version.server";
import { requireWorkspaceSession } from "@/lib/workspace/active";
import { can } from "@/lib/workspace/permissions";
import { SettingsV2Fallback } from "@/features/settings/settings-v2-fallback";
import { AuditScreen } from "@/features/audit/audit-screen";
import { redirect } from "next/navigation";

export default async function AuditSettingsPage() {
  if (!(await isUiV2())) {
    return <SettingsV2Fallback />;
  }

  const session = await requireWorkspaceSession();
  if (!session.ok) {
    redirect("/login");
  }

  if (!can(session.role, "audit.view")) {
    redirect("/settings/profile");
  }

  return <AuditScreen />;
}
