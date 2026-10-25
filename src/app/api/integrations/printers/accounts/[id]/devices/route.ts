import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isCloudAuthError } from "@/lib/printer-cloud/errors";
import {
  CLOUD_ACCOUNT_SELECT,
  linkedDeviceIds,
  listAccountDevices,
  markAccountSynced,
  type IntegrationAccountRow,
} from "@/lib/printer-cloud/sync";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("printer_integration_accounts")
    .select(CLOUD_ACCOUNT_SELECT)
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Hesap bulunamadı" }, { status: 404 });
  }
  const account = data as IntegrationAccountRow;

  const linkedIds = await linkedDeviceIds(supabase, user.id, account.vendor);

  try {
    const devices = await listAccountDevices(supabase, account);
    return NextResponse.json({
      vendor: account.vendor,
      devices: devices.map((d) => ({ ...d, linked: linkedIds.has(d.id) })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Cihaz listesi alınamadı";
    if (isCloudAuthError(e)) {
      await markAccountSynced(supabase, account, "error");
      return NextResponse.json(
        { error: msg, reconnect: true, vendor: account.vendor },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
