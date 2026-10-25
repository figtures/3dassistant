import { z } from "zod";
import type { FaultStatus, JobStatus, PaymentStatus } from "@/types/database";
import {
  mapCatalogVoiceToFormFields,
  mapFaultVoiceToFormFields,
  mapProcurementVoiceToFormFields,
  mapVoiceToFormFields,
  type CatalogVoiceFormResult,
  type FaultVoiceFormResult,
  type ProcurementVoiceFormResult,
  type VoiceFormApplyResult,
} from "@/lib/parse-note";

export type VoiceParseDomain = "job" | "procurement" | "catalog" | "fault";

const jobStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);
const paymentStatusSchema = z.enum(["unpaid", "partial", "paid", "upcoming"]);
const faultStatusSchema = z.enum(["open", "in_progress", "resolved"]);

const looseStr = z.union([z.string(), z.number()]).optional();

export const llmJobSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  customerName: z.string().optional(),
  materialName: z.string().optional(),
  colorName: z.string().optional(),
  gramsUsed: looseStr,
  revenueAmount: looseStr,
  status: jobStatusSchema.optional(),
  deliveryDate: z.string().optional(),
  durationMinutes: looseStr,
  paymentStatus: paymentStatusSchema.optional(),
  amountPaid: looseStr,
  amountRemaining: looseStr,
  paymentDueDate: z.string().optional(),
  installmentCount: looseStr,
  installmentAmount: looseStr,
  customerSource: z.string().optional(),
  referral: z.string().optional(),
});

export const llmProcurementSchema = z.object({
  supplierName: z.string().optional(),
  materialName: z.string().optional(),
  colorName: z.string().optional(),
  grams: looseStr,
  unitPrice: looseStr,
  total: looseStr,
  purchaseDate: z.string().optional(),
  channel: z.string().optional(),
  invoiceRef: z.string().optional(),
  notes: z.string().optional(),
});

export const llmCatalogSchema = z.object({
  sku: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  materialName: z.string().optional(),
  defaultGrams: looseStr,
  tags: z.union([z.string(), z.array(z.string())]).optional(),
});

export const llmFaultSchema = z.object({
  machineName: z.string().optional(),
  faultTypeName: z.string().optional(),
  durationHours: looseStr,
  faultDate: z.string().optional(),
  status: faultStatusSchema.optional(),
  description: z.string().optional(),
});

export type LlmJobRaw = z.infer<typeof llmJobSchema>;
export type LlmProcurementRaw = z.infer<typeof llmProcurementSchema>;
export type LlmCatalogRaw = z.infer<typeof llmCatalogSchema>;
export type LlmFaultRaw = z.infer<typeof llmFaultSchema>;

const domainSchemaMap = {
  job: llmJobSchema,
  procurement: llmProcurementSchema,
  catalog: llmCatalogSchema,
  fault: llmFaultSchema,
} as const;

export type VoiceParseContext = {
  materials?: {
    id: string;
    name: string;
    material_colors?: { id: string; color_name: string }[];
  }[];
  customers?: { id: string; name: string }[];
  suppliers?: { id: string; name: string }[];
  machines?: { id: string; name: string }[];
  faultTypes?: { id: string; name: string }[];
};

function str(v: string | number | undefined): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

const STATUS_TR: Record<JobStatus, string> = {
  pending: "beklemede",
  in_progress: "devam ediyor",
  completed: "tamamlandı",
  cancelled: "iptal",
};

const PAYMENT_TR: Record<PaymentStatus, string> = {
  unpaid: "ödenmedi",
  partial: "kısmi ödeme",
  paid: "ödendi",
  upcoming: "yaklaşan ödeme",
};

const FAULT_STATUS_TR: Record<FaultStatus, string> = {
  open: "açık",
  in_progress: "devam ediyor",
  resolved: "çözüldü",
};

/** LLM JSON alanlarını kural tabanlı ayrıştırıcıya uygun Türkçe metne çevirir */
export function llmJobRawToNote(raw: LlmJobRaw): string {
  const parts: string[] = [];
  if (raw.title) parts.push(raw.title);
  if (raw.description) parts.push(raw.description);
  const grams = str(raw.gramsUsed);
  if (grams) parts.push(`${grams} gram`);
  if (raw.materialName) parts.push(raw.materialName);
  if (raw.colorName) parts.push(raw.colorName);
  if (raw.customerName) parts.push(`müşteri ${raw.customerName}`);
  const rev = str(raw.revenueAmount);
  if (rev) parts.push(`${rev} lira`);
  if (raw.status) parts.push(STATUS_TR[raw.status]);
  if (raw.deliveryDate) parts.push(`termin ${raw.deliveryDate}`);
  const mins = str(raw.durationMinutes);
  if (mins) parts.push(`${mins} dakika`);
  if (raw.paymentStatus) parts.push(PAYMENT_TR[raw.paymentStatus]);
  const paid = str(raw.amountPaid);
  if (paid) parts.push(`ödenen ${paid}`);
  const rem = str(raw.amountRemaining);
  if (rem) parts.push(`kalan ${rem}`);
  if (raw.paymentDueDate) parts.push(`ödeme tarihi ${raw.paymentDueDate}`);
  const inst = str(raw.installmentCount);
  if (inst) parts.push(`${inst} taksit`);
  const instAmt = str(raw.installmentAmount);
  if (instAmt) parts.push(`taksit ${instAmt}`);
  if (raw.customerSource) parts.push(`kaynak ${raw.customerSource}`);
  if (raw.referral) parts.push(`referans ${raw.referral}`);
  return parts.join(", ");
}

export function llmProcurementRawToNote(raw: LlmProcurementRaw): string {
  const parts: string[] = [];
  if (raw.supplierName) parts.push(`tedarikçi ${raw.supplierName}`);
  if (raw.materialName) parts.push(raw.materialName);
  if (raw.colorName) parts.push(raw.colorName);
  const grams = str(raw.grams);
  if (grams) parts.push(`${grams} gram`);
  const up = str(raw.unitPrice);
  if (up) parts.push(`birim fiyat ${up}`);
  const tot = str(raw.total);
  if (tot) parts.push(`toplam ${tot}`);
  if (raw.purchaseDate) parts.push(`tarih ${raw.purchaseDate}`);
  if (raw.channel) parts.push(raw.channel);
  if (raw.invoiceRef) parts.push(`fatura ${raw.invoiceRef}`);
  if (raw.notes) parts.push(raw.notes);
  return parts.join(", ");
}

export function llmCatalogRawToNote(raw: LlmCatalogRaw): string {
  const parts: string[] = [];
  if (raw.sku) parts.push(`sku ${raw.sku}`);
  if (raw.name) parts.push(raw.name);
  if (raw.description) parts.push(raw.description);
  if (raw.materialName) parts.push(raw.materialName);
  const g = str(raw.defaultGrams);
  if (g) parts.push(`${g} gram`);
  if (raw.tags) {
    const t = Array.isArray(raw.tags) ? raw.tags.join(", ") : raw.tags;
    parts.push(`etiket ${t}`);
  }
  return parts.join(", ");
}

export function llmFaultRawToNote(raw: LlmFaultRaw): string {
  const parts: string[] = [];
  if (raw.machineName) parts.push(`makine ${raw.machineName}`);
  if (raw.faultTypeName) parts.push(raw.faultTypeName);
  const h = str(raw.durationHours);
  if (h) parts.push(`${h} saat`);
  if (raw.faultDate) parts.push(`tarih ${raw.faultDate}`);
  if (raw.status) parts.push(FAULT_STATUS_TR[raw.status]);
  if (raw.description) parts.push(raw.description);
  return parts.join(", ");
}

export function validateLlmPayload(
  domain: VoiceParseDomain,
  data: unknown
):
  | { ok: true; data: LlmJobRaw | LlmProcurementRaw | LlmCatalogRaw | LlmFaultRaw }
  | { ok: false; error: string } {
  const schema = domainSchemaMap[domain];
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.message };
  }
  return { ok: true, data: parsed.data };
}

export function mapLlmToFormResult(
  domain: VoiceParseDomain,
  raw: LlmJobRaw | LlmProcurementRaw | LlmCatalogRaw | LlmFaultRaw,
  context: VoiceParseContext
):
  | VoiceFormApplyResult
  | ProcurementVoiceFormResult
  | CatalogVoiceFormResult
  | FaultVoiceFormResult {
  const materials = context.materials ?? [];
  switch (domain) {
    case "job":
      return mapVoiceToFormFields(
        llmJobRawToNote(raw as LlmJobRaw),
        materials,
        context.customers ?? []
      );
    case "procurement":
      return mapProcurementVoiceToFormFields(
        llmProcurementRawToNote(raw as LlmProcurementRaw),
        materials,
        context.suppliers ?? []
      );
    case "catalog":
      return mapCatalogVoiceToFormFields(
        llmCatalogRawToNote(raw as LlmCatalogRaw),
        materials.map((m) => ({ id: m.id, name: m.name }))
      );
    case "fault":
      return mapFaultVoiceToFormFields(
        llmFaultRawToNote(raw as LlmFaultRaw),
        context.machines ?? [],
        context.faultTypes ?? []
      );
    default: {
      const _exhaustive: never = domain;
      throw new Error(`Bilinmeyen domain: ${_exhaustive}`);
    }
  }
}

export function getVoiceLlmConfig(): {
  apiKey: string | undefined;
  baseUrl: string;
  model: string;
} {
  const apiKey =
    process.env.VOICE_LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? undefined;
  const baseUrl = (
    process.env.VOICE_LLM_BASE_URL ?? "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const model = process.env.VOICE_LLM_MODEL ?? "gpt-4o-mini";
  return { apiKey, baseUrl, model };
}

function catalogNames(ctx: VoiceParseContext): string {
  const mats = (ctx.materials ?? []).map((m) => m.name).slice(0, 40);
  const cust = (ctx.customers ?? []).map((c) => c.name).slice(0, 40);
  const sup = (ctx.suppliers ?? []).map((s) => s.name).slice(0, 30);
  const mach = (ctx.machines ?? []).map((m) => m.name).slice(0, 20);
  const ft = (ctx.faultTypes ?? []).map((f) => f.name).slice(0, 20);
  return [
    mats.length ? `Malzemeler: ${mats.join(", ")}` : "",
    cust.length ? `Müşteriler: ${cust.join(", ")}` : "",
    sup.length ? `Tedarikçiler: ${sup.join(", ")}` : "",
    mach.length ? `Makineler: ${mach.join(", ")}` : "",
    ft.length ? `Arıza tipleri: ${ft.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function jsonSchemaHint(domain: VoiceParseDomain): string {
  switch (domain) {
    case "job":
      return `JSON alanları (hepsi opsiyonel): title, description, customerName, materialName, colorName, gramsUsed, revenueAmount, status (pending|in_progress|completed|cancelled), deliveryDate (YYYY-MM-DD), durationMinutes, paymentStatus, amountPaid, amountRemaining, paymentDueDate, installmentCount, installmentAmount, customerSource, referral`;
    case "procurement":
      return `JSON: supplierName, materialName, colorName, grams, unitPrice, total, purchaseDate, channel, invoiceRef, notes`;
    case "catalog":
      return `JSON: sku, name, description, materialName, defaultGrams, tags (string veya string dizisi)`;
    case "fault":
      return `JSON: machineName, faultTypeName, durationHours, faultDate, status (open|in_progress|resolved), description`;
  }
}

export async function callVoiceLlm(
  domain: VoiceParseDomain,
  transcript: string,
  context: VoiceParseContext
): Promise<{ ok: true; raw: unknown } | { ok: false; error: string }> {
  const { apiKey, baseUrl, model } = getVoiceLlmConfig();
  if (!apiKey) {
    return { ok: false, error: "LLM API anahtarı yapılandırılmamış" };
  }

  const system = `Sen Türkiye'deki bir 3D baskı atölyesinin sipariş asistanısın. Kullanıcının Türkçe sesli/not metninden yapılandırılmış JSON çıkar.
Verilen malzeme/müşteri/tedarikçi/makine listelerindeki isimleri tercih et; eşleşme yoksa konuşmadaki adı yaz.
Sadece geçerli JSON döndür, markdown kullanma.
${jsonSchemaHint(domain)}`;

  const user = `${catalogNames(context)}

Transkript:
${transcript.trim()}`;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `LLM HTTP ${res.status}: ${body.slice(0, 200)}` };
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      return { ok: false, error: "LLM boş yanıt döndü" };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { ok: false, error: "LLM JSON parse edilemedi" };
    }

    return { ok: true, raw: parsed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
    return { ok: false, error: msg };
  }
}
