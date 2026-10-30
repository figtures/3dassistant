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
  Textarea,
} from "@/components/ds";
import type { SupplierFormValues } from "@/features/procurement/procurement-mutations";

export type SupplierSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: SupplierFormValues;
  onFormChange: (form: SupplierFormValues) => void;
  onSave: () => void;
  saving: boolean;
};

export function SupplierSheet({
  open,
  onOpenChange,
  editing,
  form,
  onFormChange,
  onSave,
  saving,
}: SupplierSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{editing ? "Tedarikçi düzenle" : "Yeni tedarikçi"}</DialogTitle>
          <DialogDescription>
            Satın alma kayıtlarında kullanacağınız tedarikçi bilgilerini girin.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <FormField label="Ad" required>
            {(field) => (
              <Input
                {...field}
                value={form.name}
                onChange={(e) => onFormChange({ ...form, name: e.target.value })}
                autoComplete="organization"
              />
            )}
          </FormField>
          <FormField label="E-posta">
            {(field) => (
              <Input
                {...field}
                type="email"
                value={form.contact_email}
                onChange={(e) => onFormChange({ ...form, contact_email: e.target.value })}
                autoComplete="email"
              />
            )}
          </FormField>
          <FormField label="Telefon">
            {(field) => (
              <Input
                {...field}
                type="tel"
                value={form.contact_phone}
                onChange={(e) => onFormChange({ ...form, contact_phone: e.target.value })}
                autoComplete="tel"
              />
            )}
          </FormField>
          <FormField label="Web sitesi">
            {(field) => (
              <Input
                {...field}
                type="url"
                value={form.website}
                onChange={(e) => onFormChange({ ...form, website: e.target.value })}
                placeholder="https://"
              />
            )}
          </FormField>
          <FormField label="Notlar">
            {(field) => (
              <Textarea
                {...field}
                value={form.notes}
                onChange={(e) => onFormChange({ ...form, notes: e.target.value })}
                rows={3}
              />
            )}
          </FormField>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button type="button" onClick={onSave} loading={saving}>
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
