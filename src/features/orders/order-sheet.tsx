"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  useCustomers,
  useMachines,
  useMaterials,
} from "@/hooks/use-data";
import { useConfirm } from "@/hooks/use-confirm";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { mapVoiceToFormFields } from "@/lib/parse-note";
import { resolveVoiceParse, type VoiceParseSource } from "@/lib/voice-parse-client";
import { getMaterialColors } from "@/lib/materials";
import type { VoiceFieldConfidence } from "@/lib/voice-confidence";
import type { Job } from "@/types/database";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ds";
import { OrderForm } from "@/features/orders/order-form";
import {
  emptyOrderForm,
  orderFormFromJob,
  validateOrderForm,
  type OrderFormInput,
} from "@/features/orders/order-schema";
import { useOrderById } from "@/features/orders/queries";
import {
  deleteOrder,
  saveOrder,
  uploadOrderFile,
  type PendingNote,
} from "@/features/orders/use-order-mutations";
import { useTenantId } from "@/components/workspace/workspace-provider";
import { usePermission } from "@/components/workspace/can";
import { formatDateShort } from "@/lib/format";
import { ExternalLink, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

export type OrderSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
  prefill?: { machine_id?: string; job_date?: string };
  onSaved?: (jobId: string) => void;
};

export function OrderSheet({
  open,
  onOpenChange,
  orderId,
  prefill,
  onSaved,
}: OrderSheetProps) {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  const confirmAction = useConfirm();
  const canEditOrders = usePermission("orders.edit");
  const showFinance = usePermission("finance.view");
  const isNew = !orderId || orderId === "new";
  const { data: loadedJob, isLoading: jobLoading } = useOrderById(
    isNew ? null : orderId
  );

  const { data: machines = [] } = useMachines();
  const { data: materials = [] } = useMaterials();
  const { data: customers = [] } = useCustomers();

  const [form, setForm] = useState<OrderFormInput>(() =>
    emptyOrderForm({
      machine_id: prefill?.machine_id ?? machines[0]?.id,
      job_date: prefill?.job_date,
    })
  );
  const [savedJobId, setSavedJobId] = useState<string | null>(null);
  const [existingNotes, setExistingNotes] = useState<
    { content: string; is_voice: boolean }[]
  >([]);
  const [pendingNotes, setPendingNotes] = useState<PendingNote[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const initialFormRef = useRef<string>("");
  const [voiceText, setVoiceText] = useState("");
  const [voiceMatched, setVoiceMatched] = useState<string[]>([]);
  const [voiceFieldConfidence, setVoiceFieldConfidence] =
    useState<VoiceFieldConfidence>({});
  const [voiceParseSource, setVoiceParseSource] = useState<
    VoiceParseSource | undefined
  >();

  const resetForOpen = useCallback(
    (job: Job | null | undefined) => {
      if (job) {
        const next = orderFormFromJob(job);
        setForm(next);
        setExistingNotes(
          job.job_notes?.map((n) => ({
            content: n.content,
            is_voice: n.is_voice,
          })) ?? []
        );
        setSavedJobId(job.id);
        initialFormRef.current = JSON.stringify(next);
      } else {
        const next = emptyOrderForm({
          machine_id: prefill?.machine_id ?? machines[0]?.id ?? "",
          job_date: prefill?.job_date,
        });
        setForm(next);
        setExistingNotes([]);
        setSavedJobId(null);
        initialFormRef.current = JSON.stringify(next);
      }
      setPendingNotes([]);
      setNoteInput("");
      setFieldErrors({});
      setVoiceText("");
      setVoiceMatched([]);
    },
    [machines, prefill?.job_date, prefill?.machine_id]
  );

  useEffect(() => {
    if (!open) return;
    if (!isNew && jobLoading) return;
    resetForOpen(isNew ? null : loadedJob);
  }, [open, isNew, jobLoading, loadedJob, resetForOpen]);

  const isDirty =
    open &&
    (JSON.stringify(form) !== initialFormRef.current || pendingNotes.length > 0);

  const applyVoiceFinal = useCallback(
    async (text: string) => {
      setVoiceText(text);
      const mats = materials.map((m) => ({
        id: m.id,
        name: m.name,
        material_colors: getMaterialColors(m).map((c) => ({
          id: c.id,
          color_name: c.color_name,
        })),
      }));
      const { source, result: mapped } = await resolveVoiceParse(
        "job",
        text,
        {
          materials: mats,
          customers: customers.map((c) => ({ id: c.id, name: c.name })),
        },
        () => mapVoiceToFormFields(text, mats, customers)
      );
      setVoiceParseSource(source);
      setVoiceMatched(mapped.matched);
      setVoiceFieldConfidence(mapped.fieldConfidence ?? {});
      setForm((prev) => {
        const next = { ...prev };
        if (mapped.title) next.title = mapped.title;
        if (mapped.customerId) next.customer_id = mapped.customerId;
        if (mapped.materialId) next.material_id = mapped.materialId;
        if (mapped.materialColorId) next.material_color_id = mapped.materialColorId;
        if (mapped.gramsUsed) next.grams_used = mapped.gramsUsed;
        if (mapped.revenueAmount) next.revenue_amount = mapped.revenueAmount;
        if (mapped.status) next.status = mapped.status;
        if (mapped.deliveryDate) next.delivery_date = mapped.deliveryDate;
        if (mapped.durationMinutes) {
          const mins = parseInt(mapped.durationMinutes, 10);
          next.duration_hours = String(Math.floor(mins / 60));
          next.duration_minutes_part = String(mins % 60);
        }
        if (mapped.paymentStatus) next.payment_status = mapped.paymentStatus;
        if (mapped.amountPaid) next.amount_paid = mapped.amountPaid;
        if (mapped.paymentDueDate) next.payment_due_date = mapped.paymentDueDate;
        if (mapped.installmentCount) next.installment_count = mapped.installmentCount;
        if (mapped.customerName && !mapped.customerId) {
          next.pending_customer_name = mapped.customerName;
          toast.message(`Yeni müşteri: ${mapped.customerName}`, {
            description: "Kaydedince otomatik oluşturulacak.",
          });
        }
        return next;
      });
      setNoteInput(text);
    },
    [materials, customers]
  );

  const { isListening, isSupported, startListening, stopListening } =
    useSpeechRecognition({
      onResult: applyVoiceFinal,
      onInterim: setVoiceText,
    });

  async function requestClose(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (isDirty) {
      const ok = await confirmAction({
        title: "Kaydedilmemiş değişiklikler",
        description: "Sipariş formundaki değişiklikler kaybolacak.",
        confirmLabel: "Kapat",
        tone: "destructive",
      });
      if (!ok) return;
    }
    onOpenChange(false);
  }

  async function handleSave() {
    const validated = validateOrderForm({
      ...form,
      amount_remaining:
        String(
          Math.max(
            0,
            (parseFloat(form.revenue_amount) || 0) -
              (parseFloat(form.amount_paid) || 0)
          )
        ) || form.amount_remaining,
      installment_amount:
        (() => {
          const count = parseInt(form.installment_count, 10);
          const revenue = parseFloat(form.revenue_amount) || 0;
          if (count > 0 && revenue > 0) return (revenue / count).toFixed(2);
          return form.installment_amount;
        })(),
    });
    if (!validated.success) {
      const errors: Record<string, string> = {};
      for (const issue of validated.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    const supabase = createClient();

    const formForSave = {
      ...form,
      amount_remaining: String(
        Math.max(
          0,
          (parseFloat(form.revenue_amount) || 0) -
            (parseFloat(form.amount_paid) || 0)
        )
      ),
      installment_amount: (() => {
        const count = parseInt(form.installment_count, 10);
        const revenue = parseFloat(form.revenue_amount) || 0;
        if (count > 0 && revenue > 0) return (revenue / count).toFixed(2);
        return form.installment_amount;
      })(),
    };

    const { error, jobId } = await saveOrder(
      supabase,
      queryClient,
      tenantId,
      formForSave,
      materials,
      customers,
      loadedJob ?? null,
      pendingNotes,
      savedJobId
    );
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    if (jobId) {
      setSavedJobId(jobId);
      initialFormRef.current = JSON.stringify(formForSave);
      setPendingNotes([]);
      toast.success("Sipariş kaydedildi");
      onSaved?.(jobId);
    }
  }

  async function handleDelete() {
    const id = savedJobId ?? loadedJob?.id;
    if (!id) return;
    const ok = await confirmAction({
      title: "Sipariş silinsin mi?",
      description: "Bu işlem geri alınamaz.",
      confirmLabel: "Sil",
      tone: "destructive",
    });
    if (!ok) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await deleteOrder(supabase, id);
    setDeleting(false);
    if (error) {
      toast.error(error);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["jobs"] });
    toast.success("Sipariş silindi");
    onOpenChange(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const activeId = savedJobId ?? loadedJob?.id;
    if (!file || !activeId) {
      toast.error("Önce siparişi kaydedin");
      return;
    }
    const supabase = createClient();
    const { error } = await uploadOrderFile(supabase, tenantId, activeId, file);
    if (error) toast.error(error);
    else toast.success("Dosya yüklendi");
  }

  const title = isNew
    ? "Yeni sipariş"
    : form.title || loadedJob?.title || "Sipariş düzenle";

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent size="xl" className="max-sm:max-h-[95dvh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {form.job_date
              ? `Baskı ${formatDateShort(form.job_date)} · Teslim ${form.delivery_date ? formatDateShort(form.delivery_date) : "—"}`
              : "Sipariş bilgilerini kaydedin."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="py-3">
          {jobLoading && !isNew ? (
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          ) : (
            <OrderForm
              form={form}
              onFormChange={setForm}
              machines={machines}
              materials={materials}
              customers={customers}
              fieldErrors={fieldErrors}
              noteInput={noteInput}
              onNoteInputChange={setNoteInput}
              onAddNote={() => {
                if (!noteInput.trim()) return;
                setPendingNotes((prev) => [
                  ...prev,
                  { content: noteInput.trim(), is_voice: isListening },
                ]);
                setNoteInput("");
              }}
              notes={[...existingNotes, ...pendingNotes]}
              voice={{
                isSupported,
                isListening,
                voiceText,
                onVoiceTextChange: setVoiceText,
                onVoiceBlur: applyVoiceFinal,
                matched: voiceMatched,
                fieldConfidence: voiceFieldConfidence,
                parseSource: voiceParseSource,
                onToggleListen: () => {
                  if (isListening) {
                    stopListening();
                    if (voiceText.trim()) void applyVoiceFinal(voiceText);
                  } else {
                    startListening();
                  }
                },
              }}
              filesSlot={
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:bg-accent/40">
                  <Upload className="size-4" aria-hidden />
                  STL veya görsel yükle
                  <input
                    type="file"
                    className="hidden"
                    accept=".stl,.jpg,.jpeg,.png,.webp,.gif"
                    onChange={(e) => void handleFileUpload(e)}
                  />
                </label>
              }
              showFinance={showFinance}
              readOnly={!canEditOrders}
            />
          )}
        </DialogBody>
        <DialogFooter className="gap-2 sm:justify-between">
          {!isNew && canEditOrders ? (
            <div className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => void handleDelete()}
                disabled={deleting || saving}
                aria-label="Siparişi sil"
              >
                {deleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Sil
              </Button>
              {(savedJobId ?? loadedJob?.id) ? (
                <Link
                  href={`/orders/${savedJobId ?? loadedJob?.id}`}
                  onClick={() => onOpenChange(false)}
                  className="inline-flex h-8 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                >
                  <ExternalLink className="size-4" aria-hidden />
                  Tam sayfada aç
                </Link>
              ) : null}
            </div>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void requestClose(false)}
              disabled={saving}
            >
              {canEditOrders ? "İptal" : "Kapat"}
            </Button>
            {canEditOrders ? (
              <Button type="button" onClick={() => void handleSave()} loading={saving}>
                Kaydet
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
