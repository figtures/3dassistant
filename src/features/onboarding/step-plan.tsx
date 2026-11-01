"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ds/button";
import { useEntitlements } from "@/hooks/use-entitlements";
import { PLANS, type PaidPlanKey } from "@/lib/billing/plans";
import { displayPriceLabel } from "@/lib/billing/prices";
import { parseSignupIntent } from "@/lib/billing/trial";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import type { OnboardingUserMetadata } from "@/features/onboarding/onboarding-state";

type StepPlanProps = {
  metadata: OnboardingUserMetadata;
  updateMetadata: (patch: Partial<OnboardingUserMetadata>) => Promise<void>;
  onFinish: () => void;
  onSkip: () => void;
};

export function StepPlan({ metadata, updateMetadata, onFinish, onSkip }: StepPlanProps) {
  const router = useRouter();
  const { data: ent, refetch } = useEntitlements();
  const [requestedPlan, setRequestedPlan] = useState<PaidPlanKey>("pro");
  const [trialBusy, setTrialBusy] = useState(false);

  useEffect(() => {
    track("onboarding_step", { step: "plan" });
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const intent = parseSignupIntent(
        user?.user_metadata as Record<string, unknown> | undefined
      );
      if (intent) setRequestedPlan(intent.plan);
    })();
  }, []);

  const plan = PLANS[requestedPlan];
  const isTrialing = ent?.entitlements.subscription?.status === "trialing";
  const planActive = ent?.entitlements.planKey === requestedPlan && isTrialing;

  async function startTrialIfNeeded() {
    setTrialBusy(true);
    try {
      const res = await fetch("/api/billing/trial/start", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Deneme başlatılamadı");
      }
      if (data.status === "started" || data.status === "existing") {
        await refetch();
        toast.success(`${plan.name} denemeniz aktif`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hata");
    } finally {
      setTrialBusy(false);
    }
  }

  async function continueWithTrial() {
    await startTrialIfNeeded();
    await updateMetadata({ planChoice: "paid" });
    track("onboarding_step", { step: "plan_trial" });
    onFinish();
  }

  async function continueFree() {
    await updateMetadata({ planChoice: "free_continue" });
    track("onboarding_step", { step: "plan_free" });
    onFinish();
  }

  function goToBilling() {
    void updateMetadata({ planChoice: "paid" });
    track("checkout_open", { source: "onboarding_plan" });
    router.push(`/settings/billing?plan=${requestedPlan}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Planınızı seçin</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {planActive
            ? `${plan.name} planında deneme süreniz devam ediyor. İstediğiniz zaman ödeme bilgisi ekleyebilirsiniz.`
            : `Önerilen plan: ${plan.name} — ${plan.tagline}. 14 gün ücretsiz deneyin veya ücretsiz katmanla devam edin.`}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-lg font-semibold text-foreground">{plan.name}</p>
        <p className="text-sm text-muted-foreground">{displayPriceLabel(requestedPlan, "month")}</p>
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {plan.features.slice(0, 3).map((f) => (
            <li key={f}>· {f}</li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {planActive ? (
          <Button type="button" onClick={() => void onFinish()}>
            Panele geç
          </Button>
        ) : (
          <Button type="button" loading={trialBusy} onClick={() => void continueWithTrial()}>
            14 gün ücretsiz dene
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={goToBilling}>
          Planı hemen satın al
        </Button>
        <Button type="button" variant="ghost" onClick={() => void continueFree()}>
          Ücretsiz devam et
        </Button>
        <Button type="button" variant="ghost" className="text-muted-foreground" onClick={onSkip}>
          Atla
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Tüm planları{" "}
        <Link href="/settings/billing" className="text-primary hover:underline">
          abonelik sayfasında
        </Link>{" "}
        karşılaştırabilirsiniz.
      </p>

      {trialBusy ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Deneme hazırlanıyor…
        </p>
      ) : null}
    </div>
  );
}
