"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, CreditCard, LogOut, Monitor } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type ShellUser = {
  email: string;
  displayName: string;
};

export function UserMenu({ user }: { user: ShellUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = (user.displayName || user.email).charAt(0).toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex max-w-[200px] items-center gap-2 rounded-lg border border-border bg-secondary/50 px-2 py-1.5 text-left outline-none transition-colors",
          "hover:bg-secondary focus-visible:shadow-[var(--focus-ring)]"
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Kullanıcı menüsü"
      >
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground"
          aria-hidden
        >
          {initial}
        </span>
        <span className="hidden min-w-0 flex-1 sm:block">
          <span className="block truncate text-xs font-medium text-foreground">
            {user.displayName}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {user.email}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "hidden size-4 shrink-0 text-muted-foreground transition-transform sm:block",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-[var(--z-modal)] min-w-[220px] rounded-lg border border-border bg-popover p-1 shadow-lg"
        >
          <Link
            role="menuitem"
            href="/billing"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground outline-none hover:bg-accent focus-visible:shadow-[var(--focus-ring)]"
            onClick={() => setOpen(false)}
          >
            <CreditCard className="size-4 text-muted-foreground" aria-hidden />
            Abonelik
          </Link>
          <Link
            role="menuitem"
            href="/?ui=v1"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground outline-none hover:bg-accent focus-visible:shadow-[var(--focus-ring)]"
            onClick={() => setOpen(false)}
          >
            <Monitor className="size-4 text-muted-foreground" aria-hidden />
            Eski görünüme dön
          </Link>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground outline-none hover:bg-accent focus-visible:shadow-[var(--focus-ring)]"
            onClick={() => {
              setOpen(false);
              void handleLogout();
            }}
          >
            <LogOut className="size-4 text-muted-foreground" aria-hidden />
            Çıkış
          </button>
        </div>
      )}
    </div>
  );
}
