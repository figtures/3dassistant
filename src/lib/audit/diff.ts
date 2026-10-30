type FieldChange = { old: unknown; new: unknown };

export function readDiffField(
  diff: Record<string, unknown> | null | undefined,
  field: string
): unknown {
  if (!diff) return undefined;
  const raw = diff[field];
  if (raw === undefined) return undefined;
  if (raw !== null && typeof raw === "object" && "old" in raw && "new" in raw) {
    return (raw as FieldChange).new;
  }
  return raw;
}

export function readDiffFieldChange(
  diff: Record<string, unknown> | null | undefined,
  field: string
): FieldChange | null {
  if (!diff) return null;
  const raw = diff[field];
  if (raw === null || typeof raw !== "object") return null;
  if (!("old" in raw) || !("new" in raw)) return null;
  return raw as FieldChange;
}

export function diffFieldNames(
  diff: Record<string, unknown> | null | undefined
): string[] {
  if (!diff) return [];
  return Object.keys(diff);
}
