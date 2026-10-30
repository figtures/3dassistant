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
    .from("feedback_responses")
    .select("id, kind, score, comment, context, created_at, user_id, workspace_id")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ responses: data ?? [] });
}
