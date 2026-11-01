import { Cable, ClipboardList, PackageCheck } from "lucide-react";

const STEPS = [
  {
    icon: Cable,
    title: "Yazıcını bağla",
    description:
      "Bambu veya Creality bulut hesabınızı bağlayın; yerel yazıcılar için köprü kurulumunu tamamlayın.",
  },
  {
    icon: ClipboardList,
    title: "Siparişi gir",
    description:
      "Müşteri, parça, malzeme ve teslim tarihini planlama tablosuna işleyin; stok otomatik düşer.",
  },
  {
    icon: PackageCheck,
    title: "Teslim et",
    description:
      "Canlı durumla üretimi izleyin, teslim ve tahsilatı sipariş kartından kapatın.",
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="nasil-calisir"
      className="scroll-mt-24 border-b border-border py-16 md:py-20"
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Nasıl çalışır?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Üç adımda atölyenizi dijitalleştirin; kurulum rehberi uygulama içinde
            sizi yönlendirir.
          </p>
        </div>
        <ol className="grid gap-8 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, description }, index) => (
            <li key={title} className="relative flex flex-col gap-4">
              <span
                className="flex size-11 items-center justify-center rounded-xl border border-border bg-card text-primary"
                aria-hidden
              >
                <Icon className="size-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Adım {index + 1}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-foreground">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
