"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getAuthCallbackUrl } from "@/lib/site-url";
import { humanizeAuthError } from "@/lib/errors/humanize";
import { Button } from "@/components/ds/button";
import { buttonVariants } from "@/components/ds/variants";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ds/input";
import { FormField } from "@/components/ds/form-field";
import { AuthShell } from "@/features/auth/auth-shell";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthCallbackUrl("/reset-password"),
    });

    setLoading(false);

    if (resetError) {
      const message = humanizeAuthError(resetError);
      setError(message);
      toast.error("Gönderilemedi", { description: message });
      return;
    }

    setSent(true);
    toast.success("E-posta gönderildi", {
      description: "Şifre sıfırlama bağlantısı gelen kutunuza iletildi.",
    });
  }

  return (
    <AuthShell
      title="Şifrenizi mi unuttunuz?"
      description="Kayıtlı e-posta adresinize sıfırlama bağlantısı göndeririz."
    >
      {sent ? (
        <div className="space-y-6" role="status">
          <p className="text-sm leading-relaxed text-muted-foreground">
            <strong className="text-foreground">{email}</strong> adresine bir bağlantı gönderdik.
            Gelen kutunuzu ve istenmeyen klasörünü kontrol edin.
          </p>
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full")}
          >
            Giriş sayfasına dön
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <FormField label="E-posta" required error={error}>
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
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Sıfırlama bağlantısı gönder
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-primary hover:underline">
              Giriş sayfasına dön
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
