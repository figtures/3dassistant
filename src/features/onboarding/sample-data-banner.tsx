"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ds/button";
import { toast } from "sonner";
import { useSampleDataPresence } from "@/features/onboarding/use-sample-data";

export type SampleDataBannerProps = {
  className?: string;
};

export function SampleDataBanner({ className }: SampleDataBannerProps) {
  const queryClient = useQueryClient();
  const { data: hasSample = false, isLoading } = useSampleDataPresence();
  const [clearing, setClearing] = useState(false);

  if (isLoading || !hasSample) return null;

  async function handleClear() {
    setClearing(true);
    try {
      const res = await fetch("/api/onboarding/sample-data", { method: "DELETE" });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Örnek veriler silinemedi");
        return;
      }
      toast.success("Örnek veriler temizlendi");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sample-data"] }),
        queryClient.invalidateQueries({ queryKey: ["machines"] }),
        queryClient.invalidateQueries({ queryKey: ["materials"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["entitlements"] }),
      ]);
    } catch {
      toast.error("Örnek veriler silinemedi");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div
      className={
        className ??
        "flex flex-col gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      }
      role="status"
    >
      <div className="flex gap-3 text-sm text-muted-foreground">
        <FlaskConical className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
        <p>
          <span className="font-medium text-foreground">Örnek verilerle</span> çalışıyorsunuz.
          Gerçek kayıtlarınız etkilenmez; yalnızca demo kayıtları silinir.
        </p>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        loading={clearing}
        onClick={() => void handleClear()}
      >
        Temizle
      </Button>
    </div>
  );
}
