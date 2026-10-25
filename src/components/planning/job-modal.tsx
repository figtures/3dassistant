"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, Textarea, DateInput, ColorInput } from "@/components/ui/select";
import { FormSection, FormRow, FormField } from "@/components/ui/form-section";
import { formatDateTR } from "@/hooks/use-data";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { parseTurkishNote, mapVoiceToFormFields } from "@/lib/parse-note";
import { resolveVoiceParse, type VoiceParseSource } from "@/lib/voice-parse-client";
import { getMaterialColors } from "@/lib/materials";
import { VoiceParsePanel } from "@/components/ui/voice-parse-panel";
import type { VoiceFieldConfidence } from "@/lib/voice-confidence";
import { StlViewer } from "@/components/viewer/stl-viewer";
import type { Job, Material, Customer, Machine, JobStatus, PaymentStatus } from "@/types/database";
import {
  Mic,
  Upload,
  Save,
  Loader2,
  FileBox,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

interface JobModalProps {
  open: boolean;
  onClose: () => void;
  job: Job | null;
  machine: Machine;
  date: string;
  materials: Material[];
  customers: Customer[];
  onSaved: () => void;
}

const STATUS_LABELS: Record<JobStatus, string> = {
  pending: "Bekliyor",
  in_progress: "Devam Ediyor",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Ödenmedi",
  partial: "Kısmi ödendi",
  paid: "Ödendi",
  upcoming: "Ödeme bekleniyor",
};

export function JobModal({
  open,
  onClose,
  job,
  machine,
  date,
  materials,
  customers,
  onSaved,
}: JobModalProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [materialColorId, setMaterialColorId] = useState("");
  const [gramsUsed, setGramsUsed] = useState("");
  const [revenueAmount, setRevenueAmount] = useState("");
  const [durationHours, setDurationHours] = useState("");
  const [durationMinutesPart, setDurationMinutesPart] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("unpaid");
  const [amountPaid, setAmountPaid] = useState("");
  const [amountRemaining, setAmountRemaining] = useState("");
  const [paymentDueDate, setPaymentDueDate] = useState("");
  const [installmentCount, setInstallmentCount] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [pendingCustomerName, setPendingCustomerName] = useState("");
  const [pendingCustomerSource, setPendingCustomerSource] = useState("");
  const [pendingCustomerReferral, setPendingCustomerReferral] = useState("");
  const [pendingReferredByCustomerId, setPendingReferredByCustomerId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [status, setStatus] = useState<JobStatus>("pending");
  const [cellColor, setCellColor] = useState("#3b82f6");
  const [notes, setNotes] = useState<{ id?: string; content: string; is_voice: boolean }[]>([]);
  const [files, setFiles] = useState<{ id: string; file_name: string; file_path: string; file_type: string }[]>([]);
  const [stlPreviewUrl, setStlPreviewUrl] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [voiceMatched, setVoiceMatched] = useState<string[]>([]);
  const [voiceParseSource, setVoiceParseSource] = useState<VoiceParseSource | undefined>();
  const [voiceFieldConfidence, setVoiceFieldConfidence] = useState<VoiceFieldConfidence>({});
  const [noteInput, setNoteInput] = useState("");

  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === materialId),
    [materials, materialId]
  );
  const availableColors = useMemo(() => {
    if (!selectedMaterial) return [];
    return getMaterialColors(selectedMaterial).sort((a, b) => a.sort_order - b.sort_order);
  }, [selectedMaterial]);

  function handleMaterialChange(nextId: string) {
    setMaterialId(nextId);
    const mat = materials.find((m) => m.id === nextId);
    const colors = mat ? getMaterialColors(mat) : [];
    setMaterialColorId(colors[0]?.id ?? "");
  }

  const applyVoiceDisplay = useCallback((text: string) => {
    setVoiceText(text);
  }, []);

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
      if (mapped.title) setTitle(mapped.title);
      if (mapped.customerId) setCustomerId(mapped.customerId);
      if (mapped.materialId) setMaterialId(mapped.materialId);
      if (mapped.materialColorId) setMaterialColorId(mapped.materialColorId);
      if (mapped.gramsUsed) setGramsUsed(mapped.gramsUsed);
      if (mapped.revenueAmount) setRevenueAmount(mapped.revenueAmount);
      if (mapped.status) setStatus(mapped.status);
      if (mapped.deliveryDate) setDeliveryDate(mapped.deliveryDate);
      if (mapped.durationMinutes) {
        const mins = parseInt(mapped.durationMinutes, 10);
        setDurationHours(String(Math.floor(mins / 60)));
        setDurationMinutesPart(String(mins % 60));
      }
      if (mapped.paymentStatus) setPaymentStatus(mapped.paymentStatus);
      if (mapped.amountPaid) setAmountPaid(mapped.amountPaid);
      if (mapped.amountRemaining) setAmountRemaining(mapped.amountRemaining);
      if (mapped.paymentDueDate) setPaymentDueDate(mapped.paymentDueDate);
      if (mapped.installmentCount) setInstallmentCount(mapped.installmentCount);
      if (mapped.installmentAmount) setInstallmentAmount(mapped.installmentAmount);
      if (mapped.customerName && !mapped.customerId) {
        setPendingCustomerName(mapped.customerName);
        if (mapped.customerSource) setPendingCustomerSource(mapped.customerSource);
        if (mapped.referral) setPendingCustomerReferral(mapped.referral);
        if (mapped.referredByCustomerId) setPendingReferredByCustomerId(mapped.referredByCustomerId);
        toast.message(`Yeni müşteri: ${mapped.customerName}`, {
          description: "Kaydedince otomatik oluşturulacak.",
        });
      } else {
        setPendingCustomerName("");
        setPendingCustomerSource("");
        setPendingCustomerReferral("");
        setPendingReferredByCustomerId("");
      }
      setNoteInput(text);
    },
    [materials, customers]
  );

  const { isListening, isSupported, startListening, stopListening } =
    useSpeechRecognition({
      onResult: applyVoiceFinal,
      onInterim: applyVoiceDisplay,
    });

  useEffect(() => {
    if (job) {
      setCurrentJobId(job.id);
      setTitle(job.title ?? "");
      setDescription(job.description ?? "");
      setCustomerId(job.customer_id ?? "");
      setMaterialId(job.material_id ?? "");
      setMaterialColorId(job.material_color_id ?? "");
      setGramsUsed(job.grams_used ? String(job.grams_used) : "");
      setRevenueAmount(job.revenue_amount ? String(job.revenue_amount) : "");
      const totalMins = job.duration_minutes ?? 0;
      setDurationHours(totalMins ? String(Math.floor(totalMins / 60)) : "");
      setDurationMinutesPart(totalMins ? String(totalMins % 60) : "");
      setPaymentStatus(job.payment_status ?? "unpaid");
      setAmountPaid(job.amount_paid ? String(job.amount_paid) : "");
      setAmountRemaining(job.amount_remaining ? String(job.amount_remaining) : "");
      setPaymentDueDate(job.payment_due_date ?? "");
      setInstallmentCount(job.installment_count ? String(job.installment_count) : "");
      setInstallmentAmount(job.installment_amount ? String(job.installment_amount) : "");
      setPendingCustomerName("");
      setPendingCustomerSource("");
      setPendingCustomerReferral("");
      setPendingReferredByCustomerId("");
      setDeliveryDate(job.delivery_date ?? job.job_date ?? date);
      setStatus(job.status);
      setCellColor(job.cell_color);
      setNotes(job.job_notes?.map((n) => ({ id: n.id, content: n.content, is_voice: n.is_voice })) ?? []);
      loadFiles(job.id);
    } else {
      setCurrentJobId(null);
      setTitle("");
      setDescription("");
      setCustomerId("");
      setMaterialId("");
      setMaterialColorId("");
      setGramsUsed("");
      setRevenueAmount("");
      setDurationHours("");
      setDurationMinutesPart("");
      setPaymentStatus("unpaid");
      setAmountPaid("");
      setAmountRemaining("");
      setPaymentDueDate("");
      setInstallmentCount("");
      setInstallmentAmount("");
      setPendingCustomerName("");
      setPendingCustomerSource("");
      setPendingCustomerReferral("");
      setPendingReferredByCustomerId("");
      setDeliveryDate(date);
      setStatus("pending");
      setCellColor("#3b82f6");
      setNotes([]);
      setFiles([]);
      setStlPreviewUrl(null);
      setVoiceText("");
      setVoiceMatched([]);
      setVoiceFieldConfidence({});
    }
  }, [job, open]);

  async function loadFiles(jobId: string) {
    const supabase = createClient();
    const { data } = await supabase.from("job_files").select("*").eq("job_id", jobId);
    if (data) {
      setFiles(data);
      const stl = data.find((f) => f.file_type === "stl");
      if (stl) {
        const { data: urlData } = supabase.storage.from("job-files").getPublicUrl(stl.file_path);
        // For private bucket, use signed URL
        const { data: signed } = await supabase.storage
          .from("job-files")
          .createSignedUrl(stl.file_path, 3600);
        if (signed) setStlPreviewUrl(signed.signedUrl);
      }
    }
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let resolvedCustomerId = customerId || null;

    const gramsInt = gramsUsed ? parseInt(gramsUsed, 10) : 0;
    if (status === "completed" && materialColorId && gramsInt > 0) {
      const colorRow = availableColors.find((c) => c.id === materialColorId);
      const wasCompleted = job?.status === "completed" && job?.stock_deducted;
      const prevGrams = wasCompleted ? (job?.grams_used ?? 0) : 0;
      const delta = wasCompleted ? gramsInt - prevGrams : gramsInt;
      if (colorRow && delta > colorRow.stock_grams) {
        toast.warning(
          `Stok yetersiz: ${colorRow.color_name} için ${colorRow.stock_grams}g var, ${delta}g düşülecek. Stok sıfıra indirilecek.`
        );
      }
    }

    if (!resolvedCustomerId && pendingCustomerName.trim()) {
      const { data: newCustomer, error: custErr } = await supabase
        .from("customers")
        .insert({
          user_id: user.id,
          name: pendingCustomerName.trim(),
          source: pendingCustomerSource || null,
          referral: pendingCustomerReferral || null,
          referred_by_customer_id: pendingReferredByCustomerId || null,
        })
        .select("id")
        .single();
      if (custErr) {
        toast.error(`Müşteri oluşturulamadı: ${custErr.message}`);
        setSaving(false);
        return;
      }
      resolvedCustomerId = newCustomer.id;
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    }

    const hours = parseInt(durationHours, 10) || 0;
    const mins = parseInt(durationMinutesPart, 10) || 0;
    const totalDurationMinutes = hours * 60 + mins || null;

    const payload = {
      user_id: user.id,
      machine_id: machine.id,
      job_date: date,
      title: title || null,
      description: description || null,
      customer_id: resolvedCustomerId,
      material_id: materialId || null,
      material_color_id: materialColorId || null,
      grams_used: gramsUsed ? parseInt(gramsUsed) : null,
      revenue_amount: revenueAmount ? parseFloat(revenueAmount) : 0,
      duration_minutes: totalDurationMinutes,
      payment_status: paymentStatus,
      amount_paid: amountPaid ? parseFloat(amountPaid) : 0,
      amount_remaining: amountRemaining ? parseFloat(amountRemaining) : 0,
      payment_due_date: paymentDueDate || null,
      installment_count: installmentCount ? parseInt(installmentCount, 10) : null,
      installment_amount: installmentAmount ? parseFloat(installmentAmount) : null,
      delivery_date: deliveryDate || date,
      status,
      cell_color: cellColor,
    };

    let jobId = job?.id ?? currentJobId;

    if (jobId) {
      const { error } = await supabase.from("jobs").update(payload).eq("id", jobId);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("jobs").insert(payload).select().single();
      if (error) { toast.error(error.message); setSaving(false); return; }
      jobId = data.id;
      setCurrentJobId(data.id);
    }

    // Save new notes
    for (const note of notes.filter((n) => !n.id)) {
      await supabase.from("job_notes").insert({
        job_id: jobId,
        content: note.content,
        is_voice: note.is_voice,
        parsed_data: parseTurkishNote(note.content, materials, customers),
      });
    }

    queryClient.invalidateQueries({ queryKey: ["jobs"] });
    queryClient.invalidateQueries({ queryKey: ["materials"] });
    toast.success("İş emri kaydedildi — dosya yükleyebilirsiniz");
    setSaving(false);
    onSaved();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const activeJobId = currentJobId ?? job?.id;
    if (!activeJobId) {
      toast.error("Önce iş emrini kaydedin");
      return;
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    const fileType = ext === "stl" ? "stl" : ["jpg", "jpeg", "png", "webp", "gif"].includes(ext ?? "") ? "image" : "other";
    const path = `${user.id}/${activeJobId}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("job-files")
      .upload(path, file);

    if (uploadError) { toast.error(uploadError.message); return; }

    await supabase.from("job_files").insert({
      job_id: activeJobId,
      file_name: file.name,
      file_path: path,
      file_type: fileType,
      file_size: file.size,
    });

    if (fileType === "stl") {
      const { data: signed } = await supabase.storage
        .from("job-files")
        .createSignedUrl(path, 3600);
      if (signed) setStlPreviewUrl(signed.signedUrl);
    }

    loadFiles(activeJobId);
    toast.success("Dosya yüklendi");
  }

  function addNote() {
    if (!noteInput.trim()) return;
    setNotes((prev) => [...prev, { content: noteInput, is_voice: isListening }]);
    setNoteInput("");
  }

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent>
        <ModalHeader
          title={job ? (job.title ?? machine.name) : `Yeni iş · ${machine.name}`}
          subtitle={`Baskı ${formatDateTR(date)} · Termin ${deliveryDate ? formatDateTR(deliveryDate) : "—"}`}
          onClose={onClose}
        />

        <ModalBody>
          <VoiceParsePanel
            className="mb-4"
            isSupported={isSupported}
            isListening={isListening}
            voiceText={voiceText}
            onVoiceTextChange={applyVoiceDisplay}
            onVoiceBlur={applyVoiceFinal}
            matched={voiceMatched}
            fieldConfidence={voiceFieldConfidence}
            parseSource={voiceParseSource}
            placeholder="Müşteri, gram, malzeme, tutar ve termin bilgilerini Türkçe söyleyin…"
            onToggleListen={() => {
              if (isListening) {
                stopListening();
                if (voiceText.trim()) applyVoiceFinal(voiceText);
              } else {
                startListening();
              }
            }}
          />

          <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
            <FormSection title="Sipariş bilgileri">
              <FormField label="Başlık">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Parça adı…"
                />
              </FormField>
              <FormRow>
                <FormField label="Müşteri">
                  <Select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                  >
                    <option value="">Seçin…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Malzeme">
                  <Select
                    value={materialId}
                    onChange={(e) => handleMaterialChange(e.target.value)}
                  >
                    <option value="">Seçin…</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {m.brand ? ` · ${m.brand}` : ""}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Renk">
                  <Select
                    value={materialColorId}
                    onChange={(e) => setMaterialColorId(e.target.value)}
                    disabled={!materialId || availableColors.length === 0}
                  >
                    <option value="">
                      {!materialId
                        ? "Önce malzeme seçin"
                        : availableColors.length === 0
                          ? "Renk tanımlı değil"
                          : "Seçin…"}
                    </option>
                    {availableColors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.color_name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Gram">
                  <Input
                    type="number"
                    value={gramsUsed}
                    onChange={(e) => setGramsUsed(e.target.value)}
                    placeholder="150"
                  />
                </FormField>
                <FormField label="Sipariş tutarı (₺)">
                  <Input
                    type="number"
                    step="0.01"
                    value={revenueAmount}
                    onChange={(e) => setRevenueAmount(e.target.value)}
                    placeholder="450"
                  />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Süre (saat)">
                  <Input
                    type="number"
                    min="0"
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                    placeholder="2"
                  />
                </FormField>
                <FormField label="Süre (dk)">
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={durationMinutesPart}
                    onChange={(e) => setDurationMinutesPart(e.target.value)}
                    placeholder="30"
                  />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Ödeme durumu">
                  <Select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                  >
                    {Object.entries(PAYMENT_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Ödeme tarihi">
                  <DateInput
                    value={paymentDueDate}
                    onChange={(e) => setPaymentDueDate(e.target.value)}
                  />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Ödenen (₺)">
                  <Input
                    type="number"
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                  />
                </FormField>
                <FormField label="Kalan (₺)">
                  <Input
                    type="number"
                    step="0.01"
                    value={amountRemaining}
                    onChange={(e) => setAmountRemaining(e.target.value)}
                  />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Taksit sayısı">
                  <Input
                    type="number"
                    min="0"
                    value={installmentCount}
                    onChange={(e) => setInstallmentCount(e.target.value)}
                  />
                </FormField>
                <FormField label="Taksit tutarı (₺)">
                  <Input
                    type="number"
                    step="0.01"
                    value={installmentAmount}
                    onChange={(e) => setInstallmentAmount(e.target.value)}
                  />
                </FormField>
              </FormRow>
              {pendingCustomerName && !customerId && (
                <p className="text-xs text-amber-400">
                  Yeni müşteri kaydedilecek: {pendingCustomerName}
                </p>
              )}
              <FormField label="Açıklama">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="min-h-[72px]"
                  placeholder="Ek sipariş detayı…"
                />
              </FormField>
            </FormSection>

            <div className="flex flex-col gap-4">
              <FormSection title="Termin & durum">
                <FormRow>
                  <FormField label="Teslim tarihi">
                    <DateInput
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                    />
                  </FormField>
                  <FormField label="Durum">
                    <Select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as JobStatus)}
                    >
                      {Object.entries(STATUS_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </FormRow>
                <FormField label="Plan rengi">
                  <ColorInput
                    value={cellColor}
                    onChange={(e) => setCellColor(e.target.value)}
                  />
                </FormField>
              </FormSection>

              <FormSection title="Notlar & dosyalar">
                <FormField label="Ek not">
                  <div className="flex gap-2">
                    <Textarea
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="Kısa not…"
                      rows={2}
                      className="min-h-[72px] flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addNote}
                      className="shrink-0 self-end"
                    >
                      Ekle
                    </Button>
                  </div>
                </FormField>

                {notes.length > 0 && (
                  <div className="max-h-20 space-y-1 overflow-y-auto rounded-lg border border-zinc-800/60 bg-zinc-950/50 p-2">
                    {notes.map((note, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-xs text-zinc-400"
                      >
                        {note.is_voice && (
                          <Mic className="mt-0.5 h-3 w-3 shrink-0 text-sky-400" />
                        )}
                        <span>{note.content}</span>
                      </div>
                    ))}
                  </div>
                )}

                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700/70 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-500 transition-colors hover:border-sky-500/40 hover:bg-sky-500/5 hover:text-sky-400">
                  <Upload className="h-4 w-4" />
                  STL veya görsel yükle
                  <input
                    type="file"
                    className="hidden"
                    accept=".stl,.jpg,.jpeg,.png,.webp,.gif"
                    onChange={handleFileUpload}
                  />
                </label>

                {files.length > 0 && (
                  <div className="space-y-1">
                    {files.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center gap-2 rounded-lg bg-zinc-950/60 px-2.5 py-1.5 text-xs text-zinc-400"
                      >
                        {f.file_type === "stl" ? (
                          <FileBox className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                        ) : (
                          <ImageIcon className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        )}
                        <span className="truncate">{f.file_name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {stlPreviewUrl && (
                  <div className="overflow-hidden rounded-xl border border-zinc-800/80">
                    <StlViewer url={stlPreviewUrl} className="h-[180px]" showToolbar={false} />
                  </div>
                )}
              </FormSection>
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="outline" onClick={onClose} className="min-h-11">
            İptal
          </Button>
          <Button onClick={handleSave} disabled={saving} className="min-h-11">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Kaydet
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
