"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
} from "@/components/ds";
import { VoiceParsePanel } from "@/components/ui/voice-parse-panel";
import type { VoiceFieldConfidence } from "@/lib/voice-confidence";
import type { Customer, ShipmentStatus } from "@/types/database";
import { SALE_CHANNELS, SHIPMENT_STATUSES } from "@/features/catalog/catalog-utils";
import { Loader2 } from "lucide-react";

const selectClassName =
  "flex h-[var(--density-control-h)] w-full rounded-lg border border-input bg-surface-inset px-3 text-sm text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]";

export type SaleFormValues = {
  customer_id: string;
  channel: string;
  platform: string;
  unit_price: string;
  quantity: string;
  sold_at: string;
  carrier: string;
  tracking_number: string;
  shipment_status: ShipmentStatus;
};

export type CatalogSaleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: SaleFormValues;
  onFormChange: (form: SaleFormValues) => void;
  customers: Customer[];
  saving: boolean;
  onSave: () => void;
  voice: {
    isSupported: boolean;
    isListening: boolean;
    voiceText: string;
    onVoiceTextChange: (text: string) => void;
    matched: string[];
    fieldConfidence: VoiceFieldConfidence;
    onToggleListen: () => void;
  };
};

export function CatalogSaleDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  customers,
  saving,
  onSave,
  voice,
}: CatalogSaleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Satış kaydı</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <VoiceParsePanel
            isSupported={voice.isSupported}
            isListening={voice.isListening}
            voiceText={voice.voiceText}
            onVoiceTextChange={voice.onVoiceTextChange}
            matched={voice.matched}
            fieldConfidence={voice.fieldConfidence}
            onToggleListen={voice.onToggleListen}
          />
          <FormField label="Müşteri">
            {(field) => (
              <select
                {...field}
                className={selectClassName}
                value={form.customer_id}
                onChange={(e) => onFormChange({ ...form, customer_id: e.target.value })}
              >
                <option value="">Seçiniz</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <FormField label="Kanal">
            {(field) => (
              <select
                {...field}
                className={selectClassName}
                value={form.channel}
                onChange={(e) => onFormChange({ ...form, channel: e.target.value })}
              >
                <option value="">Seçiniz</option>
                {SALE_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <FormField label="Platform">
            {(field) => (
              <Input
                {...field}
                value={form.platform}
                onChange={(e) => onFormChange({ ...form, platform: e.target.value })}
              />
            )}
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Birim fiyat">
              {(field) => (
                <Input
                  {...field}
                  type="number"
                  value={form.unit_price}
                  onChange={(e) => onFormChange({ ...form, unit_price: e.target.value })}
                />
              )}
            </FormField>
            <FormField label="Adet">
              {(field) => (
                <Input
                  {...field}
                  type="number"
                  value={form.quantity}
                  onChange={(e) => onFormChange({ ...form, quantity: e.target.value })}
                />
              )}
            </FormField>
          </div>
          <FormField label="Satış tarihi">
            {(field) => (
              <Input
                {...field}
                type="date"
                value={form.sold_at}
                onChange={(e) => onFormChange({ ...form, sold_at: e.target.value })}
              />
            )}
          </FormField>
          <p className="text-sm font-medium text-foreground">Kargo (isteğe bağlı)</p>
          <FormField label="Kargo firması">
            {(field) => (
              <Input
                {...field}
                value={form.carrier}
                onChange={(e) => onFormChange({ ...form, carrier: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Takip no">
            {(field) => (
              <Input
                {...field}
                value={form.tracking_number}
                onChange={(e) =>
                  onFormChange({ ...form, tracking_number: e.target.value })
                }
              />
            )}
          </FormField>
          <FormField label="Durum">
            {(field) => (
              <select
                {...field}
                className={selectClassName}
                value={form.shipment_status}
                onChange={(e) =>
                  onFormChange({
                    ...form,
                    shipment_status: e.target.value as ShipmentStatus,
                  })
                }
              >
                {SHIPMENT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button type="button" onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
