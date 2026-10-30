"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { humanizeAuthError } from "@/lib/errors/humanize";
import { Button } from "@/components/ds/button";
import { FormField } from "@/components/ds/form-field";
import { AuthShell } from "@/features/auth/auth-shell";
import { PasswordInput } from "@/features/auth/password-input";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);

    if (password !== confirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalıdır.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (updateError) {
      const message = humanizeAuthError(updateError);
      setError(message);
      toast.error("Şifre güncellenemedi", { description: message });
      return;
    }

    toast.success("Şifreniz güncellendi");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell title="Yeni şifre belirleyin" description="Hesabınız için güçlü bir şifre seçin.">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <FormField label="Yeni şifre" required>
          {(field) => (
            <PasswordInput
              {...field}
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              autoComplete="new-password"
              required
            />
          )}
        </FormField>
        <FormField label="Yeni şifre (tekrar)" required error={error}>
          {(field) => (
            <PasswordInput
              {...field}
              name="password-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={6}
              autoComplete="new-password"
              required
            />
          )}
        </FormField>
        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Şifreyi kaydet
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Giriş sayfasına dön
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
