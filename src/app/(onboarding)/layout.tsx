import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { UpgradePromptHostLazy } from "@/features/billing/upgrade-prompt-lazy";
import { WorkspaceProvider } from "@/components/workspace/workspace-provider";
import { loadWorkspaceSession } from "@/lib/workspace/active";
import { getAuthUser } from "@/lib/supabase/get-auth-user";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login?next=/onboarding");
  }

  const workspace = await loadWorkspaceSession();
  if (!workspace) {
    redirect("/login?next=/onboarding");
  }

  return (
    <WorkspaceProvider initial={workspace}>
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/dashboard" className="inline-flex shrink-0">
            <Logo size="sm" />
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] rounded-md px-2 py-1"
          >
            Daha sonra tamamla
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
    <UpgradePromptHostLazy />
    </WorkspaceProvider>
  );
}
