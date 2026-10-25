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
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const digest =
      typeof err === "object" && err !== null && "digest" in err
        ? String((err as { digest?: string }).digest)
        : undefined;
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
    await fetch(`${origin}/api/telemetry/server-errors`, {
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
