"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { HelpTitleRow } from "@/components/v2/help/contextual-help";

/** P3-13 ile `src/content/changelog.ts` verisine bağlanacak */
export function ChangelogScreen() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      <header className="space-y-1">
        <HelpTitleRow>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <Sparkles className="size-6 text-primary" aria-hidden />
            Yenilikler
          </h1>
        </HelpTitleRow>
        <p className="text-sm text-muted-foreground">
          Sürüm notları yakında burada listelenecek. Güncellemeleri takip etmek için{" "}
          <Link href="/support" className="font-medium text-primary hover:text-primary-hover">
            destek
          </Link>{" "}
          sayfasından bize yazabilirsiniz.
        </p>
      </header>
    </div>
  );
}
