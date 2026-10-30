"use client";

import Link from "next/link";
import {
  BookOpen,
  CircleHelp,
  Keyboard,
  LifeBuoy,
  MessageCircleWarning,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSupportReport } from "@/components/support/report-problem-modal";
import { ShortcutsDialog } from "@/components/v2/help/shortcuts-dialog";
import { cn } from "@/lib/utils";

/** P3-16 sonrası durum sayfası menüde gösterilir */
const SHOW_STATUS_PAGE = false;

type HelpMenuProps = {
  shortcutsOpen: boolean;
  onShortcutsOpenChange: (open: boolean) => void;
};

export function HelpMenu({ shortcutsOpen, onShortcutsOpenChange }: HelpMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { openReport } = useSupportReport();

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function run(action: () => void) {
    setMenuOpen(false);
    action();
  }

  const items = [
    {
      id: "shortcuts",
      label: "Kısayollar",
      icon: Keyboard,
      onClick: () => onShortcutsOpenChange(true),
    },
    {
      id: "report",
      label: "Sorun bildir",
      icon: MessageCircleWarning,
      onClick: () => openReport(),
    },
    {
      id: "support",
      label: "Destek talepleri",
      icon: LifeBuoy,
      href: "/support",
    },
    {
      id: "changelog",
      label: "Yenilikler",
      icon: Sparkles,
      href: "/changelog",
    },
    ...(SHOW_STATUS_PAGE
      ? [
          {
            id: "status",
            label: "Durum sayfası",
            icon: CircleHelp,
            href: "/status",
          },
        ]
      : []),
    {
      id: "guide",
      label: "Rehber",
      icon: BookOpen,
      href: "/support?topic=rehber",
    },
  ] as const;

  return (
    <>
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors",
            "hover:bg-accent hover:text-foreground focus-visible:shadow-[var(--focus-ring)]",
            menuOpen && "bg-accent text-foreground"
          )}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label="Yardım menüsü"
        >
          <CircleHelp className="size-5" aria-hidden />
        </button>
        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 top-full z-[var(--z-popover,50)] mt-2 w-56 rounded-xl border border-border bg-popover py-1 text-sm shadow-lg"
          >
            {items.map((item) => {
              const Icon = item.icon;
              const content = (
                <>
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span>{item.label}</span>
                </>
              );
              if ("href" in item && item.href) {
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-foreground outline-none hover:bg-accent focus-visible:bg-accent"
                    onClick={() => setMenuOpen(false)}
                  >
                    {content}
                  </Link>
                );
              }
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-foreground outline-none hover:bg-accent focus-visible:bg-accent"
                  onClick={() =>
                    run(() => {
                      if ("onClick" in item) item.onClick();
                    })
                  }
                >
                  {content}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={onShortcutsOpenChange} />
    </>
  );
}

