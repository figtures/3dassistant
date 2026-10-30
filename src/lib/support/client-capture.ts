"use client";

import type { ClientDiagnostics } from "./types";
import { sanitizeClientErrorMessage } from "./redact";
import { reportClientErrorToTelemetry, getRecentErrorFingerprints } from "./telemetry-client";

const MAX_ERRORS = 20;
const MAX_FETCHES = 10;

type Ring<T> = { items: T[] };

const errors: Ring<{ at: string; message: string; source?: string }> = { items: [] };
const failedFetches: Ring<{ at: string; path: string; status: number }> = { items: [] };

let installed = false;

function pushError(entry: { message: string; source?: string; stack?: string }) {
  errors.items.push({ at: new Date().toISOString(), message: entry.message, source: entry.source });
  if (errors.items.length > MAX_ERRORS) errors.items.shift();
  reportClientErrorToTelemetry({
    message: entry.message,
    stack: entry.stack,
    route: typeof window !== "undefined" ? window.location.pathname : undefined,
  });
}

function pushFailedFetch(path: string, status: number) {
  failedFetches.items.push({ at: new Date().toISOString(), path, status });
  if (failedFetches.items.length > MAX_FETCHES) failedFetches.items.shift();
}

function fetchPathOnly(url: string): string {
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    return u.pathname + (u.search ? "?…" : "");
  } catch {
    return url.split("?")[0] ?? url;
  }
}

function resolveFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** Next.js RSC navigasyon istekleri — dev reload sırasında ağ hatası beklenir. */
function isNextRscFetch(url: string, init?: RequestInit): boolean {
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    if (u.searchParams.has("_rsc")) return true;
    if (u.pathname.startsWith("/_next/")) return true;
  } catch {
    if (url.includes("_rsc=") || url.includes("/_next/")) return true;
  }
  const headers = init?.headers;
  if (headers instanceof Headers) {
    if (headers.get("RSC") === "1" || headers.get("Next-Router-Prefetch") === "1") return true;
  } else if (headers && typeof headers === "object" && !Array.isArray(headers)) {
    const h = headers as Record<string, string>;
    if (h.RSC === "1" || h["Next-Router-Prefetch"] === "1") return true;
  }
  return false;
}

export function installClientDiagnosticsCapture() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (ev) => {
    const msg = ev.message || String(ev.error ?? "error");
    const stack = ev.error instanceof Error ? ev.error.stack : undefined;
    pushError({
      message: sanitizeClientErrorMessage(msg),
      source: ev.filename ? `${ev.filename}:${ev.lineno}` : undefined,
      stack,
    });
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason;
    const msg = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    pushError({
      message: sanitizeClientErrorMessage(msg),
      source: "unhandledrejection",
      stack,
    });
  });

  const origError = console.error;
  console.error = (...args: unknown[]) => {
    try {
      const text = args
        .map((a) => (typeof a === "string" ? a : a instanceof Error ? a.message : JSON.stringify(a)))
        .join(" ");
      if (text && !text.includes("[support]")) {
        pushError({ message: sanitizeClientErrorMessage(text.slice(0, 500)), source: "console.error" });
      }
    } catch {
      /* ignore */
    }
    origError.apply(console, args);
  };

  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = resolveFetchUrl(input);
    if (isNextRscFetch(url, init)) {
      return origFetch(input, init);
    }
    const res = await origFetch(input, init);
    if (!res.ok && !url.includes("/api/support/")) {
      pushFailedFetch(fetchPathOnly(url), res.status);
    }
    return res;
  };
}

export function snapshotClientDiagnostics(extra?: Partial<ClientDiagnostics>): ClientDiagnostics {
  const fingerprints = getRecentErrorFingerprints(8);
  return {
    route: typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    viewport:
      typeof window !== "undefined"
        ? { width: window.innerWidth, height: window.innerHeight }
        : undefined,
    timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined,
    locale: typeof navigator !== "undefined" ? navigator.language : undefined,
    clientErrors: [...errors.items],
    failedFetches: [...failedFetches.items],
    errorFingerprints: fingerprints.length ? fingerprints : undefined,
    ...extra,
  };
}

export function buildMailtoFallback(opts: {
  ticketId?: string;
  subject: string;
  description: string;
  diagnostics: ClientDiagnostics;
}): string {
  const supportTo = "destek@3dasisstant.com";
  const subj = encodeURIComponent(
    opts.ticketId ? `[${opts.ticketId}] ${opts.subject}` : opts.subject
  );
  const body = encodeURIComponent(
    [
      opts.description,
      "",
      "--- Tanılama ---",
      JSON.stringify(opts.diagnostics, null, 2),
    ].join("\n")
  );
  return `mailto:${supportTo}?subject=${subj}&body=${body}`;
}
