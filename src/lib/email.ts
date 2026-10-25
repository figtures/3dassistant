import { Resend } from "resend";

const FROM =
  process.env.SUPPORT_EMAIL_FROM?.trim() ||
  process.env.EMAIL_FROM?.trim() ||
  "PrintFlow <onboarding@resend.dev>";

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY yok — e-posta gönderilmedi:", opts.subject, "→", opts.to);
    return { ok: true, skipped: true };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });

  if (error) {
    console.error("[email] Gönderim hatası:", error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
