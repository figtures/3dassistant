"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  focusPageSearchInput,
  hasShortcutModifier,
  INITIAL_GO_STATE,
  isEditableTarget,
  readShortcutsEnabled,
  resolveShortcut,
  SHORTCUTS_PREF_CHANGED,
  type GoSequenceState,
  type ShortcutDispatch,
} from "@/lib/shortcuts/registry";

export type ShortcutHandlers = {
  onFocusPageSearch?: () => void;
  onNewRecord?: () => void;
  onShowShortcuts?: () => void;
  onNavigate?: (href: string) => void;
  onTableNext?: () => void;
  onTablePrev?: () => void;
  onTableToggleSelect?: () => void;
  onTableEdit?: () => void;
  onEscape?: () => void;
};

const handlerStack: ShortcutHandlers[] = [];

function mergeHandlers(): ShortcutHandlers {
  const merged: ShortcutHandlers = {};
  for (let i = handlerStack.length - 1; i >= 0; i -= 1) {
    const h = handlerStack[i];
    if (!merged.onFocusPageSearch && h.onFocusPageSearch) {
      merged.onFocusPageSearch = h.onFocusPageSearch;
    }
    if (!merged.onNewRecord && h.onNewRecord) merged.onNewRecord = h.onNewRecord;
    if (!merged.onShowShortcuts && h.onShowShortcuts) {
      merged.onShowShortcuts = h.onShowShortcuts;
    }
    if (!merged.onNavigate && h.onNavigate) merged.onNavigate = h.onNavigate;
    if (!merged.onTableNext && h.onTableNext) merged.onTableNext = h.onTableNext;
    if (!merged.onTablePrev && h.onTablePrev) merged.onTablePrev = h.onTablePrev;
    if (!merged.onTableToggleSelect && h.onTableToggleSelect) {
      merged.onTableToggleSelect = h.onTableToggleSelect;
    }
    if (!merged.onTableEdit && h.onTableEdit) merged.onTableEdit = h.onTableEdit;
    if (!merged.onEscape && h.onEscape) merged.onEscape = h.onEscape;
  }
  return merged;
}

function subscribeShortcutsEnabled(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key == null || e.key === "pf.shortcuts.enabled") onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(SHORTCUTS_PREF_CHANGED, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SHORTCUTS_PREF_CHANGED, onStoreChange);
  };
}

export function useShortcutsEnabled(): boolean {
  return useSyncExternalStore(
    subscribeShortcutsEnabled,
    readShortcutsEnabled,
    () => true
  );
}

export function useShortcutHandlers(handlers: ShortcutHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const proxy: ShortcutHandlers = {
      onFocusPageSearch: () => handlersRef.current.onFocusPageSearch?.(),
      onNewRecord: () => handlersRef.current.onNewRecord?.(),
      onShowShortcuts: () => handlersRef.current.onShowShortcuts?.(),
      onNavigate: (href) => handlersRef.current.onNavigate?.(href),
      onTableNext: () => handlersRef.current.onTableNext?.(),
      onTablePrev: () => handlersRef.current.onTablePrev?.(),
      onTableToggleSelect: () => handlersRef.current.onTableToggleSelect?.(),
      onTableEdit: () => handlersRef.current.onTableEdit?.(),
      onEscape: () => handlersRef.current.onEscape?.(),
    };
    handlerStack.push(proxy);
    return () => {
      const idx = handlerStack.indexOf(proxy);
      if (idx >= 0) handlerStack.splice(idx, 1);
    };
  }, []);
}

function runDispatch(dispatch: ShortcutDispatch, handlers: ShortcutHandlers) {
  switch (dispatch.type) {
    case "showShortcuts":
      handlers.onShowShortcuts?.();
      break;
    case "focusPageSearch":
      if (handlers.onFocusPageSearch) handlers.onFocusPageSearch();
      else focusPageSearchInput();
      break;
    case "newRecord":
      handlers.onNewRecord?.();
      break;
    case "navigate":
      if (handlers.onNavigate) handlers.onNavigate(dispatch.href);
      break;
    case "tableNext":
      handlers.onTableNext?.();
      break;
    case "tablePrev":
      handlers.onTablePrev?.();
      break;
    case "tableToggleSelect":
      handlers.onTableToggleSelect?.();
      break;
    case "tableEdit":
      handlers.onTableEdit?.();
      break;
    case "escape":
      handlers.onEscape?.();
      break;
    default:
      break;
  }
}

let goState: GoSequenceState = INITIAL_GO_STATE;
let listenerCount = 0;

function onGlobalKeyDown(e: KeyboardEvent) {
  if (hasShortcutModifier(e)) return;
  if (isEditableTarget(e.target)) return;
  if (!readShortcutsEnabled()) return;

  const { dispatch, goState: nextGo } = resolveShortcut(e, goState, {
    enabled: true,
  });
  goState = nextGo;

  if (dispatch.type === "none" || dispatch.type === "startGoSequence") {
    if (dispatch.type === "startGoSequence") e.preventDefault();
    return;
  }

  e.preventDefault();
  runDispatch(dispatch, mergeHandlers());
}

export type ShortcutRootOptions = {
  onShowShortcuts?: () => void;
  onNavigate?: (href: string) => void;
};

/** Uygulama kabuğunda bir kez çağrılır. */
export function useShortcutRoot(options: ShortcutRootOptions): void {
  const router = useRouter();
  const enabled = useShortcutsEnabled();
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useShortcutHandlers({
    onShowShortcuts: () => optionsRef.current.onShowShortcuts?.(),
    onNavigate: (href) => {
      if (optionsRef.current.onNavigate) {
        optionsRef.current.onNavigate(href);
      } else {
        router.push(href);
      }
    },
    onFocusPageSearch: focusPageSearchInput,
  });

  useEffect(() => {
    if (!enabled) {
      goState = INITIAL_GO_STATE;
    }
  }, [enabled]);

  useEffect(() => {
    listenerCount += 1;
    if (listenerCount === 1) {
      window.addEventListener("keydown", onGlobalKeyDown);
    }
    return () => {
      listenerCount -= 1;
      if (listenerCount === 0) {
        window.removeEventListener("keydown", onGlobalKeyDown);
        goState = INITIAL_GO_STATE;
      }
    };
  }, []);
}
