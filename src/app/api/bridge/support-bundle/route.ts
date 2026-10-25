import { NextRequest, NextResponse } from "next/server";
import { tryCreateAdminClient, SERVICE_ROLE_MISSING_MESSAGE } from "@/lib/supabase/admin";
import { bridgeFromBearer } from "@/lib/bridge/auth";
import { generateBundleCode } from "@/lib/support/bundle-code";
import { MAX_BUNDLE_BYTES } from "@/lib/support/diagnostics";
import { redactSecretsDeep } from "@/lib/support/redact";

export const dynamic = "force-dynamic";

/** Köprü: tanılama paketi yükle (Bearer köprü jetonu). */
export async function POST(request: NextRequest) {
  const ctx = await bridgeFromBearer(request.headers.get("authorization"));
  if (!ctx) {
    return NextResponse.json({ error: "Geçersiz köprü jetonu" }, { status: 401 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BUNDLE_BYTES) {
    return NextResponse.json({ error: "Paket 256KB sınırını aşıyor" }, { status: 413 });
  }

  let body: { bundle?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  if (!body.bundle || typeof body.bundle !== "object") {
    return NextResponse.json({ error: "bundle alanı gerekli" }, { status: 400 });
  }

  const payload = redactSecretsDeep(body.bundle);
  const serialized = JSON.stringify(payload);
  if (serialized.length > MAX_BUNDLE_BYTES) {
    return NextResponse.json({ error: "Paket 256KB sınırını aşıyor" }, { status: 413 });
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
    return NextResponse.json({ error: SERVICE_ROLE_MISSING_MESSAGE }, { status: 503 });
  }
  let bundleCode = generateBundleCode();

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await admin
      .from("bridge_support_bundles")
      .insert({
        bundle_code: bundleCode,
        bridge_id: ctx.bridgeId,
        user_id: ctx.userId,
        payload,
        size_bytes: serialized.length,
      })
      .select("id, bundle_code, created_at")
      .single();

    if (!error && data) {
      return NextResponse.json({
        ok: true,
        bundleId: data.id,
        bundleCode: data.bundle_code,
        createdAt: data.created_at,
      });
    }
    if (error?.code === "23505") {
      bundleCode = generateBundleCode();
      continue;
    }
    return NextResponse.json({ error: error?.message ?? "Kayıt hatası" }, { status: 500 });
  }

  return NextResponse.json({ error: "Kayıt hatası" }, { status: 500 });
}
