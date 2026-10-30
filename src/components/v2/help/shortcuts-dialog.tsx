"use client";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ds/dialog";
import {
  getShortcutDisplayRows,
  type ShortcutDisplayRow,
} from "@/lib/shortcuts/registry";

const GROUP_LABELS: Record<ShortcutDisplayRow["group"], string> = {
  genel: "Genel",
  gezinme: "Gezinme (G sonra…)",
  tablo: "Tablolar",
};

const GROUP_ORDER: ShortcutDisplayRow["group"][] = [
  "genel",
  "gezinme",
  "tablo",
];

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const rows = getShortcutDisplayRows();
  const byGroup = GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    rows: rows.filter((r) => r.group === group),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="max-sm:max-h-[90dvh]">
        <DialogHeader>
          <DialogTitle>Klavye kısayolları</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-5 pt-0">
        <p className="text-sm text-muted-foreground">
          Metin alanlarında kısayollar devre dışıdır. Klavye kısayollarını
          Görünüm ayarlarından kapatabilirsiniz (erişilebilirlik).
        </p>
        <div className="space-y-5">
          {byGroup.map(({ group, label, rows: groupRows }) =>
            groupRows.length ? (
              <section key={group}>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </h3>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {groupRows.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm"
                    >
                      <span className="text-foreground">{row.label}</span>
                      <kbd className="shrink-0 rounded-md border border-border bg-muted px-2 py-0.5 font-sans text-xs text-foreground">
                        {row.keys}
                      </kbd>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null
          )}
        </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
