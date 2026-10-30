"use client";

import Link from "next/link";
import { Lock, Thermometer, Layers, Camera } from "lucide-react";
import { Badge, Button } from "@/components/ds";
import { cn } from "@/lib/utils";
import {
  methodsForVendor,
  isMethodAvailable,
  type ConnectMethod,
  type ConnectVendor,
} from "@/features/printer-connect/methods";

type MethodStepProps = {
  vendor: ConnectVendor;
  cloudMonitoring: boolean;
  selected: ConnectMethod | null;
  onSelect: (method: ConnectMethod) => void;
  onBack: () => void;
};

function LiveIcons({ temps, progress, camera }: { temps: boolean; progress: boolean; camera: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
      {temps ? (
        <span className="inline-flex items-center gap-0.5">
          <Thermometer className="size-3" aria-hidden /> Sıcaklık
        </span>
      ) : null}
      {progress ? (
        <span className="inline-flex items-center gap-0.5">
          <Layers className="size-3" aria-hidden /> İlerleme
        </span>
      ) : null}
      {camera ? (
        <span className="inline-flex items-center gap-0.5">
          <Camera className="size-3" aria-hidden /> Kamera
        </span>
      ) : null}
      {!temps && !progress && !camera ? <span>Canlı takip yok</span> : null}
    </span>
  );
}

export function MethodStep({
  vendor,
  cloudMonitoring,
  selected,
  onSelect,
  onBack,
}: MethodStepProps) {
  const options = methodsForVendor(vendor);

  function handleClick(method: ConnectMethod, locked: boolean) {
    if (locked) return;
    onSelect(method);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Nasıl bağlanmak istersiniz?</p>
      <ul className="space-y-3">
        {options.map((opt) => {
          const locked = !isMethodAvailable(opt, cloudMonitoring);
          const isSelected = selected === opt.id;
          return (
            <li key={opt.id}>
              <button
                type="button"
                disabled={locked}
                onClick={() => handleClick(opt.id, locked)}
                className={cn(
                  "w-full rounded-xl border p-4 text-left transition",
                  locked && "cursor-not-allowed opacity-90",
                  isSelected && !locked
                    ? "border-primary bg-primary-subtle ring-1 ring-primary/30"
                    : "border-border bg-card hover:border-primary/40",
                  !locked && !isSelected && "hover:bg-surface-inset"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{opt.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{opt.summary}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {opt.recommended ? (
                      <Badge tone="primary" className="text-[10px]">
                        {opt.badge ?? "Önerilen"}
                      </Badge>
                    ) : null}
                    {locked ? (
                      <Badge tone="warning" className="text-[10px]">
                        <Lock className="mr-0.5 size-3" aria-hidden />
                        Atölye planında
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Kurulum ~{opt.setupMinutes} dk ·{" "}
                  <LiveIcons {...opt.live} />
                </p>
                {locked ? (
                  <Link
                    href="/billing?reason=cloud"
                    className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Planları karşılaştır →
                  </Link>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <Button type="button" variant="ghost" onClick={onBack}>
        Geri
      </Button>
    </div>
  );
}
