import { Suspense } from "react";
import { OnboardingWizard } from "@/features/onboarding/onboarding-wizard";
import { Skeleton } from "@/components/ds/skeleton";

export const metadata = {
  title: "Kurulum",
};

export default function OnboardingPage() {
  return (
    <div className="space-y-2">
      <h1 className="sr-only">3D Asisstant kurulum sihirbazı</h1>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <OnboardingWizard />
      </Suspense>
    </div>
  );
}
