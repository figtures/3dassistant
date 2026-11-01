"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { track } from "@/lib/analytics";

type MarketingCtaLinkProps = ComponentProps<typeof Link> & {
  cta: string;
};

export function MarketingCtaLink({ cta, href, onClick, ...rest }: MarketingCtaLinkProps) {
  return (
    <Link
      href={href}
      {...rest}
      onClick={(e) => {
        track("cta_click", { cta, href: typeof href === "string" ? href : "" });
        onClick?.(e);
      }}
    />
  );
}
