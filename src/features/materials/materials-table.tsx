"use client";

import Link from "next/link";
import { Fragment, useMemo } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
} from "@/components/ds";
import { buttonVariants } from "@/components/ds/variants";
import { getMaterialColors, getMaterialTotalStock } from "@/lib/materials";
import { isLowStock, lowStockThreshold } from "@/lib/stock";
import { cn, formatCurrency, formatGrams } from "@/lib/utils";
import type { Material, MaterialColor } from "@/types/database";
import type { BulkStockColorTarget } from "@/features/materials/bulk-actions";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Scale,
  ShoppingCart,
  Trash2,
} from "lucide-react";
const STOCK_BAR_REFERENCE_GRAMS = 2000;

function StockBar({
  grams,
  critical,
  className,
}: {
  grams: number;
  critical: boolean;
  className?: string;
}) {
  const pct = Math.min(100, (grams / STOCK_BAR_REFERENCE_GRAMS) * 100);
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <div
        className="h-1.5 min-w-[4rem] flex-1 overflow-hidden rounded-full bg-muted"
        role="presentation"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            critical ? "bg-warning" : "bg-primary"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {formatGrams(grams)}
      </span>
    </div>
  );
}

function ColorSwatch({ hex }: { hex?: string | null }) {
  if (!hex) return null;
  return (
    <span
      className="inline-block size-2.5 shrink-0 rounded-full ring-1 ring-border"
      style={{ backgroundColor: hex }}
      aria-hidden
    />
  );
}

export type MaterialsTableActions = {
  onEdit: (materialId: string) => void;
  onDelete: (materialId: string) => void;
  onAdjustStock: (material: Material, color: MaterialColor) => void;
};

export type MaterialsTableProps = {
  materials: Material[];
  expandedIds: Set<string>;
  onToggleExpand: (materialId: string) => void;
  actions: MaterialsTableActions;
  selectedColors?: Set<string>;
  onToggleColorSelect?: (target: BulkStockColorTarget) => void;
  onToggleSelectAllColors?: () => void;
  allColorsSelected?: boolean;
  selectIndeterminate?: boolean;
};

function MaterialColorRow({
  material,
  color,
  actions,
  selected,
  onToggleSelect,
}: {
  material: Material;
  color: MaterialColor;
  actions: MaterialsTableActions;
  selected?: boolean;
  onToggleSelect?: (target: BulkStockColorTarget) => void;
}) {
  const grams = color.stock_grams ?? 0;
  const critical = isLowStock(grams, lowStockThreshold(color.low_stock_grams));

  return (
    <tr className="border-b border-border/60 bg-surface-1/40 last:border-0">
      <td className="w-10 px-3 py-2.5">
        {onToggleSelect ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={() =>
              onToggleSelect({
                colorId: color.id,
                materialId: material.id,
                currentGrams: grams,
              })
            }
            aria-label={`${color.color_name} seç`}
            className="size-4 rounded border-border"
          />
        ) : null}
      </td>
      <td className="px-4 py-2.5 pl-4 text-sm text-muted-foreground" colSpan={2}>
        <span className="inline-flex items-center gap-2">
          <ColorSwatch hex={color.hex_code} />
          {color.color_name}
          {critical ? (
            <Badge tone="warning" className="ml-1">
              Kritik stok
            </Badge>
          ) : null}
        </span>
      </td>
      <td className="hidden px-4 py-2.5 md:table-cell">
        <StockBar grams={grams} critical={critical} />
      </td>
      <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">—</td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex flex-wrap justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => actions.onAdjustStock(material, color)}
          >
            <Scale className="size-3.5" aria-hidden />
            <span className="sr-only sm:not-sr-only sm:ml-1">Stok</span>
          </Button>
          <Link
            href={`/procurement?new=1&material=${material.id}&color=${color.id}`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <ShoppingCart className="size-3.5" aria-hidden />
            <span className="sr-only sm:not-sr-only sm:ml-1">Alım</span>
          </Link>
        </div>
      </td>
    </tr>
  );
}

export function MaterialsTable({
  materials,
  expandedIds,
  onToggleExpand,
  actions,
  selectedColors,
  onToggleColorSelect,
  onToggleSelectAllColors,
  allColorsSelected = false,
  selectIndeterminate = false,
}: MaterialsTableProps) {
  const selectionEnabled = selectedColors != null && onToggleColorSelect != null;
  const sorted = useMemo(
    () =>
      [...materials].sort((a, b) =>
        a.name.localeCompare(b.name, "tr")
      ),
    [materials]
  );

  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-border lg:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-surface-1 text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-3 font-medium" scope="col">
                {selectionEnabled ? (
                  <input
                    type="checkbox"
                    checked={allColorsSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = selectIndeterminate;
                    }}
                    onChange={() => onToggleSelectAllColors?.()}
                    aria-label="Tüm renkleri seç"
                    className="size-4 rounded border-border"
                  />
                ) : null}
              </th>
              <th className="w-10 px-4 py-3 font-medium" scope="col" />
              <th className="px-4 py-3 font-medium" scope="col">
                Malzeme
              </th>
              <th className="hidden px-4 py-3 font-medium md:table-cell" scope="col">
                Stok
              </th>
              <th className="px-4 py-3 font-medium" scope="col">
                Fiyat
              </th>
              <th className="px-4 py-3 text-right font-medium" scope="col">
                Eylemler
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((mat) => {
              const colors = getMaterialColors(mat).sort(
                (a, b) => a.sort_order - b.sort_order
              );
              const expanded = expandedIds.has(mat.id);
              const total = getMaterialTotalStock(mat);
              const hasCritical = colors.some((c) =>
                isLowStock(c.stock_grams, lowStockThreshold(c.low_stock_grams))
              );

              return (
                <Fragment key={mat.id}>
                  <tr className="border-b border-border/80 hover:bg-accent/30">
                    <td className="px-3 py-3" />
                    <td className="px-2 py-3">
                      {colors.length > 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => onToggleExpand(mat.id)}
                          aria-expanded={expanded}
                          aria-label={
                            expanded ? "Renkleri gizle" : "Renkleri göster"
                          }
                        >
                          {expanded ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </Button>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{mat.name}</p>
                      {mat.brand ? (
                        <p className="text-xs text-muted-foreground">{mat.brand}</p>
                      ) : null}
                      {hasCritical ? (
                        <Badge tone="warning" className="mt-1">
                          Kritik stok
                        </Badge>
                      ) : null}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <StockBar grams={total} critical={hasCritical} />
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {colors.length} renk
                      </p>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {formatCurrency(mat.price_per_kg)}/kg
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => actions.onEdit(mat.id)}
                          aria-label={`${mat.name} düzenle`}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => actions.onDelete(mat.id)}
                          aria-label={`${mat.name} sil`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {expanded
                    ? colors.map((c) => (
                        <MaterialColorRow
                          key={c.id}
                          material={mat}
                          color={c}
                          actions={actions}
                          selected={selectedColors?.has(c.id)}
                          onToggleSelect={onToggleColorSelect}
                        />
                      ))
                    : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:hidden">
        {sorted.map((mat) => {
          const colors = getMaterialColors(mat).sort(
            (a, b) => a.sort_order - b.sort_order
          );
          const total = getMaterialTotalStock(mat);
          const hasCritical = colors.some((c) =>
            isLowStock(c.stock_grams, lowStockThreshold(c.low_stock_grams))
          );

          return (
            <Card key={mat.id} className="overflow-hidden">
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{mat.name}</p>
                  {mat.brand ? (
                    <p className="text-xs text-muted-foreground">{mat.brand}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => actions.onEdit(mat.id)}
                    aria-label={`${mat.name} düzenle`}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive"
                    onClick={() => actions.onDelete(mat.id)}
                    aria-label={`${mat.name} sil`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">Toplam stok</span>
                  <StockBar grams={total} critical={hasCritical} className="max-w-[60%]" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Fiyat</span>
                  <span className="tabular-nums">
                    {formatCurrency(mat.price_per_kg)}/kg
                  </span>
                </div>
                {colors.length > 0 ? (
                  <ul className="space-y-2 border-t border-border pt-3">
                    {colors.map((c) => {
                      const grams = c.stock_grams ?? 0;
                      const critical = isLowStock(
                        grams,
                        lowStockThreshold(c.low_stock_grams)
                      );
                      return (
                        <li
                          key={c.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-sm"
                        >
                          <span className="inline-flex items-center gap-2">
                            {onToggleColorSelect ? (
                              <input
                                type="checkbox"
                                checked={selectedColors?.has(c.id)}
                                onChange={() =>
                                  onToggleColorSelect({
                                    colorId: c.id,
                                    materialId: mat.id,
                                    currentGrams: grams,
                                  })
                                }
                                aria-label={`${c.color_name} seç`}
                                className="size-4 rounded border-border"
                              />
                            ) : null}
                            <ColorSwatch hex={c.hex_code} />
                            {c.color_name}
                            {critical ? (
                              <Badge tone="warning">Kritik</Badge>
                            ) : null}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {formatGrams(grams)}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => actions.onAdjustStock(mat, c)}
                              aria-label="Stok düzelt"
                            >
                              <Scale className="size-3.5" />
                            </Button>
                            <Link
                              href={`/procurement?new=1&material=${mat.id}&color=${c.id}`}
                              className={cn(
                                buttonVariants({ variant: "ghost", size: "icon" }),
                                "size-7"
                              )}
                              aria-label="Alım oluştur"
                            >
                              <ShoppingCart className="size-3.5" />
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">Renk tanımlı değil</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
