import { isUiV2 } from "@/lib/flags/ui-version.server";
import LoginLegacyPage from "@/legacy/pages/login-page";
import { LoginForm } from "@/features/auth/login-form";

export default async function LoginPage() {
  if (await isUiV2()) {
    return <LoginForm />;
  }
  return <LoginLegacyPage />;
}
