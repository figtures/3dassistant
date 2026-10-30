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
  Textarea,
} from "@/components/ds";
import { VoiceParsePanel } from "@/components/ui/voice-parse-panel";
import type { VoiceFieldConfidence } from "@/lib/voice-confidence";
import type { VoiceParseSource } from "@/lib/voice-parse-client";
import type { Material } from "@/types/database";
import { Loader2 } from "lucide-react";

const selectClassName =
  "flex h-[var(--density-control-h)] w-full rounded-lg border border-input bg-surface-inset px-3 text-sm text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]";

export type CatalogCreateForm = {
  sku: string;
  name: string;
  description: string;
  default_material_id: string;
  default_grams: string;
  tags: string;
};

export type CatalogCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: CatalogCreateForm;
  onFormChange: (form: CatalogCreateForm) => void;
  materials: Material[];
  saving: boolean;
  onSave: () => void;
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

export function CatalogCreateDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  materials,
  saving,
  onSave,
  voice,
}: CatalogCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Yeni katalog ürünü</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <VoiceParsePanel
            isSupported={voice.isSupported}
            isListening={voice.isListening}
            voiceText={voice.voiceText}
            onVoiceTextChange={voice.onVoiceTextChange}
            matched={voice.matched}
            fieldConfidence={voice.fieldConfidence}
            parseSource={voice.parseSource}
            onToggleListen={voice.onToggleListen}
          />
          <FormField label="SKU" required>
            {(field) => (
              <Input
                {...field}
                value={form.sku}
                onChange={(e) => onFormChange({ ...form, sku: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Ad" required>
            {(field) => (
              <Input
                {...field}
                value={form.name}
                onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              />
            )}
          </FormField>
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
          <FormField label="Varsayılan malzeme">
            {(field) => (
              <select
                {...field}
                className={selectClassName}
                value={form.default_material_id}
                onChange={(e) =>
                  onFormChange({ ...form, default_material_id: e.target.value })
                }
              >
                <option value="">Seçiniz</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <FormField label="Varsayılan gram">
            {(field) => (
              <Input
                {...field}
                type="number"
                value={form.default_grams}
                onChange={(e) => onFormChange({ ...form, default_grams: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Etiketler (virgülle)" description="ör. hobi, otomotiv">
            {(field) => (
              <Input
                {...field}
                value={form.tags}
                onChange={(e) => onFormChange({ ...form, tags: e.target.value })}
              />
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
