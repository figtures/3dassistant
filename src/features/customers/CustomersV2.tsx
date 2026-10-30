"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCustomers, useJobs } from "@/hooks/use-data";
import { useConfirm } from "@/hooks/use-confirm";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { mapCustomerVoiceToFormFields } from "@/lib/parse-note";
import type { VoiceFieldConfidence } from "@/lib/voice-confidence";
import type { CustomerImportRow } from "@/lib/excel";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Skeleton,
} from "@/components/ds";
import { HelpTitleRow } from "@/components/v2/help/contextual-help";
import {
  CustomerImportDialog,
  type ImportPreviewRow,
} from "@/features/customers/customer-import-dialog";
import {
  CustomerSheet,
  type CustomerFormValues,
} from "@/features/customers/customer-sheet";
import { useTenantId } from "@/components/workspace/workspace-provider";
import { usePermission } from "@/components/workspace/can";
import { CustomersTable } from "@/features/customers/customers-table";
import {
  buildCustomerStatsMap,
  matchesCustomerSearch,
} from "@/features/customers/customer-utils";
import {
  Download,
  FileSpreadsheet,
  MoreHorizontal,
  Plus,
  Search,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";

const emptyForm = (): CustomerFormValues => ({
  name: "",
  email: "",
  phone: "",
  company: "",
  notes: "",
  source: "",
  referral: "",
  referred_by_customer_id: "",
});

function validateImportRow(row: CustomerImportRow): string | undefined {
  if (!row.name.trim()) return "Ad soyad zorunlu";
  const email = row.email?.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Geçersiz e-posta";
  }
  return undefined;
}

function CustomersV2Content() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmAction = useConfirm();
  const canEditCustomers = usePermission("customers.edit");
  const showFinance = usePermission("finance.view");
  const canExport = usePermission("export.data");

  const { data: customers = [], isLoading, isError, refetch } = useCustomers();
  const { data: jobs = [] } = useJobs();

  const statsMap = useMemo(() => buildCustomerStatsMap(jobs), [jobs]);

  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerFormValues>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [excelMenuOpen, setExcelMenuOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importValid, setImportValid] = useState<ImportPreviewRow[]>([]);
  const [importInvalid, setImportInvalid] = useState<ImportPreviewRow[]>([]);
  const [importing, setImporting] = useState(false);

  const [voiceText, setVoiceText] = useState("");
  const [voiceMatched, setVoiceMatched] = useState<string[]>([]);
  const [voiceFieldConfidence, setVoiceFieldConfidence] = useState<VoiceFieldConfidence>({});

  const patchUrl = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `/customers?${qs}` : "/customers", { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    setEditingId(null);
    setForm(emptyForm());
    setSheetOpen(true);
    patchUrl({ new: null });
  }, [searchParams, patchUrl]);

  const { isListening, isSupported, startListening, stopListening } = useSpeechRecognition({
    onResult: (text) => {
      setVoiceText(text);
      const mapped = mapCustomerVoiceToFormFields(
        text,
        customers.map((c) => ({ id: c.id, name: c.name }))
      );
      setVoiceMatched(mapped.matched);
      setVoiceFieldConfidence(mapped.fieldConfidence ?? {});
      setForm((prev) => ({
        ...prev,
        name: mapped.name ?? prev.name,
        source: mapped.source ?? prev.source,
        referral: mapped.referral ?? prev.referral,
        referred_by_customer_id: mapped.referredByCustomerId ?? prev.referred_by_customer_id,
      }));
    },
    onInterim: setVoiceText,
  });

  const filtered = useMemo(
    () => customers.filter((c) => matchesCustomerSearch(c, search)),
    [customers, search]
  );

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setVoiceText("");
    setVoiceMatched([]);
    setVoiceFieldConfidence({});
    setSheetOpen(true);
  }

  function openEdit(id: string) {
    const c = customers.find((x) => x.id === id);
    if (!c) return;
    setEditingId(id);
    setForm({
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      company: c.company ?? "",
      notes: c.notes ?? "",
      source: c.source ?? "",
      referral: c.referral ?? "",
      referred_by_customer_id: c.referred_by_customer_id ?? "",
    });
    setVoiceText("");
    setVoiceMatched([]);
    setSheetOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();

    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      company: form.company.trim() || null,
      notes: form.notes.trim() || null,
      source: form.source || null,
      referral: form.referral.trim() || null,
      referred_by_customer_id: form.referred_by_customer_id || null,
    };

    if (editingId) {
      const { error } = await supabase.from("customers").update(payload).eq("id", editingId);
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("customers").insert({
        ...payload,
        user_id: tenantId,
      });
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
    }

    toast.success(editingId ? "Müşteri güncellendi" : "Müşteri eklendi");
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    setSaving(false);
    setSheetOpen(false);
  }

  async function handleDelete(id: string) {
    const confirmed = await confirmAction({
      title: "Müşteri silinsin mi?",
      description: "Bu müşteri kaydı kalıcı olarak silinir. Geçmiş siparişler korunur.",
      confirmLabel: "Sil",
      tone: "destructive",
    });
    if (!confirmed) return;
    const supabase = createClient();
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Müşteri silindi");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    }
  }

  async function handleDownloadTemplate() {
    setExcelMenuOpen(false);
    const { downloadCustomerTemplate } = await import("@/lib/excel");
    downloadCustomerTemplate();
  }

  async function handleExport() {
    setExcelMenuOpen(false);
    const { exportCustomersToExcel } = await import("@/lib/excel");
    exportCustomersToExcel(customers);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setExcelMenuOpen(false);
    try {
      const { parseCustomerExcel } = await import("@/lib/excel");
      const rows = await parseCustomerExcel(file);
      const valid: ImportPreviewRow[] = [];
      const invalid: ImportPreviewRow[] = [];
      rows.forEach((row, index) => {
        const line = index + 2;
        const error = validateImportRow(row);
        const entry = { row, line };
        if (error) invalid.push({ ...entry, error });
        else valid.push(entry);
      });
      setImportValid(valid);
      setImportInvalid(invalid);
      setImportOpen(true);
    } catch {
      toast.error("Excel dosyası okunamadı");
    }
  }

  async function handleImportConfirm() {
    setImporting(true);
    const supabase = createClient();

    const rows = importValid.map(({ row }) => ({
      user_id: tenantId,
      name: row.name.trim(),
      email: row.email?.trim() || null,
      phone: row.phone?.trim() || null,
      company: row.company?.trim() || null,
      notes: row.notes?.trim() || null,
    }));

    const { error } = await supabase.from("customers").insert(rows);
    if (error) {
      toast.error(error.message);
    } else {
      const skipped = importInvalid.length;
      toast.success(
        skipped > 0
          ? `${rows.length} müşteri aktarıldı, ${skipped} satır atlandı`
          : `${rows.length} müşteri içe aktarıldı`
      );
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setImportOpen(false);
      setImportValid([]);
      setImportInvalid([]);
    }
    setImporting(false);
  }

  if (isLoading) {
    return (
      <div className="space-y-6 pb-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        title="Müşteriler yüklenemedi"
        description="Bağlantınızı kontrol edip tekrar deneyin."
        action={
          <Button type="button" onClick={() => void refetch()}>
            Tekrar dene
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <header className="space-y-2">
        <HelpTitleRow>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Müşteriler</h1>
        </HelpTitleRow>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Müşteri kayıtları, sipariş geçmişi ve tahsilat özeti. Excel ile toplu içe ve dışa
          aktarabilirsiniz.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              patchUrl({ q: e.target.value.trim() || null });
            }}
            placeholder="Ad, firma veya iletişim ara…"
            className="pl-9"
            aria-label="Müşteri ara"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport ? (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => setExcelMenuOpen(true)}
              aria-label="Excel işlemleri"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          ) : null}
          {canEditCustomers ? (
            <Button type="button" onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              Müşteri ekle
            </Button>
          ) : null}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileSelect}
      />

      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Henüz müşteri yok"
          description="İlk müşterinizi ekleyin veya Excel şablonu ile toplu içe aktarın."
          action={
            canEditCustomers ? (
              <div className="flex flex-wrap justify-center gap-2">
                {canExport ? (
                  <Button type="button" variant="secondary" onClick={() => void handleDownloadTemplate()}>
                    <Download className="size-4" aria-hidden />
                    Şablon indir
                  </Button>
                ) : null}
                <Button type="button" onClick={openCreate}>
                  <Plus className="size-4" aria-hidden />
                  Müşteri ekle
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Sonuç bulunamadı"
          description={`"${search.trim()}" için eşleşen müşteri yok.`}
          action={
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSearch("");
                patchUrl({ q: null });
              }}
            >
              Aramayı temizle
            </Button>
          }
        />
      ) : (
        <CustomersTable
          customers={filtered}
          statsMap={statsMap}
          onEdit={openEdit}
          onDelete={handleDelete}
          showFinance={showFinance}
          canEdit={canEditCustomers}
        />
      )}

      <CustomerSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editing={!!editingId}
        form={form}
        onFormChange={setForm}
        onSave={handleSave}
        saving={saving}
        customers={customers}
        editingId={editingId}
        voice={{
          isSupported,
          isListening,
          voiceText,
          onVoiceTextChange: setVoiceText,
          matched: voiceMatched,
          fieldConfidence: voiceFieldConfidence,
          onToggleListen: () => (isListening ? stopListening() : startListening()),
        }}
      />

      <CustomerImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        validRows={importValid}
        invalidRows={importInvalid}
        importing={importing}
        onConfirm={handleImportConfirm}
      />

      <Dialog open={excelMenuOpen} onOpenChange={setExcelMenuOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Excel</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Button type="button" variant="secondary" onClick={() => void handleDownloadTemplate()}>
              <Download className="size-4" aria-hidden />
              Şablon indir
            </Button>
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" aria-hidden />
              İçe aktar
            </Button>
            {customers.length > 0 ? (
              <Button type="button" variant="secondary" onClick={() => void handleExport()}>
                <FileSpreadsheet className="size-4" aria-hidden />
                Dışa aktar
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function CustomersV2() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 pb-8">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-full max-w-md" />
        </div>
      }
    >
      <CustomersV2Content />
    </Suspense>
  );
}
