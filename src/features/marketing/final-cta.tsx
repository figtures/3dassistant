import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ds/variants";
import { TRIAL_REGISTER_HREF } from "@/features/marketing/constants";

export function FinalCta() {
  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center pf-layer-lines md:px-12">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Atölyenizi bir sonraki baskıya hazırlayın
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            14 gün boyunca Atölye planını ücretsiz deneyin. Kredi kartı
            gerekmez; kurulum birkaç dakika sürer.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={TRIAL_REGISTER_HREF}
              className={cn(
                buttonVariants({ variant: "primary", size: "lg" }),
                "min-w-[220px]"
              )}
            >
              14 gün ücretsiz dene
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "ghost", size: "lg" }),
                "min-w-[220px]"
              )}
            >
              Zaten hesabım var
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
