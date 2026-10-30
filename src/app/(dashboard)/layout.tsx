import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { AppShellV2 } from "@/components/v2/shell/app-shell-v2";
import { SupportDiagnosticsRoot } from "@/components/support/support-diagnostics-root";
import { getUiVersion } from "@/lib/flags/ui-version";
import {
  parseSidebarCollapsed,
  SIDEBAR_COOKIE,
} from "@/lib/shell/sidebar-cookie";
import { UpgradePromptHost } from "@/features/billing/upgrade-prompt";
import { WorkspaceProvider } from "@/components/workspace/workspace-provider";
import { loadWorkspaceSession } from "@/lib/workspace/active";
import { getAuthUser } from "@/lib/supabase/get-auth-user";
import { isSupportAdminEmail } from "@/lib/support/admin";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();

  if (!user) redirect("/login");

  const ui = await getUiVersion();
  const jar = await cookies();
  const sidebarCollapsed = parseSidebarCollapsed(
    jar.get(SIDEBAR_COOKIE)?.value
  );

  const displayName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "Kullanıcı";

  const shellUser = {
    email: user.email ?? "",
    displayName,
  };

  const workspace = await loadWorkspaceSession();
  if (!workspace) redirect("/login");

  return (
    <WorkspaceProvider initial={workspace}>
      <SupportDiagnosticsRoot>
        {ui === "v2" ? (
          <AppShellV2
            user={shellUser}
            sidebarCollapsed={sidebarCollapsed}
            isSupportAdmin={isSupportAdminEmail(user.email)}
          >
            {children}
          </AppShellV2>
        ) : (
          <AppShell>{children}</AppShell>
        )}
      </SupportDiagnosticsRoot>
      <UpgradePromptHost />
    </WorkspaceProvider>
  );
}
