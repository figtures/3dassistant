"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  Box,
  Briefcase,
  Cpu,
  Loader2,
  Users,
} from "lucide-react";
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
import { useWorkspace } from "@/components/workspace/workspace-provider";
import {
  countGlobalSearchResults,
  useGlobalSearch,
} from "@/features/search/use-global-search";
import {
  getRecentEntries,
  pushRecent,
  type RecentEntry,
  type RecentEntryType,
} from "@/features/search/recent";

export type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin?: boolean;
};

function recentIcon(type: RecentEntryType) {
  switch (type) {
    case "customer":
      return Users;
    case "job":
      return Briefcase;
    case "machine":
      return Cpu;
    case "catalog":
      return Box;
  }
}

export function CommandPalette({
  open,
  onOpenChange,
  isAdmin = false,
}: CommandPaletteProps) {
  const router = useRouter();
  const { openReport } = useSupportReport();
  const { role } = useWorkspace();

  const close = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const runRoute = useCallback(
    (href: string, recent?: Omit<RecentEntry, "href"> & { href?: string }) => {
      if (recent) {
        pushRecent({
          id: recent.id,
          type: recent.type,
          title: recent.title,
          href: recent.href ?? href,
        });
      }
      close();
      router.push(href);
    },
    [close, router]
  );

  const navItems = getVisibleNavItems({ role, isSupportAdmin: isAdmin });
  const [query, setQuery] = useState("");
  const { debouncedQuery, data: searchData, isFetching, isLoading } =
    useGlobalSearch(query);

  const recentEntries = useMemo(() => {
    if (!open || query.trim().length > 0) return [];
    return getRecentEntries();
  }, [open, query]);

  const totalCommands = QUICK_ACTIONS.length + navItems.length;
  const searchCount = countGlobalSearchResults(searchData);

  const resultsSummary = useMemo(() => {
    const q = query.trim();
    if (debouncedQuery.length >= 2) {
      if (isFetching || isLoading) return `'${debouncedQuery}' aranıyor`;
      return `${searchCount} arama sonucu bulundu`;
    }
    if (!q) return `${totalCommands} komut listelendi`;
    return `'${q}' için sonuçlar filtreleniyor`;
  }, [
    query,
    debouncedQuery,
    isFetching,
    isLoading,
    searchCount,
    totalCommands,
  ]);

  const emptyText =
    debouncedQuery.length >= 2
      ? `Sonuç bulunamadı — '${debouncedQuery}' için yeni müşteri oluştur`
      : "Sonuç bulunamadı.";

  const showSearchGroups = debouncedQuery.length >= 2 && searchData;

  return (
    <CommandMenu
      open={open}
      onOpenChange={onOpenChange}
      onQueryChange={setQuery}
      resultsSummary={resultsSummary}
      emptyText={emptyText}
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

      {recentEntries.length > 0 ? (
        <>
          <CommandSeparator />
          <CommandGroup heading="Son görüntülenenler">
            {recentEntries.map((entry) => {
              const Icon = recentIcon(entry.type);
              return (
                <CommandItem
                  key={`recent-${entry.type}-${entry.id}`}
                  value={`recent-${entry.type}-${entry.id}-${entry.title}`}
                  keywords={[entry.title]}
                  icon={<Icon aria-hidden />}
                  onSelect={() => runRoute(entry.href)}
                >
                  {entry.title}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </>
      ) : null}

      {showSearchGroups ? (
        <>
          <CommandSeparator />
          {searchData.customers.length > 0 ? (
            <CommandGroup heading="Müşteriler">
              {searchData.customers.map((customer) => (
                <CommandItem
                  key={`customer-${customer.id}`}
                  value={`customer-${customer.name}-${customer.id}`}
                  keywords={[customer.name, debouncedQuery]}
                  icon={<Users aria-hidden />}
                  onSelect={() =>
                    runRoute(`/customers/${customer.id}`, {
                      id: customer.id,
                      type: "customer",
                      title: customer.name,
                    })
                  }
                >
                  {customer.name}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {searchData.jobs.length > 0 ? (
            <CommandGroup heading="Siparişler">
              {searchData.jobs.map((job) => {
                const label =
                  job.title?.trim() ||
                  job.customer?.name ||
                  "İsimsiz sipariş";
                const hint = job.customer?.name
                  ? job.title
                    ? job.customer.name
                    : undefined
                  : undefined;
                return (
                  <CommandItem
                    key={`job-${job.id}`}
                    value={`job-${label}-${job.id}`}
                    keywords={[label, job.customer?.name ?? "", debouncedQuery]}
                    icon={<Briefcase aria-hidden />}
                    hint={hint}
                    onSelect={() =>
                      runRoute("/planning", {
                        id: job.id,
                        type: "job",
                        title: label,
                      })
                    }
                  >
                    {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ) : null}
          {searchData.machines.length > 0 ? (
            <CommandGroup heading="Makineler">
              {searchData.machines.map((machine) => (
                <CommandItem
                  key={`machine-${machine.id}`}
                  value={`machine-${machine.name}-${machine.id}`}
                  keywords={[machine.name, debouncedQuery]}
                  icon={<Cpu aria-hidden />}
                  onSelect={() =>
                    runRoute(`/machines/${machine.id}`, {
                      id: machine.id,
                      type: "machine",
                      title: machine.name,
                    })
                  }
                >
                  {machine.name}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {searchData.catalogItems.length > 0 ? (
            <CommandGroup heading="Katalog">
              {searchData.catalogItems.map((item) => (
                <CommandItem
                  key={`catalog-${item.id}`}
                  value={`catalog-${item.name}-${item.sku ?? ""}-${item.id}`}
                  keywords={[
                    item.name,
                    item.sku ?? "",
                    debouncedQuery,
                  ]}
                  icon={<Box aria-hidden />}
                  hint={item.sku ? `SKU: ${item.sku}` : undefined}
                  onSelect={() =>
                    runRoute(`/catalog/${item.id}`, {
                      id: item.id,
                      type: "catalog",
                      title: item.name,
                    })
                  }
                >
                  {item.name}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {searchCount === 0 && !isFetching ? (
            <CommandGroup heading="Öneri">
              <CommandItem
                value={`new-customer-${debouncedQuery}`}
                keywords={[debouncedQuery, "yeni", "müşteri"]}
                icon={<Users aria-hidden />}
                onSelect={() =>
                  runRoute(`/customers?new=1&q=${encodeURIComponent(debouncedQuery)}`)
                }
              >
                Yeni müşteri oluştur
              </CommandItem>
            </CommandGroup>
          ) : null}
        </>
      ) : null}

      {debouncedQuery.length >= 2 && isFetching ? (
        <CommandGroup heading="Ara">
          <CommandItem
            disabled
            value="search-loading"
            icon={<Loader2 aria-hidden className="animate-spin" />}
          >
            Aranıyor…
          </CommandItem>
        </CommandGroup>
      ) : null}
    </CommandMenu>
  );
}
