"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { ChevronDown, Cloud, Download, ExternalLink, Loader2, Lock, Radio, Search } from "lucide-react";
import { toast } from "sonner";
import { useEntitlements } from "@/hooks/use-entitlements";
import { bridgeDeepLinkPair, type BridgeDownload } from "@/lib/bridge/downloads";
import {
  detectBridgePlatformInBrowser,
  type BridgePlatformDetection,
} from "@/lib/bridge/detect-platform";
import { BRIDGE_VENDOR_LABELS, BRIDGE_VENDORS } from "@/lib/bridge/vendors";
import { BRIDGE_LAN_HINTS } from "@/lib/bridge/vendor-lan-hints";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

/** CDN 404: yalnızca HEAD yanıt verirse; CORS engelinde indirmeyi yine deneriz. */
async function installerHeadMissing(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return !res.ok;
  } catch {
    return false;
  }
}

function downloadFallbackToast() {
  toast.error("Installer indirilemedi. Kurulum rehberine bakın veya destek talebi oluşturun.", {
    duration: 8000,
  });
}

export function WorkshopBridgeModal({ open, onOpenChange }: Props) {
  const { data: ent } = useEntitlements();
  const cloudAllowed = ent?.entitlements.cloudMonitoring ?? false;
  const [loading, setLoading] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<BridgeDownload[]>([]);
  const [installersPublished, setInstallersPublished] = useState(false);
  const [detection, setDetection] = useState<BridgePlatformDetection | null>(null);
  const [showOtherPlatforms, setShowOtherPlatforms] = useState(false);
  const [showVendorNotes, setShowVendorNotes] = useState(false);

  const siteUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL ?? "https://your-app.vercel.app";

  useEffect(() => {
    if (!open || !cloudAllowed) return;
    setShowOtherPlatforms(false);
    void detectBridgePlatformInBrowser().then(setDetection);
    fetch("/api/bridge/downloads")
      .then((r) => r.json())
      .then((body) => {
        setDownloads(body.downloads ?? []);
        setInstallersPublished(Boolean(body.installersPublished));
      })
      .catch(() => setDownloads([]));
  }, [open, cloudAllowed]);

  const primaryDownload = useMemo(() => {
    if (detection?.status !== "known") return null;
    return downloads.find((d) => d.platform === detection.platform) ?? null;
  }, [detection, downloads]);

  const otherDownloads = useMemo(() => {
    if (!primaryDownload) return downloads;
    return downloads.filter((d) => d.platform !== primaryDownload.platform);
  }, [downloads, primaryDownload]);

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
        downloadFallbackToast();
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
        toast.error(body.error);
        return;
      }
      if (!res.ok) throw new Error(body.error ?? "Kod oluşturulamadı");
      setCode(body.code);
      setExpiresAt(body.expiresAt);
      toast.success("Eşleştirme kodu hazır");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hata");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setCode(null);
      setExpiresAt(null);
    }
    onOpenChange(next);
  }

  const deepLink = code ? bridgeDeepLinkPair(siteUrl, code) : null;

  const primaryButtonLabel =
    detection?.status === "known" && primaryDownload
      ? `${detection.label} için indir`
      : detection?.status === "known"
        ? `${detection.label} için indir`
        : "Kurulumu indir";

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalContent className="max-w-lg">
        <ModalHeader
          title="Atölye köprüsü"
          subtitle="Tek masaüstü kurulum — yazıcılar yerel ağda otomatik bulunur"
        />
        <ModalBody className="space-y-4 text-sm text-zinc-300">
          {!cloudAllowed ? (
            <div className="space-y-2 rounded-2xl border border-sky-900/50 bg-sky-950/20 p-4">
              <p className="flex items-center gap-2 font-medium text-zinc-100">
                <Lock className="h-4 w-4 text-sky-400" /> Canlı takip planınızda yok
              </p>
              <Link href="/billing?reason=cloud" className="text-sky-400 hover:text-sky-300">
                Atölye veya Filament Farm planına geçin →
              </Link>
            </div>
          ) : (
            <>
              <p className="text-zinc-400">
                <strong className="text-zinc-200">PrintFlow Bridge</strong> atölye PC’de arka planda
                çalışır. Chrome, Firefox veya Edge için ayrı kurulum yok — ERP’ye hangi tarayıcıdan
                girerseniz girin aynı makine kartı güncellenir.
              </p>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  1 — Kurulumu indir
                </p>

                {detection && (
                  <p className="mb-3 text-xs text-zinc-400">
                    {detection.status === "known" ? (
                      <>
                        Algılanan sistem:{" "}
                        <span className="font-medium text-zinc-200">{detection.label}</span>
                        {detection.macAmbiguous && (
                          <span className="mt-1 block text-[11px] text-zinc-500">
                            Intel Mac kullanıyorsanız aşağıdan &quot;Diğer platformlar&quot; ile Intel
                            sürümünü seçin.
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        {detection.label}. {detection.hint}
                      </>
                    )}
                  </p>
                )}

                {!installersPublished && downloads.length === 0 ? (
                  <p className="text-xs text-amber-200/90">
                    Installer henüz yayında değil.{" "}
                    <Link href="/support?topic=bridge" className="text-sky-400 hover:text-sky-300">
                      Destek talebi oluşturun
                    </Link>
                  </p>
                ) : downloads.length === 0 ? (
                  <p className="text-xs text-zinc-500">İndirme listesi yükleniyor…</p>
                ) : (
                  <>
                    <Button
                      type="button"
                      className="w-full"
                      disabled={downloadBusy}
                      onClick={() => void handlePrimaryDownload()}
                    >
                      {downloadBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {primaryButtonLabel}
                    </Button>
                    {primaryDownload && (
                      <p className="mt-2 text-[11px] text-zinc-600">
                        Dosya: <span className="text-zinc-500">{primaryDownload.filename}</span>
                      </p>
                    )}
                  </>
                )}

                {downloads.length > 0 && (
                  <div className="mt-3 border-t border-zinc-800/80 pt-3">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between text-xs text-zinc-500 hover:text-zinc-400"
                      onClick={() => setShowOtherPlatforms((v) => !v)}
                    >
                      Diğer platformlar
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${showOtherPlatforms ? "rotate-180" : ""}`}
                      />
                    </button>
                    {showOtherPlatforms && (
                      <ul className="mt-2 space-y-2">
                        {(showOtherPlatforms && primaryDownload ? otherDownloads : downloads).map((d) => (
                          <li key={d.platform}>
                            <a
                              href={d.url}
                              className="flex items-center gap-2 text-sky-400 hover:text-sky-300"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Download className="h-3.5 w-3.5 shrink-0" />
                              {d.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <p className="mt-2 text-[11px] text-zinc-600">
                  Sorun mu yaşıyorsunuz?{" "}
                  <Link href="/support?topic=bridge" className="text-sky-400 hover:text-sky-300">
                    Kurulum rehberi
                  </Link>
                  {" · "}
                  <Link href="/support?topic=bridge&report=1" className="text-sky-400 hover:text-sky-300">
                    Destek paketini gönder
                  </Link>
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  2 — Kodu oluşturun, köprüyü açın
                </p>
                <p className="flex items-start gap-2 text-zinc-400">
                  <Search className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                  <span>
                    Köprü aynı ağdaki yazıcıları <strong className="text-zinc-200">otomatik bulur</strong>;
                    listeden seçmeniz yeterli. IP adresi veya seri numarası girmeniz gerekmez.
                  </span>
                </p>
                {cloudAllowed && (
                  <p className="mt-2 flex items-start gap-2 text-xs text-zinc-500">
                    <Cloud className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-500/80" />
                    <span>
                      Bambu yazıcı bulut modundaysa erişim kodu girmek zorunda değilsiniz: üstteki{" "}
                      <strong className="text-zinc-400">Yazıcıları bağla</strong> ile Bambu hesabınızı
                      bağlayın; telemetri buluttan gelir (atölye köprüsü gerekmez). Köprü kullanacaksanız
                      Bambu Studio oturumu veya yazıcı ekranındaki kod yeterlidir.
                    </span>
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {BRIDGE_VENDORS.map((v) => (
                    <span
                      key={v}
                      title={BRIDGE_LAN_HINTS[v].discovery}
                      className="rounded-full border border-zinc-800 bg-zinc-950/40 px-2 py-0.5 text-[11px] text-zinc-400"
                    >
                      {BRIDGE_VENDOR_LABELS[v]}
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  className="mt-3 flex w-full items-center justify-between text-xs text-zinc-500 hover:text-zinc-400"
                  onClick={() => setShowVendorNotes((v) => !v)}
                >
                  Bazı yazıcılarda bir kez sorulanlar
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${showVendorNotes ? "rotate-180" : ""}`}
                  />
                </button>
                {showVendorNotes && (
                  <ul className="mt-2 space-y-1.5 text-xs text-zinc-500">
                    {BRIDGE_VENDORS.filter((v) => BRIDGE_LAN_HINTS[v].userInput).map((v) => (
                      <li key={v}>
                        <strong className="text-zinc-300">{BRIDGE_VENDOR_LABELS[v]}:</strong>{" "}
                        {BRIDGE_LAN_HINTS[v].userInput}
                      </li>
                    ))}
                    <li>
                      Yazıcı listede yoksa: bilgisayar ve yazıcı aynı ağda mı (misafir Wi-Fi ayrı ağdır)?
                      Köprü bu durumda IP adresini elle girmenize izin verir.
                    </li>
                  </ul>
                )}
              </div>

              {code ? (
                <div className="rounded-2xl border border-emerald-800/50 bg-emerald-950/20 p-4 text-center">
                  <p className="text-xs text-zinc-500">Eşleştirme kodu (15 dk)</p>
                  <p className="mt-1 font-mono text-3xl font-semibold tracking-widest text-emerald-300">
                    {code}
                  </p>
                  {expiresAt && (
                    <p className="mt-2 text-xs text-zinc-500">
                      Geçerlilik: {new Date(expiresAt).toLocaleTimeString("tr-TR")}
                    </p>
                  )}
                  {deepLink && (
                    <a
                      href={deepLink}
                      className="mt-3 inline-flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Köprüyü aç (printflow://)
                    </a>
                  )}
                  <p className="mt-3 text-left text-xs text-zinc-500">
                    Köprü bulduğu yazıcıları listeler; bu kodla 15 dk içinde birden fazla yazıcı
                    seçebilirsiniz. Sonradan yazıcı eklemek için yeni kod üretin.
                  </p>
                </div>
              ) : (
                <Button type="button" onClick={createCode} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
                  Eşleştirme kodu oluştur
                </Button>
              )}

              <p className="text-xs text-zinc-600">
                Erişim kodu, şifre ve API anahtarları yalnızca atölye bilgisayarında kalır; sunucuya
                gönderilmez. Sorun yaşarsanız köprüden destek paketi gönderin veya panelden{" "}
                <Link href="/support?topic=bridge&report=1" className="text-sky-400 hover:text-sky-300">
                  Sorun bildir
                </Link>
                .
              </p>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
            Kapat
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
