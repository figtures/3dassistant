import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tryCreateAdminClient, SERVICE_ROLE_MISSING_MESSAGE } from "@/lib/supabase/admin";
import { isSupportAdminEmail } from "@/lib/support/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isSupportAdminEmail(user.email)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
    return NextResponse.json({ error: SERVICE_ROLE_MISSING_MESSAGE }, { status: 503 });
  }

  const { data, error } = await admin
    .from("client_error_events")
    .select(
      "id, user_id, route, message, stack, fingerprint, source, count, first_seen, last_seen, sample_digest"
    )
    .order("last_seen", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const grouped = new Map<
    string,
    {
      fingerprint: string;
      message: string;
      route: string | null;
      source: string;
      count: number;
      last_seen: string;
      samples: Array<{ user_id: string | null; count: number }>;
    }
  >();

  for (const row of data ?? []) {
    const key = `${row.fingerprint}:${row.source}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        fingerprint: row.fingerprint,
        message: row.message,
        route: row.route,
        source: row.source,
        count: row.count ?? 1,
        last_seen: row.last_seen,
        samples: [{ user_id: row.user_id, count: row.count ?? 1 }],
      });
    } else {
      existing.count += row.count ?? 1;
      if (row.last_seen > existing.last_seen) {
        existing.last_seen = row.last_seen;
        existing.message = row.message;
        existing.route = row.route;
      }
      existing.samples.push({ user_id: row.user_id, count: row.count ?? 1 });
    }
  }

  const errors = [...grouped.values()].sort((a, b) => (a.last_seen < b.last_seen ? 1 : -1));

  return NextResponse.json({ errors });
}
