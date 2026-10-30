"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Radio } from "lucide-react";
import { Button } from "@/components/ds";
import { buttonVariants } from "@/components/ds/variants";
import { cn } from "@/lib/utils";
import { useMachineLiveSse } from "@/hooks/use-machine-sse";

const VERIFY_TIMEOUT_MS = 30_000;

type VerifyStepProps = {
  machineIds: string[];
  manualOnly?: boolean;
  onVerified: () => void;
  onSkip: () => void;
};

export function VerifyStep({
  machineIds,
  manualOnly = false,
  onVerified,
  onSkip,
}: VerifyStepProps) {
  const primaryId = machineIds[0];
  const { live } = useMachineLiveSse(manualOnly ? undefined : primaryId);
  const [timedOut, setTimedOut] = useState(false);
  const [verified, setVerified] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (manualOnly) return;
    if (!primaryId) return;
    const hasTelemetry =
      live &&
      (live.nozzle_temp_c != null ||
        live.bed_temp_c != null ||
        live.printer_state != null ||
        live.connection_status === "connected");
    if (hasTelemetry) {
      setVerified(true);
      const t = setTimeout(onVerified, 1200);
      return () => clearTimeout(t);
    }
    const timeout = setTimeout(() => setTimedOut(true), VERIFY_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [live, primaryId, manualOnly, onVerified]);

  if (manualOnly || !primaryId) {
    return (
      <div className="space-y-4">
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-semibold text-foreground outline-none"
        >
          Canlı takip yok
        </h3>
        <p className="text-sm text-muted-foreground">
          Makine planlamada kullanılabilir. Canlı veri için daha sonra yazıcı bağlama sihirbazını
          tekrar çalıştırın.
        </p>
        <Button type="button" onClick={onSkip}>
          Devam
        </Button>
      </div>
    );
  }

  if (verified && live) {
    return (
      <div className="space-y-4">
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="flex items-center gap-2 text-lg font-semibold text-foreground outline-none"
        >
          <CheckCircle2 className="size-5 text-primary" aria-hidden />
          Canlı veri alındı
        </h3>
        <p className="text-sm text-muted-foreground">
          {live.name}:{" "}
          {live.nozzle_temp_c != null ? `Nozul ${live.nozzle_temp_c} °C` : null}
          {live.printer_state ? ` · Durum: ${live.printer_state}` : null}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-semibold text-foreground outline-none"
      >
        Bağlantı doğrulanıyor
      </h3>
      {!timedOut ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
          İlk telemetri bekleniyor (en fazla 30 sn)…
        </p>
      ) : (
        <div className="space-y-3 rounded-xl border border-border bg-surface-inset p-4 text-sm">
          <p className="font-medium text-foreground">Henüz canlı veri gelmedi</p>
          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            <li>Yazıcı açık ve aynı ağda mı?</li>
            <li>Bambu/Creality için hesap bağlantısı tamamlandı mı?</li>
            <li>Köprü kullanıyorsanız uygulama çalışıyor mu?</li>
            <li>LAN / geliştirici modu gereksinimlerini kontrol edin.</li>
          </ul>
          <Link
            href="/support?topic=bridge"
            className={cn(buttonVariants({ variant: "secondary", size: "md" }))}
          >
            Sorun giderme rehberi
          </Link>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" onClick={onSkip}>
          Şimdilik atla
        </Button>
        {!timedOut ? (
          <Button type="button" variant="secondary" onClick={onSkip} className="sm:ml-auto">
            <Radio className="size-4" aria-hidden />
            Devam et
          </Button>
        ) : (
          <Button type="button" onClick={onSkip} className="sm:ml-auto">
            Makinelere git
          </Button>
        )}
      </div>
    </div>
  );
}
