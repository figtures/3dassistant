"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getAuthCallbackUrl } from "@/lib/site-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function RegisterLegacyPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, company_name: companyName },
        emailRedirectTo: getAuthCallbackUrl("/dashboard"),
      },
    });

    if (error) {
      toast.error("Kayıt başarısız", { description: error.message });
      setLoading(false);
      return;
    }

    toast.success("Hesap oluşturuldu!", {
      description: "E-posta adresinize doğrulama linki gönderildi.",
    });
    router.push("/login?registered=1");
    router.refresh();
  }

  return (
    <div className="mesh-bg flex min-h-screen items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute -right-32 top-1/4 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative w-full max-w-md animate-fade-up">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>

        <Card glow>
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">Hesap oluşturun</CardTitle>
            <CardDescription>Ücretsiz başlayın, kredi kartı gerekmez</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Ad Soyad</Label>
                <Input
                  id="fullName"
                  placeholder="Ahmet Yılmaz"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">Firma Adı</Label>
                <Input
                  id="companyName"
                  placeholder="3D Print Studio"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  autoComplete="organization"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ornek@firma.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Şifre</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="En az 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="mt-2 w-full" size="lg" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kayıt Ol"}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-zinc-500">
              Zaten hesabınız var mı?{" "}
              <Link href="/login" className="font-medium text-sky-400 hover:text-sky-300">
                Giriş yapın
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
