export type VoiceConfidenceLevel = "high" | "medium" | "low";

export type VoiceFieldConfidence = Record<string, VoiceConfidenceLevel>;

const CONFIDENCE_LABELS: Record<VoiceConfidenceLevel, string> = {
  high: "Yüksek",
  medium: "Orta",
  low: "Düşük",
};

export function confidenceLabel(level: VoiceConfidenceLevel): string {
  return CONFIDENCE_LABELS[level];
}

/** matched dizisindeki "(...)" ifadelerini düşük güven olarak işaretler */
export function confidenceFromMatchedLabels(
  matched: string[],
  idFields: Record<string, boolean>
): VoiceFieldConfidence {
  const out: VoiceFieldConfidence = {};
  for (const label of matched) {
    const key = label.split(" (")[0].trim();
    const isLow = label.includes("(");
    if (idFields[key]) {
      out[key] = "high";
    } else if (isLow) {
      out[key] = "low";
    } else {
      out[key] = out[key] ?? "medium";
    }
  }
  for (const [key, hasId] of Object.entries(idFields)) {
    if (hasId) out[key] = "high";
  }
  return out;
}

