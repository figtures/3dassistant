"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error("Giriş başarısız", { description: error.message });
      setLoading(false);
      return;
    }

    toast.success("Hoş geldiniz!");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mesh-bg flex min-h-screen items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute -left-32 top-1/3 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />

      <div className="relative w-full max-w-md animate-fade-up">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>

        <Card glow>
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">Tekrar hoş geldiniz</CardTitle>
            <CardDescription>Hesabınıza giriş yapın</CardDescription>
          </CardHeader>
          <CardContent>
            {registered && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                <p className="text-sm leading-relaxed text-sky-300/90">
                  Kayıt tamamlandı. E-postanızdaki doğrulama linkine tıklayın, ardından giriş yapın.
                </p>
              </div>
            )}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ornek@firma.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Şifre</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="mt-2 w-full" size="lg" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Giriş Yap"}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-zinc-500">
              Hesabınız yok mu?{" "}
              <Link href="/register" className="font-medium text-sky-400 hover:text-sky-300">
                Kayıt olun
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
