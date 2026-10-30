"use client";

import { useMemo } from "react";
import { FormField } from "@/components/ds";
import { getMaterialColors } from "@/lib/materials";
import type { Material } from "@/types/database";

const selectClassName =
  "flex h-[var(--density-control-h)] w-full rounded-lg border border-input bg-surface-inset px-3 text-sm text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]";

export type MaterialColorSelectProps = {
  materials: Material[];
  materialId: string;
  colorId: string;
  onMaterialChange: (materialId: string, defaultColorId: string) => void;
  onColorChange: (colorId: string) => void;
};

export function MaterialColorSelect({
  materials,
  materialId,
  colorId,
  onMaterialChange,
  onColorChange,
}: MaterialColorSelectProps) {
  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === materialId),
    [materials, materialId]
  );

  const colors = useMemo(() => {
    if (!selectedMaterial) return [];
    return getMaterialColors(selectedMaterial).sort(
      (a, b) => a.sort_order - b.sort_order
    );
  }, [selectedMaterial]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Malzeme">
        {(field) => (
          <select
            {...field}
            className={selectClassName}
            value={materialId}
            onChange={(e) => {
              const nextId = e.target.value;
              const mat = materials.find((m) => m.id === nextId);
              const first = mat ? getMaterialColors(mat)[0]?.id ?? "" : "";
              onMaterialChange(nextId, first);
            }}
          >
            <option value="">Seçin…</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.brand ? ` · ${m.brand}` : ""}
              </option>
            ))}
          </select>
        )}
      </FormField>
      <FormField label="Renk">
        {(field) => (
          <div className="flex items-center gap-2">
            {colors.find((c) => c.id === colorId)?.hex_code ? (
              <span
                className="size-4 shrink-0 rounded-full border border-border"
                style={{
                  backgroundColor:
                    colors.find((c) => c.id === colorId)?.hex_code ?? undefined,
                }}
                aria-hidden
              />
            ) : null}
            <select
              {...field}
              className={selectClassName}
              value={colorId}
              onChange={(e) => onColorChange(e.target.value)}
              disabled={!materialId || colors.length === 0}
            >
              <option value="">
                {!materialId
                  ? "Önce malzeme seçin"
                  : colors.length === 0
                    ? "Renk tanımlı değil"
                    : "Seçin…"}
              </option>
              {colors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.color_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </FormField>
    </div>
  );
}
