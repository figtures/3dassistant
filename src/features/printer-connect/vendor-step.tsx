"use client";

import { Cpu, Factory } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CONNECT_VENDOR_LABELS,
  CONNECT_VENDORS,
  type ConnectVendor,
} from "@/features/printer-connect/methods";

type VendorStepProps = {
  value: ConnectVendor | null;
  onSelect: (vendor: ConnectVendor) => void;
};

const VENDOR_HINTS: Record<ConnectVendor, string> = {
  bambu: "Bulut hesabı veya LAN köprüsü",
  creality: "Creality Cloud veya köprü",
  prusa: "PrusaLink — köprü önerilir",
  other: "Klipper, OctoPrint, Moonraker",
};

export function VendorStep({ value, onSelect }: VendorStepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Yazıcınızın markasını seçin; size en uygun bağlantı yöntemlerini sıralayacağız.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {CONNECT_VENDORS.map((vendor) => {
          const selected = value === vendor;
          return (
            <button
              key={vendor}
              type="button"
              onClick={() => onSelect(vendor)}
              className={cn(
                "flex min-h-[108px] flex-col items-start gap-2 rounded-xl border p-4 text-left transition",
                selected
                  ? "border-primary bg-primary-subtle ring-1 ring-primary/30"
                  : "border-border bg-card hover:border-primary/40 hover:bg-surface-inset"
              )}
            >
              <span className="flex items-center gap-2 text-base font-semibold text-foreground">
                {vendor === "other" ? (
                  <Cpu className="size-5 text-muted-foreground" aria-hidden />
                ) : (
                  <Factory className="size-5 text-muted-foreground" aria-hidden />
                )}
                {CONNECT_VENDOR_LABELS[vendor]}
              </span>
              <span className="text-xs text-muted-foreground">{VENDOR_HINTS[vendor]}</span>
              {vendor === "bambu" ? (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                  Önerilen
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
