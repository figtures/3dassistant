import { NextResponse } from "next/server";
import { probeBridgeServiceHealth } from "@/lib/bridge/probe-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const bridge = await probeBridgeServiceHealth();

  const overall =
    bridge.status === "degraded" ? "degraded" : "ok";

  const body = {
    status: overall,
    service: "app",
    bridge,
  };

  if (overall === "degraded") {
    return NextResponse.json(body, { status: 503 });
  }

  return NextResponse.json(body);
}
