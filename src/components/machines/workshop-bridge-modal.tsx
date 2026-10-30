"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ds";
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
      : process.env.NEXT_PUBLIC_SITE_URL ?? "https://3dasisstant.com";

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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md" className="max-sm:max-h-[95dvh]">
        <DialogHeader>
          <DialogTitle>Atölye köprüsü</DialogTitle>
          <DialogDescription>
            Tek masaüstü kurulum — yazıcılar yerel ağda otomatik bulunur
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4 text-sm text-muted-foreground">
          {!cloudAllowed ? (
            <div className="space-y-2 rounded-xl border border-info/30 bg-info-subtle p-4">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <Lock className="h-4 w-4 text-info" aria-hidden /> Canlı takip planınızda yok
              </p>
              <Link
                href="/billing?reason=cloud"
                className="text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
              >
                Atölye veya Filament Farm planına geçin →
              </Link>
            </div>
          ) : (
            <>
              <p>
                <strong className="text-foreground">3D Asisstant Bridge</strong> atölye PC’de arka planda
                çalışır. Chrome, Firefox veya Edge için ayrı kurulum yok — ERP’ye hangi tarayıcıdan
                girerseniz girin aynı makine kartı güncellenir.
              </p>

              <div className="rounded-xl border border-border bg-surface-2/80 p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  1 — Kurulumu indir
                </p>

                {detection && (
                  <p className="mb-3 text-xs text-muted-foreground">
                    {detection.status === "known" ? (
                      <>
                        Algılanan sistem:{" "}
                        <span className="font-medium text-foreground">{detection.label}</span>
                        {detection.macAmbiguous && (
                          <span className="mt-1 block text-[11px] text-muted-foreground">
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
                  <p className="text-xs text-warning">
                    Installer henüz yayında değil.{" "}
                    <Link href="/support?topic=bridge" className="text-primary hover:text-primary-hover">
                      Destek talebi oluşturun
                    </Link>
                  </p>
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
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {primaryButtonLabel}
                    </Button>
                    {primaryDownload && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Dosya: <span className="text-foreground/80">{primaryDownload.filename}</span>
                      </p>
                    )}
                  </>
                )}

                {downloads.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground"
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
                              className="flex items-center gap-2 text-primary hover:text-primary-hover"
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

                <p className="mt-2 text-[11px] text-muted-foreground">
                  Sorun mu yaşıyorsunuz?{" "}
                  <Link href="/support?topic=bridge" className="text-primary hover:text-primary-hover">
                    Kurulum rehberi
                  </Link>
                  {" · "}
                  <Link href="/support?topic=bridge&report=1" className="text-primary hover:text-primary-hover">
                    Destek paketini gönder
                  </Link>
                </p>
              </div>

              <div className="rounded-xl border border-border bg-surface-2/80 p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  2 — Kodu oluşturun, köprüyü açın
                </p>
                <p className="flex items-start gap-2">
                  <Search className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span>
                    Köprü aynı ağdaki yazıcıları <strong className="text-foreground">otomatik bulur</strong>;
                    listeden seçmeniz yeterli. IP adresi veya seri numarası girmeniz gerekmez.
                  </span>
                </p>
                {cloudAllowed && (
                  <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                    <Cloud className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" aria-hidden />
                    <span>
                      Bambu yazıcı bulut modundaysa erişim kodu girmek zorunda değilsiniz: üstteki{" "}
                      <strong className="text-foreground">Yazıcıları bağla</strong> ile Bambu hesabınızı
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
                      className="rounded-full border border-border bg-surface-inset px-2 py-0.5 text-[11px] text-muted-foreground"
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
                    className={`h-3.5 w-3.5 transition-transform ${showVendorNotes ? "rotate-180" : ""}`}
                  />
                </button>
                {showVendorNotes && (
                  <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                    {BRIDGE_VENDORS.filter((v) => BRIDGE_LAN_HINTS[v].userInput).map((v) => (
                      <li key={v}>
                        <strong className="text-foreground">{BRIDGE_VENDOR_LABELS[v]}:</strong>{" "}
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
                <div className="rounded-xl border border-success/40 bg-success-subtle p-4 text-center">
                  <p className="text-xs text-muted-foreground">Eşleştirme kodu (15 dk)</p>
                  <p className="mt-1 font-mono text-3xl font-semibold tracking-widest text-success">
                    {code}
                  </p>
                  {expiresAt && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Geçerlilik: {new Date(expiresAt).toLocaleTimeString("tr-TR")}
                    </p>
                  )}
                  {deepLink && (
                    <a
                      href={deepLink}
                      className="mt-3 inline-flex items-center gap-1 text-sm text-success hover:text-success/90"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Köprüyü aç (printflow://)
                    </a>
                  )}
                  <p className="mt-3 text-left text-xs text-muted-foreground">
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

              <p className="text-xs text-muted-foreground">
                Erişim kodu, şifre ve API anahtarları yalnızca atölye bilgisayarında kalır; sunucuya
                gönderilmez. Sorun yaşarsanız köprüden destek paketi gönderin veya panelden{" "}
                <Link href="/support?topic=bridge&report=1" className="text-primary hover:text-primary-hover">
                  Sorun bildir
                </Link>
                .
              </p>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
