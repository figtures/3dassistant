import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupportAttachmentMeta } from "@/lib/support/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ ticketId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { ticketId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const { data: report, error } = await supabase
    .from("support_reports")
    .select(
      "id, ticket_id, subject, description, category, status, created_at, updated_at, attachments"
    )
    .eq("ticket_id", ticketId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!report) {
    return NextResponse.json({ error: "Bilet bulunamadı" }, { status: 404 });
  }

  const { data: messages } = await supabase
    .from("support_report_messages")
    .select("id, author_type, author_email, body, created_at")
    .eq("report_id", report.id)
    .order("created_at", { ascending: true });

  const attachments = (report.attachments ?? []) as SupportAttachmentMeta[];
  const signedAttachments: Array<SupportAttachmentMeta & { signedUrl?: string }> = [];
  for (const att of attachments) {
    const { data: signed } = await supabase.storage
      .from("support-attachments")
      .createSignedUrl(att.path, 3600);
    signedAttachments.push({ ...att, signedUrl: signed?.signedUrl });
  }

  return NextResponse.json({
    ticket: { ...report, attachments: signedAttachments },
    messages: messages ?? [],
  });
}
