"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getAuthCallbackUrl } from "@/lib/site-url";
import { humanizeAuthError } from "@/lib/errors/humanize";
import { Button } from "@/components/ds/button";
import { Input } from "@/components/ds/input";
import { FormField } from "@/components/ds/form-field";
import { AuthShell } from "@/features/auth/auth-shell";
import { PasswordInput } from "@/features/auth/password-input";
import { cn } from "@/lib/utils";
import { isPaidPlanKey, PLANS, type PaidPlanKey } from "@/lib/billing/plans";
import { track } from "@/lib/analytics";

function passwordHints(password: string) {
  return [
    { ok: password.length >= 6, label: "En az 6 karakter" },
    { ok: /[A-Za-z]/.test(password) && /\d/.test(password), label: "Harf ve rakam içermesi önerilir" },
  ];
}

function resolveSignupFromParams(searchParams: URLSearchParams): {
  plan: PaidPlanKey | null;
  trial: boolean;
} {
  const trial = searchParams.get("trial") === "1";
  const rawPlan = searchParams.get("plan");
  const plan = isPaidPlanKey(rawPlan) ? rawPlan : trial ? "pro" : null;
  return { plan, trial };
}

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const signupParams = useMemo(() => resolveSignupFromParams(searchParams), [searchParams]);

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | undefined>();

  const hints = useMemo(() => passwordHints(password), [password]);
  const trialPlanName =
    signupParams.plan != null ? PLANS[signupParams.plan].name : null;

  useEffect(() => {
    track("register_start", {
      trial: signupParams.trial,
      plan: signupParams.plan ?? "none",
    });
  }, [signupParams.plan, signupParams.trial]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setFormError(undefined);

    if (!acceptedLegal) {
      setFormError("Devam etmek için sözleşmeleri kabul etmelisiniz.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const metadata: Record<string, unknown> = {
      full_name: fullName,
      company_name: companyName,
    };
    if (signupParams.trial || signupParams.plan) {
      metadata.signup = {
        ...(signupParams.plan ? { plan: signupParams.plan } : {}),
        trial: signupParams.trial,
      };
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: getAuthCallbackUrl("/dashboard"),
      },
    });

    if (error) {
      const message = humanizeAuthError(error);
      setFormError(message);
      toast.error("Kayıt başarısız", { description: message });
      setLoading(false);
      return;
    }

    track("register_complete", {
      trial: signupParams.trial,
      plan: signupParams.plan ?? "none",
    });

    toast.success("Hesap oluşturuldu!", {
      description: "E-posta adresinize doğrulama linki gönderildi.",
    });
    router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    router.refresh();
  }

  return (
    <AuthShell
      title="Hesap oluşturun"
      description={
        signupParams.trial && trialPlanName
          ? `${trialPlanName} planında 14 gün ücretsiz deneyin — kredi kartı gerekmez`
          : "Ücretsiz başlayın, kredi kartı gerekmez"
      }
    >
      <form onSubmit={handleRegister} className="space-y-5" noValidate>
        <FormField label="Ad Soyad" required>
          {(field) => (
            <Input
              {...field}
              name="name"
              placeholder="Ahmet Yılmaz"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
            />
          )}
        </FormField>
        <FormField label="Firma adı">
          {(field) => (
            <Input
              {...field}
              name="organization"
              placeholder="3D Print Studio"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              autoComplete="organization"
            />
          )}
        </FormField>
        <FormField label="E-posta" required>
          {(field) => (
            <Input
              {...field}
              type="email"
              name="email"
              placeholder="ornek@firma.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          )}
        </FormField>
        <FormField
          label="Şifre"
          required
          error={formError}
          description="Şifre yöneticiniz bu alanı doldurabilir."
        >
          {(field) => (
            <div className="space-y-2">
              <PasswordInput
                {...field}
                name="password"
                placeholder="En az 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                autoComplete="new-password"
                required
              />
              <ul className="space-y-1 text-xs text-muted-foreground" aria-live="polite">
                {hints.map((hint) => (
                  <li
                    key={hint.label}
                    className={cn(hint.ok && password.length > 0 && "text-foreground")}
                  >
                    {hint.ok && password.length > 0 ? "✓" : "·"} {hint.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </FormField>
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug">
          <input
            type="checkbox"
            checked={acceptedLegal}
            onChange={(e) => setAcceptedLegal(e.target.checked)}
            className="mt-1 size-4 rounded border-border accent-primary"
            required
          />
          <span className="text-muted-foreground">
            <Link href="/legal/kvkk" className="text-primary hover:underline">
              KVKK aydınlatma metnini
            </Link>
            {" "}ve{" "}
            <Link href="/legal/terms" className="text-primary hover:underline">
              kullanım koşullarını
            </Link>{" "}
            okudum, kabul ediyorum.
          </span>
        </label>
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Kayıt Ol
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Zaten hesabınız var mı?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Giriş yapın
        </Link>
      </p>
    </AuthShell>
  );
}
