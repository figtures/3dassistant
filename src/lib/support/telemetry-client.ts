"use client";

import { errorFingerprint } from "./fingerprint";
import { sanitizeClientErrorMessage } from "./redact";

const SAMPLE_RATE = 0.25;
const MIN_INTERVAL_MS = 15_000;
const recentFingerprints = new Map<string, number>();

function shouldSend(fingerprint: string): boolean {
  const now = Date.now();
  const last = recentFingerprints.get(fingerprint);
  if (last && now - last < MIN_INTERVAL_MS) return false;
  recentFingerprints.set(fingerprint, now);
  if (Math.random() > SAMPLE_RATE) return false;
  return true;
}

export function reportClientErrorToTelemetry(opts: {
  message: string;
  stack?: string;
  route?: string;
}): void {
  if (typeof window === "undefined") return;
  const message = sanitizeClientErrorMessage(opts.message);
  if (!message) return;

  const fingerprint = errorFingerprint({
    message,
    route: opts.route ?? window.location.pathname,
    source: "client",
  });
  if (!shouldSend(fingerprint)) return;

  void fetch("/api/telemetry/client-errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      stack: opts.stack?.slice(0, 4000),
      route: opts.route ?? window.location.pathname + window.location.search,
      fingerprint,
    }),
    keepalive: true,
  }).catch(() => {
    /* ignore */
  });
}

export function getRecentErrorFingerprints(limit = 5): string[] {
  return [...recentFingerprints.keys()].slice(-limit);
}
