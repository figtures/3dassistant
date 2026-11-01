"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Minus, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ds/variants";
import { FormField } from "@/components/ds/form-field";
import { Input } from "@/components/ds/input";
import { Textarea } from "@/components/ds/textarea";
import { TRIAL_REGISTER_HREF } from "@/features/marketing/constants";
import {
  hasYearlyDisplayPrices,
  planCardRows,
  type BillingInterval,
} from "@/lib/billing/prices";
import { hasYearlyCheckoutPrices } from "@/lib/billing/plans";
import { PLANS, type PlanKey } from "@/lib/billing/plans";

const PLAN_COLUMNS: PlanKey[] = ["free", "starter", "pro", "farm"];

type ComparisonRow = {
  id: string;
  label: string;
  type: "text" | "bool";
  value: (key: PlanKey) => string | boolean;
};

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    id: "machines",
    label: "Maksimum makine",
    type: "text",
    value: (key) => String(PLANS[key].maxMachines),
  },
  {
    id: "cloud",
    label: "Canlı bulut yazıcı takibi",
    type: "bool",
    value: (key) => PLANS[key].cloudMonitoring,
  },
  {
    id: "sync",
    label: "Bulut senkron kapasitesi",
    type: "text",
    value: (key) => {
      const n = PLANS[key].syncPerTick;
      return n > 0 ? `${n} yazıcı / döngü` : "—";
    },
  },
  {
    id: "planning",
    label: "Planlama, stok ve müşteri",
    type: "bool",
    value: () => true,
  },
  {
    id: "procurement",
    label: "Tedarik ve katalog",
    type: "bool",
    value: (key) => key !== "free",
  },
];

function CellValue({ row, planKey }: { row: ComparisonRow; planKey: PlanKey }) {
  const raw = row.value(planKey);
  if (row.type === "text") {
    return <span className="text-sm text-foreground">{String(raw)}</span>;
  }
  if (raw) {
    return (
      <Check className="mx-auto size-4 text-primary" aria-label="Dahil" />
    );
  }
  return (
    <Minus className="mx-auto size-4 text-muted-foreground" aria-label="Dahil değil" />
  );
}

function BillingIntervalToggle({
  interval,
  onChange,
}: {
  interval: BillingInterval;
  onChange: (v: BillingInterval) => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-border bg-surface-inset p-0.5"
      role="group"
      aria-label="Fatura dönemi"
    >
      <button
        type="button"
        className={cn(
          "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          interval === "month"
            ? "bg-surface-raised text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => onChange("month")}
      >
        Aylık
      </button>
      <button
        type="button"
        className={cn(
          "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          interval === "year"
            ? "bg-surface-raised text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => onChange("year")}
      >
        Yıllık
      </button>
    </div>
  );
}

function EnterpriseContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState(
    "40+ makine veya çok lokasyonlu üretim için teklif almak istiyorum."
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          company: company.trim() || undefined,
          message,
          topic: "enterprise",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Gönderilemedi");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <p className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-foreground">
        Teşekkürler. Mesajınız alındı; en kısa sürede size dönüş yapacağız.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
      <FormField label="Ad Soyad" required>
        {(props) => (
          <Input
            {...props}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            required
          />
        )}
      </FormField>
      <FormField label="E-posta" required>
        {(props) => (
          <Input
            {...props}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            required
          />
        )}
      </FormField>
      <FormField label="Firma / atölye" className="sm:col-span-2">
        {(props) => (
          <Input
            {...props}
            autoComplete="organization"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            disabled={busy}
          />
        )}
      </FormField>
      <FormField label="Mesajınız" required className="sm:col-span-2">
        {(props) => (
          <Textarea
            {...props}
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={busy}
            required
          />
        )}
      </FormField>
      {error ? (
        <p className="sm:col-span-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className={cn(buttonVariants({ variant: "primary", size: "md" }), "gap-2")}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
          Teklif iste
        </button>
      </div>
    </form>
  );
}

export function PricingTable() {
  const showYearlyToggle =
    hasYearlyDisplayPrices() || hasYearlyCheckoutPrices();
  const [interval, setInterval] = useState<BillingInterval>("month");

  const plans = useMemo(() => planCardRows(interval), [interval]);

  return (
    <div className="space-y-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            14 gün deneme · Kredi kartı gerekmez
          </p>
          {showYearlyToggle ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Yıllık ödemede 2 ay bedava (uygun planlarda)
            </p>
          ) : null}
        </div>
        {showYearlyToggle ? (
          <BillingIntervalToggle interval={interval} onChange={setInterval} />
        ) : null}
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
            <p className="text-sm text-muted-foreground">{plan.tagline}</p>
            <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
              {plan.priceLabel}
            </p>
            <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
              {plan.features.map((feature) => (
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
              {plan.key === "free" ? "Ücretsiz başla" : "Denemeyi başlat"}
            </Link>
          </li>
        ))}
      </ul>

      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Özellik karşılaştırması
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Plan limitleri tek kaynak olan plan tanımlarından üretilir.
        </p>
        <div className="mt-6 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <caption className="sr-only">
              Plan özellikleri karşılaştırma tablosu
            </caption>
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th scope="col" className="px-4 py-3 font-medium text-foreground">
                  Özellik
                </th>
                {PLAN_COLUMNS.map((key) => (
                  <th
                    key={key}
                    scope="col"
                    className={cn(
                      "px-4 py-3 text-center font-medium",
                      key === "pro" ? "text-primary" : "text-foreground"
                    )}
                  >
                    {PLANS[key].name}
                    {key === "pro" ? (
                      <span className="mt-0.5 block text-xs font-normal text-primary">
                        Önerilen
                      </span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <th scope="row" className="px-4 py-3 font-normal text-muted-foreground">
                    {row.label}
                  </th>
                  {PLAN_COLUMNS.map((key) => (
                    <td key={key} className="px-4 py-3 text-center">
                      <CellValue row={row} planKey={key} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Gösterilen fiyatlar bilgilendirme amaçlıdır; KDV hariçtir. Kesin tutar ödeme
          adımında görünür.
        </p>
      </div>

      <section
        id="kurumsal"
        className="scroll-mt-24 rounded-2xl border border-border bg-muted/15 p-6 md:p-8"
        aria-labelledby="enterprise-heading"
      >
        <h2 id="enterprise-heading" className="text-xl font-semibold text-foreground">
          Kurumsal
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          <strong className="font-medium text-foreground">40+ makine</strong>, çok
          lokasyon veya özel SLA ihtiyacınız varsa Filament Farm planının üzerinde
          size özel paket hazırlıyoruz. Formu doldurun; satış ekibimiz sizinle iletişime
          geçsin.
        </p>
        <EnterpriseContactForm />
      </section>
    </div>
  );
}
