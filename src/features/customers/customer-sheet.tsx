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
import { VoiceParsePanel } from "@/components/ui/voice-parse-panel";
import type { VoiceFieldConfidence } from "@/lib/voice-confidence";
import { CUSTOMER_SOURCES, type Customer } from "@/types/database";

const selectClassName =
  "flex h-[var(--density-control-h)] w-full rounded-lg border border-input bg-surface-inset px-3 text-sm text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]";

export type CustomerFormValues = {
  name: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
  source: string;
  referral: string;
  referred_by_customer_id: string;
};

export type CustomerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: CustomerFormValues;
  onFormChange: (form: CustomerFormValues) => void;
  onSave: () => void;
  saving: boolean;
  customers: Customer[];
  editingId: string | null;
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

export function CustomerSheet({
  open,
  onOpenChange,
  editing,
  form,
  onFormChange,
  onSave,
  saving,
  customers,
  editingId,
  voice,
}: CustomerSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Müşteri düzenle" : "Yeni müşteri"}</DialogTitle>
          <DialogDescription>
            İletişim bilgilerini kaydedin; sipariş ve tahsilat geçmişi bu kayda bağlanır.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(60vh,520px)] space-y-4 overflow-y-auto overscroll-contain py-1">
          <VoiceParsePanel
            isSupported={voice.isSupported}
            isListening={voice.isListening}
            voiceText={voice.voiceText}
            onVoiceTextChange={voice.onVoiceTextChange}
            matched={voice.matched}
            fieldConfidence={voice.fieldConfidence}
            placeholder="Örn: müşteri adı Deniz Yıldız, referans Ahmet Yılmaz, kaynak Instagram"
            onToggleListen={voice.onToggleListen}
          />
          <FormField label="Ad soyad" required>
            {(field) => (
              <Input
                {...field}
                value={form.name}
                onChange={(e) => onFormChange({ ...form, name: e.target.value })}
                autoComplete="name"
              />
            )}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="E-posta">
              {(field) => (
                <Input
                  {...field}
                  type="email"
                  value={form.email}
                  onChange={(e) => onFormChange({ ...form, email: e.target.value })}
                  autoComplete="email"
                />
              )}
            </FormField>
            <FormField label="Telefon">
              {(field) => (
                <Input
                  {...field}
                  value={form.phone}
                  onChange={(e) => onFormChange({ ...form, phone: e.target.value })}
                  autoComplete="tel"
                />
              )}
            </FormField>
          </div>
          <FormField label="Firma">
            {(field) => (
              <Input
                {...field}
                value={form.company}
                onChange={(e) => onFormChange({ ...form, company: e.target.value })}
                autoComplete="organization"
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
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Kaynak">
              {(field) => (
                <select
                  {...field}
                  value={form.source}
                  onChange={(e) => onFormChange({ ...form, source: e.target.value })}
                  className={selectClassName}
                >
                  <option value="">Seçin…</option>
                  {CUSTOMER_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField label="Referans (metin)">
              {(field) => (
                <Input
                  {...field}
                  value={form.referral}
                  onChange={(e) => onFormChange({ ...form, referral: e.target.value })}
                  placeholder="Yönlendiren kişi"
                />
              )}
            </FormField>
          </div>
          <FormField label="Yönlendiren müşteri">
            {(field) => (
              <select
                {...field}
                value={form.referred_by_customer_id}
                onChange={(e) =>
                  onFormChange({ ...form, referred_by_customer_id: e.target.value })
                }
                className={selectClassName}
              >
                <option value="">Seçin…</option>
                {customers
                  .filter((c) => c.id !== editingId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            )}
          </FormField>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
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
