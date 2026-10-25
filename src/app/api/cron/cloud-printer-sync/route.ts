import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ENTITLED_STATUSES } from "@/lib/billing/plans";
import {
  CLOUD_ACCOUNT_SELECT,
  markAccountSynced,
  normalizeIntegrationAccount,
  syncCloudLink,
  type IntegrationAccountRow,
  type MachineCloudLinkRow,
} from "@/lib/printer-cloud/sync";
import {
  groupByAccount,
  runWithConcurrency,
  selectLinksForTick,
} from "@/lib/printer-cloud/sync-scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Tek tick'te çekilecek toplam yazıcı (tüm kiracılar). */
const TICK_LINK_CAP = 40;
/** Aynı anda işlenen üretici hesabı sayısı; hesap içindeki cihazlar sıralı çekilir. */
const ACCOUNT_CONCURRENCY = 5;
/** maxDuration'dan önce yeni cihaz çekmeyi bırak. */
const TIME_BUDGET_MS = 90_000;
const CANDIDATE_LIMIT = 500;
const USER_CHUNK = 200;

type LinkWithAccount = MachineCloudLinkRow & {
  last_synced_at: string | null;
  account: IntegrationAccountRow;
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const supabase = createAdminClient();

    const { data: subs, error: subsError } = await supabase
      .from("subscriptions")
      .select("user_id, sync_per_tick")
      .eq("cloud_monitoring", true)
      .in("status", ENTITLED_STATUSES)
      .gt("sync_per_tick", 0);

    if (subsError) {
      return NextResponse.json({ error: subsError.message }, { status: 500 });
    }

    const perUserLimit = new Map<string, number>(
      (subs ?? []).map((s) => [s.user_id as string, s.sync_per_tick as number])
    );
    if (perUserLimit.size === 0) {
      return NextResponse.json({ ok: true, tenants: 0, selected: 0, synced: 0, failed: 0 });
    }

    const userIds = [...perUserLimit.keys()];
    const candidates: LinkWithAccount[] = [];
    for (let i = 0; i < userIds.length; i += USER_CHUNK) {
      const { data, error } = await supabase
        .from("machine_cloud_links")
        .select(
          `id, machine_id, user_id, integration_account_id, external_device_id, enabled, last_synced_at,
           integration_account:printer_integration_accounts!inner(${CLOUD_ACCOUNT_SELECT})`
        )
        .eq("enabled", true)
        .eq("integration_account.status", "active")
        .in("user_id", userIds.slice(i, i + USER_CHUNK))
        .order("last_synced_at", { ascending: true, nullsFirst: true })
        .limit(CANDIDATE_LIMIT);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      for (const row of data ?? []) {
        const account = normalizeIntegrationAccount(row.integration_account);
        if (!account || account.user_id !== row.user_id) continue;
        candidates.push({ ...(row as unknown as MachineCloudLinkRow), last_synced_at: row.last_synced_at, account });
      }
    }

    candidates.sort((a, b) => {
      if (a.last_synced_at === b.last_synced_at) return 0;
      if (!a.last_synced_at) return -1;
      if (!b.last_synced_at) return 1;
      return a.last_synced_at < b.last_synced_at ? -1 : 1;
    });

    const selected = selectLinksForTick(candidates, perUserLimit, TICK_LINK_CAP);
    const groups = groupByAccount(selected);

    let synced = 0;
    let failed = 0;
    let skipped = 0;
    let authFailures = 0;
    const errors: string[] = [];

    await runWithConcurrency(groups, ACCOUNT_CONCURRENCY, async (links) => {
      const account = links[0].account;
      let anySuccess = false;

      for (let i = 0; i < links.length; i++) {
        if (Date.now() - startedAt > TIME_BUDGET_MS) {
          skipped += links.length - i;
          break;
        }

        const result = await syncCloudLink(supabase, links[i], account, { updateAccount: false });

        if (result.authError) {
          authFailures++;
          skipped += links.length - i - 1;
          await markAccountSynced(supabase, account, "error");
          errors.push(`account ${account.id}: yetki hatası`);
          return;
        }
        if (result.ok) {
          synced++;
          if (!result.unreachable) anySuccess = true;
        } else {
          failed++;
          errors.push(`machine ${links[i].machine_id}: ${result.error}`);
        }
      }

      if (anySuccess) await markAccountSynced(supabase, account, "active");
    });

    return NextResponse.json({
      ok: true,
      tenants: perUserLimit.size,
      candidates: candidates.length,
      selected: selected.length,
      synced,
      failed,
      skipped,
      authFailures,
      durationMs: Date.now() - startedAt,
      errors: errors.slice(0, 20),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[cron/cloud-printer-sync]", message, e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
