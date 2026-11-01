import { Suspense } from "react";
import { isUiV2 } from "@/lib/flags/ui-version.server";
import RegisterLegacyPage from "@/legacy/pages/register-page";
import { RegisterForm } from "@/features/auth/register-form";
import { Skeleton } from "@/components/ds/skeleton";

export default async function RegisterPage() {
  if (await isUiV2()) {
    return (
      <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-md" />}>
        <RegisterForm />
      </Suspense>
    );
  }
  return <RegisterLegacyPage />;
}
