"use client";

import Link from "next/link";
import { CalendarDays, Cpu, PlusCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type QuickLink = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

const LINKS: QuickLink[] = [
  {
    href: "/planning",
    label: "Planlama",
    description: "Üretim takvimini aç",
    icon: CalendarDays,
  },
  {
    href: "/machines",
    label: "Makineler",
    description: "Filo ve canlı durum",
    icon: Cpu,
  },
  {
    href: "/planning",
    label: "Yeni sipariş",
    description: "Planlamada iş ekle",
    icon: PlusCircle,
  },
];

export function QuickLinks() {
  return (
    <section aria-labelledby="quick-links-heading">
      <h2
        id="quick-links-heading"
        className="mb-3 text-sm font-medium text-muted-foreground"
      >
        Hızlı erişim
      </h2>
      <div className="grid gap-2 sm:grid-cols-3">
        {LINKS.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-foreground">{label}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {description}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
