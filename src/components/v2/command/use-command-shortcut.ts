"use client";

import { useCallback, useEffect, useState } from "react";

/** ⌘K (Mac) veya Ctrl+K — input/textarea içinde de açılır (standart davranış). */
export function useCommandShortcut(key = "k") {
  const [open, setOpenState] = useState(false);
  const [everOpened, setEverOpened] = useState(false);

  const setOpen = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setOpenState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      if (next) setEverOpened(true);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key) return;
      if (!e.metaKey && !e.ctrlKey) return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, setOpen]);

  return [open, setOpen, everOpened] as const;
}

export function getCommandShortcutLabel(): string {
  if (typeof navigator === "undefined") return "⌘K";
  const platform = navigator.platform ?? "";
  if (/Mac|iPhone|iPad|iPod/.test(platform)) return "⌘K";
  return "Ctrl+K";
}
