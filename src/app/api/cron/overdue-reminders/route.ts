import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { processJobNotificationCron } from "@/lib/notifications/cron-jobs";
import {
  formatOverdueEmail,
  isJobOverdueForReminder,
  shouldSendReminderNow,
  type OverdueJob,
} from "@/lib/overdue-reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    const { data: jobs, error } = await supabase
      .from("jobs")
      .select(
        `
        *,
        machine:machines(*),
        customer:customers(*),
        material:materials(*)
      `
      )
      .not("delivery_date", "is", null)
      .in("status", ["pending", "in_progress"]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const userIds = [...new Set((jobs ?? []).map((j) => j.user_id))];
    const { data: members } = await supabase
      .from("workspace_members")
      .select("user_id")
      .in("workspace_id", userIds);

    const memberUserIds = [
      ...new Set([
        ...userIds,
        ...(members ?? []).map((m) => m.user_id),
      ]),
    ];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", memberUserIds);

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p])
    );

    const profileEmails = new Map<string, string | null>(
      (profiles ?? []).map((p) => [p.id, p.email])
    );

    const notificationStats = await processJobNotificationCron(
      supabase,
      (jobs ?? []) as OverdueJob[],
      profileEmails
    );

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const job of jobs ?? []) {
      if (!isJobOverdueForReminder(job)) {
        skipped++;
        continue;
      }
      if (!shouldSendReminderNow(job)) {
        skipped++;
        continue;
      }

      const profile = profileMap.get(job.user_id);
      const to = profile?.email;
      if (!to) {
        skipped++;
        continue;
      }

      const overdueJob: OverdueJob = {
        ...job,
        profile_email: profile?.email ?? null,
        profile_name: profile?.full_name ?? null,
      };

      const { subject, html, text } = formatOverdueEmail(overdueJob);
      const result = await sendEmail({ to, subject, html, text });

      if (result.skipped) {
        console.warn(
          `[cron/overdue-reminders] E-posta atlandı (Resend yok): job=${job.id} → ${to}`
        );
        skipped++;
        continue;
      }

      if (result.ok) {
        await supabase
          .from("jobs")
          .update({ last_overdue_reminder_at: new Date().toISOString() })
          .eq("id", job.id);
        sent++;
      } else {
        errors.push(`${job.id}: ${result.error}`);
      }
    }

    return NextResponse.json({
      ok: true,
      checked: jobs?.length ?? 0,
      sent,
      skipped,
      errors,
      notifications: notificationStats,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[cron/overdue-reminders]", message, e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
