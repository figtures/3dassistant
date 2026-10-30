"use client";

import { Button } from "@/components/ds";

type SettingsFormFooterProps = {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard?: () => void;
  saveLabel?: string;
};

export function SettingsFormFooter({
  dirty,
  saving,
  onSave,
  onDiscard,
  saveLabel = "Kaydet",
}: SettingsFormFooterProps) {
  if (!dirty) return null;

  return (
    <div className="sticky bottom-0 z-[var(--z-sticky)] flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background/95 py-3 backdrop-blur-sm">
      {onDiscard ? (
        <Button type="button" variant="ghost" disabled={saving} onClick={onDiscard}>
          Değişiklikleri geri al
        </Button>
      ) : null}
      <Button type="button" loading={saving} onClick={onSave}>
        {saveLabel}
      </Button>
    </div>
  );
}
