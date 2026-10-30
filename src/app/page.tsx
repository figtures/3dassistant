import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { FeatureIcon } from "@/components/ui/icon-box";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Cuboid,
  FileSpreadsheet,
  Mic,
  Printer,
  ShieldCheck,
} from "lucide-react";

const features = [
  {
    icon: CalendarDays,
    title: "Planlama Tablosu",
    desc: "Tarih × makine grid ile iş emirlerinizi Excel benzeri görünümde yönetin.",
  },
  {
    icon: BarChart3,
    title: "Canlı Dashboard",
    desc: "Çoklu filtreli metrikler ve grafiklerle işletmenizi analiz edin.",
  },
  {
    icon: Cuboid,
    title: "3D Önizleme",
    desc: "STL dosyalarını uygulama içinde anında açıp inceleyin.",
  },
  {
    icon: Mic,
    title: "Sesli Not",
    desc: "Türkçe sesli giriş ile not ekleyin, alanlar otomatik dolsun.",
  },
  {
    icon: ShieldCheck,
    title: "Güvenli & İzole",
    desc: "Her hesap yalnızca kendi verisini görür. Supabase RLS koruması.",
  },
  {
    icon: FileSpreadsheet,
    title: "Excel Entegrasyonu",
    desc: "Müşteri listesini şablon ile toplu içe ve dışa aktarın.",
  },
];

export default function HomePage() {
  return (
    <div className="mesh-bg relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -left-32 top-20 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-20 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />

      <nav className="relative z-10 flex items-center justify-between px-6 py-5 lg:px-12">
        <Logo size="md" />
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Giriş
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm">
              Başla
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </nav>

      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-20 pt-12 text-center lg:pt-20">
        <div className="animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-700/60 bg-zinc-900/60 px-4 py-1.5 text-xs font-medium text-zinc-400 ring-1 ring-zinc-800/80">
          <Printer className="h-3.5 w-3.5 text-sky-400" strokeWidth={2} />
          3D Baskı Firmaları İçin
        </div>

        <h1 className="animate-fade-up animate-fade-up-delay-1 text-4xl font-semibold leading-tight tracking-tight text-zinc-50 sm:text-5xl lg:text-6xl">
          İşletmenizi{" "}
          <span className="gradient-text">tek platformda</span>
          <br />
          profesyonelce yönetin
        </h1>

        <p className="animate-fade-up animate-fade-up-delay-2 mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          Makineler, malzemeler, müşteriler ve iş emirlerinizi takip edin.
          Dashboard, planlama tablosu ve 3D görüntüleyici ile tam kontrol sizde.
        </p>

        <div className="animate-fade-up animate-fade-up-delay-3 mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/register">
            <Button size="lg" className="min-w-[180px]">
              Ücretsiz Başla
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg" className="min-w-[180px]">
              Giriş Yap
            </Button>
          </Link>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass glass-hover group rounded-2xl p-6">
              <FeatureIcon icon={Icon} />
              <h3 className="font-medium text-zinc-100">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-zinc-800/60 py-6 text-center text-xs text-zinc-600">
        © 2026 3D Asisstant — 3D atölye ERP
      </footer>
    </div>
  );
}
