"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ds";
import { buttonVariants } from "@/components/ds/variants";
import { useSupportReport } from "@/components/support/report-problem-modal";
import {
  ENTITLEMENTS_QUERY_KEY,
  fetchEntitlements,
  useEntitlements,
} from "@/hooks/use-entitlements";
import { track } from "@/lib/analytics";
import {
  FEATURE_COPY,
  featureUnlockSummary,
  suggestedUpgradePlan,
} from "@/lib/billing/features";
import {
  AWAIT_POLL_MS,
  AWAIT_WEBHOOK_MS,
  initPaddleCheckout,
  isPaddleClientConfigured,
  openPaddleCheckout,
  setPaddleCheckoutCompletedHandler,
} from "@/lib/billing/paddle-checkout-client";
import type { PaidPlanKey } from "@/lib/billing/plans";
import { displayPriceLabel } from "@/lib/billing/prices";
import { useUpgradePromptStore } from "@/lib/billing/upgrade-prompt-store";

export function UpgradePromptHost() {
  const open = useUpgradePromptStore((s) => s.open);
  const payload = useUpgradePromptStore((s) => s.payload);
  const close = useUpgradePromptStore((s) => s.close);
  const queryClient = useQueryClient();
  const { data: ent } = useEntitlements();
  const { openReport } = useSupportReport();

  const [busy, setBusy] = useState(false);
  const [paddleReady, setPaddleReady] = useState(false);
  const pendingPlanRef = useRef<PaidPlanKey | null>(null);
  const mountedRef = useRef(true);

  const { data: plansData } = useQuery({
    queryKey: ["billing-plans"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await fetch("/api/billing/plans");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Planlar alınamadı");
      return data as { billingAvailable: boolean };
    },
    enabled: open,
  });

  const feature = payload?.feature ?? "cloud_sync";
  const copy = FEATURE_COPY[feature];
  const currentPlan = ent?.entitlements.planKey ?? "free";
  const targetPlan = suggestedUpgradePlan(currentPlan, feature);
  const priceLabel = useMemo(
    () => displayPriceLabel(targetPlan, "month"),
    [targetPlan]
  );

  const billingAvailable =
    Boolean(plansData?.billingAvailable) && isPaddleClientConfigured();

  useEffect(() => {
    if (!open || !payload) return;
    track("upgrade_prompt_shown", { feature: payload.feature, plan: targetPlan });
  }, [open, payload, targetPlan]);

  useEffect(() => {
    mountedRef.current = true;
    setPaddleCheckoutCompletedHandler(() => {
      track("checkout_complete", { plan: pendingPlanRef.current ?? "unknown", source: "upgrade" });
      if (typeof window !== "undefined") {
        window.location.assign("/settings/billing?checkout=success");
      }
      if (pendingPlanRef.current) {
        void waitForPlan(pendingPlanRef.current);
      }
    });
    return () => {
      mountedRef.current = false;
      setPaddleCheckoutCompletedHandler(null);
    };
  }, []);

  async function waitForPlan(plan: PaidPlanKey) {
    const deadline = Date.now() + AWAIT_WEBHOOK_MS;
    while (mountedRef.current && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, AWAIT_POLL_MS));
      const fresh = await queryClient
        .fetchQuery({
          queryKey: ENTITLEMENTS_QUERY_KEY,
          queryFn: fetchEntitlements,
          staleTime: 0,
        })
        .catch(() => null);
      if (fresh?.entitlements.planKey === plan) {
        toast.success("Planınız güncellendi");
        queryClient.invalidateQueries({ queryKey: ["machines"] });
        close();
        return;
      }
    }
    toast.message("Ödemeniz alındı; plan birkaç dakika içinde etkinleşecek.");
    close();
  }

  async function handleUpgrade() {
    track("upgrade_click", { feature, plan: targetPlan });
    if (!billingAvailable) {
      openReport({
        category: "billing",
        subject: "Plan yükseltme",
        description: payload?.message
          ? `Plan yükseltme isteği (${feature}): ${payload.message}`
          : `Plan yükseltme isteği: ${copy.title}`,
      });
      close();
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: targetPlan, interval: "month" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Ödeme başlatılamadı");
      if (data.mode === "updated") {
        toast.message(`${data.planName ?? targetPlan} planına geçiliyor…`);
        void waitForPlan(targetPlan);
        return;
      }
      if (!paddleReady) {
        throw new Error("Ödeme penceresi yüklenemedi, sayfayı yenileyip tekrar deneyin");
      }
      pendingPlanRef.current = targetPlan;
      track("checkout_open", { plan: targetPlan, source: "upgrade" });
      openPaddleCheckout(data.transactionId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hata");
    } finally {
      setBusy(false);
    }
  }

  const planDefName =
    targetPlan === "starter"
      ? "Starter"
      : targetPlan === "pro"
        ? "Atölye"
        : "Filament Farm";

  return (
    <>
      {billingAvailable ? (
        <Script
          src="https://cdn.paddle.com/paddle/v2/paddle.js"
          strategy="lazyOnload"
          onLoad={() => initPaddleCheckout(() => setPaddleReady(true))}
        />
      ) : null}
      <Dialog open={open} onOpenChange={(next) => !next && close()}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>
              {payload?.message ?? copy.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-lg border border-border bg-surface-inset px-4 py-3 text-sm">
            <p className="font-medium text-foreground">
              Önerilen plan: {planDefName}
            </p>
            <p className="text-muted-foreground">
              {featureUnlockSummary(feature, targetPlan)}
            </p>
            <p className="tabular-nums text-foreground">{priceLabel}</p>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => close()}>
              Kapat
            </Button>
            <Link
              href="/billing"
              className={buttonVariants({ variant: "secondary" })}
            >
              Planları karşılaştır
            </Link>
            <Button type="button" onClick={() => void handleUpgrade()} disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Yükleniyor…
                </>
              ) : billingAvailable ? (
                "Yükselt"
              ) : (
                "Bize yazın"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
