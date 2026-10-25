import type {
  CatalogVoiceFormResult,
  FaultVoiceFormResult,
  ProcurementVoiceFormResult,
  VoiceFormApplyResult,
} from "@/lib/parse-note";
import type { VoiceParseContext, VoiceParseDomain } from "@/lib/voice-llm";

export type VoiceParseSource = "llm" | "rule";

type DomainResultMap = {
  job: VoiceFormApplyResult;
  procurement: ProcurementVoiceFormResult;
  catalog: CatalogVoiceFormResult;
  fault: FaultVoiceFormResult;
};

export async function resolveVoiceParse<D extends VoiceParseDomain>(
  domain: D,
  text: string,
  context: VoiceParseContext,
  ruleParse: () => DomainResultMap[D]
): Promise<{ source: VoiceParseSource; result: DomainResultMap[D] }> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { source: "rule", result: ruleParse() };
  }

  try {
    const res = await fetch("/api/voice/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, text: trimmed, context }),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        source?: VoiceParseSource;
        result?: DomainResultMap[D];
      };
      if (data.source === "llm" && data.result) {
        return { source: "llm", result: data.result };
      }
    }
  } catch {
    /* ağ hatası — kural tabanlı */
  }

  return { source: "rule", result: ruleParse() };
}
