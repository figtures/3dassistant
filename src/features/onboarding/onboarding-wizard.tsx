"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  OnboardingStepper,
  type WizardStep,
} from "@/components/v2/onboarding/stepper";
import { useOnboarding } from "@/features/onboarding/use-onboarding";
import { StepWorkshop } from "@/features/onboarding/step-workshop";
import { StepPrinters } from "@/features/onboarding/step-printers";
import { StepMaterials } from "@/features/onboarding/step-materials";
import { StepFirstOrder } from "@/features/onboarding/step-first-order";
import { Skeleton } from "@/components/ds/skeleton";

const WIZARD_STEPS: WizardStep[] = [
  { id: "workshop", label: "Atölyeniz" },
  { id: "printers", label: "Yazıcılar" },
  { id: "materials", label: "Filament" },
  { id: "first_order", label: "İlk sipariş" },
];

export function OnboardingWizard() {
  const router = useRouter();
  const { metadata, isLoading, updateMetadata, skipStep } = useOnboarding();
  const [stepIndex, setStepIndex] = useState(0);
  const [companyName, setCompanyName] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        setProfileLoading(false);
        return;
      }
      const fromMeta = (user.user_metadata?.company_name as string | undefined)?.trim();
      if (fromMeta) {
        setCompanyName(fromMeta);
        setProfileLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_name")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setCompanyName(profile?.company_name?.trim() ?? "");
        setProfileLoading(false);
      }
    }
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const finish = useCallback(async () => {
    await updateMetadata({ wizardCompletedAt: new Date().toISOString() });
    router.push("/dashboard?welcome=1");
    router.refresh();
  }, [router, updateMetadata]);

  const goNext = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, WIZARD_STEPS.length - 1));
  }, []);

  const skipWizardStep = useCallback(
    async (relatedChecklistId?: Parameters<typeof skipStep>[0]) => {
      if (relatedChecklistId) {
        await skipStep(relatedChecklistId);
      }
      if (stepIndex >= WIZARD_STEPS.length - 1) {
        await finish();
      } else {
        goNext();
      }
    },
    [finish, goNext, skipStep, stepIndex]
  );

  if (isLoading || profileLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full max-w-2xl" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <OnboardingStepper steps={WIZARD_STEPS} currentIndex={stepIndex} />

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        {stepIndex === 0 ? (
          <StepWorkshop
            initialCompanyName={companyName}
            metadata={metadata}
            updateMetadata={updateMetadata}
            onSaved={goNext}
            onSkip={() => void skipWizardStep()}
          />
        ) : null}
        {stepIndex === 1 ? (
          <StepPrinters
            onContinue={goNext}
            onSkip={() => void skipWizardStep("add_machine")}
          />
        ) : null}
        {stepIndex === 2 ? (
          <StepMaterials
            onContinue={goNext}
            onSkip={() => void skipWizardStep("add_material")}
          />
        ) : null}
        {stepIndex === 3 ? (
          <StepFirstOrder
            onFinish={() => void finish()}
            onSkip={() => void skipWizardStep("first_order")}
          />
        ) : null}
      </div>
    </div>
  );
}
