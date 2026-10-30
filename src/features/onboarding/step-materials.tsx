"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { saveMaterial } from "@/features/materials/material-mutations";
import {
  ONBOARDING_MATERIAL_TEMPLATES,
  type MaterialTemplate,
} from "@/features/onboarding/material-templates";
import { Button } from "@/components/ds/button";
import { cn } from "@/lib/utils";

type StepMaterialsProps = {
  onContinue: () => void;
  onSkip: () => void;
};

export function StepMaterials({ onContinue, onSkip }: StepMaterialsProps) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set(["pla"]));
  const [colorPick, setColorPick] = useState<Record<string, number>>({
    pla: 0,
    petg: 0,
  });
  const [saving, setSaving] = useState(false);

  const templates = useMemo(
    () =>
      ONBOARDING_MATERIAL_TEMPLATES.filter((t) => selected.has(t.id)),
    [selected]
  );

  function toggleTemplate(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (!templates.length) {
      toast.error("En az bir malzeme seçin");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Oturum bulunamadı");
      setSaving(false);
      return;
    }

    for (const template of templates) {
      const colorIndex = colorPick[template.id] ?? 0;
      const color = template.colors[colorIndex] ?? template.colors[0];
      const result = await saveMaterial(
        supabase,
        user.id,
        null,
        {
          name: template.name,
          brand: template.brand,
          price_per_kg: "0",
        },
        [
          {
            color_name: color.color_name,
            hex_code: color.hex_code,
            stock_grams: "1000",
          },
        ]
      );
      if (result.error) {
        toast.error(result.error);
        setSaving(false);
        return;
      }
    }

    toast.success("Malzemeler eklendi");
    queryClient.invalidateQueries({ queryKey: ["materials"] });
    setSaving(false);
    onContinue();
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Filament</h2>
        <p className="text-sm text-muted-foreground">
          Sık kullandığınız malzemeleri hızlıca ekleyin (kg fiyatını sonra
          güncelleyebilirsiniz).
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {ONBOARDING_MATERIAL_TEMPLATES.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            checked={selected.has(template.id)}
            colorIndex={colorPick[template.id] ?? 0}
            onToggle={() => toggleTemplate(template.id)}
            onColorChange={(index) =>
              setColorPick((prev) => ({ ...prev, [template.id]: index }))
            }
          />
        ))}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onSkip}>
          Atla
        </Button>
        <div className="flex gap-2 sm:justify-end">
          <Button type="button" variant="secondary" onClick={onContinue}>
            Sonra
          </Button>
          <Button type="button" loading={saving} onClick={() => void handleSave()}>
            Kaydet ve devam
          </Button>
        </div>
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  checked,
  colorIndex,
  onToggle,
  onColorChange,
}: {
  template: MaterialTemplate;
  checked: boolean;
  colorIndex: number;
  onToggle: () => void;
  onColorChange: (index: number) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        checked ? "border-primary bg-primary-subtle/50" : "border-border bg-card"
      )}
    >
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="size-4 rounded accent-[var(--primary)]"
        />
        <span className="font-medium">{template.name}</span>
      </label>
      {checked && template.colors.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {template.colors.map((c, i) => (
            <button
              key={c.color_name}
              type="button"
              aria-pressed={colorIndex === i}
              onClick={() => onColorChange(i)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                colorIndex === i
                  ? "border-primary bg-background"
                  : "border-border bg-muted/30"
              )}
            >
              <span
                className="size-3 rounded-full border border-border"
                style={{ backgroundColor: c.hex_code }}
                aria-hidden
              />
              {c.color_name}
            </button>
          ))}
        </div>
      ) : checked && template.colors[0] ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Renk: {template.colors[0].color_name}
        </p>
      ) : null}
    </div>
  );
}
