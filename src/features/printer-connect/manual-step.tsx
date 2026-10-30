"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useMachines } from "@/hooks/use-data";
import { Button, FormField, Input } from "@/components/ds";
import type { MachineStatus } from "@/types/database";

const STATUS_LABELS: Record<MachineStatus, string> = {
  active: "Aktif",
  maintenance: "Bakımda",
  offline: "Kapalı",
};

type ManualStepProps = {
  onSaved: (machineId: string) => void;
  onBack?: () => void;
};

export function ManualStep({ onSaved, onBack }: ManualStepProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: machines = [] } = useMachines();
  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [status, setStatus] = useState<MachineStatus>("active");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Makine adı gerekli");
      return;
    }
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

    const { data, error } = await supabase
      .from("machines")
      .insert({
        name: name.trim(),
        model: model.trim() || null,
        status,
        user_id: user.id,
        sort_order: machines.length,
      })
      .select("id")
      .single();

    setSaving(false);
    if (error) {
      if (error.hint === "PLAN_MACHINE_LIMIT") {
        const { openUpgradePromptFromPlanError } = await import(
          "@/lib/billing/handle-plan-error"
        );
        openUpgradePromptFromPlanError(
          { error: error.message, hint: error.hint },
          "machine_slots"
        );
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Makine eklendi");
    queryClient.invalidateQueries({ queryKey: ["machines"] });
    queryClient.invalidateQueries({ queryKey: ["entitlements"] });
    if (data?.id) onSaved(data.id);
  }

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-muted-foreground">
        Canlı takip bu adımda kurulmaz. Makine kartını oluşturup planlamaya devam edebilir; sonra{" "}
        <strong className="text-foreground">Yazıcı bağla</strong> ile canlı bağlantı ekleyebilirsiniz.
      </p>
      <FormField label="Makine adı" required>
        {(field) => (
          <Input
            {...field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Örn. Ender-3"
            autoComplete="off"
          />
        )}
      </FormField>
      <FormField label="Model">
        {(field) => (
          <Input
            {...field}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="İsteğe bağlı"
            autoComplete="off"
          />
        )}
      </FormField>
      <FormField label="Planlama durumu">
        {(field) => (
          <select
            {...field}
            value={status}
            onChange={(e) => setStatus(e.target.value as MachineStatus)}
            className="flex h-[var(--density-control-h)] w-full rounded-lg border border-input bg-surface-inset px-3 text-sm text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          >
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        )}
      </FormField>
      <div className="flex flex-wrap gap-2">
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack} disabled={saving}>
            Geri
          </Button>
        ) : null}
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !name.trim()}
          loading={saving}
          className="sm:ml-auto"
        >
          Kaydet ve devam
        </Button>
      </div>
    </div>
  );
}
