"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useSupportReport } from "@/components/support/report-problem-modal";
import {
  CommandGroup,
  CommandItem,
  CommandMenu,
  CommandSeparator,
} from "@/components/v2/command/command-menu";
import {
  QUICK_ACTIONS,
  getVisibleNavItems,
  navItemKeywords,
} from "@/components/v2/command/command-palette-data";

export type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin?: boolean;
};

export function CommandPalette({
  open,
  onOpenChange,
  isAdmin = false,
}: CommandPaletteProps) {
  const router = useRouter();
  const { openReport } = useSupportReport();

  const close = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const runRoute = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router]
  );

  const navItems = getVisibleNavItems(isAdmin);
  const [query, setQuery] = useState("");
  const totalCommands = QUICK_ACTIONS.length + navItems.length;
  const resultsSummary = useMemo(() => {
    const q = query.trim();
    if (!q) return `${totalCommands} komut listelendi`;
    return `'${q}' için sonuçlar filtreleniyor`;
  }, [query, totalCommands]);

  return (
    <CommandMenu
      open={open}
      onOpenChange={onOpenChange}
      onQueryChange={setQuery}
      resultsSummary={resultsSummary}
    >
      <CommandGroup heading="Hızlı eylemler">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <CommandItem
              key={action.id}
              value={`action-${action.id}`}
              keywords={[action.label, ...(action.keywords ?? [])]}
              icon={<Icon aria-hidden />}
              hint={action.hint}
              onSelect={() => {
                if (action.kind === "report") {
                  close();
                  openReport();
                  return;
                }
                if (action.href) runRoute(action.href);
              }}
            >
              {action.label}
            </CommandItem>
          );
        })}
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Git">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <CommandItem
              key={item.id}
              value={`nav-${item.id}`}
              keywords={navItemKeywords(item.id, item.label)}
              icon={<Icon aria-hidden />}
              onSelect={() => runRoute(item.href)}
            >
              {item.label}
            </CommandItem>
          );
        })}
      </CommandGroup>
    </CommandMenu>
  );
}
