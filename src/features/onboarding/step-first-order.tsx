"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useCustomers, useMachines, useMaterials } from "@/hooks/use-data";
import { saveOrder } from "@/features/orders/use-order-mutations";
import { emptyOrderForm } from "@/features/orders/order-schema";
import { Button } from "@/components/ds/button";
import { FormField } from "@/components/ds/form-field";
import { Input } from "@/components/ds/input";

type StepFirstOrderProps = {
  onFinish: () => void;
  onSkip: () => void;
};

export function StepFirstOrder({ onFinish, onSkip }: StepFirstOrderProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: machines = [] } = useMachines();
  const { data: materials = [] } = useMaterials();
  const { data: customers = [] } = useCustomers();

  const defaultMachineId = machines[0]?.id ?? "";

  const [title, setTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [grams, setGrams] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const canSubmit = useMemo(
    () => Boolean(title.trim() && defaultMachineId),
    [title, defaultMachineId]
  );

  async function handleCreate() {
    if (!defaultMachineId) {
      toast.error("Önce en az bir makine ekleyin veya bu adımı atlayın");
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

    const form = emptyOrderForm({
      machine_id: defaultMachineId,
      job_date: new Date().toISOString().slice(0, 10),
    });
    form.title = title.trim();
    form.pending_customer_name = customerName.trim();
    form.grams_used = grams || "0";
    form.delivery_date = deliveryDate;
    form.revenue_amount = "0";
    form.amount_paid = "0";

    const mat = materials[0];
    if (mat) {
      form.material_id = mat.id;
      const color = mat.material_colors?.[0];
      if (color) form.material_color_id = color.id;
    }

    const result = await saveOrder(
      supabase,
      queryClient,
      user.id,
      form,
      materials,
      customers,
      null,
      [],
      null
    );

    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("İlk siparişiniz oluşturuldu");
    onFinish();
  }

  async function handleSampleData() {
    setSeeding(true);
    try {
      const res = await fetch("/api/onboarding/sample-data", { method: "POST" });
      const body = (await res.json()) as { error?: string; code?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Örnek veriler eklenemedi");
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["machines"] }),
        queryClient.invalidateQueries({ queryKey: ["materials"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["sample-data"] }),
        queryClient.invalidateQueries({ queryKey: ["entitlements"] }),
      ]);
      toast.success("Örnek veriler hazır — keşfetmeye başlayın");
      onFinish();
      router.push("/dashboard?ui=v2");
    } catch {
      toast.error("Örnek veriler eklenemedi");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">İlk sipariş</h2>
        <p className="text-sm text-muted-foreground">
          Basit bir siparişle planlamayı deneyin. Detayları sonra düzenleyebilirsiniz.
        </p>
      </header>

      {!defaultMachineId ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Makine eklemeden sipariş oluşturamazsınız. Önceki adımda makine ekleyin veya
          bu adımı atlayın.
        </p>
      ) : null}

      <FormField label="Sipariş başlığı" required>
        {(field) => (
          <Input
            {...field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Örn. Vazo baskısı"
          />
        )}
      </FormField>

      <FormField label="Müşteri adı">
        {(field) => (
          <Input
            {...field}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="İsteğe bağlı — boş bırakılabilir"
          />
        )}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Gram">
          {(field) => (
            <Input
              {...field}
              inputMode="numeric"
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              placeholder="120"
            />
          )}
        </FormField>
        <FormField label="Teslim tarihi">
          {(field) => (
            <Input
              {...field}
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          )}
        </FormField>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onSkip}>
          Atla
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            loading={seeding}
            onClick={() => void handleSampleData()}
          >
            Örnek verilerle keşfet
          </Button>
          <Button
            type="button"
            loading={saving}
            disabled={!canSubmit}
            onClick={() => void handleCreate()}
          >
            Bitir
          </Button>
        </div>
      </div>
    </div>
  );
}
