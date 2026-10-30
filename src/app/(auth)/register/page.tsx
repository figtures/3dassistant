import { isUiV2 } from "@/lib/flags/ui-version.server";
import RegisterLegacyPage from "@/legacy/pages/register-page";
import { RegisterForm } from "@/features/auth/register-form";

export default async function RegisterPage() {
  if (await isUiV2()) {
    return <RegisterForm />;
  }
  return <RegisterLegacyPage />;
}
