"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SETTINGS_NAV } from "@/lib/nav";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { isWorkspaceAdminRole } from "@/lib/workspace/roles";

export function SettingsSubnav() {
  const pathname = usePathname();
  const { role } = useWorkspace();
  const isAdmin = isWorkspaceAdminRole(role);

  const items = SETTINGS_NAV.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav
      className="w-full shrink-0 lg:w-56"
      aria-label="Ayarlar menüsü"
    >
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.id} className="shrink-0 lg:shrink">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors",
                  "focus-visible:shadow-[var(--focus-ring)]",
                  active
                    ? "bg-primary-subtle text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "size-[18px] shrink-0",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                  strokeWidth={active ? 2.25 : 2}
                  aria-hidden
                />
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
