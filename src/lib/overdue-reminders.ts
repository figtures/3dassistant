import type { Job } from "@/types/database";
import { addDays, format, parseISO, startOfDay } from "date-fns";
import { tr } from "date-fns/locale";

export interface OverdueJob extends Job {
  profile_email: string | null;
  profile_name: string | null;
}

/** Termini geçmiş ve hatırlatma gönderilmeye uygun işler */
export function isJobOverdueForReminder(job: {
  delivery_date: string | null;
  status: string;
}): boolean {
  if (!job.delivery_date) return false;
  if (job.status === "completed" || job.status === "cancelled") return false;

  const today = startOfDay(new Date());
  const delivery = startOfDay(parseISO(job.delivery_date));
  const reminderStart = addDays(delivery, 1);

  return today >= reminderStart;
}

export function shouldSendReminderNow(
  job: { last_overdue_reminder_at: string | null },
  now = new Date()
): boolean {
  if (!job.last_overdue_reminder_at) return true;
  const last = new Date(job.last_overdue_reminder_at);
  const hoursSince = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
  return hoursSince >= 1;
}

export function formatOverdueEmail(job: OverdueJob): {
  subject: string;
  html: string;
  text: string;
} {
  const title = job.title ?? "İsimsiz iş";
  const customer = job.customer?.name ?? "—";
  const machine = job.machine?.name ?? "—";
  const delivery = job.delivery_date
    ? format(parseISO(job.delivery_date), "d MMMM yyyy", { locale: tr })
    : "—";
  const statusLabels: Record<string, string> = {
    pending: "Bekliyor",
    in_progress: "Devam Ediyor",
    completed: "Tamamlandı",
    cancelled: "İptal",
  };

  const subject = `⚠ Termin gecikmesi: ${title}`;
  const text = [
    `Termin tarihi geçmiş bir iş emriniz var.`,
    ``,
    `İş: ${title}`,
    `Müşteri: ${customer}`,
    `Makine: ${machine}`,
    `Termin: ${delivery}`,
    `Durum: ${statusLabels[job.status] ?? job.status}`,
    ``,
    `Termin tarihini ileri alana veya durumu güncelleyene kadar saatlik hatırlatma alacaksınız.`,
    `3D Assistant Takvim: ${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/calendar`,
  ].join("\n");

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 520px; color: #18181b;">
      <h2 style="color: #dc2626; margin-bottom: 8px;">Termin Gecikmesi</h2>
      <p style="color: #52525b;">Aşağıdaki iş emrinin teslim tarihi geçmiş durumda:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 6px 0; color: #71717a;">İş</td><td style="padding: 6px 0;"><strong>${title}</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #71717a;">Müşteri</td><td style="padding: 6px 0;">${customer}</td></tr>
        <tr><td style="padding: 6px 0; color: #71717a;">Makine</td><td style="padding: 6px 0;">${machine}</td></tr>
        <tr><td style="padding: 6px 0; color: #71717a;">Termin</td><td style="padding: 6px 0; color: #dc2626;"><strong>${delivery}</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #71717a;">Durum</td><td style="padding: 6px 0;">${statusLabels[job.status] ?? job.status}</td></tr>
      </table>
      <p style="color: #71717a; font-size: 14px;">
        Termin tarihini ileri alana veya durumu güncelleyene kadar saatlik hatırlatma gönderilecektir.
      </p>
      <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/calendar"
         style="display: inline-block; margin-top: 12px; padding: 10px 18px; background: #0ea5e9; color: white; text-decoration: none; border-radius: 8px; font-size: 14px;">
        Takvime Git
      </a>
    </div>
  `;

  return { subject, html, text };
}
