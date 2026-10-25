"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoy, Menu, MessageCircleWarning } from "lucide-react";
import { getBreadcrumbs } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { FleetPulse } from "@/components/v2/shell/fleet-pulse";
import { UserMenu, type ShellUser } from "@/components/v2/shell/user-menu";
import { useSupportReport } from "@/components/support/report-problem-modal";

export function TopBar({
  user,
  onOpenMobileNav,
}: {
  user: ShellUser;
  onOpenMobileNav: () => void;
}) {
  const pathname = usePathname();
  const crumbs = getBreadcrumbs(pathname);
  const { openReport } = useSupportReport();

  return (
    <header
      className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md lg:px-6"
    >
      <button
        type="button"
        className="flex size-10 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:shadow-[var(--focus-ring)] lg:hidden"
        onClick={onOpenMobileNav}
        aria-label="Menüyü aç"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          href="/dashboard"
          className="text-sm font-semibold tracking-tight text-foreground lg:hidden"
        >
          3dassistant
        </Link>
        <nav
          aria-label="Breadcrumb"
          className="hidden min-w-0 items-center gap-1 text-sm text-muted-foreground lg:flex"
        >
          {crumbs.map((crumb, i) => (
            <span key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {i > 0 && (
                <span className="text-muted-foreground/60" aria-hidden>
                  /
                </span>
              )}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="truncate hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="truncate text-foreground">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      <FleetPulse />

      <div className="flex items-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={() => openReport()}
          className={cn(
            "hidden items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors sm:inline-flex",
            "hover:bg-accent hover:text-foreground focus-visible:shadow-[var(--focus-ring)]"
          )}
        >
          <MessageCircleWarning className="size-4" aria-hidden />
          Sorun bildir
        </button>
        <Link
          href="/support"
          className={cn(
            "hidden items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors sm:inline-flex",
            "hover:bg-accent hover:text-foreground focus-visible:shadow-[var(--focus-ring)]"
          )}
        >
          <LifeBuoy className="size-4" aria-hidden />
          Destek
        </Link>
        <UserMenu user={user} />
      </div>
    </header>
  );
}
