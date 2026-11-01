import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  CalendarRange,
  Headphones,
  Mic,
  Printer,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ds/variants";
import { TRIAL_REGISTER_HREF } from "@/features/marketing/constants";

type BentoFeature = {
  icon: typeof Printer;
  title: string;
  description: string;
  span: string;
  featured?: boolean;
  image?: string;
};

const FEATURES: BentoFeature[] = [
  {
    icon: Printer,
    title: "Canlı filo",
    description:
      "Yazıcı durumu, ilerleme ve uyarılar tek panelde; bulut senkronu ile güncel kalır.",
    span: "md:col-span-2 md:row-span-2",
    featured: true,
    image: "/marketing/hero-fleet.webp",
  },
  {
    icon: CalendarRange,
    title: "Üretim planı",
    description: "Tarih × makine tablosu ile iş emirlerini net sıraya koyun.",
    span: "",
    image: "/marketing/feature-planning.webp",
  },
  {
    icon: Boxes,
    title: "Filament stoğu",
    description: "Malzeme tüketimi ve kritik stok uyarıları planlamayla bağlı.",
    span: "",
  },
  {
    icon: Receipt,
    title: "Sipariş ve tahsilat",
    description: "Müşteri, teslim ve ödeme durumunu siparişten takip edin.",
    span: "",
    image: "/marketing/feature-orders.webp",
  },
  {
    icon: Mic,
    title: "Sesle sipariş",
    description: "Türkçe sesli giriş ile not ve alanları hızlı doldurun.",
    span: "",
  },
  {
    icon: Headphones,
    title: "Türkçe destek",
    description: "Arayüz, hata mesajları ve destek kanalları Türkçe.",
    span: "md:col-span-2",
  },
];

export function FeatureBento() {
  return (
    <section
      id="ozellikler"
      className="scroll-mt-24 border-b border-border py-16 md:py-20"
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Atölyenizin ihtiyaç duyduğu parçalar bir arada
          </h2>
          <p className="mt-3 text-muted-foreground">
            Planlamadan canlı takibe, stoktan tahsilata — abartılı vaatler
            olmadan günlük iş akışınız için.
          </p>
        </div>

        <div className="grid auto-rows-[minmax(180px,auto)] grid-cols-1 gap-4 md:grid-cols-3 md:auto-rows-[220px]">
          {FEATURES.map(
            ({ icon: Icon, title, description, span, featured, image }) => (
              <article
                key={title}
                className={cn(
                  "relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-6",
                  span,
                  featured && "min-h-[320px] md:min-h-0"
                )}
              >
                {featured && image ? (
                  <div className="pointer-events-none absolute inset-0 opacity-40">
                    <Image
                      src={image}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 100vw, 66vw"
                      className="object-cover object-top"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/90 to-card/40" />
                  </div>
                ) : null}
                {!featured && image ? (
                  <div className="pointer-events-none absolute right-0 top-0 h-32 w-40 opacity-20">
                    <Image
                      src={image}
                      alt=""
                      fill
                      sizes="160px"
                      className="object-cover object-left-top"
                    />
                  </div>
                ) : null}
                <div className="relative z-10">
                  <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
              </article>
            )
          )}

          <div className="flex flex-col justify-between rounded-2xl border border-border bg-primary p-6 text-primary-foreground md:col-span-1">
            <p className="text-sm font-medium opacity-90">Hemen başlayın</p>
            <div>
              <p className="text-xl font-semibold leading-snug">
                14 gün Atölye planını deneyin
              </p>
              <Link
                href={TRIAL_REGISTER_HREF}
                className={cn(
                  buttonVariants({ variant: "secondary", size: "md" }),
                  "mt-4 inline-flex bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                )}
              >
                Ücretsiz dene
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
