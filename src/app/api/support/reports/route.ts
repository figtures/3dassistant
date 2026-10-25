import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { validateAttachmentMeta, type SupportAttachmentMeta } from "@/lib/support/attachments";
import { enrichSupportDiagnostics } from "@/lib/support/diagnostics";
import { sendSupportReportEmails } from "@/lib/support/emails";
import { supportReportRateLimited } from "@/lib/support/rate-limit";
import { generateTicketId } from "@/lib/support/ticket-id";
import type { ClientDiagnostics, SupportCategory } from "@/lib/support/types";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const attachmentSchema = z.object({
  path: z.string().min(1).max(500),
  name: z.string().min(1).max(200),
  contentType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive(),
});

const bodySchema = z.object({
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(8000),
  category: z.enum(["bridge", "billing", "order", "other"]),
  machineId: z.string().uuid().optional().nullable(),
  diagnostics: z.record(z.string(), z.unknown()).optional(),
  attachments: z.array(attachmentSchema).max(3).optional(),
  uploadFolderId: z.string().uuid().optional(),
});

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

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz alanlar", details: parsed.error.flatten() }, { status: 400 });
  }

  const admin = tryCreateAdminClient();
  const rateDb = admin ?? supabase;
  const { limited } = await supportReportRateLimited(rateDb, user.id);
  if (limited) {
    return NextResponse.json(
      { error: "Çok fazla bildirim gönderdiniz. Lütfen bir saat sonra tekrar deneyin." },
      { status: 429 }
    );
  }

  const folderId = parsed.data.uploadFolderId ?? randomUUID();
  const attachments = (parsed.data.attachments ?? []) as SupportAttachmentMeta[];
  const attCheck = validateAttachmentMeta(attachments, user.id, folderId);
  if (!attCheck.ok) {
    return NextResponse.json({ error: attCheck.error }, { status: 400 });
  }

  const clientDiag = (parsed.data.diagnostics ?? {}) as ClientDiagnostics;
  const diagnostics = await enrichSupportDiagnostics(
    supabase,
    admin,
    user.id,
    user.email,
    clientDiag,
    parsed.data.machineId
  );

  let ticketId = generateTicketId();
  let insertedId: string | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from("support_reports")
      .insert({
        ticket_id: ticketId,
        user_id: user.id,
        subject: parsed.data.subject,
        description: parsed.data.description,
        category: parsed.data.category as SupportCategory,
        diagnostics,
        machine_id: parsed.data.machineId ?? null,
        bridge_bundle_id: diagnostics.linkedBridgeBundleId ?? null,
        attachments,
      })
      .select("id")
      .single();

    if (!error && data) {
      insertedId = data.id;
      break;
    }
    if (error?.code === "23505") {
      ticketId = generateTicketId();
      continue;
    }
    return NextResponse.json({ error: error?.message ?? "Kayıt hatası" }, { status: 500 });
  }

  if (!insertedId) {
    return NextResponse.json({ error: "Kayıt hatası" }, { status: 500 });
  }

  await supabase.from("support_report_messages").insert({
    report_id: insertedId,
    author_type: "customer",
    author_user_id: user.id,
    author_email: user.email,
    body: parsed.data.description,
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? request.nextUrl.origin;
  const adminUrl = `${siteUrl}/support/admin?ticket=${ticketId}`;

  const emailResult = await sendSupportReportEmails({
    ticketId,
    subject: parsed.data.subject,
    description: parsed.data.description,
    category: parsed.data.category,
    customerEmail: user.email ?? "unknown@printflow.local",
    diagnostics,
    adminUrl,
    attachments,
    adminClient: admin,
  });

  if (emailResult.skipped) {
    console.warn("[support] E-posta yapılandırılmadı (RESEND_API_KEY); bilet kaydedildi:", ticketId);
  }

  return NextResponse.json({
    ok: true,
    ticketId,
    reportId: insertedId,
    emailSent: emailResult.supportSent && emailResult.confirmSent,
    emailSkipped: emailResult.skipped,
  });
}
