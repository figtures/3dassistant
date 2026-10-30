import { OnboardingWizard } from "@/features/onboarding/onboarding-wizard";

export const metadata = {
  title: "Kurulum",
};

export default function OnboardingPage() {
  return (
    <div className="space-y-2">
      <h1 className="sr-only">3D Asisstant kurulum sihirbazı</h1>
      <OnboardingWizard />
    </div>
  );
}
