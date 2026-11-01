import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().trim().min(2, "Ad en az 2 karakter olmalı").max(120),
  email: z.string().trim().email("Geçerli bir e-posta girin").max(200),
  company: z.string().trim().max(200).optional(),
  message: z.string().trim().min(10, "Mesaj en az 10 karakter olmalı").max(4000),
  topic: z.enum(["enterprise", "pricing"]).optional(),
});

function supportInbox(): string {
  return process.env.SUPPORT_EMAIL_TO?.trim() || "destek@3dasisstant.com";
}

export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Geçersiz alanlar";
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const { name, email, company, message, topic } = parsed.data;
  const subject =
    topic === "enterprise"
      ? `Kurumsal fiyatlandırma: ${name}`
      : `Fiyatlandırma iletişim: ${name}`;

  const companyLine = company?.trim() ? `Firma: ${company.trim()}\n` : "";
  const text = [
    `Konu: ${topic === "enterprise" ? "Kurumsal (40+ makine)" : "Fiyatlandırma"}`,
    `Ad: ${name}`,
    `E-posta: ${email}`,
    companyLine,
    "",
    message,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <p><strong>Konu:</strong> ${topic === "enterprise" ? "Kurumsal (40+ makine / çok lokasyon)" : "Fiyatlandırma"}</p>
    <p><strong>Ad:</strong> ${escapeHtml(name)}</p>
    <p><strong>E-posta:</strong> ${escapeHtml(email)}</p>
    ${company?.trim() ? `<p><strong>Firma:</strong> ${escapeHtml(company.trim())}</p>` : ""}
    <hr />
    <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
  `.trim();

  const result = await sendEmail({
    to: supportInbox(),
    subject,
    html,
    text,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "Mesaj gönderilemedi. Lütfen daha sonra tekrar deneyin." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    emailSkipped: Boolean(result.skipped),
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
