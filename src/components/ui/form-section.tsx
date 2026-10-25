"use client";

import { cn } from "@/lib/utils";

export function FormSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-zinc-800/80 bg-zinc-900/35 p-4",
        className
      )}
    >
      <h3 className="mb-3 border-b border-zinc-800/60 pb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function FormRow({
  children,
  cols = 2,
}: {
  children: React.ReactNode;
  cols?: 2 | 3;
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        cols === 2 && "grid-cols-1 sm:grid-cols-2",
        cols === 3 && "grid-cols-1 md:grid-cols-3"
      )}
    >
      {children}
    </div>
  );
}

export function FormField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <label className="block text-xs font-medium text-zinc-400">{label}</label>
      {children}
    </div>
  );
}
