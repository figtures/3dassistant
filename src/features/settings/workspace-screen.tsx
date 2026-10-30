"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  FormField,
  Input,
  Textarea,
} from "@/components/ds";
import { HelpTitleRow } from "@/components/v2/help/contextual-help";
import { SettingsFormFooter } from "@/features/settings/settings-form-footer";
import { WORKSPACE_TIMEZONES } from "@/lib/settings/workspace-billing-meta";

type WorkspacePayload = {
  name: string;
  taxNumber: string;
  billingAddress: string;
  timezone: string;
  currency: string;
  canEdit: boolean;
};

const selectClassName =
  "flex h-[var(--density-control-h)] w-full rounded-lg border border-input bg-surface-inset px-3 text-sm text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]";

export function WorkspaceSettingsScreen() {
  const [initial, setInitial] = useState<WorkspacePayload | null>(null);
  const [name, setName] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [timezone, setTimezone] = useState("Europe/Istanbul");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/settings/workspace");
    const data = (await res.json().catch(() => ({}))) as WorkspacePayload & {
      error?: string;
    };
    if (!res.ok) {
      toast.error("Çalışma alanı yüklenemedi", { description: data.error });
      setLoading(false);
      return;
    }
    setInitial(data);
    setName(data.name ?? "");
    setTaxNumber(data.taxNumber ?? "");
    setBillingAddress(data.billingAddress ?? "");
    setTimezone(data.timezone || "Europe/Istanbul");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty =
    initial !== null &&
    (name.trim() !== (initial.name ?? "").trim() ||
      taxNumber.trim() !== (initial.taxNumber ?? "").trim() ||
      billingAddress.trim() !== (initial.billingAddress ?? "").trim() ||
      timezone !== (initial.timezone || "Europe/Istanbul"));

  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  async function save() {
    if (!initial?.canEdit) return;
    setSaving(true);
    const res = await fetch("/api/settings/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        taxNumber: taxNumber.trim(),
        billingAddress: billingAddress.trim(),
        timezone,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      toast.error("Kaydedilemedi", { description: data.error });
      return;
    }
    toast.success("Çalışma alanı güncellendi");
    await load();
  }

  if (loading) {
    return (
      <div className="space-y-4 pb-8">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const readOnly = !initial?.canEdit;

  return (
    <div className="space-y-8 pb-8">
      <header className="space-y-1">
        <HelpTitleRow>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Çalışma alanı
          </h1>
        </HelpTitleRow>
        <p className="max-w-xl text-sm text-muted-foreground">
          Firma bilgileri fatura ve resmi belgeler için kullanılır.
        </p>
      </header>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">Genel</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Firma / atölye adı">
            {(field) => (
              <Input
                {...field}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={readOnly}
                autoComplete="organization"
              />
            )}
          </FormField>
          <p className="text-sm text-muted-foreground">
            Logo yükleme yakında eklenecek.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">Fatura bilgileri</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Vergi numarası">
            {(field) => (
              <Input
                {...field}
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
                disabled={readOnly}
                inputMode="numeric"
              />
            )}
          </FormField>
          <FormField label="Fatura adresi">
            {(field) => (
              <Textarea
                {...field}
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                disabled={readOnly}
                rows={3}
              />
            )}
          </FormField>
          <FormField label="Saat dilimi">
            {(field) => (
              <select
                {...field}
                className={selectClassName}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                disabled={readOnly}
              >
                {WORKSPACE_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <FormField label="Para birimi">
            {(field) => (
              <Input {...field} value="TRY (₺)" disabled readOnly />
            )}
          </FormField>
          {readOnly ? (
            <p className="text-sm text-muted-foreground">
              Bu bilgileri yalnızca sahip ve yönetici rolleri düzenleyebilir.
            </p>
          ) : null}
          <SettingsFormFooter
            dirty={dirty && !readOnly}
            saving={saving}
            onSave={() => void save()}
            onDiscard={() => {
              if (!initial) return;
              setName(initial.name);
              setTaxNumber(initial.taxNumber);
              setBillingAddress(initial.billingAddress);
              setTimezone(initial.timezone || "Europe/Istanbul");
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
