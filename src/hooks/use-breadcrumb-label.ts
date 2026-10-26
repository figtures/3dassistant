"use client";

import { useEffect, useSyncExternalStore } from "react";

const labels = new Map<string, string>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return labels;
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

/** v2 topbar: dinamik rota segmenti etiketi (örn. makine adı). */
export function useBreadcrumbLabel(segment: string, label: string | undefined | null) {
  useEffect(() => {
    if (!segment || !label?.trim()) return;
    labels.set(segment, label.trim());
    notify();
    return () => {
      if (labels.get(segment) === label.trim()) {
        labels.delete(segment);
        notify();
      }
    };
  }, [segment, label]);
}

export function useBreadcrumbLabelMap(): ReadonlyMap<string, string> {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
