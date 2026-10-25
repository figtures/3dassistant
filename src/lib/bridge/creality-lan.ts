import { normalizeCrealityTelemetry, type IotRpcSnapshot } from "@/lib/printer-cloud/creality-client";
import type { NormalizedTelemetry } from "@/lib/printer-cloud/types";

/** Creality yazıcıdan LAN (HTTP/WebSocket) ile gelen IoT benzeri snapshot → ERP telemetri. */
export function normalizeCrealityLanTelemetry(
  deviceId: string,
  deviceName: string,
  iot: IotRpcSnapshot | null,
  onlineHint = true
): NormalizedTelemetry {
  return normalizeCrealityTelemetry(deviceId, deviceName, iot, null, onlineHint);
}
