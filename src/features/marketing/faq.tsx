"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ds/accordion";

const FAQ_ITEMS = [
  {
    id: "veriler",
    question: "Verilerim nerede tutuluyor?",
    answer:
      "Verileriniz Supabase üzerinde, hesabınıza özel satır düzeyinde güvenlik (RLS) ile ayrılır. KVKK aydınlatma metnine footer ve kayıt ekranından ulaşabilirsiniz.",
  },
  {
    id: "offline",
    question: "İnternet kesilirse ne olur?",
    answer:
      "Planlama, stok ve sipariş kayıtları çevrimiçi çalışır; bağlantı gelince senkron devam eder. Yerel köprü ile bağlı yazıcılar atölye ağında çalışmaya devam edebilir; bulut senkronu bağlantıya bağlıdır.",
  },
  {
    id: "yazicilar",
    question: "Hangi yazıcıları destekliyorsunuz?",
    answer:
      "Bambu Lab ve Creality için bulut bağlantısı, Klipper/OctoPrint ve yerel köprü ile diğer yazıcılar desteklenir. Detaylı uyumluluk listesi kayıt sonrası sihirbazda güncellenir.",
  },
  {
    id: "iptal",
    question: "Denemeyi veya aboneliği nasıl iptal ederim?",
    answer:
      "Abonelik ayarlarından istediğiniz zaman iptal edebilirsiniz. Deneme süresi bitmeden iptal ederseniz dönem sonuna kadar erişiminiz devam eder; fatura dönemi sonrası planınız Ücretsiz seviyeye döner.",
  },
] as const;

export function MarketingFaq() {
  return (
    <section id="sss" className="scroll-mt-24 border-b border-border py-16 md:py-20">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Sık sorulan sorular
          </h2>
          <p className="mt-3 text-muted-foreground">
            Kayıt öncesi merak edilen konular
          </p>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {FAQ_ITEMS.map(({ id, question, answer }) => (
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
