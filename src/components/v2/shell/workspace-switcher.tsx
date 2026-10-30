"use client";

import { Building2, ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { cn } from "@/lib/utils";

type WorkspaceSwitcherProps = {
  collapsed?: boolean;
};

export function WorkspaceSwitcher({ collapsed = false }: WorkspaceSwitcherProps) {
  const { id, name, memberships, switchWorkspace, switching } = useWorkspace();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const showSwitcher = memberships.length > 1;

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

  if (!showSwitcher) {
    return null;
  }

  async function pick(nextId: string) {
    if (nextId === id || switching) return;
    setOpen(false);
    try {
      await switchWorkspace(nextId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Çalışma alanı değiştirilemedi");
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", collapsed ? "px-1" : "px-3 pb-2")}>
      <button
        type="button"
        disabled={switching}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 text-left text-sidebar-foreground transition-colors hover:bg-sidebar-accent/70 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
          collapsed ? "justify-center p-2" : "px-3 py-2"
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={collapsed ? name : undefined}
      >
        {switching ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-xs font-medium">{name}</span>
            <ChevronDown
              className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
              aria-hidden
            />
          </>
        )}
      </button>

      {open && (
        <ul
          role="listbox"
          className={cn(
            "absolute z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-lg",
            collapsed ? "left-full top-0 ml-2 w-56" : "inset-x-3"
          )}
        >
          {memberships.map((m) => (
            <li key={m.id} role="option" aria-selected={m.id === id}>
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent",
                  m.id === id && "bg-accent/60"
                )}
                onClick={() => void pick(m.id)}
              >
                <span className="font-medium">{m.name}</span>
                <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
