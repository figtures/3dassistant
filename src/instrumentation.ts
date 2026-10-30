import type { Instrumentation } from "next";

export async function register() {
  /* Node-only kayıt: instrumentation.node.ts */
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (err, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { getServerSiteUrl } = await import("@/lib/site-url-server");
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const digest =
      typeof err === "object" && err !== null && "digest" in err
        ? String((err as { digest?: string }).digest)
        : undefined;
    const origin = getServerSiteUrl();
    const telemetryUrl = new URL("/api/telemetry/server-errors", origin);
    await fetch(telemetryUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        stack: stack?.slice(0, 4000),
        route: request.path,
        digest,
      }),
    });
  } catch (e) {
    console.warn("[instrumentation] onRequestError failed", e);
  }
};
