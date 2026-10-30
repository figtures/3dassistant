import { bridgeServiceUrl } from "@/lib/bridge/service-url";

const PROBE_TIMEOUT_MS = 2500;

export type BridgeProbeResult = {
  configured: boolean;
  status: "ok" | "degraded" | "skipped";
  latencyMs?: number;
  detail?: string;
};

/** Dahili printflow-bridge servisinin /health uç noktasını dener (binding yoksa atlanır). */
export async function probeBridgeServiceHealth(): Promise<BridgeProbeResult> {
  const url = bridgeServiceUrl("/health");
  if (!url) {
    return { configured: false, status: "skipped" };
  }

  const started = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: "no-store",
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      return {
        configured: true,
        status: "degraded",
        latencyMs,
        detail: `HTTP ${res.status}`,
      };
    }
    return { configured: true, status: "ok", latencyMs };
  } catch (err) {
    return {
      configured: true,
      status: "degraded",
      latencyMs: Date.now() - started,
      detail: err instanceof Error ? err.message : "unreachable",
    };
  }
}
