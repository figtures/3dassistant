"use client";

import { useEffect, useMemo } from "react";
import { SetupChecklist, type SetupChecklistStep } from "@/components/v2/onboarding/setup-checklist";
import {
  shouldShowSetupChecklist,
  type OnboardingStepId,
} from "@/features/onboarding/onboarding-state";
import { useOnboarding } from "@/features/onboarding/use-onboarding";
import { Skeleton } from "@/components/ds/skeleton";
import { cn } from "@/lib/utils";

const STEP_COPY: Record<
  OnboardingStepId,
  { description: string; actionLabel: string }
> = {
  connect_printer: {
    description:
      "Bulut hesabı, atölye köprüsü veya elle ekleme ile yazıcınızı bağlayın; canlı durum ve ilerlemeyi takip edin.",
    actionLabel: "Yazıcı bağla",
  },
  add_machine: {
    description:
      "Atölyenizdeki yazıcıları kaydedin. Bağlı yazıcı yoksa önce bağlantıyı tamamlayın.",
    actionLabel: "Makine ekle",
  },
  add_material: {
    description:
      "Kullandığınız filament türlerini ve renk stoklarını ekleyin; siparişlerde otomatik seçilsin.",
    actionLabel: "Filament ekle",
  },
  first_order: {
    description:
      "İlk siparişinizi oluşturun; planlama ve teslim takviminde görünsün.",
    actionLabel: "Sipariş oluştur",
  },
  add_customer: {
    description:
      "Müşteri kaydı açın; sipariş ve tahsilat takibini kolaylaştırın.",
    actionLabel: "Müşteri ekle",
  },
  choose_plan: {
    description:
      "İhtiyacınıza uygun planı seçin veya ücretsiz planda devam edin.",
    actionLabel: "Planları gör",
  },
  invite_team: {
    description: "Ekibinizi davet ederek aynı atölyede birlikte çalışın.",
    actionLabel: "Ekip davet et",
  },
};

export type SetupChecklistCardProps = {
  className?: string;
};

export function SetupChecklistCard({ className }: SetupChecklistCardProps) {
  const {
    progress,
    metadata,
    isLoading,
    dismissOnboarding,
    updateMetadata,
  } = useOnboarding();

  const visible = useMemo(
    () =>
      shouldShowSetupChecklist({
        dismissed: progress.dismissed,
        isComplete: progress.isComplete,
        setupCompletedAt: metadata.setupCompletedAt,
      }),
    [progress.dismissed, progress.isComplete, metadata.setupCompletedAt]
  );

  useEffect(() => {
    if (!progress.isComplete || metadata.setupCompletedAt) return;
    void updateMetadata({ setupCompletedAt: new Date().toISOString() });
  }, [progress.isComplete, metadata.setupCompletedAt, updateMetadata]);

  const steps: SetupChecklistStep[] = useMemo(
    () =>
      progress.steps
        .filter((s) => s.status !== "hidden")
        .map((step) => ({
          ...step,
          ...STEP_COPY[step.id],
          href:
            step.id === "add_material"
              ? "/materials?new=1"
              : step.href,
        })),
    [progress.steps]
  );

  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border bg-card p-4",
          className
        )}
        aria-busy
        aria-label="Kurulum kontrol listesi yükleniyor"
      >
        <Skeleton className="mb-3 h-5 w-40" />
        <Skeleton className="mb-2 h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!visible) return null;

  return (
    <SetupChecklist
      className={className}
      steps={steps}
      completedCount={progress.completed}
      totalCount={progress.total}
      isComplete={progress.isComplete}
      onHide={() => void dismissOnboarding()}
    />
  );
}
