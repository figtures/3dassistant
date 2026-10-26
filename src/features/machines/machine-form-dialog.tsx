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
import type { MachineStatus } from "@/types/database";

const STATUS_LABELS: Record<MachineStatus, string> = {
  active: "Aktif",
  maintenance: "Bakımda",
  offline: "Kapalı",
};

export type MachineFormValues = {
  name: string;
  model: string;
  status: MachineStatus;
};

export type MachineFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: MachineFormValues;
  onFormChange: (form: MachineFormValues) => void;
  onSave: () => void;
  saving: boolean;
};

export function MachineFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  onFormChange,
  onSave,
  saving,
}: MachineFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{editing ? "Makine düzenle" : "Elle makine ekle"}</DialogTitle>
          <DialogDescription>
            Planlama ve siparişler için yazıcı bilgilerini girin. Canlı takip için
            bağlantıyı sonra kurabilirsiniz.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <FormField label="Makine adı" required>
            {(field) => (
              <Input
                {...field}
                value={form.name}
                onChange={(e) => onFormChange({ ...form, name: e.target.value })}
                placeholder="Örn. Ender-3"
                autoComplete="off"
              />
            )}
          </FormField>
          <FormField label="Model">
            {(field) => (
              <Input
                {...field}
                value={form.model}
                onChange={(e) => onFormChange({ ...form, model: e.target.value })}
                placeholder="Bambu Lab X1 Carbon"
                autoComplete="off"
              />
            )}
          </FormField>
          <FormField label="Planlama durumu">
            {(field) => (
              <select
                {...field}
                value={form.status}
                onChange={(e) =>
                  onFormChange({
                    ...form,
                    status: e.target.value as MachineStatus,
                  })
                }
                className="flex h-[var(--density-control-h)] w-full rounded-lg border border-input bg-surface-inset px-3 text-sm text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
              >
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={saving || !form.name.trim()}
            loading={saving}
          >
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
