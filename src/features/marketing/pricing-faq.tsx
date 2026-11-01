"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ds/accordion";

const BILLING_FAQ_ITEMS = [
  {
    id: "fatura",
    question: "Fatura ve ödeme nasıl işler?",
    answer:
      "Ücretli planlarda abonelik dönem sonunda otomatik yenilenir. Fatura ve kart bilgilerinizi kayıt sonrası abonelik ayarlarından veya güvenli ödeme sağlayıcımızın müşteri portalından yönetebilirsiniz. Kurumsal teklifler için iletişim formunu kullanın.",
  },
  {
    id: "iptal",
    question: "Denemeyi veya aboneliği iptal edebilir miyim?",
    answer:
      "Evet. Deneme süresinde veya aktif abonelikte istediğiniz zaman iptal edebilirsiniz. İptal, mevcut dönem sonunda geçerli olur; dönem bitene kadar plan haklarınız devam eder. Sonrasında hesabınız Ücretsiz seviyeye döner; verileriniz silinmez.",
  },
  {
    id: "kdv",
    question: "Fiyatlara KDV dahil mi?",
    answer:
      "Sitede gösterilen tutarlar bilgilendirme amaçlıdır ve KDV hariç olarak listelenir. Kesin tutar, fatura adresinize göre ödeme adımında görünür. Türkiye’deki işletmeler için geçerli vergi kuralları uygulanır.",
  },
  {
    id: "yillik",
    question: "Yıllık ödeme seçeneği var mı?",
    answer:
      "Yıllık faturalandırma, fiyat env yapılandırması tamamlandığında bu sayfada görünür. Yıllık planda genellikle iki ay bedel indirim uygulanır; güncel oran ödeme ekranında gösterilir.",
  },
] as const;

export function PricingBillingFaq() {
  return (
    <section id="fatura-sss" className="scroll-mt-24 border-t border-border py-16 md:py-20">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Fatura ve abonelik
          </h2>
          <p className="mt-3 text-muted-foreground">
            Ödeme, iptal ve vergilendirme hakkında sık sorulanlar
          </p>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {BILLING_FAQ_ITEMS.map(({ id, question, answer }) => (
            <AccordionItem key={id} value={id}>
              <AccordionTrigger>{question}</AccordionTrigger>
              <AccordionContent>{answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
