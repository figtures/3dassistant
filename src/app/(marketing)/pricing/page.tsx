import type { Metadata } from "next";
import { FinalCta } from "@/features/marketing/final-cta";
import { PricingBillingFaq } from "@/features/marketing/pricing-faq";
import { PricingTable } from "@/features/marketing/pricing-table";

export const metadata: Metadata = {
  title: "Fiyatlandırma",
  description:
    "3D Asisstant planları: ücretsiz deneme, Atölye canlı yazıcı takibi, Filament Farm ve kurumsal teklif. Türkçe atölye yazılımı fiyatları.",
  openGraph: {
    title: "Fiyatlandırma · 3D Asisstant",
    description:
      "Atölyenize uygun planı seçin. 14 gün ücretsiz deneyin; yıllık faturalandırma ve kurumsal teklifler.",
  },
};

export default function PricingPage() {
  return (
    <>
      <section className="border-b border-border py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Şeffaf fiyatlandırma
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Küçük atölyeden filament farmına kadar aynı platform. Canlı yazıcı takibi
            için <span className="text-foreground">Atölye</span> planı önerilir; büyük
            filolar için kurumsal teklif alın.
          </p>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4">
          <PricingTable />
        </div>
      </section>

      <PricingBillingFaq />
      <FinalCta />
    </>
  );
}
