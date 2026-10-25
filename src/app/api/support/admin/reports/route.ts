import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { tryCreateAdminClient, SERVICE_ROLE_MISSING_MESSAGE } from "@/lib/supabase/admin";
import { isSupportAdminEmail } from "@/lib/support/admin";
import { signedSupportAttachments } from "@/lib/support/signed-attachments";
import { sendStaffReplyEmail } from "@/lib/support/emails";
import { canTransitionSupportStatus, type SupportReportStatus } from "@/lib/support/status";
import type { SupportAttachmentMeta } from "@/lib/support/types";

export const dynamic = "force-dynamic";

async function requireSupportAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isSupportAdminEmail(user.email)) {
    return null;
  }
  return user;
}

export async function GET() {
  const user = await requireSupportAdmin();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
    return NextResponse.json({ error: SERVICE_ROLE_MISSING_MESSAGE }, { status: 503 });
  }

  const { data: reports, error } = await admin
    .from("support_reports")
    .select(
      "id, ticket_id, user_id, subject, description, category, status, diagnostics, machine_id, bridge_bundle_id, attachments, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const reportIds = (reports ?? []).map((r) => r.id);
  const messagesByReport: Record<string, unknown[]> = {};
  if (reportIds.length) {
    const { data: messages } = await admin
      .from("support_report_messages")
      .select("id, report_id, author_type, author_email, body, created_at")
      .in("report_id", reportIds)
      .order("created_at", { ascending: true });
    for (const m of messages ?? []) {
      if (!messagesByReport[m.report_id]) messagesByReport[m.report_id] = [];
      messagesByReport[m.report_id].push(m);
    }
  }

  const bundleIds = (reports ?? [])
    .map((r) => r.bridge_bundle_id)
    .filter((id): id is string => Boolean(id));

  const bundles: Record<string, unknown> = {};
  if (bundleIds.length) {
    const { data: rows } = await admin
      .from("bridge_support_bundles")
      .select("id, bundle_code, payload, created_at")
      .in("id", bundleIds);
    for (const b of rows ?? []) {
      bundles[b.id] = b;
    }
  }

  const userIds = [...new Set((reports ?? []).map((r) => r.user_id))];
  const { data: profiles } = await admin.from("profiles").select("id, email, full_name").in("id", userIds);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return NextResponse.json({
    reports: await Promise.all(
      (reports ?? []).map(async (r) => {
        const attachments = (r.attachments ?? []) as SupportAttachmentMeta[];
        const signed = attachments.length ? await signedSupportAttachments(admin, attachments) : [];
        return {
          ...r,
          profile: profileMap.get(r.user_id) ?? null,
          bridgeBundle: r.bridge_bundle_id ? bundles[r.bridge_bundle_id] ?? null : null,
          messages: messagesByReport[r.id] ?? [],
          attachmentUrls: signed,
        };
      })
    ),
  });
}

const patchSchema = z.object({
  ticketId: z.string(),
  status: z.enum(["open", "in_progress", "resolved"]),
});

export async function PATCH(request: NextRequest) {
  const user = await requireSupportAdmin();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz alanlar" }, { status: 400 });
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
    return NextResponse.json({ error: SERVICE_ROLE_MISSING_MESSAGE }, { status: 503 });
  }

  const { data: existing } = await admin
    .from("support_reports")
    .select("status")
    .eq("ticket_id", parsed.data.ticketId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Bilet bulunamadı" }, { status: 404 });
  }

  const from = existing.status as SupportReportStatus;
  const to = parsed.data.status;
  if (!canTransitionSupportStatus(from, to)) {
    return NextResponse.json({ error: "Geçersiz durum geçişi" }, { status: 400 });
  }

  const { error } = await admin
    .from("support_reports")
    .update({ status: to })
    .eq("ticket_id", parsed.data.ticketId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

const replySchema = z.object({
  ticketId: z.string(),
  body: z.string().trim().min(1).max(8000),
});

export async function POST(request: NextRequest) {
  const user = await requireSupportAdmin();
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const parsed = replySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz mesaj" }, { status: 400 });
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
    return NextResponse.json({ error: SERVICE_ROLE_MISSING_MESSAGE }, { status: 503 });
  }

  const { data: report } = await admin
    .from("support_reports")
    .select("id, ticket_id, subject, user_id, status")
    .eq("ticket_id", parsed.data.ticketId)
    .maybeSingle();

  if (!report) {
    return NextResponse.json({ error: "Bilet bulunamadı" }, { status: 404 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", report.user_id)
    .maybeSingle();

  const { error: msgError } = await admin.from("support_report_messages").insert({
    report_id: report.id,
    author_type: "staff",
    author_user_id: user.id,
    author_email: user.email,
    body: parsed.data.body,
  });

  if (msgError) {
    return NextResponse.json({ error: msgError.message }, { status: 500 });
  }

  const nextStatus = report.status === "open" ? "in_progress" : report.status;
  await admin
    .from("support_reports")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", report.id);

  if (profile?.email) {
    await sendStaffReplyEmail({
      ticketId: report.ticket_id,
      customerEmail: profile.email,
      subject: report.subject,
      body: parsed.data.body,
    });
  }

  return NextResponse.json({ ok: true });
}
