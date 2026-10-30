"use client";

import { Button, Card, CardContent } from "@/components/ds";
import { FaultStatusBadge } from "@/features/faults/fault-status-badge";
import { formatDateShort } from "@/lib/format";
import { formatHours } from "@/lib/utils";
import type { Fault } from "@/types/database";
import { Pencil, Trash2 } from "lucide-react";

export type FaultsTableProps = {
  faults: Fault[];
  onEdit: (fault: Fault) => void;
  onDelete: (id: string) => void;
};

export function FaultsTable({ faults, onEdit, onDelete }: FaultsTableProps) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="sticky top-0 z-[1] bg-surface-2">
              <tr className="border-b border-border text-left text-muted-foreground">
                {["Tarih", "Makine", "Arıza tipi", "Süre", "Durum", "Açıklama", ""].map((h) => (
                  <th key={h || "actions"} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {faults.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-border/60 transition-colors hover:bg-surface-2/50"
                >
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDateShort(f.fault_date)}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {f.machine?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {f.fault_type_name ?? f.fault_type?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {formatHours(f.duration_hours)}
                  </td>
                  <td className="px-4 py-3">
                    <FaultStatusBadge status={f.status} />
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-muted-foreground">
                    {f.description ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(f)}
                        aria-label="Arıza kaydını düzenle"
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(f.id)}
                        aria-label="Arıza kaydını sil"
                      >
                        <Trash2 className="size-4 text-destructive" aria-hidden />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {faults.map((f) => (
          <Card key={f.id} className="border-border">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{f.machine?.name ?? "Makine"}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateShort(f.fault_date)} · {formatHours(f.duration_hours)}
                  </p>
                </div>
                <FaultStatusBadge status={f.status} />
              </div>
              <p className="text-sm text-foreground">
                {f.fault_type_name ?? f.fault_type?.name ?? "Arıza tipi yok"}
              </p>
              {f.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">{f.description}</p>
              )}
              <div className="flex justify-end gap-1 pt-1">
                <Button type="button" variant="secondary" size="sm" onClick={() => onEdit(f)}>
                  Düzenle
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(f.id)}>
                  Sil
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
