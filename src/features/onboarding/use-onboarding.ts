"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  useCustomers,
  useJobs,
  useMachines,
  useMaterials,
} from "@/hooks/use-data";
import { useEntitlements } from "@/hooks/use-entitlements";
import {
  computeOnboarding,
  mergeOnboardingMetadata,
  type OnboardingProgress,
  type OnboardingStepId,
  type OnboardingUserMetadata,
} from "@/features/onboarding/onboarding-state";

const ONBOARDING_USER_KEY = ["onboarding", "user"] as const;

async function fetchOnboardingUserMetadata(): Promise<OnboardingUserMetadata> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const raw = user?.user_metadata?.onboarding;
  if (raw && typeof raw === "object") {
    return raw as OnboardingUserMetadata;
  }
  return {};
}

export function useOnboarding(): {
  progress: OnboardingProgress;
  metadata: OnboardingUserMetadata;
  isLoading: boolean;
  dismissOnboarding: () => Promise<void>;
  skipStep: (id: OnboardingStepId) => Promise<void>;
  updateMetadata: (patch: Partial<OnboardingUserMetadata>) => Promise<void>;
  refresh: () => void;
} {
  const queryClient = useQueryClient();
  const { data: machines = [], isLoading: machinesLoading } = useMachines();
  const { data: materials = [], isLoading: materialsLoading } = useMaterials();
  const { data: jobs = [], isLoading: jobsLoading } = useJobs();
  const { data: customers = [], isLoading: customersLoading } = useCustomers();
  const { data: entitlements, isLoading: entLoading } = useEntitlements();

  const { data: metadata = {}, isLoading: metaLoading } = useQuery({
    queryKey: ONBOARDING_USER_KEY,
    queryFn: fetchOnboardingUserMetadata,
  });

  const progress = useMemo(
    () =>
      computeOnboarding({
        machines,
        materialsCount: materials.length,
        jobsCount: jobs.length,
        customersCount: customers.length,
        planKey: entitlements?.entitlements.planKey ?? "free",
        metadata,
        showInviteTeam: false,
      }),
    [machines, materials.length, jobs.length, customers.length, entitlements, metadata]
  );

  const updateMetadata = useCallback(
    async (patch: Partial<OnboardingUserMetadata>) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const merged = mergeOnboardingMetadata(user.user_metadata, patch);
      await supabase.auth.updateUser({ data: merged });
      await queryClient.invalidateQueries({ queryKey: ONBOARDING_USER_KEY });
    },
    [queryClient]
  );

  const dismissOnboarding = useCallback(async () => {
    await updateMetadata({ dismissedAt: new Date().toISOString() });
  }, [updateMetadata]);

  const skipStep = useCallback(
    async (id: OnboardingStepId) => {
      const skipped = new Set(metadata.skipped ?? []);
      skipped.add(id);
      await updateMetadata({ skipped: [...skipped] });
    },
    [metadata.skipped, updateMetadata]
  );

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ONBOARDING_USER_KEY });
  }, [queryClient]);

  return {
    progress,
    metadata,
    isLoading:
      machinesLoading ||
      materialsLoading ||
      jobsLoading ||
      customersLoading ||
      entLoading ||
      metaLoading,
    dismissOnboarding,
    skipStep,
    updateMetadata,
    refresh,
  };
}
