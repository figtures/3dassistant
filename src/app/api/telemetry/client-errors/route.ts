import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { errorFingerprint } from "@/lib/support/fingerprint";
import { recordClientErrorEvent } from "@/lib/support/error-events";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  stack: z.string().max(4000).optional(),
  route: z.string().max(500).optional(),
  fingerprint: z.string().max(64).optional(),
});

const ipBuckets = new Map<string, { count: number; resetAt: number }>();
const MAX_PER_IP_HOUR = 60;

function ipRateLimited(ip: string): boolean {
  const now = Date.now();
  const row = ipBuckets.get(ip);
  if (!row || now > row.resetAt) {
    ipBuckets.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return false;
  }
  row.count += 1;
  return row.count > MAX_PER_IP_HOUR;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (ipRateLimited(ip)) {
    return NextResponse.json({ ok: true, skipped: true });
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const fp =
    parsed.data.fingerprint ??
    errorFingerprint({
      message: parsed.data.message,
      route: parsed.data.route,
      source: "client",
    });

  const result = await recordClientErrorEvent(supabase, {
    userId: user?.id ?? null,
    message: parsed.data.message,
    stack: parsed.data.stack,
    route: parsed.data.route,
    source: "client",
  });

  return NextResponse.json({ ok: true, fingerprint: result?.fingerprint ?? fp });
}
