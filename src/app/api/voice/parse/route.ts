import { NextRequest, NextResponse } from "next/server";
import {
  callVoiceLlm,
  getVoiceLlmConfig,
  mapLlmToFormResult,
  validateLlmPayload,
  type VoiceParseContext,
  type VoiceParseDomain,
} from "@/lib/voice-llm";

export const dynamic = "force-dynamic";

const domains: VoiceParseDomain[] = ["job", "procurement", "catalog", "fault"];

export async function POST(request: NextRequest) {
  let body: {
    domain?: VoiceParseDomain;
    text?: string;
    context?: VoiceParseContext;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const domain = body.domain;
  const text = body.text?.trim();
  const context = body.context ?? {};

  if (!domain || !domains.includes(domain)) {
    return NextResponse.json({ error: "Geçersiz domain" }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: "Metin gerekli" }, { status: 400 });
  }

  const { apiKey } = getVoiceLlmConfig();
  if (!apiKey) {
    return NextResponse.json(
      { error: "LLM yapılandırılmamış", fallback: true },
      { status: 503 }
    );
  }

  const llm = await callVoiceLlm(domain, text, context);
  if (!llm.ok) {
    console.warn("[voice/parse] LLM hatası:", llm.error);
    return NextResponse.json(
      { error: llm.error, fallback: true },
      { status: 502 }
    );
  }

  const validated = validateLlmPayload(domain, llm.raw);
  if (!validated.ok) {
    console.warn("[voice/parse] Zod doğrulama:", validated.error);
    return NextResponse.json(
      { error: validated.error, fallback: true },
      { status: 502 }
    );
  }

  const result = mapLlmToFormResult(domain, validated.data, context);

  return NextResponse.json({ source: "llm", result });
}
