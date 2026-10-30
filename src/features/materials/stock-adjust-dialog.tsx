"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
} from "@/components/ds";
import { formatGrams } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export type StockAdjustTarget = {
  materialId: string;
  colorId: string;
  materialName: string;
  colorName: string;
  currentGrams: number;
};

export type StockAdjustDialogProps = {
  target: StockAdjustTarget | null;
  onOpenChange: (open: boolean) => void;
  value: string;
  onValueChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
};

export function StockAdjustDialog({
  target,
  onOpenChange,
  value,
  onValueChange,
  onSave,
  saving,
}: StockAdjustDialogProps) {
  const open = target != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Stok düzelt</DialogTitle>
          <DialogDescription>
            {target ? (
              <>
                <span className="font-medium text-foreground">{target.materialName}</span>
                {" · "}
                {target.colorName}
                {" — mevcut "}
                {formatGrams(target.currentGrams)}
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <FormField label="Yeni stok (gram)" required>
          {(field) => (
            <Input
              {...field}
              type="number"
              min={0}
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              autoFocus
            />
          )}
        </FormField>
        <DialogFooter>
          <Button onClick={onSave} disabled={saving || value.trim() === ""} className="w-full">
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Kaydediliyor…
              </>
            ) : (
              "Stoku güncelle"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
