import { NextResponse } from "next/server";
import { bridgeDownloads, bridgeInstallersPublished } from "@/lib/bridge/downloads";

export const dynamic = "force-dynamic";

/** PrintFlow Bridge tek tık kurulum dosyaları (imzalı artefaktlar CI’dan). */
export async function GET() {
  const published = bridgeInstallersPublished();
  return NextResponse.json({
    version: process.env.NEXT_PUBLIC_PRINTFLOW_BRIDGE_VERSION?.trim() || "0.1.0",
    installersPublished: published,
    note:
      "Tarayıcı eklentisi gerekmez. Masaüstü köprü tüm tarayıcılarda aynı ERP oturumunu kullanır.",
    devSetup:
      "Installer henüz yayında değilse: npm run bridge:pair ve npm run bridge:run (Node, Go gerekmez).",
    downloads: published ? bridgeDownloads() : [],
  });
}
