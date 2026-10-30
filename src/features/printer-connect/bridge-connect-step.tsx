"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Radio,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ds";
import { buttonVariants } from "@/components/ds/variants";
import { cn } from "@/lib/utils";
import { useMachines } from "@/hooks/use-data";
import { useEntitlements } from "@/hooks/use-entitlements";
import { bridgeDeepLinkPair, type BridgeDownload } from "@/lib/bridge/downloads";
import {
  detectBridgePlatformInBrowser,
  type BridgePlatformDetection,
} from "@/lib/bridge/detect-platform";
import { BRIDGE_VENDOR_LABELS, BRIDGE_VENDORS } from "@/lib/bridge/vendors";
import { BRIDGE_LAN_HINTS } from "@/lib/bridge/vendor-lan-hints";

type BridgeConnectStepProps = {
  onLinked: (machineIds: string[]) => void;
  onBack?: () => void;
};

function startBridgeDownload(item: BridgeDownload) {
  const a = document.createElement("a");
  a.href = item.url;
  a.download = item.filename;
  a.rel = "noopener noreferrer";
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function installerHeadMissing(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return !res.ok;
  } catch {
    return false;
  }
}

function usePairingCountdown(expiresAt: string | null) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) {
      setRemaining(null);
      return;
    }
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setRemaining(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return remaining;
}

function formatCountdown(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function BridgeConnectStep({ onLinked, onBack }: BridgeConnectStepProps) {
  const queryClient = useQueryClient();
  const { data: ent } = useEntitlements();
  const cloudAllowed = ent?.entitlements.cloudMonitoring ?? false;
  const { data: machines = [], refetch } = useMachines();

  const [loading, setLoading] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [baselineIds, setBaselineIds] = useState<string[] | null>(null);
  const [downloads, setDownloads] = useState<BridgeDownload[]>([]);
  const [installersPublished, setInstallersPublished] = useState(false);
  const [detection, setDetection] = useState<BridgePlatformDetection | null>(null);
  const [showOtherPlatforms, setShowOtherPlatforms] = useState(false);
  const [showVendorNotes, setShowVendorNotes] = useState(false);
  const [waitingBridge, setWaitingBridge] = useState(false);

  const countdown = usePairingCountdown(expiresAt);

  const siteUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL ?? "https://3dasisstant.com";

  useEffect(() => {
    if (!cloudAllowed) return;
    void detectBridgePlatformInBrowser().then(setDetection);
    fetch("/api/bridge/downloads")
      .then((r) => r.json())
      .then((body) => {
        setDownloads(body.downloads ?? []);
        setInstallersPublished(Boolean(body.installersPublished));
      })
      .catch(() => setDownloads([]));
  }, [cloudAllowed]);

  const primaryDownload = useMemo(() => {
    if (detection?.status !== "known") return null;
    return downloads.find((d) => d.platform === detection.platform) ?? null;
  }, [detection, downloads]);

  const otherDownloads = useMemo(() => {
    if (!primaryDownload) return downloads;
    return downloads.filter((d) => d.platform !== primaryDownload.platform);
  }, [downloads, primaryDownload]);

  useEffect(() => {
    if (!code || !waitingBridge || baselineIds === null) return;
    const id = setInterval(() => {
      void refetch().then((result) => {
        const list = result.data ?? machines;
        const added = list.filter(
          (m) => !baselineIds.includes(m.id) && m.bridge_binding?.id
        );
        if (added.length > 0) {
          setWaitingBridge(false);
          queryClient.invalidateQueries({ queryKey: ["machines"] });
          toast.success("Köprü bağlandı — yazıcılar eklendi");
          onLinked(added.map((m) => m.id));
        }
      });
    }, 3000);
    return () => clearInterval(id);
  }, [code, waitingBridge, baselineIds, refetch, machines, onLinked, queryClient]);

  async function handlePrimaryDownload() {
    if (!primaryDownload) {
      if (!installersPublished || downloads.length === 0) {
        toast.message("Installer henüz yayında değil", {
          description: "Erken erişim için destek talebi oluşturabilirsiniz.",
        });
      } else {
        toast.error("Sisteminiz için otomatik eşleşme yok; Diğer platformlar bölümünü açın.");
        setShowOtherPlatforms(true);
      }
      return;
    }

    setDownloadBusy(true);
    try {
      if (await installerHeadMissing(primaryDownload.url)) {
        toast.error("Installer indirilemedi. Kurulum rehberine bakın veya destek talebi açın.");
        return;
      }
      startBridgeDownload(primaryDownload);
      toast.success(`${primaryDownload.label} indiriliyor…`);
    } finally {
      setDownloadBusy(false);
    }
  }

  async function createCode() {
    setLoading(true);
    try {
      const res = await fetch("/api/bridge/pairing-codes", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.status === 402) {
        const { handlePlanErrorResponse } = await import(
          "@/lib/billing/handle-plan-error"
        );
        await handlePlanErrorResponse(res, body, "bridge_pairing");
        return;
      }
      if (!res.ok) throw new Error(body.error ?? "Kod oluşturulamadı");
      setCode(body.code);
      setExpiresAt(body.expiresAt);
      setBaselineIds(machines.map((m) => m.id));
      setWaitingBridge(true);
      toast.success("Eşleştirme kodu hazır");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hata");
    } finally {
      setLoading(false);
    }
  }

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Kod kopyalandı");
    } catch {
      toast.error("Kopyalanamadı");
    }
  }

  const deepLink = code ? bridgeDeepLinkPair(siteUrl, code) : null;

  const primaryButtonLabel =
    detection?.status === "known" && primaryDownload
      ? `${detection.label} için indir`
      : detection?.status === "known"
        ? `${detection.label} için indir`
        : "Kurulumu indir";

  if (!cloudAllowed) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Atölye köprüsü canlı takip planınızda yer alır.
        </p>
        <Link href="/billing?reason=cloud" className="text-sm font-medium text-primary">
          Planları gör →
        </Link>
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack}>
            Geri
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        <strong className="text-foreground">3D Asisstant Bridge</strong> atölye bilgisayarınızda arka
        planda çalışır; yazıcılar yerel ağda otomatik bulunur.
      </p>

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          1 — Kurulumu indir
        </p>
        {detection ? (
          <p className="mb-3 text-xs text-muted-foreground">
            {detection.status === "known" ? (
              <>
                Algılanan sistem:{" "}
                <span className="font-medium text-foreground">{detection.label}</span>
              </>
            ) : (
              detection.hint
            )}
          </p>
        ) : null}

        {!installersPublished && downloads.length === 0 ? (
          <div className="space-y-2 text-xs text-warning">
            <p>Installer henüz yayında değil — erken erişim için bize yazın.</p>
            <Link
              href="/support?topic=bridge"
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
            >
              Destek talebi oluştur
            </Link>
          </div>
        ) : downloads.length === 0 ? (
          <p className="text-xs text-muted-foreground">İndirme listesi yükleniyor…</p>
        ) : (
          <>
            <Button
              type="button"
              className="w-full"
              disabled={downloadBusy}
              onClick={() => void handlePrimaryDownload()}
            >
              {downloadBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {primaryButtonLabel}
            </Button>
          </>
        )}

        {downloads.length > 0 ? (
          <div className="mt-3 border-t border-border pt-3">
            <button
              type="button"
              className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowOtherPlatforms((v) => !v)}
            >
              Diğer platformlar
              <ChevronDown
                className={`size-3.5 transition-transform ${showOtherPlatforms ? "rotate-180" : ""}`}
              />
            </button>
            {showOtherPlatforms ? (
              <ul className="mt-2 space-y-2">
                {(primaryDownload ? otherDownloads : downloads).map((d) => (
                  <li key={d.platform}>
                    <a
                      href={d.url}
                      className="flex items-center gap-2 text-primary hover:text-primary-hover"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="size-3.5 shrink-0" />
                      {d.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <p className="mt-3 text-xs text-muted-foreground">
          Sorun mu yaşıyorsunuz?{" "}
          <Link href="/support?topic=bridge" className="text-primary hover:underline">
            Kurulum rehberi
          </Link>
          {" · "}
          <Link href="/support?topic=bridge&report=1" className="text-primary hover:underline">
            Destek paketini gönder
          </Link>
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          2 — Eşleştirme kodu
        </p>
        <p className="flex items-start gap-2 text-muted-foreground">
          <Search className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>
            Köprü aynı ağdaki yazıcıları <strong className="text-foreground">otomatik bulur</strong>;
            IP veya seri numarası girmeniz gerekmez.
          </span>
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {BRIDGE_VENDORS.map((v) => (
            <span
              key={v}
              title={BRIDGE_LAN_HINTS[v].discovery}
              className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {BRIDGE_VENDOR_LABELS[v]}
            </span>
          ))}
        </div>

        <button
          type="button"
          className="mt-3 flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowVendorNotes((v) => !v)}
        >
          Bazı yazıcılarda bir kez sorulanlar
          <ChevronDown
            className={`size-3.5 transition-transform ${showVendorNotes ? "rotate-180" : ""}`}
          />
        </button>
        {showVendorNotes ? (
          <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            {BRIDGE_VENDORS.filter((v) => BRIDGE_LAN_HINTS[v].userInput).map((v) => (
              <li key={v}>
                <strong className="text-foreground">{BRIDGE_VENDOR_LABELS[v]}:</strong>{" "}
                {BRIDGE_LAN_HINTS[v].userInput}
              </li>
            ))}
          </ul>
        ) : null}

        {code ? (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary-subtle p-4 text-center">
            <p className="text-xs text-muted-foreground">Eşleştirme kodu</p>
            <p className="mt-1 font-mono text-3xl font-semibold tracking-[0.3em] text-foreground">
              {code}
            </p>
            {countdown !== null ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Kalan süre: {formatCountdown(countdown)}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => void copyCode()}>
                <Copy className="size-3.5" aria-hidden />
                Kopyala
              </Button>
              {deepLink ? (
                <a
                  href={deepLink}
                  className={cn(
                    buttonVariants({ variant: "secondary", size: "sm" }),
                    "inline-flex items-center gap-2"
                  )}
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  Köprüyü aç
                </a>
              ) : null}
            </div>
            {waitingBridge ? (
              <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Köprü bekleniyor…
              </p>
            ) : null}
          </div>
        ) : (
          <Button type="button" onClick={() => void createCode()} disabled={loading} className="mt-4 w-full">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Radio className="size-4" />}
            Eşleştirme kodu oluştur
          </Button>
        )}
      </div>

      {onBack ? (
        <Button type="button" variant="ghost" onClick={onBack}>
          Geri
        </Button>
      ) : null}
    </div>
  );
}
