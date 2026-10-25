"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  groupNavItems,
  NAV_ITEMS,
  type NavBadgeKey,
  type NavItem,
} from "@/lib/nav";
import type { NavBadges } from "@/components/v2/shell/use-nav-badges";

function NavBadge({
  badgeKey,
  badges,
}: {
  badgeKey: NavBadgeKey;
  badges: NavBadges;
}) {
  const count = badges[badgeKey];
  if (!count) return null;

  const tone =
    badgeKey === "machineErrors"
      ? "bg-destructive/15 text-destructive"
      : badgeKey === "lowStock"
        ? "bg-[color-mix(in_oklab,var(--state-paused)_18%,transparent)] text-[var(--state-paused)]"
        : "bg-primary-subtle text-primary";

  return (
    <span
      className={cn(
        "ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        tone
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SidebarLink({
  item,
  collapsed,
  badges,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  badges: NavBadges;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active =
    pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors",
        "focus-visible:shadow-[var(--focus-ring)]",
        active
          ? "bg-primary-subtle text-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        collapsed && "justify-center px-2"
      )}
    >
      {active && (
        <span
          className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary"
          aria-hidden
        />
      )}
      <Icon
        className={cn(
          "size-[18px] shrink-0",
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        )}
        strokeWidth={active ? 2.25 : 2}
        aria-hidden
      />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.badgeKey ? (
            <NavBadge badgeKey={item.badgeKey} badges={badges} />
          ) : null}
        </>
      )}
    </Link>
  );
}

export function SidebarNavPanel({
  collapsed,
  badges,
  isAdmin,
  onNavigate,
  className,
}: {
  collapsed: boolean;
  badges: NavBadges;
  isAdmin?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const groups = groupNavItems(NAV_ITEMS, { isAdmin });

  return (
    <nav
      className={cn("flex min-h-0 flex-1 flex-col", className)}
      aria-label="Ana menü"
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-3">
        {groups.map((group) => (
          <div key={group.section} role="group" aria-label={group.label}>
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {group.label}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <SidebarLink
                  key={item.id}
                  item={item}
                  collapsed={collapsed}
                  badges={badges}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}

export function SidebarCollapseButton({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors",
        "hover:bg-sidebar-accent hover:text-foreground",
        "focus-visible:shadow-[var(--focus-ring)]"
      )}
      aria-label={collapsed ? "Kenar çubuğunu genişlet" : "Kenar çubuğunu daralt"}
      aria-expanded={!collapsed}
    >
      {collapsed ? (
        <PanelLeftOpen className="size-[18px]" aria-hidden />
      ) : (
        <PanelLeftClose className="size-[18px]" aria-hidden />
      )}
    </button>
  );
}
