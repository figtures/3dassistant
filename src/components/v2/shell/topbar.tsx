"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { getCommandShortcutLabel } from "@/components/v2/command/use-command-shortcut";
import { applyBreadcrumbLabels, getBreadcrumbs } from "@/lib/nav";
import { useBreadcrumbLabelMap } from "@/hooks/use-breadcrumb-label";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ds";
import { FleetPulse } from "@/components/v2/shell/fleet-pulse";
import { UserMenu, type ShellUser } from "@/components/v2/shell/user-menu";
import { HelpMenu } from "@/components/v2/help/help-menu";
import { NotificationBell } from "@/components/v2/notifications/notification-bell";

export function TopBar({
  user,
  onOpenMobileNav,
  onOpenCommandPalette,
  shortcutsOpen,
  onShortcutsOpenChange,
  changelogUnread,
}: {
  user: ShellUser;
  onOpenMobileNav: () => void;
  onOpenCommandPalette: () => void;
  shortcutsOpen: boolean;
  onShortcutsOpenChange: (open: boolean) => void;
  changelogUnread?: boolean;
}) {
  const pathname = usePathname();
  const labelMap = useBreadcrumbLabelMap();
  const crumbs = applyBreadcrumbLabels(
    getBreadcrumbs(pathname),
    pathname,
    labelMap
  );
  return (
    <header
      className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md print:hidden lg:px-6"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground lg:hidden"
        onClick={onOpenMobileNav}
        aria-label="Menüyü aç"
      >
        <Menu className="size-5" aria-hidden />
      </Button>

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
          onClick={onOpenCommandPalette}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-sm text-muted-foreground outline-none transition-colors",
            "hover:bg-accent hover:text-foreground focus-visible:shadow-[var(--focus-ring)]",
            "max-w-[140px] sm:max-w-[220px]"
          )}
          aria-label="Komut paletini aç"
          aria-keyshortcuts="Control+K Meta+K"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="hidden truncate sm:inline">Ara…</span>
          <kbd className="hidden shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-sans text-xs text-foreground/70 sm:inline">
            {getCommandShortcutLabel()}
          </kbd>
        </button>
        <HelpMenu
          shortcutsOpen={shortcutsOpen}
          onShortcutsOpenChange={onShortcutsOpenChange}
          changelogUnread={changelogUnread}
        />
        <NotificationBell />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
