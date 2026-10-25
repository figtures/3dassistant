import type { SupabaseClient } from "@supabase/supabase-js";
import { getEntitlements } from "@/lib/billing/entitlements";
import { appBuildLabel } from "./admin";
import { redactSecretsDeep, sanitizeClientErrorMessage } from "./redact";
import type { ClientDiagnostics, SupportReportDiagnostics } from "./types";

const BUNDLE_LINK_WINDOW_MS = 24 * 60 * 60 * 1000;

export function normalizeClientDiagnostics(raw: ClientDiagnostics): ClientDiagnostics {
  return {
    ...raw,
    clientErrors: (raw.clientErrors ?? []).slice(-15).map((e) => ({
      ...e,
      message: sanitizeClientErrorMessage(e.message),
    })),
    failedFetches: (raw.failedFetches ?? []).slice(-10),
  };
}

export async function enrichSupportDiagnostics(
  supabase: SupabaseClient,
  admin: SupabaseClient | null,
  userId: string,
  userEmail: string | undefined,
  client: ClientDiagnostics,
  machineId?: string | null
): Promise<SupportReportDiagnostics> {
  const normalized = normalizeClientDiagnostics(client);
  const entitlements = await getEntitlements(supabase, userId);

  const base: SupportReportDiagnostics = {
    ...normalized,
    userId,
    userEmail,
    planKey: entitlements.planKey,
    planName: entitlements.planName,
    appVersion: appBuildLabel(),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, ""),
  };

  if (machineId) {
    const { data: machine } = await supabase
      .from("machines")
      .select("id, name, last_seen_at, bridge_binding:bridge_machine_bindings(last_push_at, vendor, device_serial, lan_host)")
      .eq("id", machineId)
      .eq("user_id", userId)
      .maybeSingle();

    if (machine) {
      const binding = Array.isArray(machine.bridge_binding)
        ? machine.bridge_binding[0]
        : machine.bridge_binding;
      base.machine = {
        id: machine.id,
        name: machine.name,
        vendor: binding?.vendor,
        lastTelemetryAt: machine.last_seen_at,
        bridgeBinding: binding
          ? {
              lastPushAt: binding.last_push_at,
              deviceSerial: binding.device_serial,
              lanHost: binding.lan_host,
            }
          : null,
      };
    }
  }

  const { data: bridge } = await supabase
    .from("workshop_bridges")
    .select("id, label, last_seen_at, agent_version")
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (bridge) {
    base.bridge = {
      id: bridge.id,
      label: bridge.label,
      lastSeenAt: bridge.last_seen_at,
      agentVersion: bridge.agent_version,
    };
  }

  const bundleClient = admin ?? supabase;
  const since = new Date(Date.now() - BUNDLE_LINK_WINDOW_MS).toISOString();
  let bundleQuery = bundleClient
    .from("bridge_support_bundles")
    .select("id, bundle_code, created_at")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);

  if (normalized.bridgeBundleCode) {
    bundleQuery = bundleClient
      .from("bridge_support_bundles")
      .select("id, bundle_code, created_at")
      .eq("user_id", userId)
      .eq("bundle_code", normalized.bridgeBundleCode)
      .limit(1);
  }

  const { data: bundle } = await bundleQuery.maybeSingle();
  if (bundle) {
    base.linkedBridgeBundleId = bundle.id;
    base.linkedBridgeBundleCode = bundle.bundle_code;
  }

  return redactSecretsDeep(base);
}

export const MAX_BUNDLE_BYTES = 256 * 1024;
