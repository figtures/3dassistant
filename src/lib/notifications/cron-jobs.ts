import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import {
  formatPaymentDueEmail,
  formatPaymentDueNotification,
  formatDeliveryTomorrowNotification,
  isJobDeliveryTomorrow,
  isJobPaymentDueOverdue,
} from "@/lib/notifications/job-alerts";
import {
  notifyWorkspaceMembersInApp,
  userNotificationChannelEnabled,
} from "@/lib/notifications/server-notify";
import type { Job } from "@/types/database";

type JobRow = Job;

export async function processJobNotificationCron(
  supabase: SupabaseClient,
  jobs: JobRow[],
  memberEmails: Map<string, string | null>
): Promise<{ deliveryInApp: number; paymentInApp: number; paymentEmail: number }> {
  let deliveryInApp = 0;
  let paymentInApp = 0;
  let paymentEmail = 0;

  for (const job of jobs) {
    const workspaceId = job.user_id;

    if (isJobDeliveryTomorrow(job)) {
      const payload = formatDeliveryTomorrowNotification(job);
      deliveryInApp += await notifyWorkspaceMembersInApp(supabase, {
        workspaceId,
        kind: "order",
        title: payload.title,
        body: payload.body,
        href: payload.href,
      });
    }

    if (isJobPaymentDueOverdue(job)) {
      const payload = formatPaymentDueNotification(job);
      paymentInApp += await notifyWorkspaceMembersInApp(supabase, {
        workspaceId,
        kind: "payment",
        title: payload.title,
        body: payload.body,
        href: payload.href,
      });

      const { data: members } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId);

      const { subject, html, text } = formatPaymentDueEmail(job);

      for (const member of members ?? []) {
        const emailEnabled = await userNotificationChannelEnabled(
          supabase,
          member.user_id,
          "payment",
          "email"
        );
        const to = memberEmails.get(member.user_id);
        if (!emailEnabled || !to) continue;
        const result = await sendEmail({ to, subject, html, text });
        if (result.ok && !result.skipped) paymentEmail++;
      }
    }
  }

  return { deliveryInApp, paymentInApp, paymentEmail };
}
