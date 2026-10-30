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
import { Loader2 } from "lucide-react";

export type BulkStockAdjustDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colorCount: number;
  deltaValue: string;
  onDeltaChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
};

export function BulkStockAdjustDialog({
  open,
  onOpenChange,
  colorCount,
  deltaValue,
  onDeltaChange,
  onSave,
  saving,
}: BulkStockAdjustDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Toplu stok düzelt</DialogTitle>
          <DialogDescription>
            {colorCount} renk için aynı gram değişimi uygulanır (negatif = düşür).
          </DialogDescription>
        </DialogHeader>
        <FormField label="Gram değişimi" required>
          {(field) => (
            <Input
              {...field}
              type="number"
              value={deltaValue}
              onChange={(e) => onDeltaChange(e.target.value)}
              autoFocus
            />
          )}
        </FormField>
        <DialogFooter>
          <Button
            type="button"
            onClick={onSave}
            disabled={saving || deltaValue.trim() === ""}
            className="w-full"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Kaydediliyor…
              </>
            ) : (
              "Stokları güncelle"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
