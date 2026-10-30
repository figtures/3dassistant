"use client";

import { useMemo } from "react";
import {
  FormField,
  Input,
  Textarea,
} from "@/components/ds";
import { VoiceParsePanel } from "@/components/ui/voice-parse-panel";
import { CustomerCombobox } from "@/features/orders/customer-combobox";
import { MaterialColorSelect } from "@/features/orders/material-color-select";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/features/orders/order-constants";
import type { OrderFormInput } from "@/features/orders/order-schema";
import type { VoiceFieldConfidence } from "@/lib/voice-confidence";
import type { VoiceParseSource } from "@/lib/voice-parse-client";
import type { Customer, Machine, PaymentStatus } from "@/types/database";
import type { Material } from "@/types/database";

const selectClassName =
  "flex h-[var(--density-control-h)] w-full rounded-lg border border-input bg-surface-inset px-3 text-sm text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]";

export type OrderFormProps = {
  form: OrderFormInput;
  onFormChange: (form: OrderFormInput) => void;
  machines: Machine[];
  materials: Material[];
  customers: Customer[];
  fieldErrors?: Record<string, string>;
  noteInput: string;
  onNoteInputChange: (value: string) => void;
  onAddNote: () => void;
  notes: { content: string; is_voice: boolean }[];
  voice: {
    isSupported: boolean;
    isListening: boolean;
    voiceText: string;
    onVoiceTextChange: (text: string) => void;
    onVoiceBlur: (text: string) => void;
    matched: string[];
    fieldConfidence: VoiceFieldConfidence;
    parseSource?: VoiceParseSource;
    onToggleListen: () => void;
  };
  filesSlot?: React.ReactNode;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-foreground">{children}</h3>
  );
}

export function OrderForm({
  form,
  onFormChange,
  machines,
  materials,
  customers,
  fieldErrors,
  noteInput,
  onNoteInputChange,
  onAddNote,
  notes,
  voice,
  filesSlot,
}: OrderFormProps) {
  const patch = (partial: Partial<OrderFormInput>) =>
    onFormChange({ ...form, ...partial });

  const computedRemaining = useMemo(() => {
    const revenue = parseFloat(form.revenue_amount) || 0;
    const paid = parseFloat(form.amount_paid) || 0;
    if (!revenue && !paid) return form.amount_remaining;
    return String(Math.max(0, revenue - paid));
  }, [form.revenue_amount, form.amount_paid, form.amount_remaining]);

  const computedInstallment = useMemo(() => {
    const count = parseInt(form.installment_count, 10);
    const revenue = parseFloat(form.revenue_amount) || 0;
    if (count > 0 && revenue > 0) return (revenue / count).toFixed(2);
    return form.installment_amount;
  }, [form.installment_count, form.revenue_amount, form.installment_amount]);

  const paymentOptions = useMemo(
    () => Object.entries(PAYMENT_STATUS_LABELS) as [PaymentStatus, string][],
    []
  );

  return (
    <div className="space-y-6">
      <VoiceParsePanel
        isSupported={voice.isSupported}
        isListening={voice.isListening}
        voiceText={voice.voiceText}
        onVoiceTextChange={voice.onVoiceTextChange}
        onVoiceBlur={voice.onVoiceBlur}
        matched={voice.matched}
        fieldConfidence={voice.fieldConfidence}
        parseSource={voice.parseSource}
        placeholder="Müşteri, gram, malzeme, tutar ve termin bilgilerini Türkçe söyleyin…"
        onToggleListen={voice.onToggleListen}
      />

      <section className="space-y-3" aria-labelledby="order-section-info">
        <SectionTitle>Sipariş</SectionTitle>
        <FormField label="Başlık" required error={fieldErrors?.title}>
          {(field) => (
            <Input
              {...field}
              value={form.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Parça adı…"
            />
          )}
        </FormField>
        <FormField label="Müşteri">
          {(field) => (
            <CustomerCombobox
              {...field}
              customers={customers}
              value={form.customer_id}
              pendingName={form.pending_customer_name}
              onChange={(customerId) => patch({ customer_id: customerId })}
              onPendingName={(name) =>
                patch({
                  pending_customer_name: name,
                  customer_id: "",
                })
              }
              onClearPending={() =>
                patch({
                  pending_customer_name: "",
                  pending_customer_source: "",
                  pending_customer_referral: "",
                  pending_referred_by_customer_id: "",
                })
              }
            />
          )}
        </FormField>
        <FormField label="Açıklama">
          {(field) => (
            <Textarea
              {...field}
              value={form.description}
              onChange={(e) => patch({ description: e.target.value })}
              rows={2}
              className="min-h-[72px]"
            />
          )}
        </FormField>
      </section>

      <section className="space-y-3" aria-labelledby="order-section-production">
        <SectionTitle>Üretim</SectionTitle>
        <FormField label="Makine" required error={fieldErrors?.machine_id}>
          {(field) => (
            <select
              {...field}
              className={selectClassName}
              value={form.machine_id}
              onChange={(e) => patch({ machine_id: e.target.value })}
            >
              <option value="">Seçin…</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <MaterialColorSelect
          materials={materials}
          materialId={form.material_id}
          colorId={form.material_color_id}
          onMaterialChange={(materialId, defaultColorId) =>
            patch({ material_id: materialId, material_color_id: defaultColorId })
          }
          onColorChange={(colorId) => patch({ material_color_id: colorId })}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Gram">
            {(field) => (
              <Input
                {...field}
                type="number"
                min={0}
                value={form.grams_used}
                onChange={(e) => patch({ grams_used: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Süre (saat)">
            {(field) => (
              <Input
                {...field}
                type="number"
                min={0}
                value={form.duration_hours}
                onChange={(e) => patch({ duration_hours: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Süre (dk)">
            {(field) => (
              <Input
                {...field}
                type="number"
                min={0}
                max={59}
                value={form.duration_minutes_part}
                onChange={(e) =>
                  patch({ duration_minutes_part: e.target.value })
                }
              />
            )}
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Başlangıç tarihi" required error={fieldErrors?.job_date}>
            {(field) => (
              <Input
                {...field}
                type="date"
                value={form.job_date}
                onChange={(e) => patch({ job_date: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Plan rengi">
            {(field) => (
              <Input
                {...field}
                type="color"
                value={form.cell_color}
                onChange={(e) => patch({ cell_color: e.target.value })}
                className="h-[var(--density-control-h)] p-1"
              />
            )}
          </FormField>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Teslim</SectionTitle>
        <FormField label="Teslim tarihi">
          {(field) => (
            <Input
              {...field}
              type="date"
              value={form.delivery_date}
              onChange={(e) => patch({ delivery_date: e.target.value })}
            />
          )}
        </FormField>
        <FormField label="Durum">
          {(field) => (
            <select
              {...field}
              className={selectClassName}
              value={form.status}
              onChange={(e) =>
                patch({ status: e.target.value as OrderFormInput["status"] })
              }
            >
              {Object.entries(ORDER_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </FormField>
      </section>

      <section className="space-y-3">
        <SectionTitle>Ödeme</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Sipariş tutarı (₺)" error={fieldErrors?.revenue_amount}>
            {(field) => (
              <Input
                {...field}
                type="number"
                step="0.01"
                min={0}
                value={form.revenue_amount}
                onChange={(e) => patch({ revenue_amount: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Ödeme durumu">
            {(field) => (
              <select
                {...field}
                className={selectClassName}
                value={form.payment_status}
                onChange={(e) =>
                  patch({
                    payment_status: e.target.value as OrderFormInput["payment_status"],
                  })
                }
              >
                {paymentOptions.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Ödenen (₺)" error={fieldErrors?.amount_paid}>
            {(field) => (
              <Input
                {...field}
                type="number"
                step="0.01"
                min={0}
                value={form.amount_paid}
                onChange={(e) => patch({ amount_paid: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Kalan (₺)">
            {(field) => (
              <Input
                {...field}
                type="number"
                step="0.01"
                readOnly
                value={computedRemaining}
                tabIndex={-1}
                className="bg-muted/40"
              />
            )}
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Ödeme vadesi">
            {(field) => (
              <Input
                {...field}
                type="date"
                value={form.payment_due_date}
                onChange={(e) => patch({ payment_due_date: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Taksit sayısı">
            {(field) => (
              <Input
                {...field}
                type="number"
                min={0}
                value={form.installment_count}
                onChange={(e) => patch({ installment_count: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Taksit tutarı (₺)">
            {(field) => (
              <Input
                {...field}
                type="number"
                step="0.01"
                value={computedInstallment}
                readOnly
                tabIndex={-1}
                className="bg-muted/40"
              />
            )}
          </FormField>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Notlar</SectionTitle>
        <div className="flex gap-2">
          <Textarea
            value={noteInput}
            onChange={(e) => onNoteInputChange(e.target.value)}
            placeholder="Kısa not…"
            rows={2}
            className="min-h-[72px] flex-1"
          />
          <button
            type="button"
            className="shrink-0 self-end rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
            onClick={onAddNote}
          >
            Ekle
          </button>
        </div>
        {notes.length > 0 ? (
          <ul className="max-h-24 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface-inset p-2 text-xs text-muted-foreground">
            {notes.map((note, i) => (
              <li key={i}>{note.content}</li>
            ))}
          </ul>
        ) : null}
        {filesSlot}
      </section>
    </div>
  );
}
