"use client";

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
} from "@/components/ds";
import { Loader2, Plus, X } from "lucide-react";
import type { ColorFormRow, MaterialFormValues } from "@/features/materials/material-mutations";

export type MaterialSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: MaterialFormValues;
  onFormChange: (form: MaterialFormValues) => void;
  colors: ColorFormRow[];
  onColorsChange: (colors: ColorFormRow[]) => void;
  onSave: () => void;
  saving: boolean;
};

export function MaterialSheet({
  open,
  onOpenChange,
  editing,
  form,
  onFormChange,
  colors,
  onColorsChange,
  onSave,
  saving,
}: MaterialSheetProps) {
  function addColorRow() {
    onColorsChange([
      ...colors,
      { color_name: "", hex_code: "", stock_grams: "", low_stock_grams: "" },
    ]);
  }

  function removeColorRow(index: number) {
    if (colors.length <= 1) return;
    onColorsChange(colors.filter((_, i) => i !== index));
  }

  function updateColorRow(index: number, patch: Partial<ColorFormRow>) {
    onColorsChange(colors.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-sm:max-h-[95dvh]">
        <DialogHeader>
          <DialogTitle>{editing ? "Malzeme düzenle" : "Yeni malzeme"}</DialogTitle>
          <DialogDescription>
            Filament bilgileri ve renk varyantları. Stok, renk satırlarından otomatik
            toplanır.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4 py-1">
          <FormField label="Malzeme adı" required>
            {(field) => (
              <Input
                {...field}
                value={form.name}
                onChange={(e) => onFormChange({ ...form, name: e.target.value })}
                placeholder="PETG"
                autoComplete="off"
              />
            )}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Marka">
              {(field) => (
                <Input
                  {...field}
                  value={form.brand}
                  onChange={(e) => onFormChange({ ...form, brand: e.target.value })}
                  autoComplete="off"
                />
              )}
            </FormField>
            <FormField label="Fiyat (₺/kg)">
              {(field) => (
                <Input
                  {...field}
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price_per_kg}
                  onChange={(e) =>
                    onFormChange({ ...form, price_per_kg: e.target.value })
                  }
                />
              )}
            </FormField>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">Renkler</p>
              <Button type="button" variant="ghost" size="sm" onClick={addColorRow}>
                <Plus className="size-3.5" aria-hidden />
                Renk ekle
              </Button>
            </div>
            <div className="space-y-2">
              {colors.map((row, index) => (
                <div
                  key={row.id ?? `new-${index}`}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_88px_100px_100px_44px] sm:items-end"
                >
                  {index === 0 ? (
                    <FormField label="Renk adı">
                      {(field) => (
                        <Input
                          {...field}
                          value={row.color_name}
                          onChange={(e) =>
                            updateColorRow(index, { color_name: e.target.value })
                          }
                          placeholder="Siyah"
                        />
                      )}
                    </FormField>
                  ) : (
                    <Input
                      aria-label="Renk adı"
                      value={row.color_name}
                      onChange={(e) =>
                        updateColorRow(index, { color_name: e.target.value })
                      }
                      placeholder="Siyah"
                    />
                  )}
                  {index === 0 ? (
                    <FormField label="Hex">
                      {(field) => (
                        <Input
                          {...field}
                          value={row.hex_code}
                          onChange={(e) =>
                            updateColorRow(index, { hex_code: e.target.value })
                          }
                          placeholder="#000"
                        />
                      )}
                    </FormField>
                  ) : (
                    <Input
                      aria-label="Hex"
                      value={row.hex_code}
                      onChange={(e) =>
                        updateColorRow(index, { hex_code: e.target.value })
                      }
                      placeholder="#000"
                    />
                  )}
                  {index === 0 ? (
                    <FormField label="Stok (g)">
                      {(field) => (
                        <Input
                          {...field}
                          type="number"
                          min={0}
                          value={row.stock_grams}
                          onChange={(e) =>
                            updateColorRow(index, { stock_grams: e.target.value })
                          }
                          placeholder="500"
                        />
                      )}
                    </FormField>
                  ) : (
                    <Input
                      aria-label="Stok (gram)"
                      type="number"
                      min={0}
                      value={row.stock_grams}
                      onChange={(e) =>
                        updateColorRow(index, { stock_grams: e.target.value })
                      }
                      placeholder="500"
                    />
                  )}
                  {index === 0 ? (
                    <FormField
                      label="Eşik (g)"
                      description="Boş bırakılırsa 500 g"
                    >
                      {(field) => (
                        <Input
                          {...field}
                          type="number"
                          min={0}
                          value={row.low_stock_grams}
                          onChange={(e) =>
                            updateColorRow(index, {
                              low_stock_grams: e.target.value,
                            })
                          }
                          placeholder="500"
                        />
                      )}
                    </FormField>
                  ) : (
                    <Input
                      aria-label="Düşük stok eşiği (gram)"
                      type="number"
                      min={0}
                      value={row.low_stock_grams}
                      onChange={(e) =>
                        updateColorRow(index, { low_stock_grams: e.target.value })
                      }
                      placeholder="500"
                    />
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0"
                    onClick={() => removeColorRow(index)}
                    disabled={colors.length <= 1}
                    aria-label="Renk satırını kaldır"
                  >
                    <X className="size-3.5" aria-hidden />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogBody>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            onClick={onSave}
            disabled={saving || !form.name.trim()}
            className="w-full sm:w-auto"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Kaydediliyor…
              </>
            ) : (
              "Kaydet"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
