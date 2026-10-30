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
import { FAULT_STATUS_LABELS } from "@/features/faults/fault-constants";
import type { FaultFormValues } from "@/features/faults/fault-mutations";
import type { VoiceFieldConfidence } from "@/lib/voice-confidence";
import type { VoiceParseSource } from "@/lib/voice-parse-client";
import type { FaultType, Machine } from "@/types/database";

export type FaultSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: FaultFormValues;
  onFormChange: (form: FaultFormValues) => void;
  onSave: () => void;
  saving: boolean;
  machines: Machine[];
  typeOptions: FaultType[];
  onSetMaintenance?: () => void;
  maintenanceLoading?: boolean;
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
};

export function FaultSheet({
  open,
  onOpenChange,
  editing,
  form,
  onFormChange,
  onSave,
  saving,
  machines,
  typeOptions,
  onSetMaintenance,
  maintenanceLoading,
  voice,
}: FaultSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-sm:max-h-[95dvh]">
        <DialogHeader>
          <DialogTitle>{editing ? "Arıza düzenle" : "Yeni arıza"}</DialogTitle>
          <DialogDescription>
            Makine duruşlarını kaydedin; sesli not ile alanları hızlıca doldurabilirsiniz.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4 py-1">
          <VoiceParsePanel
            isSupported={voice.isSupported}
            isListening={voice.isListening}
            voiceText={voice.voiceText}
            onVoiceTextChange={voice.onVoiceTextChange}
            onVoiceBlur={voice.onVoiceBlur}
            matched={voice.matched}
            fieldConfidence={voice.fieldConfidence}
            parseSource={voice.parseSource}
            placeholder="Makine, arıza tipi, süre bilgilerini söyleyin…"
            onToggleListen={voice.onToggleListen}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Makine" required>
              {(field) => (
                <select
                  {...field}
                  className={nativeSelectClassName}
                  value={form.machine_id}
                  onChange={(e) => onFormChange({ ...form, machine_id: e.target.value })}
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
            <FormField label="Tarih" required>
              {(field) => (
                <Input
                  {...field}
                  type="date"
                  value={form.fault_date}
                  onChange={(e) => onFormChange({ ...form, fault_date: e.target.value })}
                />
              )}
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Arıza tipi">
              {(field) => (
                <select
                  {...field}
                  className={nativeSelectClassName}
                  value={form.fault_type_id}
                  onChange={(e) => {
                    const t = typeOptions.find((x) => x.id === e.target.value);
                    onFormChange({
                      ...form,
                      fault_type_id: e.target.value,
                      fault_type_name: t?.name ?? "",
                    });
                  }}
                >
                  <option value="">Seçin veya yazın…</option>
                  {typeOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField label="Özel tip adı">
              {(field) => (
                <Input
                  {...field}
                  value={form.fault_type_name}
                  onChange={(e) => onFormChange({ ...form, fault_type_name: e.target.value })}
                  placeholder="Nozzle tıkanması"
                />
              )}
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Duruş süresi (saat)">
              {(field) => (
                <Input
                  {...field}
                  type="number"
                  step="0.25"
                  min={0}
                  value={form.duration_hours}
                  onChange={(e) => onFormChange({ ...form, duration_hours: e.target.value })}
                />
              )}
            </FormField>
            <FormField label="Durum">
              {(field) => (
                <select
                  {...field}
                  className={nativeSelectClassName}
                  value={form.status}
                  onChange={(e) =>
                    onFormChange({ ...form, status: e.target.value as FaultFormValues["status"] })
                  }
                >
                  {Object.entries(FAULT_STATUS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          </div>
          <FormField label="Açıklama">
            {(field) => (
              <Textarea
                {...field}
                value={form.description}
                onChange={(e) => onFormChange({ ...form, description: e.target.value })}
                rows={3}
              />
            )}
          </FormField>
        </DialogBody>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {editing && onSetMaintenance ? (
            <Button
              type="button"
              variant="secondary"
              onClick={onSetMaintenance}
              loading={maintenanceLoading}
              className="w-full sm:w-auto"
            >
              Makineyi bakıma al
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="flex w-full gap-2 sm:w-auto sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button
              type="button"
              onClick={onSave}
              loading={saving}
              disabled={!form.machine_id}
            >
              Kaydet
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
