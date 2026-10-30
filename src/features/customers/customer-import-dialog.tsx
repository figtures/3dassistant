"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ds";
import type { CustomerImportRow } from "@/lib/excel";

export type ImportPreviewRow = {
  row: CustomerImportRow;
  line: number;
  error?: string;
};

export type CustomerImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  validRows: ImportPreviewRow[];
  invalidRows: ImportPreviewRow[];
  importing: boolean;
  onConfirm: () => void;
};

export function CustomerImportDialog({
  open,
  onOpenChange,
  validRows,
  invalidRows,
  importing,
  onConfirm,
}: CustomerImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Excel içe aktarma</DialogTitle>
          <DialogDescription>
            {validRows.length} satır aktarılacak
            {invalidRows.length > 0
              ? `, ${invalidRows.length} satır atlanacak (eksik veya geçersiz).`
              : "."}
          </DialogDescription>
        </DialogHeader>

        {invalidRows.length > 0 ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive-subtle/30 p-3 text-sm">
            <p className="font-medium text-foreground">Atlanan satırlar</p>
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-muted-foreground">
              {invalidRows.map((r) => (
                <li key={`${r.line}-${r.row.name}`}>
                  Satır {r.line}: {r.error ?? "Geçersiz"}
                  {r.row.name ? ` (${r.row.name})` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="max-h-60 overflow-y-auto overscroll-contain rounded-lg border border-border">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="sticky top-0 bg-surface-2">
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Ad</th>
                <th className="px-3 py-2 font-medium">E-posta</th>
                <th className="px-3 py-2 font-medium">Telefon</th>
              </tr>
            </thead>
            <tbody>
              {validRows.map((r) => (
                <tr key={r.line} className="border-b border-border/60">
                  <td className="px-3 py-2 text-foreground">{r.row.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.row.email ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.row.phone ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={importing || validRows.length === 0}
            loading={importing}
          >
            {validRows.length} müşteri aktar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
