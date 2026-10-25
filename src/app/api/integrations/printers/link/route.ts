import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  cloudRequiredMessage,
  getEntitlements,
  machineLimitMessage,
  PLAN_ERROR,
} from "@/lib/billing/entitlements";
import { linkedDeviceIds } from "@/lib/printer-cloud/sync";

export const dynamic = "force-dynamic";

const MAX_DEVICES_PER_REQUEST = 100;

type LinkItem = {
  external_device_id: string;
  external_device_name?: string;
  machine_id?: string;
  machine_name?: string;
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  let body: { integration_account_id?: string; devices?: LinkItem[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const accountId = body.integration_account_id;
  if (!accountId) {
    return NextResponse.json({ error: "integration_account_id gerekli" }, { status: 400 });
  }

  const requested = (body.devices ?? []).filter((d) => d.external_device_id?.trim());
  if (requested.length === 0) {
    return NextResponse.json({ error: "En az bir cihaz seçin" }, { status: 400 });
  }
  if (requested.length > MAX_DEVICES_PER_REQUEST) {
    return NextResponse.json({ error: "Tek seferde en fazla 100 yazıcı eklenebilir" }, { status: 400 });
  }

  const { data: account } = await supabase
    .from("printer_integration_accounts")
    .select("id, vendor")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({ error: "Hesap bulunamadı" }, { status: 404 });
  }

  const entitlements = await getEntitlements(supabase, user.id);
  if (!entitlements.cloudMonitoring) {
    return NextResponse.json(
      { error: cloudRequiredMessage(), code: PLAN_ERROR.cloudRequired },
      { status: 402 }
    );
  }

  const alreadyLinked = await linkedDeviceIds(supabase, user.id, account.vendor);
  const devices = requested.filter((d) => !alreadyLinked.has(d.external_device_id));

  if (devices.length === 0) {
    return NextResponse.json({ ok: true, linked: [], skipped: requested.length, vendor: account.vendor });
  }

  const { count: machineCount } = await supabase
    .from("machines")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const newMachinesNeeded = devices.filter((d) => !d.machine_id).length;
  const slotsLeft = Math.max(0, entitlements.maxMachines - (machineCount ?? 0));
  if (newMachinesNeeded > slotsLeft) {
    return NextResponse.json(
      {
        error:
          slotsLeft === 0
            ? machineLimitMessage(entitlements.maxMachines)
            : `Planınızda ${slotsLeft} makine yeri kaldı, ${newMachinesNeeded} yazıcı seçtiniz. Seçimi azaltın veya planınızı yükseltin.`,
        code: PLAN_ERROR.machineLimit,
        slotsLeft,
      },
      { status: 402 }
    );
  }

  const linked: { machine_id: string; external_device_id: string }[] = [];
  let sortOrder = machineCount ?? 0;

  for (const device of devices) {
    let machineId: string | undefined = device.machine_id;

    if (machineId) {
      const { data: machine } = await supabase
        .from("machines")
        .select("id")
        .eq("id", machineId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!machine) {
        return NextResponse.json({ error: "Makine bulunamadı" }, { status: 404 });
      }
    } else {
      const name =
        device.machine_name?.trim() || device.external_device_name?.trim() || "Bulut yazıcı";
      const { data: created, error: createError } = await supabase
        .from("machines")
        .insert({
          user_id: user.id,
          name,
          model: device.external_device_name ?? null,
          status: "active",
          sort_order: sortOrder++,
        })
        .select("id")
        .single();

      if (createError || !created) {
        const planBlocked = createError?.hint === PLAN_ERROR.machineLimit;
        return NextResponse.json(
          {
            error: createError?.message ?? "Makine oluşturulamadı",
            code: planBlocked ? PLAN_ERROR.machineLimit : undefined,
            linked,
          },
          { status: planBlocked ? 402 : 500 }
        );
      }
      machineId = created.id;
    }

    const { error: linkError } = await supabase.from("machine_cloud_links").upsert(
      {
        machine_id: machineId,
        user_id: user.id,
        integration_account_id: accountId,
        external_device_id: device.external_device_id,
        external_device_name: device.external_device_name ?? null,
        enabled: true,
      },
      { onConflict: "machine_id" }
    );

    if (linkError) {
      const planBlocked = linkError.hint === PLAN_ERROR.cloudRequired;
      return NextResponse.json(
        { error: linkError.message, code: planBlocked ? PLAN_ERROR.cloudRequired : undefined, linked },
        { status: planBlocked ? 402 : 500 }
      );
    }

    linked.push({ machine_id: machineId!, external_device_id: device.external_device_id });
  }

  return NextResponse.json({
    ok: true,
    linked,
    skipped: requested.length - devices.length,
    vendor: account.vendor,
  });
}
