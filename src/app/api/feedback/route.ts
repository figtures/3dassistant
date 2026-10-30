import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/active";
import type { FeedbackKind } from "@/features/feedback/schedule";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  kind: z.enum(["nps", "csat", "page"]),
  score: z.number().int(),
  comment: z.string().trim().max(4000).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

function validateScore(kind: FeedbackKind, score: number): string | null {
  if (kind === "nps" && (score < 0 || score > 10)) {
    return "NPS puanı 0–10 arasında olmalıdır";
  }
  if ((kind === "csat" || kind === "page") && (score < 1 || score > 5)) {
    return "Puan 1–5 arasında olmalıdır";
  }
  return null;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const kind = request.nextUrl.searchParams.get("kind");
  if (kind === "nps") {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("created_at")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const { data: lastRow, error: lastError } = await supabase
      .from("feedback_responses")
      .select("created_at")
      .eq("user_id", user.id)
      .eq("kind", "nps")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastError) {
      return NextResponse.json({ error: lastError.message }, { status: 500 });
    }

    return NextResponse.json({
      userCreatedAt: profile?.created_at ?? user.created_at,
      lastNpsSubmittedAt: lastRow?.created_at ?? null,
    });
  }

  if (kind === "csat") {
    const ticketId = request.nextUrl.searchParams.get("ticketId")?.trim();
    if (!ticketId) {
      return NextResponse.json({ error: "ticketId gerekli" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("feedback_responses")
      .select("id")
      .eq("user_id", user.id)
      .eq("kind", "csat")
      .contains("context", { ticketId })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ submitted: Boolean(data) });
  }

  return NextResponse.json({ error: "Geçersiz kind" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz alanlar", details: parsed.error.flatten() }, { status: 400 });
  }

  const scoreError = validateScore(parsed.data.kind, parsed.data.score);
  if (scoreError) {
    return NextResponse.json({ error: scoreError }, { status: 400 });
  }

  const context = parsed.data.context ?? {};

  if (parsed.data.kind === "csat") {
    const ticketId = typeof context.ticketId === "string" ? context.ticketId.trim() : "";
    if (!ticketId) {
      return NextResponse.json({ error: "CSAT için ticketId gerekli" }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from("feedback_responses")
      .select("id")
      .eq("user_id", user.id)
      .eq("kind", "csat")
      .contains("context", { ticketId })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Bu talep için zaten geri bildirim verildi" }, { status: 409 });
    }
  }

  const workspaceId = await getActiveWorkspaceId();

  const { data, error } = await supabase
    .from("feedback_responses")
    .insert({
      workspace_id: workspaceId,
      user_id: user.id,
      kind: parsed.data.kind,
      score: parsed.data.score,
      comment: parsed.data.comment?.trim() || null,
      context,
    })
    .select("id, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id, createdAt: data.created_at });
}
