"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { humanizeAuthError } from "@/lib/errors/humanize";
import { Button } from "@/components/ds/button";
import { Input } from "@/components/ds/input";
import { FormField } from "@/components/ds/form-field";
import { AuthShell } from "@/features/auth/auth-shell";
import { PasswordInput } from "@/features/auth/password-input";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered") === "1";
  const authError = searchParams.get("error") === "auth_callback_failed";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(undefined);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const message = humanizeAuthError(error);
      setFieldError(message);
      toast.error("Giriş başarısız", { description: message });
      setLoading(false);
      return;
    }

    toast.success("Hoş geldiniz!");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell title="Tekrar hoş geldiniz" description="Hesabınıza giriş yapın">
      {registered ? (
        <div
          className="mb-6 flex items-start gap-3 rounded-lg border border-border bg-primary-subtle px-4 py-3"
          role="status"
        >
          <Mail className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p className="text-sm leading-relaxed text-foreground">
            Kayıt tamamlandı. E-postanızdaki doğrulama linkine tıklayın, ardından giriş yapın.
          </p>
        </div>
      ) : null}
      {authError ? (
        <p className="mb-6 text-sm text-destructive" role="alert">
          Oturum açılamadı. Lütfen tekrar giriş yapın veya şifrenizi sıfırlayın.
        </p>
      ) : null}
      <form onSubmit={handleLogin} className="space-y-5" noValidate>
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
        <FormField label="Şifre" required error={fieldError}>
          {(field) => (
            <div className="space-y-2">
              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Şifremi unuttum
                </Link>
              </div>
              <PasswordInput
                {...field}
                name="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          )}
        </FormField>
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Giriş Yap
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Hesabınız yok mu?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Kayıt olun
        </Link>
      </p>
    </AuthShell>
  );
}

export function LoginForm() {
  return (
    <Suspense>
      <LoginFormInner />
    </Suspense>
  );
}
