import Image from "next/image";
import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ds/variants";
import { TRIAL_REGISTER_HREF } from "@/features/marketing/constants";
import { MarketingCtaLink } from "@/features/marketing/marketing-cta-link";

export function MarketingHero() {
  return (
    <section className="relative overflow-hidden border-b border-border pf-layer-lines">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-12 md:pb-20 md:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-1.5 text-sm text-muted-foreground">
            <span
              className="size-2 rounded-full bg-primary motion-safe:animate-pulse"
              aria-hidden
            />
            3D baskı atölyeleri için
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
            3D baskı atölyenizi tek ekrandan yönetin
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Siparişten teslimata, her yazıcının canlı durumu, filament stoğu ve
            tahsilat — Türkçe, atölyeler için.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <MarketingCtaLink
              cta="hero_trial"
              href={TRIAL_REGISTER_HREF}
              className={cn(
                buttonVariants({ variant: "primary", size: "lg" }),
                "min-w-[200px]"
              )}
            >
              14 gün ücretsiz dene
              <ArrowRight className="size-4" aria-hidden />
            </MarketingCtaLink>
            <Link
              href="#urun-onizleme"
              className={cn(
                buttonVariants({ variant: "secondary", size: "lg" }),
                "min-w-[200px]"
              )}
            >
              <PlayCircle className="size-4" aria-hidden />
              Canlı demoyu izle
            </Link>
          </div>
        </div>

        <div
          id="urun-onizleme"
          className="relative mx-auto mt-14 max-w-5xl scroll-mt-24 md:mt-16"
        >
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-lg,0_24px_48px_-12px_rgb(0_0_0/0.45))]">
            <Image
              src="/marketing/hero-fleet.webp"
              alt="3D Asisstant filo görünümü — yazıcı durumları ve atölye özeti"
              width={2400}
              height={1500}
              priority
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px"
              className="h-auto w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
