import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SupportDiagnosticsRoot } from "@/components/support/support-diagnostics-root";
import { getUiVersion } from "@/lib/flags/ui-version";
import {
  parseSidebarCollapsed,
  SIDEBAR_COOKIE,
} from "@/lib/shell/sidebar-cookie";
import { UpgradePromptHostLazy } from "@/features/billing/upgrade-prompt-lazy";
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

  const [ui, jar, workspace] = await Promise.all([
    getUiVersion(),
    cookies(),
    loadWorkspaceSession(),
  ]);

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

  if (!workspace) redirect("/login");

  let shell: React.ReactNode;
  if (ui === "v2") {
    const { AppShellV2 } = await import("@/components/v2/shell/app-shell-v2");
    shell = (
      <AppShellV2
        user={shellUser}
        sidebarCollapsed={sidebarCollapsed}
        isSupportAdmin={isSupportAdminEmail(user.email)}
      >
        {children}
      </AppShellV2>
    );
  } else {
    const { AppShell } = await import("@/components/layout/app-shell");
    shell = <AppShell>{children}</AppShell>;
  }

  return (
    <WorkspaceProvider initial={workspace}>
      <SupportDiagnosticsRoot>{shell}</SupportDiagnosticsRoot>
      <UpgradePromptHostLazy />
    </WorkspaceProvider>
  );
}
