"use client";

import { Button, Card, CardContent } from "@/components/ds";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { formatGrams } from "@/lib/utils";
import type { MaterialPurchase } from "@/types/database";
import { Pencil, Trash2 } from "lucide-react";

export type PurchasesTableProps = {
  purchases: MaterialPurchase[];
  onEdit: (purchase: MaterialPurchase) => void;
  onDelete: (id: string) => void;
};

export function PurchasesTable({ purchases, onEdit, onDelete }: PurchasesTableProps) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="sticky top-0 z-[1] bg-surface-2">
              <tr className="border-b border-border text-left text-muted-foreground">
                {["Tarih", "Malzeme", "Gram", "Toplam", "Tedarikçi", "Kanal", ""].map((h) => (
                  <th key={h || "actions"} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border/60 transition-colors hover:bg-surface-2/50"
                >
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDateShort(p.purchase_date)}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {p.material?.name ?? "—"}
                    {p.material_color?.color_name && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {p.material_color.color_name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatGrams(p.grams)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatCurrency(Number(p.total))}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.supplier?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.channel ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(p)}
                        aria-label="Alım kaydını düzenle"
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(p.id)}
                        aria-label="Alım kaydını sil"
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
        {purchases.map((p) => (
          <Card key={p.id} className="border-border">
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">
                    {p.material?.name ?? "Alım"}
                    {p.material_color?.color_name && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {p.material_color.color_name}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateShort(p.purchase_date)} · {formatGrams(p.grams)}
                  </p>
                </div>
                <p className="shrink-0 tabular-nums font-medium text-foreground">
                  {formatCurrency(Number(p.total))}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                {p.supplier?.name ?? "Tedarikçi yok"}
                {p.channel ? ` · ${p.channel}` : ""}
              </p>
              <div className="flex justify-end gap-1 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onEdit(p)}
                >
                  Düzenle
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(p.id)}
                >
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
