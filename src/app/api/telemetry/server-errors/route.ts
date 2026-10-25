import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { recordClientErrorEvent } from "@/lib/support/error-events";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  stack: z.string().max(4000).optional(),
  route: z.string().max(500).optional(),
  digest: z.string().max(200).optional(),
});

/** Sunucu instrumentation → yerel HTTP (Edge instrumentation Node modülü içermez) */
export async function POST(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const isLocal =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.endsWith(".local");
  if (!isLocal && request.headers.get("x-forwarded-for")) {
    const secret = process.env.CRON_SECRET?.trim();
    const auth = request.headers.get("authorization");
    if (!secret || auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz alanlar" }, { status: 400 });
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  await recordClientErrorEvent(admin, {
    userId: null,
    message: parsed.data.message,
    stack: parsed.data.stack,
    route: parsed.data.route,
    source: "server",
    digest: parsed.data.digest,
  });

  return NextResponse.json({ ok: true });
}
