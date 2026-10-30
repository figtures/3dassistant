"use client";

import { usePathname } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { getPageHelp } from "@/content/help";
import { cn } from "@/lib/utils";

export function ContextualHelp({ className }: { className?: string }) {
  const pathname = usePathname();
  const content = getPageHelp(pathname);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors",
          "hover:bg-accent hover:text-foreground focus-visible:shadow-[var(--focus-ring)]",
          open && "bg-accent text-foreground"
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? titleId : undefined}
        aria-label={`${content.title} hakkında yardım`}
      >
        <CircleHelp className="size-4" aria-hidden />
      </button>
      {open ? (
        <div
          id={titleId}
          role="dialog"
          aria-labelledby={`${titleId}-heading`}
          className={cn(
            "absolute right-0 top-full z-[var(--z-popover,50)] mt-2 w-[min(20rem,calc(100vw-2rem))]",
            "rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg"
          )}
        >
          <p
            id={`${titleId}-heading`}
            className="text-sm font-semibold text-foreground"
          >
            {content.title}
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
            {content.items.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function HelpTitleRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <div className="min-w-0 flex-1">{children}</div>
      <ContextualHelp className="shrink-0" />
    </div>
  );
}
