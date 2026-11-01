"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, CardContent, Skeleton } from "@/components/ds";
import { buttonVariants } from "@/components/ds/variants";
import { PlanCards, type PlanCardRow } from "@/components/v2/billing/plan-cards";
import { useSupportReport } from "@/components/support/report-problem-modal";
import { HelpTitleRow } from "@/components/v2/help/contextual-help";
import {
  ENTITLEMENTS_QUERY_KEY,
  fetchEntitlements,
  useEntitlements,
} from "@/hooks/use-entitlements";
import { useConfirm } from "@/hooks/use-confirm";
import { formatDateTR } from "@/hooks/use-data";
import {
  AWAIT_POLL_MS,
  AWAIT_WEBHOOK_MS,
  initPaddleCheckout,
  isPaddleClientConfigured,
  openPaddleCheckout,
  setPaddleCheckoutCompletedHandler,
} from "@/lib/billing/paddle-checkout-client";
import {
  hasYearlyCheckoutPrices,
  type BillingInterval as CheckoutInterval,
  type PaidPlanKey,
  type PlanKey,
} from "@/lib/billing/plans";
import {
  hasYearlyDisplayPrices,
  planCardRows,
  type BillingInterval,
} from "@/lib/billing/prices";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { useRouter } from "next/navigation";

const STATUS_LABEL: Record<string, string> = {
  trialing: "Deneme",
  active: "Aktif",
  past_due: "Ödeme bekleniyor",
  canceled: "İptal edildi",
  paused: "Duraklatıldı",
};

type ApiPlan = {
  key: PaidPlanKey;
  purchasable: boolean;
  priceLabel: string | null;
};

const BILLING_FAQ = [
  {
    q: "Planım ne zaman yenilenir?",
    a: "Ücretli planlarda dönem sonunda aboneliğiniz otomatik yenilenir. Tarihi bu sayfadaki mevcut plan kartında görebilirsiniz.",
  },
  {
    q: "Plan değişikliği nasıl işler?",
    a: "Yükseltme veya düşürme, güvenli ödeme sağlayıcımız üzerinden orantılı olarak hesaplanır. Onay sonrası birkaç dakika içinde haklarınız güncellenir.",
  },
  {
    q: "Fatura ve ödeme yöntemini nereden yönetirim?",
    a: "Aktif aboneliğiniz varsa üstteki «Fatura ve ödeme yönetimi» bağlantısı müşteri portalını açar.",
  },
];

export function BillingV2() {
  return (
    <Suspense fallback={<BillingV2Skeleton />}>
      <BillingV2Content />
    </Suspense>
  );
}

function BillingV2Skeleton() {
  return (
    <div className="space-y-6 pb-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <Skeleton className="h-36 w-full rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-4">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

function BillingV2Content() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const confirmAction = useConfirm();
  const { openReport } = useSupportReport();

  const [interval, setInterval] = useState<BillingInterval>("month");
  const [awaitingPlan, setAwaitingPlan] = useState<PlanKey | null>(null);
  const [busyPlan, setBusyPlan] = useState<PaidPlanKey | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [paddleReady, setPaddleReady] = useState(false);
  const pendingPlanRef = useRef<PaidPlanKey | null>(null);
  const mountedRef = useRef(true);

  const showYearlyToggle = hasYearlyDisplayPrices() || hasYearlyCheckoutPrices();

  const { data: ent, isLoading: entLoading } = useEntitlements();
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ["billing-plans"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ plans: ApiPlan[]; billingAvailable: boolean }> => {
      const res = await fetch("/api/billing/plans");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Planlar alınamadı");
      return data;
    },
  });

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
    setPaddleCheckoutCompletedHandler(() => {
      track("checkout_complete", { plan: pendingPlanRef.current ?? "unknown" });
      router.replace("/settings/billing?checkout=success");
      if (pendingPlanRef.current) void waitForPlan(pendingPlanRef.current);
    });
    return () => {
      mountedRef.current = false;
      setPaddleCheckoutCompletedHandler(null);
    };
  }, [router, waitForPlan]);

  const planCards: PlanCardRow[] = useMemo(() => {
    const purchasableByKey = new Map<PaidPlanKey, boolean>();
    const apiPriceByKey = new Map<PaidPlanKey, string | null>();
    for (const p of plansData?.plans ?? []) {
      purchasableByKey.set(p.key, p.purchasable);
      apiPriceByKey.set(p.key, p.priceLabel);
    }
    const billingAvailable = plansData?.billingAvailable ?? false;

    return planCardRows(interval).map((row) => {
      if (row.key === "free") {
        return { ...row, purchasable: false };
      }
      const key = row.key as PaidPlanKey;
      const apiLabel = apiPriceByKey.get(key);
      const priceLabel =
        billingAvailable && apiLabel ? apiLabel : row.priceLabel;
      return {
        ...row,
        priceLabel,
        purchasable: Boolean(purchasableByKey.get(key) && billingAvailable),
      };
    });
  }, [interval, plansData]);

  async function choosePlan(plan: PaidPlanKey) {
    const sub = ent?.entitlements.subscription;
    if (sub?.hasPaddleSubscription && ent?.entitlements.planKey !== "free") {
      const ok = await confirmAction({
        title: "Plana geçilsin mi?",
        description: `${planCards.find((p) => p.key === plan)?.name ?? plan} planına geçiş, mevcut dönem için orantılı ücretlendirilir.`,
        confirmLabel: "Plana geç",
      });
      if (!ok) return;
    }

    setBusyPlan(plan);
    try {
      const checkoutInterval: CheckoutInterval = interval === "year" ? "year" : "month";
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval: checkoutInterval }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Ödeme başlatılamadı");

      if (data.mode === "updated") {
        toast.message(`${data.planName} planına geçiliyor…`);
        void waitForPlan(plan);
        return;
      }
      if (!paddleReady) {
        throw new Error("Ödeme penceresi yüklenemedi, sayfayı yenileyip tekrar deneyin");
      }
      pendingPlanRef.current = plan;
      track("checkout_open", { plan, source: "billing" });
      openPaddleCheckout(data.transactionId);
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

  if (entLoading || plansLoading || !ent) {
    return <BillingV2Skeleton />;
  }

  const { entitlements, usage, billingAvailable } = ent;
  const sub = entitlements.subscription;
  const reason = searchParams.get("reason");
  const checkoutSuccess = searchParams.get("checkout") === "success";
  const paddleScript = billingAvailable && isPaddleClientConfigured();

  return (
    <div className="space-y-8 pb-8">
      {paddleScript ? (
        <Script
          src="https://cdn.paddle.com/paddle/v2/paddle.js"
          strategy="afterInteractive"
          onReady={() => initPaddleCheckout(() => setPaddleReady(true))}
        />
      ) : null}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <HelpTitleRow>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Abonelik</h1>
          </HelpTitleRow>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Planınızı yönetin. Ödeme ve faturalar güvenli ödeme sağlayıcımız üzerinden işlenir.
          </p>
        </div>
        {sub?.hasPaddleSubscription ? (
          <Button variant="secondary" onClick={openPortal} disabled={portalBusy}>
            {portalBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <CreditCard className="h-4 w-4" aria-hidden />
            )}
            Fatura ve ödeme yönetimi
          </Button>
        ) : null}
      </header>

      {sub?.status === "past_due" ? (
        <div
          role="status"
          className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground"
        >
          Ödeme alınamadı — kart bilgisini güncelleyin. Hizmetleriniz ödeme yeniden alınana kadar
          açık kalır.
          {sub.hasPaddleSubscription ? (
            <button
              type="button"
              className="ml-1 font-medium underline hover:no-underline"
              onClick={() => void openPortal()}
            >
              Ödeme yöntemini güncelle
            </button>
          ) : null}
        </div>
      ) : null}

      {checkoutSuccess ? (
        <div
          role="status"
          className="rounded-xl border border-success/40 bg-success/10 px-4 py-4 text-sm text-foreground"
        >
          <p className="font-medium">Ödemeniz alındı</p>
          <p className="mt-1 text-muted-foreground">
            Planınız birkaç dakika içinde güncellenir. Sırada yazıcı bağlamak veya ilk siparişinizi
            oluşturmak var.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/machines/connect"
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
            >
              Yazıcı bağla
            </Link>
            <Link
              href="/orders?order=new"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              İlk sipariş
            </Link>
          </div>
        </div>
      ) : null}

      {reason === "cloud" && entitlements.cloudMonitoring === false ? (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
          Ücretsiz planda buluttan makine bağlama kilitlidir. Bambu / Creality canlı takibi için
          Atölye veya Filament Farm planına geçin.
        </div>
      ) : null}

      {awaitingPlan ? (
        <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-success" aria-hidden />
          Ödemeniz doğrulanıyor, planınız birazdan etkinleşecek…
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">{entitlements.planName}</h2>
            {sub ? (
              <Badge tone={sub.status === "past_due" ? "warning" : "primary"}>
                {STATUS_LABEL[sub.status] ?? sub.status}
              </Badge>
            ) : null}
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <UsageMeter used={usage.machines} max={entitlements.maxMachines} label="Makineler" />
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                Canlı yazıcı takibi:{" "}
                <span
                  className={
                    entitlements.cloudMonitoring ? "font-medium text-success" : "text-muted-foreground"
                  }
                >
                  {entitlements.cloudMonitoring
                    ? `açık (${usage.cloudMachines} yazıcı bağlı)`
                    : "planınızda yok"}
                </span>
              </p>
              {sub?.cancelAt ? (
                <p className="text-warning">Abonelik {formatDateTR(sub.cancelAt)} tarihinde sona erecek.</p>
              ) : null}
              {!sub?.cancelAt && sub?.currentPeriodEnd ? (
                <p>Sonraki yenileme: {formatDateTR(sub.currentPeriodEnd)}</p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {!billingAvailable ? (
        <Card className="border-dashed">
          <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
            <p>
              Online ödeme yakında. Planınızı yükseltmek için bize yazın — size en kısa sürede dönüş
              yapacağız.
            </p>
            <Button
              variant="secondary"
              onClick={() =>
                openReport({
                  category: "billing",
                  subject: "Plan yükseltme talebi",
                  description:
                    "Online ödeme henüz aktif değil. Uygun plan ve fiyatlandırma hakkında bilgi almak istiyorum.",
                })
              }
            >
              Destek talebi oluştur
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Planları karşılaştır</h2>
          {showYearlyToggle ? (
            <div
              className="inline-flex rounded-lg border border-border bg-surface-inset p-0.5"
              role="group"
              aria-label="Fatura dönemi"
            >
              <button
                type="button"
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  interval === "month"
                    ? "bg-surface-raised text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setInterval("month")}
              >
                Aylık
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  interval === "year"
                    ? "bg-surface-raised text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setInterval("year")}
              >
                Yıllık
              </button>
            </div>
          ) : null}
        </div>
        {interval === "year" && showYearlyToggle ? (
          <p className="text-xs text-muted-foreground">Yıllık ödemede 2 ay bedava (uygun planlarda).</p>
        ) : null}
        <PlanCards
          plans={planCards}
          currentPlan={entitlements.planKey}
          interval={interval}
          busyPlan={busyPlan}
          checkoutPending={awaitingPlan !== null}
          hasPaidSubscription={Boolean(sub?.hasPaddleSubscription)}
          onSelectPlan={(plan) => void choosePlan(plan)}
        />
        <p className="text-xs text-muted-foreground">
          Fiyatlar KDV hariç gösterilir. Kesin tutar ödeme adımında görünür.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Sık sorulan sorular</h2>
        <dl className="divide-y divide-border rounded-xl border border-border">
          {BILLING_FAQ.map((item) => (
            <div key={item.q} className="px-4 py-3">
              <dt className="text-sm font-medium text-foreground">{item.q}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground">
          Başka sorunuz mu var?{" "}
          <Link href="/support" className="font-medium text-primary hover:text-primary-hover">
            Destek taleplerine gidin
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

function UsageMeter({
  label,
  used,
  max,
}: {
  label: string;
  used: number;
  max: number;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 100;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums text-foreground">
          {used} / {max}
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={cn("h-full rounded-full transition-[width]", pct >= 100 ? "bg-warning" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
