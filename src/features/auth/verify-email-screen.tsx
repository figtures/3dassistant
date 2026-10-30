"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { humanizeAuthError } from "@/lib/errors/humanize";
import { Button } from "@/components/ds/button";
import { buttonVariants } from "@/components/ds/variants";
import { cn } from "@/lib/utils";
import { AuthShell } from "@/features/auth/auth-shell";

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [loading, setLoading] = useState(false);

  async function resend() {
    if (!email) {
      toast.error("E-posta adresi bulunamadı");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    setLoading(false);

    if (error) {
      toast.error("Gönderilemedi", { description: humanizeAuthError(error) });
      return;
    }

    toast.success("Doğrulama e-postası tekrar gönderildi");
  }

  return (
    <AuthShell title="Gelen kutunuzu kontrol edin">
      <div className="space-y-6">
        <div
          className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-4"
          role="status"
        >
          <Mail className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            {email ? (
              <p>
                <strong className="text-foreground">{email}</strong> adresine bir doğrulama
                bağlantısı gönderdik. Hesabınızı etkinleştirmek için e-postadaki linke tıklayın.
              </p>
            ) : (
              <p>
                Kayıt işleminiz tamamlandı. E-postanızdaki doğrulama linkine tıklayarak hesabınızı
                etkinleştirin.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            loading={loading}
            disabled={!email}
            onClick={() => void resend()}
          >
            Doğrulama e-postasını tekrar gönder
          </Button>
          <Link
            href="/login"
            className={cn(buttonVariants({ size: "lg" }), "flex-1 text-center")}
          >
            Giriş sayfasına git
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}

export function VerifyEmailScreen() {
  return (
    <Suspense>
      <VerifyEmailInner />
    </Suspense>
  );
}
