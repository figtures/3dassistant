"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CreditCard, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ENTITLEMENTS_QUERY_KEY,
  fetchEntitlements,
  useEntitlements,
} from "@/hooks/use-entitlements";
import { formatDateTR } from "@/hooks/use-data";
import { cn } from "@/lib/utils";
import type { PaidPlanKey, PlanKey } from "@/lib/billing/plans";

type PlanCard = {
  key: PaidPlanKey;
  name: string;
  tagline: string;
  features: string[];
  maxMachines: number;
  cloudMonitoring: boolean;
  priceLabel: string | null;
  purchasable: boolean;
};

type PaddleGlobal = {
  Environment: { set: (env: string) => void };
  Initialize: (opts: {
    token: string;
    eventCallback?: (event: { name?: string }) => void;
  }) => void;
  Checkout: {
    open: (opts: {
      transactionId: string;
      settings?: { displayMode?: "overlay"; locale?: string; theme?: "dark" | "light" };
    }) => void;
  };
};

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

const STATUS_LABEL: Record<string, string> = {
  trialing: "Deneme",
  active: "Aktif",
  past_due: "Ödeme bekleniyor",
  canceled: "İptal edildi",
  paused: "Duraklatıldı",
};

const PADDLE_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
const PADDLE_ENV = process.env.NEXT_PUBLIC_PADDLE_ENV === "production" ? "production" : "sandbox";
const AWAIT_WEBHOOK_MS = 90_000;
const AWAIT_POLL_MS = 3_000;

// Paddle.Initialize sayfa ömrü boyunca bir kez çağrılabilir; sayfaya her dönüşte yalnızca dinleyici güncellenir.
let paddleInitialized = false;
let onCheckoutCompleted: (() => void) | null = null;

export default function BillingPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <BillingContent />
    </Suspense>
  );
}

function BillingContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [awaitingPlan, setAwaitingPlan] = useState<PlanKey | null>(null);
  const [busyPlan, setBusyPlan] = useState<PaidPlanKey | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [paddleReady, setPaddleReady] = useState(false);
  const pendingPlanRef = useRef<PaidPlanKey | null>(null);

  const { data: ent, isLoading: entLoading } = useEntitlements();
  const mountedRef = useRef(true);
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ["billing-plans"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ plans: PlanCard[]; billingAvailable: boolean }> => {
      const res = await fetch("/api/billing/plans");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Planlar alınamadı");
      return data;
    },
  });

  const currentPlan = ent?.entitlements.planKey;

  /** Plan hakkı yalnızca Paddle webhook'u ile yazılır; tarayıcı yalnızca sonucu bekler. */
  const waitForPlan = useCallback(
    async (plan: PlanKey) => {
      setAwaitingPlan(plan);
      const deadline = Date.now() + AWAIT_WEBHOOK_MS;
      while (mountedRef.current && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, AWAIT_POLL_MS));
        const fresh = await queryClient
          .fetchQuery({ queryKey: ENTITLEMENTS_QUERY_KEY, queryFn: fetchEntitlements, staleTime: 0 })
          .catch(() => null);
        if (fresh?.entitlements.planKey === plan) {
          if (!mountedRef.current) return;
          setAwaitingPlan(null);
          toast.success("Planınız güncellendi");
          queryClient.invalidateQueries({ queryKey: ["machines"] });
          return;
        }
      }
      if (!mountedRef.current) return;
      setAwaitingPlan(null);
      toast.message("Ödemeniz alındı; planınız birkaç dakika içinde etkinleşecek.");
    },
    [queryClient]
  );

  useEffect(() => {
    mountedRef.current = true;
    onCheckoutCompleted = () => {
      if (pendingPlanRef.current) void waitForPlan(pendingPlanRef.current);
    };
    return () => {
      mountedRef.current = false;
      onCheckoutCompleted = null;
    };
  }, [waitForPlan]);

  const initPaddle = useCallback(() => {
    const paddle = window.Paddle;
    if (!paddle || !PADDLE_TOKEN) return;
    if (!paddleInitialized) {
      if (PADDLE_ENV === "sandbox") paddle.Environment.set("sandbox");
      paddle.Initialize({
        token: PADDLE_TOKEN,
        eventCallback: (event) => {
          if (event.name === "checkout.completed") onCheckoutCompleted?.();
        },
      });
      paddleInitialized = true;
    }
    setPaddleReady(true);
  }, []);

  async function choosePlan(plan: PaidPlanKey) {
    setBusyPlan(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Ödeme başlatılamadı");

      if (data.mode === "updated") {
        toast.message(`${data.planName} planına geçiliyor…`);
        void waitForPlan(plan);
        return;
      }
      if (!window.Paddle || !paddleReady) {
        throw new Error("Ödeme penceresi yüklenemedi, sayfayı yenileyip tekrar deneyin");
      }
      pendingPlanRef.current = plan;
      window.Paddle.Checkout.open({
        transactionId: data.transactionId,
        settings: { displayMode: "overlay", locale: "tr", theme: "dark" },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hata");
    } finally {
      setBusyPlan(null);
    }
  }

  async function openPortal() {
    setPortalBusy(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Yönetim sayfası açılamadı");
      window.location.href = data.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hata");
      setPortalBusy(false);
    }
  }

  if (entLoading || plansLoading || !ent) return <PageLoader />;

  const { entitlements, usage, billingAvailable } = ent;
  const sub = entitlements.subscription;
  const reason = searchParams.get("reason");

  return (
    <div className="space-y-8">
      {billingAvailable && PADDLE_TOKEN && (
        <Script
          src="https://cdn.paddle.com/paddle/v2/paddle.js"
          strategy="afterInteractive"
          onReady={initPaddle}
        />
      )}

      <PageHeader
        title="Abonelik"
        description="Planınızı seçin. Ödeme ve faturalar Paddle üzerinden güvenle yönetilir."
        action={
          sub?.hasPaddleSubscription ? (
            <Button variant="outline" onClick={openPortal} disabled={portalBusy}>
              {portalBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Ödeme ve faturalar
            </Button>
          ) : null
        }
      />

      {reason === "cloud" && entitlements.cloudMonitoring === false && (
        <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-200">
          Ücretsiz planda buluttan makine bağlama kilitlidir. Bambu / Creality canlı takibi için
          Atölye veya Filament Farm planına geçin.
        </div>
      )}

      {awaitingPlan && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          Ödemeniz doğrulanıyor, planınız birazdan etkinleşecek…
        </div>
      )}

      <section className="glass rounded-2xl p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-100">{entitlements.planName}</h2>
          {sub && <Badge variant={sub.status === "past_due" ? "warning" : "primary"}>{STATUS_LABEL[sub.status] ?? sub.status}</Badge>}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <UsageBar label="Makineler" used={usage.machines} max={entitlements.maxMachines} />
          <div className="text-sm text-zinc-400">
            <p>
              Canlı yazıcı takibi:{" "}
              <span className={entitlements.cloudMonitoring ? "text-emerald-400" : "text-zinc-500"}>
                {entitlements.cloudMonitoring ? `açık (${usage.cloudMachines} yazıcı bağlı)` : "planınızda yok"}
              </span>
            </p>
            {sub?.cancelAt && (
              <p className="mt-1 text-amber-400">Abonelik {formatDateTR(sub.cancelAt)} tarihinde sona erecek.</p>
            )}
            {!sub?.cancelAt && sub?.currentPeriodEnd && (
              <p className="mt-1">Sonraki yenileme: {formatDateTR(sub.currentPeriodEnd)}</p>
            )}
            {sub?.status === "past_due" && (
              <p className="mt-1 text-amber-400">Son ödeme alınamadı. Kesinti olmaması için ödeme yönteminizi güncelleyin.</p>
            )}
          </div>
        </div>
      </section>

      {!billingAvailable && (
        <p className="text-sm text-zinc-500">
          Online ödeme şu an kullanılamıyor. Plan değişikliği için destek ekibiyle iletişime geçin.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {(plansData?.plans ?? []).map((plan) => {
          const isCurrent = currentPlan === plan.key;
          return (
            <div
              key={plan.key}
              className={cn(
                "glass flex flex-col rounded-2xl p-5",
                isCurrent && "ring-1 ring-sky-500/40"
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-zinc-100">{plan.name}</h3>
                {plan.cloudMonitoring && (
                  <Badge variant="success" className="text-[10px]">
                    <Sparkles className="mr-1 h-3 w-3" /> Canlı takip
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-zinc-500">{plan.tagline}</p>
              <p className="mt-4 text-2xl font-semibold text-zinc-50">{plan.priceLabel ?? "—"}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-zinc-300">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-5 w-full"
                variant={isCurrent ? "secondary" : "default"}
                disabled={isCurrent || !plan.purchasable || busyPlan !== null || awaitingPlan !== null}
                onClick={() => choosePlan(plan.key)}
              >
                {busyPlan === plan.key ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isCurrent ? (
                  "Mevcut plan"
                ) : sub?.hasPaddleSubscription && entitlements.planKey !== "free" ? (
                  "Bu plana geç"
                ) : (
                  "Abone ol"
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UsageBar({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 100;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-200">
          {used} / {max}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={cn("h-full rounded-full", pct >= 100 ? "bg-amber-500" : "bg-sky-500")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
