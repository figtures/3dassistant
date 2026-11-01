import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ds/variants";
import { planCardRows } from "@/lib/billing/prices";
import { TRIAL_REGISTER_HREF } from "@/features/marketing/constants";

export function PricingTeaser() {
  const plans = planCardRows("month");

  return (
    <section className="border-b border-border bg-muted/15 py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">
              Atölyenize uygun plan
            </h2>
            <p className="mt-3 text-muted-foreground">
              Ücretsiz deneyin, büyüdükçe yükseltin. Fiyatlar tek kaynaktan
              gelir; ayrıntılı karşılaştırma fiyatlandırma sayfasında.
            </p>
          </div>
          <Link
            href="/pricing"
            className={cn(
              buttonVariants({ variant: "secondary", size: "md" }),
              "shrink-0"
            )}
          >
            Tüm planları gör
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <li
              key={plan.key}
              className={cn(
                "flex flex-col rounded-2xl border bg-card p-5",
                plan.recommended
                  ? "border-primary shadow-[0_0_0_1px_var(--primary)]"
                  : "border-border"
              )}
            >
              {plan.recommended ? (
                <span className="mb-3 w-fit rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Önerilen
                </span>
              ) : (
                <span className="mb-3 h-5" aria-hidden />
              )}
              <h3 className="text-lg font-semibold text-foreground">
                {plan.name}
              </h3>
              <p className="text-sm text-muted-foreground">{plan.tagline}</p>
              <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                {plan.priceLabel}
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
                {plan.features.slice(0, 3).map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-primary"
                      aria-hidden
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={
                  plan.key === "free"
                    ? "/register"
                    : plan.recommended
                      ? TRIAL_REGISTER_HREF
                      : `/register?plan=${plan.key}`
                }
                className={cn(
                  buttonVariants({
                    variant: plan.recommended ? "primary" : "secondary",
                    size: "md",
                  }),
                  "mt-6 w-full"
                )}
              >
                {plan.key === "free" ? "Ücretsiz başla" : "Planı seç"}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
