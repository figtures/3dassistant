import { getCommandShortcutLabel } from "@/components/v2/command/use-command-shortcut";

export const SHORTCUTS_PREF_KEY = "pf.shortcuts.enabled";
export const SHORTCUTS_PREF_CHANGED = "pf:shortcuts-pref-changed";
export const GO_SEQUENCE_MS = 1000;

export type GoNavKey = "d" | "o" | "p" | "m" | "s" | "c";

export const GO_NAV_ROUTES: Record<
  GoNavKey,
  { href: string; label: string; sequenceLabel: string }
> = {
  d: { href: "/dashboard", label: "Genel Bakış", sequenceLabel: "G → D" },
  o: { href: "/orders", label: "Siparişler", sequenceLabel: "G → O" },
  p: { href: "/planning", label: "Planlama", sequenceLabel: "G → P" },
  m: { href: "/machines", label: "Makineler", sequenceLabel: "G → M" },
  s: { href: "/materials", label: "Malzemeler", sequenceLabel: "G → S" },
  c: { href: "/customers", label: "Müşteriler", sequenceLabel: "G → C" },
};

export type ShortcutDisplayRow = {
  id: string;
  keys: string;
  label: string;
  group: "genel" | "gezinme" | "tablo";
};

export function readShortcutsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(SHORTCUTS_PREF_KEY) !== "0";
}

export function writeShortcutsEnabled(enabled: boolean): void {
  localStorage.setItem(SHORTCUTS_PREF_KEY, enabled ? "1" : "0");
  window.dispatchEvent(new Event(SHORTCUTS_PREF_CHANGED));
}

export function getShortcutDisplayRows(): ShortcutDisplayRow[] {
  const goRows = (Object.keys(GO_NAV_ROUTES) as GoNavKey[]).map((key) => ({
    id: `go-${key}`,
    keys: GO_NAV_ROUTES[key].sequenceLabel,
    label: GO_NAV_ROUTES[key].label,
    group: "gezinme" as const,
  }));

  return [
    {
      id: "command-palette",
      keys: getCommandShortcutLabel(),
      label: "Komut paleti",
      group: "genel",
    },
    { id: "focus-search", keys: "/", label: "Sayfa içi aramaya odaklan", group: "genel" },
    { id: "new-order", keys: "N", label: "Yeni sipariş", group: "genel" },
    ...goRows,
    { id: "shortcuts-help", keys: "?", label: "Klavye kısayolları", group: "genel" },
    { id: "table-next", keys: "J", label: "Tabloda sonraki satır", group: "tablo" },
    { id: "table-prev", keys: "K", label: "Tabloda önceki satır", group: "tablo" },
    { id: "table-select", keys: "X", label: "Satır seç / kaldır", group: "tablo" },
    { id: "table-edit", keys: "E", label: "Seçili kaydı düzenle", group: "tablo" },
    { id: "escape", keys: "Esc", label: "Kapat / seçimi temizle", group: "genel" },
  ];
}

const EDITABLE_SELECTOR =
  "input, textarea, select, [contenteditable='true'], [contenteditable='']";

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest(EDITABLE_SELECTOR));
}

export function hasShortcutModifier(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey || event.altKey;
}

export type GoSequenceState = {
  pending: boolean;
  startedAt: number;
};

export const INITIAL_GO_STATE: GoSequenceState = {
  pending: false,
  startedAt: 0,
};

export type ShortcutDispatch =
  | { type: "showShortcuts" }
  | { type: "focusPageSearch" }
  | { type: "newRecord" }
  | { type: "navigate"; href: string }
  | { type: "tableNext" }
  | { type: "tablePrev" }
  | { type: "tableToggleSelect" }
  | { type: "tableEdit" }
  | { type: "escape" }
  | { type: "startGoSequence" }
  | { type: "none" };

export type ResolveShortcutOptions = {
  enabled: boolean;
  now?: number;
};

/** Saf eşleştirme — birim testler için. */
export function resolveShortcut(
  event: Pick<KeyboardEvent, "key">,
  goState: GoSequenceState,
  options: ResolveShortcutOptions
): { dispatch: ShortcutDispatch; goState: GoSequenceState } {
  const now = options.now ?? Date.now();
  if (!options.enabled) {
    return { dispatch: { type: "none" }, goState: INITIAL_GO_STATE };
  }

  let state = goState;
  if (state.pending && now - state.startedAt > GO_SEQUENCE_MS) {
    state = INITIAL_GO_STATE;
  }

  if (state.pending) {
    const navKey = event.key.toLowerCase() as GoNavKey;
    const route = GO_NAV_ROUTES[navKey];
    if (route) {
      return {
        dispatch: { type: "navigate", href: route.href },
        goState: INITIAL_GO_STATE,
      };
    }
    return { dispatch: { type: "none" }, goState: INITIAL_GO_STATE };
  }

  if (event.key === "?") return { dispatch: { type: "showShortcuts" }, goState: state };
  if (event.key === "/") return { dispatch: { type: "focusPageSearch" }, goState: state };
  if (event.key === "n" || event.key === "N") {
    return { dispatch: { type: "newRecord" }, goState: state };
  }
  if (event.key === "g" || event.key === "G") {
    return {
      dispatch: { type: "startGoSequence" },
      goState: { pending: true, startedAt: now },
    };
  }
  if (event.key === "j" || event.key === "J") {
    return { dispatch: { type: "tableNext" }, goState: state };
  }
  if (event.key === "k" || event.key === "K") {
    return { dispatch: { type: "tablePrev" }, goState: state };
  }
  if (event.key === "x" || event.key === "X") {
    return { dispatch: { type: "tableToggleSelect" }, goState: state };
  }
  if (event.key === "e" || event.key === "E") {
    return { dispatch: { type: "tableEdit" }, goState: state };
  }
  if (event.key === "Escape") {
    return { dispatch: { type: "escape" }, goState: state };
  }

  return { dispatch: { type: "none" }, goState: state };
}

export function focusPageSearchInput(): void {
  if (typeof document === "undefined") return;
  const el = document.querySelector<HTMLElement>("[data-page-search]");
  el?.focus();
}
