"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Card, CardContent, CardHeader } from "@/components/ds";
import { HelpTitleRow } from "@/components/v2/help/contextual-help";
import { ShortcutsDialog } from "@/components/v2/help/shortcuts-dialog";
import { SettingsFormFooter } from "@/features/settings/settings-form-footer";
import {
  DENSITY_COOKIE,
  DENSITY_COOKIE_MAX_AGE,
  parseUiDensity,
  type UiDensity,
} from "@/lib/shell/density-cookie";
import { cn } from "@/lib/utils";

import {
  SHORTCUTS_PREF_KEY,
  writeShortcutsEnabled,
} from "@/lib/shortcuts/registry";

function readDensityFromDom(): UiDensity {
  if (typeof document === "undefined") return "comfortable";
  return parseUiDensity(document.documentElement.dataset.density);
}

function applyDensity(density: UiDensity) {
  document.documentElement.dataset.density = density;
  document.cookie = `${DENSITY_COOKIE}=${density}; path=/; max-age=${DENSITY_COOKIE_MAX_AGE}; samesite=lax`;
}

export function AppearanceSettingsScreen() {
  const [density, setDensity] = useState<UiDensity>("comfortable");
  const [initialDensity, setInitialDensity] = useState<UiDensity>("comfortable");
  const [shortcutsEnabled, setShortcutsEnabled] = useState(true);
  const [initialShortcuts, setInitialShortcuts] = useState(true);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = readDensityFromDom();
    setDensity(d);
    setInitialDensity(d);
    const stored = localStorage.getItem(SHORTCUTS_PREF_KEY);
    const enabled = stored !== "0";
    setShortcutsEnabled(enabled);
    setInitialShortcuts(enabled);
  }, []);

  const dirty =
    density !== initialDensity || shortcutsEnabled !== initialShortcuts;

  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function save() {
    setSaving(true);
    applyDensity(density);
    writeShortcutsEnabled(shortcutsEnabled);
    setInitialDensity(density);
    setInitialShortcuts(shortcutsEnabled);
    setSaving(false);
    toast.success("Görünüm tercihleri kaydedildi");
  }

  function discard() {
    setDensity(initialDensity);
    setShortcutsEnabled(initialShortcuts);
  }

  return (
    <div className="space-y-8 pb-8">
      <header className="space-y-1">
        <HelpTitleRow>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Görünüm
          </h1>
        </HelpTitleRow>
        <p className="max-w-xl text-sm text-muted-foreground">
          Tema, yoğunluk ve klavye kısayolları.
        </p>
      </header>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">Tema</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-primary bg-primary-subtle px-3 py-2.5">
            <span className="text-sm font-medium text-foreground">Koyu</span>
            <input type="radio" name="theme" checked readOnly className="size-4 accent-[var(--primary)]" />
          </label>
          <label className="flex cursor-not-allowed items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-3 py-2.5 opacity-70">
            <span className="text-sm text-muted-foreground">Açık — yakında</span>
            <input type="radio" name="theme" disabled className="size-4" />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">Yoğunluk</h2>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {(
            [
              { id: "comfortable" as const, label: "Rahat", hint: "Varsayılan satır yüksekliği" },
              { id: "compact" as const, label: "Sıkı", hint: "Daha fazla satır görünür" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setDensity(opt.id)}
              className={cn(
                "rounded-lg border px-3 py-3 text-left outline-none transition-colors focus-visible:shadow-[var(--focus-ring)]",
                density === opt.id
                  ? "border-primary bg-primary-subtle"
                  : "border-border bg-card hover:bg-accent/40"
              )}
            >
              <span className="block text-sm font-medium text-foreground">{opt.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{opt.hint}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">Klavye kısayolları</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Kısayolları etkinleştir</p>
              <p className="text-xs text-muted-foreground">
                Kapatıldığında G tuşu ile gezinme devre dışı kalır.
              </p>
            </div>
            <input
              type="checkbox"
              className="size-4 accent-[var(--primary)]"
              checked={shortcutsEnabled}
              onChange={(e) => setShortcutsEnabled(e.target.checked)}
              aria-label="Klavye kısayollarını etkinleştir"
            />
          </div>
          <Button type="button" variant="secondary" onClick={() => setShortcutsOpen(true)}>
            Kısayol listesini göster
          </Button>
        </CardContent>
      </Card>

      <SettingsFormFooter
        dirty={dirty}
        saving={saving}
        onSave={save}
        onDiscard={discard}
      />

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
