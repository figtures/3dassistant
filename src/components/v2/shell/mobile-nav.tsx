"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarNavPanel } from "@/components/v2/shell/sidebar-nav";
import { useNavBadges } from "@/components/v2/shell/use-nav-badges";

export function MobileNavSheet({
  open,
  onOpenChange,
  isAdmin,
  changelogUnread,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin?: boolean;
  changelogUnread?: boolean;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const badges = useNavBadges();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        aria-label="Menüyü kapat"
        onClick={() => onOpenChange(false)}
        tabIndex={-1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "absolute inset-y-0 left-0 flex w-[min(100%,280px)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl",
          "transition-transform duration-200"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border px-4">
          <span id={titleId} className="text-sm font-semibold text-foreground">
            Menü
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex size-10 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-sidebar-accent focus-visible:shadow-[var(--focus-ring)]"
            aria-label="Menüyü kapat"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <SidebarNavPanel
          collapsed={false}
          badges={badges}
          isAdmin={isAdmin}
          changelogUnread={changelogUnread}
          onNavigate={() => onOpenChange(false)}
          className="flex-1"
        />
      </div>
    </div>
  );
}
