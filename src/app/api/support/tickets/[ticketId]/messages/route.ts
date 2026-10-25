import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { supportEmailTo } from "@/lib/support/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  body: z.string().trim().min(1).max(8000),
});

type Params = { params: Promise<{ ticketId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { ticketId } = await params;
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
    return NextResponse.json({ error: "Geçersiz mesaj" }, { status: 400 });
  }

  const { data: report } = await supabase
    .from("support_reports")
    .select("id, subject, status")
    .eq("ticket_id", ticketId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!report) {
    return NextResponse.json({ error: "Bilet bulunamadı" }, { status: 404 });
  }

  if (report.status === "resolved") {
    return NextResponse.json({ error: "Çözülmüş bilete yanıt verilemez" }, { status: 400 });
  }

  const { data: message, error } = await supabase
    .from("support_report_messages")
    .insert({
      report_id: report.id,
      author_type: "customer",
      author_user_id: user.id,
      author_email: user.email,
      body: parsed.data.body,
    })
    .select("id, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase
    .from("support_reports")
    .update({ status: "open", updated_at: new Date().toISOString() })
    .eq("id", report.id);

  await sendEmail({
    to: supportEmailTo(),
    subject: `[${ticketId}] Müşteri yanıtı: ${report.subject}`,
    text: `${user.email ?? "müşteri"}:\n\n${parsed.data.body}`,
    html: `<p><strong>${ticketId}</strong> — müşteri yanıtı</p><pre>${escapeHtml(parsed.data.body)}</pre>`,
  });

  return NextResponse.json({ ok: true, message });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
