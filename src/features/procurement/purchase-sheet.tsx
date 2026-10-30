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
  nativeSelectClassName,
  Textarea,
} from "@/components/ds";
import { VoiceParsePanel } from "@/components/ui/voice-parse-panel";
import { PROCUREMENT_CHANNELS } from "@/features/procurement/procurement-constants";
import type { PurchaseFormValues } from "@/features/procurement/procurement-mutations";
import type { VoiceFieldConfidence } from "@/lib/voice-confidence";
import type { VoiceParseSource } from "@/lib/voice-parse-client";
import type { Material, Supplier } from "@/types/database";
import type { MaterialColor } from "@/types/database";

export type PurchaseSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: PurchaseFormValues;
  onFormChange: (form: PurchaseFormValues) => void;
  onRecalcTotal: () => void;
  onSave: () => void;
  saving: boolean;
  suppliers: Supplier[];
  materials: Material[];
  colorOptions: MaterialColor[];
  voice: {
    isSupported: boolean;
    isListening: boolean;
    voiceText: string;
    onVoiceTextChange: (text: string) => void;
    matched: string[];
    fieldConfidence: VoiceFieldConfidence;
    parseSource?: VoiceParseSource;
    onToggleListen: () => void;
  };
};

export function PurchaseSheet({
  open,
  onOpenChange,
  editing,
  form,
  onFormChange,
  onRecalcTotal,
  onSave,
  saving,
  suppliers,
  materials,
  colorOptions,
  voice,
}: PurchaseSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-sm:max-h-[95dvh]">
        <DialogHeader>
          <DialogTitle>{editing ? "Alım düzenle" : "Yeni alım"}</DialogTitle>
          <DialogDescription>
            Filament alımını kaydedin; renk seçildiğinde stok otomatik güncellenir.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4 py-1">
          <VoiceParsePanel
            isSupported={voice.isSupported}
            isListening={voice.isListening}
            voiceText={voice.voiceText}
            onVoiceTextChange={voice.onVoiceTextChange}
            matched={voice.matched}
            fieldConfidence={voice.fieldConfidence}
            parseSource={voice.parseSource}
            placeholder="Örn: 1 kg siyah PLA Trendyol 450 lira"
            onToggleListen={voice.onToggleListen}
          />
          <FormField label="Tedarikçi">
            {(field) => (
              <select
                {...field}
                className={nativeSelectClassName}
                value={form.supplier_id}
                onChange={(e) => onFormChange({ ...form, supplier_id: e.target.value })}
              >
                <option value="">Seçiniz</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <FormField label="Malzeme" required>
            {(field) => (
              <select
                {...field}
                className={nativeSelectClassName}
                value={form.material_id}
                onChange={(e) =>
                  onFormChange({
                    ...form,
                    material_id: e.target.value,
                    material_color_id: "",
                  })
                }
              >
                {materials.length === 0 ? (
                  <option value="">Malzeme yok</option>
                ) : (
                  materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))
                )}
              </select>
            )}
          </FormField>
          <FormField label="Renk (stok için)">
            {(field) => (
              <select
                {...field}
                className={nativeSelectClassName}
                value={form.material_color_id}
                onChange={(e) =>
                  onFormChange({ ...form, material_color_id: e.target.value })
                }
              >
                <option value="">Stok güncelleme yok</option>
                {colorOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.color_name}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Gram" required>
              {(field) => (
                <Input
                  {...field}
                  type="number"
                  min={0}
                  value={form.grams}
                  onChange={(e) => onFormChange({ ...form, grams: e.target.value })}
                  onBlur={onRecalcTotal}
                />
              )}
            </FormField>
            <FormField label="Birim fiyat (₺/kg)">
              {(field) => (
                <Input
                  {...field}
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.unit_price}
                  onChange={(e) => onFormChange({ ...form, unit_price: e.target.value })}
                  onBlur={onRecalcTotal}
                />
              )}
            </FormField>
          </div>
          <FormField label="Toplam (₺)">
            {(field) => (
              <Input
                {...field}
                type="number"
                min={0}
                step="0.01"
                value={form.total}
                onChange={(e) => onFormChange({ ...form, total: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Alım tarihi" required>
            {(field) => (
              <Input
                {...field}
                type="date"
                value={form.purchase_date}
                onChange={(e) => onFormChange({ ...form, purchase_date: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Kanal">
            {(field) => (
              <select
                {...field}
                className={nativeSelectClassName}
                value={form.channel}
                onChange={(e) => onFormChange({ ...form, channel: e.target.value })}
              >
                <option value="">Seçiniz</option>
                {PROCUREMENT_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <FormField label="Fatura referansı">
            {(field) => (
              <Input
                {...field}
                value={form.invoice_ref}
                onChange={(e) => onFormChange({ ...form, invoice_ref: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Sipariş bağlantısı">
            {(field) => (
              <Input
                {...field}
                type="url"
                value={form.order_url}
                onChange={(e) => onFormChange({ ...form, order_url: e.target.value })}
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
        </DialogBody>
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
