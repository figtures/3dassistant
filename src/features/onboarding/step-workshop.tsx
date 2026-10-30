"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ds/button";
import { FormField } from "@/components/ds/form-field";
import { Input } from "@/components/ds/input";
import {
  planRecommendationText,
  type MachineCountRange,
} from "@/features/onboarding/plan-recommendation";
import type { OnboardingUserMetadata } from "@/features/onboarding/onboarding-state";
import { toast } from "sonner";

const RANGES: { value: MachineCountRange; label: string }[] = [
  { value: "1-2", label: "1–2 makine" },
  { value: "3-8", label: "3–8 makine" },
  { value: "9-40", label: "9–40 makine" },
  { value: "40+", label: "40+ makine" },
];

const USAGE_OPTIONS = [
  { value: "customer_orders", label: "Müşteri siparişleri" },
  { value: "own_products", label: "Kendi ürünlerim" },
  { value: "both", label: "İkisi de" },
];

type StepWorkshopProps = {
  initialCompanyName?: string;
  metadata: OnboardingUserMetadata;
  onSaved: () => void;
  onSkip: () => void;
  updateMetadata: (patch: Partial<OnboardingUserMetadata>) => Promise<void>;
};

export function StepWorkshop({
  initialCompanyName = "",
  metadata,
  onSaved,
  onSkip,
  updateMetadata,
}: StepWorkshopProps) {
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [range, setRange] = useState<MachineCountRange>(
    (metadata.workshop?.machineCountRange as MachineCountRange) ?? "1-2"
  );
  const [usage, setUsage] = useState(metadata.workshop?.usage ?? "both");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCompanyName(initialCompanyName);
  }, [initialCompanyName]);

  async function handleContinue() {
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Oturum bulunamadı");
      setSaving(false);
      return;
    }

    const trimmed = companyName.trim();
    if (trimmed) {
      const { error } = await supabase
        .from("profiles")
        .update({ company_name: trimmed })
        .eq("id", user.id);
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
    }

    try {
      await updateMetadata({
        workshop: { machineCountRange: range, usage },
      });
      onSaved();
    } catch {
      toast.error("Bilgiler kaydedilemedi. Tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFreePlan() {
    await updateMetadata({ planChoice: "free_continue" });
    toast.success("Ücretsiz planla devam edeceksiniz");
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Atölyeniz</h2>
        <p className="text-sm text-muted-foreground">
          Birkaç bilgi ile size uygun önerileri gösterelim.
        </p>
      </header>

      <FormField label="Firma / atölye adı">
        {(field) => (
          <Input
            {...field}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Örn. Katman Atölye"
            autoComplete="organization"
          />
        )}
      </FormField>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Kaç yazıcınız var?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {RANGES.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-subtle"
            >
              <input
                type="radio"
                name="machine-range"
                value={opt.value}
                checked={range === opt.value}
                onChange={() => setRange(opt.value)}
                className="size-4 accent-[var(--primary)]"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Ana kullanım</legend>
        <div className="space-y-2">
          {USAGE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-subtle"
            >
              <input
                type="radio"
                name="usage"
                value={opt.value}
                checked={usage === opt.value}
                onChange={() => setUsage(opt.value)}
                className="size-4 accent-[var(--primary)]"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        {planRecommendationText(range)}{" "}
        <Link href="/billing" className="font-medium text-primary hover:text-primary-hover">
          Planları incele
        </Link>
        {" · "}
        <button
          type="button"
          onClick={() => void handleFreePlan()}
          className="font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
        >
          Ücretsizle devam et
        </button>
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onSkip}>
          Atla
        </Button>
        <Button type="button" loading={saving} onClick={() => void handleContinue()}>
          Devam
        </Button>
      </div>
    </div>
  );
}
