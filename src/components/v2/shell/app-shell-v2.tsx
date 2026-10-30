"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useHelpShortcutsListener } from "@/components/v2/help/help-menu";
import { cn } from "@/lib/utils";
import {
  SIDEBAR_COOKIE,
  SIDEBAR_COOKIE_MAX_AGE,
} from "@/lib/shell/sidebar-cookie";
import {
  SidebarCollapseButton,
  SidebarNavPanel,
} from "@/components/v2/shell/sidebar-nav";
import { TopBar } from "@/components/v2/shell/topbar";
import {
  CommandPaletteHost,
  useCommandShortcut,
} from "@/components/v2/command/command-palette-host";
import { MobileNavSheet } from "@/components/v2/shell/mobile-nav";
import { useNavBadges } from "@/components/v2/shell/use-nav-badges";
import type { ShellUser } from "@/components/v2/shell/user-menu";
import { SidebarPlanCard } from "@/components/v2/shell/sidebar-plan-card";
import { WorkspaceSwitcher } from "@/components/v2/shell/workspace-switcher";

export type AppShellV2Props = {
  children: React.ReactNode;
  user: ShellUser;
  sidebarCollapsed: boolean;
  isSupportAdmin?: boolean;
};

function setSidebarCookie(collapsed: boolean) {
  const value = collapsed ? "1" : "0";
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${SIDEBAR_COOKIE}=${value}; Path=/; Max-Age=${SIDEBAR_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

export function AppShellV2({
  children,
  user,
  sidebarCollapsed: initialCollapsed,
  isSupportAdmin = false,
}: AppShellV2Props) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen, paletteEverOpened] = useCommandShortcut();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);
  useHelpShortcutsListener(openShortcuts);
  const badges = useNavBadges();
  const isAdmin = isSupportAdmin;

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      setSidebarCookie(next);
      return next;
    });
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none"
      >
        İçeriğe atla
      </a>

      <aside
        className={cn(
          "hidden h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-[240ms] ease-out lg:flex",
          collapsed ? "w-[60px]" : "w-[260px]"
        )}
        aria-label="Kenar çubuğu"
      >
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b border-sidebar-border",
            collapsed ? "justify-center px-2" : "gap-2 px-4"
          )}
        >
          {!collapsed && (
            <Link
              href="/dashboard"
              className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-foreground"
            >
              3dassistant
            </Link>
          )}
          <SidebarCollapseButton
            collapsed={collapsed}
            onToggle={toggleCollapsed}
          />
        </div>
        <WorkspaceSwitcher collapsed={collapsed} />
        <SidebarNavPanel
          collapsed={collapsed}
          badges={badges}
          isAdmin={isAdmin}
        />
        <SidebarPlanCard collapsed={collapsed} />
      </aside>

      <MobileNavSheet
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        isAdmin={isAdmin}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar
          user={user}
          onOpenMobileNav={() => setMobileOpen(true)}
          onOpenCommandPalette={() => setPaletteOpen(true)}
          shortcutsOpen={shortcutsOpen}
          onShortcutsOpenChange={setShortcutsOpen}
        />
        <CommandPaletteHost
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          everOpened={paletteEverOpened}
          isAdmin={isAdmin}
        />
        <main
          id="main"
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 focus:outline-none sm:px-6 sm:py-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
