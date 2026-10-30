"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ds/dialog";
import { getCommandShortcutLabel } from "@/components/v2/command/use-command-shortcut";

const SHORTCUT_ROWS: Array<{ keys: string; label: string }> = [
  { keys: getCommandShortcutLabel(), label: "Komut paleti" },
  { keys: "/", label: "Sayfa içi aramaya odaklan" },
  { keys: "?", label: "Klavye kısayolları" },
  { keys: "G → D", label: "Genel Bakış" },
  { keys: "G → O", label: "Siparişler" },
  { keys: "G → P", label: "Planlama" },
  { keys: "G → M", label: "Makineler" },
  { keys: "Esc", label: "Kapat / seçimi temizle" },
];

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Klavye kısayolları</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Metin alanlarında kısayollar devre dışıdır. Tam liste ayarlarda genişletilecektir.
        </p>
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
          {SHORTCUT_ROWS.map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm"
            >
              <span className="text-foreground">{row.label}</span>
              <kbd className="shrink-0 rounded-md border border-border bg-muted px-2 py-0.5 font-sans text-xs text-foreground">
                {row.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
