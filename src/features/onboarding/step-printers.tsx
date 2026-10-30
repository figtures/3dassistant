"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useMachines } from "@/hooks/use-data";
import { Button } from "@/components/ds/button";
import { FormField } from "@/components/ds/form-field";
import { Input } from "@/components/ds/input";
import type { MachineStatus } from "@/types/database";

type StepPrintersProps = {
  onContinue: () => void;
  onSkip: () => void;
};

export function StepPrinters({ onContinue, onSkip }: StepPrintersProps) {
  const { data: machines = [] } = useMachines();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [status, setStatus] = useState<MachineStatus>("active");
  const [saving, setSaving] = useState(false);

  const hasConnected = machines.some((m) => m.connection_status === "connected");

  async function handleAddMachine() {
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

    const { error } = await supabase.from("machines").insert({
      name: name.trim(),
      model: model.trim() || null,
      status,
      user_id: user.id,
      sort_order: machines.length,
    });

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Makine eklendi");
    setName("");
    setModel("");
    queryClient.invalidateQueries({ queryKey: ["machines"] });
    queryClient.invalidateQueries({ queryKey: ["entitlements"] });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Yazıcılarınız</h2>
        <p className="text-sm text-muted-foreground">
          Canlı takip için yazıcı bağlayın veya şimdilik elle ekleyin.
        </p>
      </header>

      {hasConnected ? (
        <p className="rounded-lg border border-primary/30 bg-primary-subtle px-3 py-2 text-sm text-foreground">
          İlk canlı veri alındı — en az bir yazıcınız bağlı görünüyor.
        </p>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <p className="text-sm font-medium">Elle makine ekle</p>
        <FormField label="Ad" required>
          {(field) => (
            <Input
              {...field}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Ender-3"
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
            />
          )}
        </FormField>
        <FormField label="Durum">
          {(field) => (
            <select
              {...field}
              value={status}
              onChange={(e) => setStatus(e.target.value as MachineStatus)}
              className="flex h-[var(--density-control-h)] w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              <option value="active">Aktif</option>
              <option value="maintenance">Bakımda</option>
            </select>
          )}
        </FormField>
        <Button
          type="button"
          variant="secondary"
          loading={saving}
          onClick={() => void handleAddMachine()}
        >
          Makine ekle
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Bulut veya köprü ile bağlamak için{" "}
        <Link href="/machines" className="font-medium text-primary hover:text-primary-hover">
          Makineler
        </Link>{" "}
        sayfasındaki &ldquo;Yazıcı bağla&rdquo; akışını kullanabilirsiniz (P2-03 sonrası
        burada gömülü olacak).
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onSkip}>
          Atla
        </Button>
        <Button type="button" onClick={onContinue}>
          Devam
        </Button>
      </div>
    </div>
  );
}
