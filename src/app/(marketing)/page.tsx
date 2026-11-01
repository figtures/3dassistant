import type { Metadata } from "next";
import { FeatureBento } from "@/features/marketing/feature-bento";
import { MarketingFaq } from "@/features/marketing/faq";
import { FinalCta } from "@/features/marketing/final-cta";
import { MarketingHero } from "@/features/marketing/hero";
import { HowItWorks } from "@/features/marketing/how-it-works";
import { PricingTeaser } from "@/features/marketing/pricing-teaser";
import { TrustStrip } from "@/features/marketing/trust-strip";

export const metadata: Metadata = {
  title: "3D baskı atölyenizi tek ekrandan yönetin",
  description:
    "Siparişten teslimata canlı yazıcı takibi, planlama, stok ve tahsilat — 3D Asisstant, Türkçe atölye yazılımı.",
  openGraph: {
    title: "3D Asisstant — 3D baskı atölye yazılımı",
    description:
      "Canlı filo, üretim planı ve stok tek platformda. 14 gün ücretsiz deneyin.",
  },
};

export default function MarketingHomePage() {
  return (
    <>
      <MarketingHero />
      <TrustStrip />
      <FeatureBento />
      <HowItWorks />
      <PricingTeaser />
      <MarketingFaq />
      <FinalCta />
    </>
  );
}
