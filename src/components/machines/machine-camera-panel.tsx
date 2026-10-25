"use client";

import { useEffect, useState } from "react";

type Props = {
  /** Köprü / uzaktan görüntüleme — LAN URL tarayıcıya verilmez */
  machineId?: string;
  /** Aynı ağda doğrudan MJPEG (köprü yoksa yedek) */
  streamUrl?: string | null;
  refreshMs?: number;
};

export function MachineCameraPanel({ machineId, streamUrl, refreshMs = 2500 }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const remote = Boolean(machineId);

  useEffect(() => {
    setError(false);
    if (machineId) {
      const bump = () => setSrc(`/api/machines/${machineId}/camera?t=${Date.now()}`);
      bump();
      const t = setInterval(bump, refreshMs);
      return () => clearInterval(t);
    }
    if (!streamUrl) {
      setSrc(null);
      return;
    }
    if (streamUrl.includes("mjpeg") || streamUrl.endsWith("/video") || streamUrl.includes("stream")) {
      setSrc(streamUrl);
      return;
    }
    const bump = () => setSrc(`${streamUrl}${streamUrl.includes("?") ? "&" : "?"}t=${Date.now()}`);
    bump();
    const t = setInterval(bump, refreshMs);
    return () => clearInterval(t);
  }, [machineId, streamUrl, refreshMs]);

  if (!machineId && !streamUrl) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 text-sm text-zinc-600">
        Kamera yok — atölye köprüsü kurulduğunda uzaktan görüntüleme açılır.
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4 text-sm text-amber-200/90">
        {remote
          ? "Kamera karesi alınamadı. Köprü çalışıyor olmalı ve yazıcı kamerası LAN’da erişilebilir olmalıdır."
          : "Kamera yüklenemedi. URL yalnızca atölye ağından erişilebilir olmalıdır."}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src ?? undefined}
        alt="Yazıcı kamerası"
        className="aspect-video w-full object-contain"
        onError={() => setError(true)}
      />
    </div>
  );
}
