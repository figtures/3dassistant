import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { ensureAppTrial } from "@/lib/billing/trial";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Deneme şu an sunucuda etkinleştirilemiyor. Lütfen biraz sonra tekrar deneyin." },
      { status: 503 }
    );
  }

  try {
    const result = await ensureAppTrial(
      admin,
      user.id,
      user.user_metadata as Record<string, unknown> | undefined
    );
    return NextResponse.json(result);
  } catch (e) {
    console.error("[billing/trial/start]", e);
    return NextResponse.json({ error: "Deneme başlatılamadı" }, { status: 500 });
  }
}
