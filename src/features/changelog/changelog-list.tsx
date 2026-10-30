"use client";

import { useMemo, useState } from "react";
import {
  CHANGELOG_RELEASES,
  type ChangelogItemType,
  type ChangelogRelease,
} from "@/content/changelog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ChangelogFilter = "all" | ChangelogItemType;

const FILTER_OPTIONS: { value: ChangelogFilter; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "new", label: "Yeni" },
  { value: "improved", label: "İyileşme" },
  { value: "fixed", label: "Düzeltme" },
];

const TYPE_LABELS: Record<ChangelogItemType, string> = {
  new: "Yeni",
  improved: "İyileşme",
  fixed: "Düzeltme",
};

const TYPE_BADGE: Record<ChangelogItemType, "success" | "primary" | "warning"> = {
  new: "success",
  improved: "primary",
  fixed: "warning",
};

function formatReleaseDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function releaseMatchesFilter(release: ChangelogRelease, filter: ChangelogFilter): boolean {
  if (filter === "all") return true;
  return release.items.some((item) => item.type === filter);
}

function filterItems(release: ChangelogRelease, filter: ChangelogFilter) {
  if (filter === "all") return release.items;
  return release.items.filter((item) => item.type === filter);
}

export function ChangelogList({
  releases = CHANGELOG_RELEASES,
  className,
}: {
  releases?: readonly ChangelogRelease[];
  className?: string;
}) {
  const [filter, setFilter] = useState<ChangelogFilter>("all");

  const visible = useMemo(
    () => releases.filter((r) => releaseMatchesFilter(r, filter)),
    [releases, filter]
  );

  return (
    <div className={cn("space-y-8", className)}>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Sürüm notu filtresi"
      >
        {FILTER_OPTIONS.map((opt) => {
          const active = filter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(opt.value)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium outline-none transition-colors",
                "focus-visible:shadow-[var(--focus-ring)]",
                active
                  ? "border-primary/40 bg-primary-subtle text-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Bu filtreyle eşleşen sürüm notu yok.
        </p>
      ) : (
        <div className="flex flex-col">
          {visible.map((release) => {
            const items = filterItems(release, filter);
            const tags = [...new Set(items.map((i) => i.type))];
            return (
              <article
                key={release.version}
                className="grid grid-cols-1 gap-4 border-b border-border py-8 last:border-b-0 lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-8"
              >
                <div className="flex flex-row items-center gap-3 self-start lg:sticky lg:top-6 lg:flex-col lg:items-start lg:gap-2">
                  <time
                    dateTime={release.date}
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {formatReleaseDate(release.date)}
                  </time>
                  <Badge variant="default" className="tabular-nums">
                    v{release.version}
                  </Badge>
                </div>
                <div className="min-w-0 space-y-4">
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <Badge key={tag} variant={TYPE_BADGE[tag]} className="text-[10px] uppercase">
                        {TYPE_LABELS[tag]}
                      </Badge>
                    ))}
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">
                    {release.title}
                  </h2>
                  <ul className="flex list-disc flex-col gap-2 ps-5 text-sm leading-relaxed text-muted-foreground marker:text-border">
                    {items.map((item) => (
                      <li key={item.text}>
                        <span className="sr-only">{TYPE_LABELS[item.type]}: </span>
                        {item.text}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
