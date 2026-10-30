import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { appBuildLabel, supportEmailFrom, supportEmailTo } from "./admin";
import { signedSupportAttachments } from "./signed-attachments";
import type { SupportAttachmentMeta, SupportReportDiagnostics } from "./types";

export async function sendSupportReportEmails(opts: {
  ticketId: string;
  subject: string;
  description: string;
  category: string;
  customerEmail: string;
  diagnostics: SupportReportDiagnostics;
  adminUrl: string;
  attachments?: SupportAttachmentMeta[];
  adminClient?: SupabaseClient | null;
}): Promise<{ supportSent: boolean; confirmSent: boolean; skipped?: boolean }> {
  let attachmentNote = "";
  const items = opts.attachments ?? [];
  if (items.length && opts.adminClient) {
    const signed = await signedSupportAttachments(opts.adminClient, items);
    const lines = signed.map(
      (a, i) =>
        `${i + 1}. ${a.name}${a.signedUrl ? `: ${a.signedUrl}` : " (imzalı URL oluşturulamadı)"}`
    );
    attachmentNote = `\n\nEkler (${items.length}):\n${lines.join("\n")}`;
  } else if (items.length) {
    attachmentNote = `\n\nEkler: ${items.length} görsel (panelden görüntüleyin)`;
  }

  const diagJson = JSON.stringify(opts.diagnostics, null, 2);
  const supportHtml = `
    <h2>Yeni destek bildirimi: ${opts.ticketId}</h2>
    <p><strong>Konu:</strong> ${escapeHtml(opts.subject)}</p>
    <p><strong>Kategori:</strong> ${escapeHtml(opts.category)}</p>
    <p><strong>Müşteri:</strong> ${escapeHtml(opts.customerEmail)}</p>
    <p><a href="${escapeHtml(opts.adminUrl)}">Panelde görüntüle</a></p>
    <h3>Açıklama</h3>
    <pre style="white-space:pre-wrap;font-family:monospace">${escapeHtml(opts.description)}</pre>
    ${items.length ? `<p><strong>Ekler:</strong> ${items.length} görsel</p>` : ""}
    <h3>Tanılama</h3>
    <pre style="white-space:pre-wrap;font-family:monospace;font-size:11px">${escapeHtml(diagJson)}</pre>
  `;

  const supportText = [
    `Bilet: ${opts.ticketId}`,
    `Konu: ${opts.subject}`,
    `Kategori: ${opts.category}`,
    `Müşteri: ${opts.customerEmail}`,
    `Panel: ${opts.adminUrl}`,
    "",
    opts.description,
    attachmentNote,
    "",
    diagJson,
  ].join("\n");

  const support = await sendEmail({
    to: supportEmailTo(),
    subject: `[${opts.ticketId}] ${opts.subject}`,
    html: supportHtml,
    text: supportText,
  });

  const confirmHtml = `
    <p>Merhaba,</p>
    <p>3D Assistant destek talebiniz alındı. Bilet numaranız: <strong>${opts.ticketId}</strong></p>
    <p>Konu: ${escapeHtml(opts.subject)}</p>
    <p>Destek taleplerinizi panelde <strong>/support</strong> sayfasından takip edebilirsiniz.</p>
    <p>Ekibimiz en kısa sürede inceleyecek. Yanıt bu e-posta adresine gönderilebilir.</p>
    <p style="color:#666;font-size:12px">Uygulama sürümü: ${escapeHtml(appBuildLabel())}</p>
  `;
  const confirm = await sendEmail({
    to: opts.customerEmail,
    subject: `3D Assistant destek talebi ${opts.ticketId}`,
    html: confirmHtml,
    text: `Talebiniz alındı. Bilet: ${opts.ticketId}\nKonu: ${opts.subject}\nTakip: /support`,
  });

  return {
    supportSent: support.ok && !support.skipped,
    confirmSent: confirm.ok && !confirm.skipped,
    skipped: support.skipped || confirm.skipped,
  };
}

export async function sendStaffReplyEmail(opts: {
  ticketId: string;
  customerEmail: string;
  subject: string;
  body: string;
}): Promise<{ ok: boolean; skipped?: boolean }> {
  const html = `
    <p>3D Assistant destek yanıtı — <strong>${escapeHtml(opts.ticketId)}</strong></p>
    <p><strong>Konu:</strong> ${escapeHtml(opts.subject)}</p>
    <pre style="white-space:pre-wrap;font-family:system-ui">${escapeHtml(opts.body)}</pre>
    <p style="color:#666;font-size:12px">Yanıt vermek için panelde /support bölümünü kullanabilirsiniz.</p>
  `;
  const result = await sendEmail({
    to: opts.customerEmail,
    subject: `Re: [${opts.ticketId}] ${opts.subject}`,
    html,
    text: `Bilet ${opts.ticketId}\n\n${opts.body}`,
  });
  return { ok: result.ok && !result.skipped, skipped: result.skipped };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** sendEmail from adresi EMAIL_FROM kullanır; dokümantasyon için export */
export function resolveFromAddress(): string {
  return supportEmailFrom();
}
