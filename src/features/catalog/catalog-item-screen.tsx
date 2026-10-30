"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  useCatalogItem,
  useCatalogSales,
  useCatalogEvents,
  useCatalogItemJobs,
  useRecentJobs,
  useCustomers,
  formatDateTR,
} from "@/hooks/use-data";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { mapSaleVoiceToFormFields } from "@/lib/parse-note";
import { CatalogQuotePanel } from "@/components/catalog/catalog-quote-panel";
import type { MeshMetrics } from "@/lib/mesh-metrics";
import { MATERIAL_DENSITY_PRESETS } from "@/lib/mesh-metrics";
import { signCatalogFilePath } from "@/lib/catalog-storage";
import { formatCurrency } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  Skeleton,
} from "@/components/ds";
import { HelpTitleRow } from "@/components/v2/help/contextual-help";
import {
  CatalogSaleDialog,
  type SaleFormValues,
} from "@/features/catalog/catalog-sale-dialog";
import { StlPreview } from "@/features/catalog/stl-preview";
import {
  CATALOG_TABS,
  detectFileType,
  fileTypeLabel,
  inventoryRecord,
  type CatalogTab,
} from "@/features/catalog/catalog-utils";
import type { VoiceFieldConfidence } from "@/lib/voice-confidence";
import {
  ArrowLeft,
  Download,
  FileArchive,
  FileBox,
  Image as ImageIcon,
  Link2,
  Loader2,
  Plus,
  ShoppingBag,
  Unlink,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTenantId } from "@/components/workspace/workspace-provider";

const emptySaleForm = (): SaleFormValues => ({
  customer_id: "",
  channel: "",
  platform: "",
  unit_price: "",
  quantity: "1",
  sold_at: new Date().toISOString().slice(0, 10),
  carrier: "",
  tracking_number: "",
  shipment_status: "pending",
});

export function CatalogItemScreen({ itemId }: { itemId: string }) {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  const { data: item, isLoading } = useCatalogItem(itemId);
  const { data: sales = [] } = useCatalogSales(itemId);
  const { data: events = [] } = useCatalogEvents(itemId);
  const { data: customers = [] } = useCustomers();
  const { data: linkedJobs = [] } = useCatalogItemJobs(itemId);
  const { data: recentJobs = [] } = useRecentJobs(40);

  const [tab, setTab] = useState<CatalogTab>("general");
  const [uploading, setUploading] = useState(false);
  const [stlUrl, setStlUrl] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [linkJobId, setLinkJobId] = useState("");
  const [saleOpen, setSaleOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [voiceMatched, setVoiceMatched] = useState<string[]>([]);
  const [voiceText, setVoiceText] = useState("");
  const [voiceFieldConfidence, setVoiceFieldConfidence] = useState<VoiceFieldConfidence>({});
  const [saleForm, setSaleForm] = useState<SaleFormValues>(emptySaleForm);
  const [stockDelta, setStockDelta] = useState("");
  const [meshMetrics, setMeshMetrics] = useState<MeshMetrics | null>(null);
  const [densityId, setDensityId] = useState("pla");

  const catalogForVoice = item ? [{ id: item.id, sku: item.sku, name: item.name }] : [];

  const applySaleVoice = useCallback(
    (text: string) => {
      setVoiceText(text);
      const mapped = mapSaleVoiceToFormFields(text, customers, catalogForVoice);
      setVoiceMatched(mapped.matched);
      setVoiceFieldConfidence(mapped.fieldConfidence ?? {});
      setSaleForm((prev) => ({
        ...prev,
        customer_id: mapped.customerId ?? prev.customer_id,
        channel: mapped.channel ?? prev.channel,
        platform: mapped.platform ?? prev.platform,
        unit_price: mapped.unitPrice ?? prev.unit_price,
        quantity: mapped.quantity ?? prev.quantity,
        carrier: mapped.carrier ?? prev.carrier,
        tracking_number: mapped.trackingNumber ?? prev.tracking_number,
      }));
    },
    [customers, catalogForVoice]
  );

  const { isListening, isSupported, startListening, stopListening } = useSpeechRecognition({
    onResult: applySaleVoice,
    onInterim: setVoiceText,
  });

  const loadStlPreview = useCallback(async (path: string) => {
    const url = await signCatalogFilePath(path, 3600);
    if (url) setStlUrl(url);
  }, []);

  const files = item?.catalog_files ?? [];
  const stlFile = files.find((f) => f.file_type === "stl");
  const images = files.filter((f) => f.file_type === "image");

  useEffect(() => {
    if (stlFile) void loadStlPreview(stlFile.path);
    else {
      setStlUrl(null);
      setMeshMetrics(null);
    }
  }, [stlFile?.path, loadStlPreview]);

  useEffect(() => {
    const matName = item?.default_material?.name?.toLowerCase() ?? "";
    const match = MATERIAL_DENSITY_PRESETS.find((p) => matName.includes(p.id));
    if (match) setDensityId(match.id);
  }, [item?.default_material?.name]);

  const loadImageThumbs = useCallback(async (imageFiles: { id: string; path: string }[]) => {
    const next: Record<string, string> = {};
    for (const f of imageFiles) {
      const url = await signCatalogFilePath(f.path, 3600);
      if (url) next[f.id] = url;
    }
    setImageUrls(next);
  }, []);

  useEffect(() => {
    if (images.length) void loadImageThumbs(images);
  }, [files, loadImageThumbs, images]);

  async function handleUpload(file: File) {
    if (!item) return;
    setUploading(true);
    const supabase = createClient();
    const path = `${tenantId}/${item.id}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage
      .from("catalog-files")
      .upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
    if (upErr) {
      setUploading(false);
      toast.error(upErr.message);
      return;
    }
    const fileType = detectFileType(file.name);
    const { error: dbErr } = await supabase.from("catalog_files").insert({
      user_id: tenantId,
      item_id: item.id,
      file_type: fileType,
      path,
      original_name: file.name,
      file_size: file.size,
      version: 1,
    });
    setUploading(false);
    if (dbErr) {
      toast.error(dbErr.message);
      return;
    }
    await supabase.from("catalog_events").insert({
      user_id: tenantId,
      item_id: item.id,
      event_type: "file_uploaded",
      payload: { name: file.name, file_type: fileType },
    });
    toast.success("Dosya yüklendi");
    await queryClient.invalidateQueries({ queryKey: ["catalog_items", itemId] });
    if (fileType === "stl") void loadStlPreview(path);
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleUpload(file);
    e.target.value = "";
  }

  async function recordSale() {
    const qty = parseInt(saleForm.quantity, 10) || 1;
    const price = parseFloat(saleForm.unit_price) || 0;
    if (!item) return;
    setSaving(true);
    const supabase = createClient();

    const { data: sale, error: saleErr } = await supabase
      .from("sales")
      .insert({
        user_id: tenantId,
        item_id: item.id,
        customer_id: saleForm.customer_id || null,
        channel: saleForm.channel || null,
        platform: saleForm.platform || null,
        unit_price: price,
        quantity: qty,
        sold_at: new Date(saleForm.sold_at).toISOString(),
      })
      .select("id")
      .single();
    if (saleErr) {
      setSaving(false);
      toast.error(saleErr.message);
      return;
    }

    if (saleForm.carrier || saleForm.tracking_number) {
      await supabase.from("shipments").insert({
        user_id: tenantId,
        sale_id: sale.id,
        carrier: saleForm.carrier || null,
        tracking_number: saleForm.tracking_number || null,
        status: saleForm.shipment_status,
        shipped_at:
          saleForm.shipment_status !== "pending" ? new Date().toISOString() : null,
      });
    }

    setSaving(false);
    toast.success("Satış kaydedildi — stok güncellendi");
    setSaleOpen(false);
    await queryClient.invalidateQueries({ queryKey: ["catalog_items"] });
    await queryClient.invalidateQueries({ queryKey: ["sales"] });
    await queryClient.invalidateQueries({ queryKey: ["catalog_events", itemId] });
  }

  async function adjustStock() {
    const delta = parseInt(stockDelta, 10);
    if (!item || !delta) return;
    setSaving(true);
    const supabase = createClient();
    const inv = inventoryRecord(item);
    const current = inv?.quantity_on_hand ?? 0;
    const next = Math.max(0, current + delta);
    const { error } = await supabase.from("catalog_inventory").upsert(
      {
        user_id: tenantId,
        item_id: item.id,
        quantity_on_hand: next,
        quantity_reserved: inv?.quantity_reserved ?? 0,
      },
      { onConflict: "user_id,item_id" }
    );
    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }
    await supabase.from("catalog_events").insert({
      user_id: tenantId,
      item_id: item.id,
      event_type: "stock_adjusted",
      payload: { delta, quantity_on_hand: next },
    });
    setSaving(false);
    setStockOpen(false);
    setStockDelta("");
    toast.success("Stok güncellendi");
    await queryClient.invalidateQueries({ queryKey: ["catalog_items", itemId] });
    await queryClient.invalidateQueries({ queryKey: ["catalog_events", itemId] });
  }

  async function downloadFile(path: string, name: string) {
    const url = await signCatalogFilePath(path, 300);
    if (!url) {
      toast.error("İndirme bağlantısı oluşturulamadı");
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    a.click();
  }

  async function linkJob() {
    if (!linkJobId || !item) return;
    const supabase = createClient();
    const { error } = await supabase.from("catalog_item_jobs").insert({
      user_id: tenantId,
      catalog_item_id: item.id,
      job_id: linkJobId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("İş emri bağlandı");
    setLinkJobId("");
    await queryClient.invalidateQueries({ queryKey: ["catalog_item_jobs", itemId] });
  }

  async function unlinkJob(linkId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("catalog_item_jobs").delete().eq("id", linkId);
    if (error) toast.error(error.message);
    else {
      toast.success("Bağlantı kaldırıldı");
      await queryClient.invalidateQueries({ queryKey: ["catalog_item_jobs", itemId] });
    }
  }

  if (isLoading || !item) {
    return (
      <div className="space-y-6 pb-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const inventory = inventoryRecord(item);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Link
            href="/catalog"
            className="-ml-2 inline-flex w-fit items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Katalog
          </Link>
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {item.sku}
            </p>
            <HelpTitleRow>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                {item.name}
              </h1>
            </HelpTitleRow>
            {item.description && (
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{item.description}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {item.default_material?.name && (
                <Badge tone="primary">{item.default_material.name}</Badge>
              )}
              <Badge tone="neutral">
                Stok {inventory?.quantity_on_hand ?? 0}
                {(inventory?.quantity_reserved ?? 0) > 0 &&
                  ` · Rezerve ${inventory?.quantity_reserved}`}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => setStockOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Stok
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setSaleOpen(true);
              setSaleForm(emptySaleForm());
              setVoiceMatched([]);
              setVoiceText("");
              setVoiceFieldConfidence({});
            }}
          >
            <ShoppingBag className="size-4" aria-hidden />
            Satış
          </Button>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Katalog sekmeleri"
        className="flex flex-wrap gap-1 border-b border-border pb-px"
      >
        {CATALOG_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] ${
              tab === t.id
                ? "bg-surface-raised text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <div className="grid gap-5 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardContent className="p-0">
              {stlUrl ? (
                <StlPreview
                  url={stlUrl}
                  className="h-[min(70vh,520px)] rounded-xl"
                  onMetrics={setMeshMetrics}
                />
              ) : (
                <div className="flex h-[min(50vh,420px)] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface-inset pf-layer-lines p-6 text-center">
                  <FileBox className="size-10 text-muted-foreground" aria-hidden />
                  <p className="text-sm text-muted-foreground">
                    3D önizleme için .stl dosyası yükleyin
                  </p>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-overlay">
                    <input
                      type="file"
                      className="sr-only"
                      accept=".stl"
                      onChange={onFileInputChange}
                    />
                    {uploading ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Upload className="size-4" aria-hidden />
                    )}
                    STL yükle
                  </label>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="lg:col-span-2">
            <CatalogQuotePanel
              metrics={meshMetrics}
              loading={!!stlUrl && !meshMetrics}
              densityId={densityId}
              onDensityChange={setDensityId}
              materialLabel={item.default_material?.name}
            />
          </div>
        </div>
      )}

      {tab === "files" && (
        <div className="space-y-4 lg:max-w-3xl">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">Dosyalar</CardTitle>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-overlay">
                <input type="file" className="sr-only" onChange={onFileInputChange} />
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Upload className="size-4" aria-hidden />
                )}
                Yükle
              </label>
            </CardHeader>
            <CardContent>
              {files.length === 0 ? (
                <EmptyState
                  icon={FileBox}
                  title="Henüz dosya yok"
                  description="STL, görsel veya arşiv dosyalarını buradan yükleyin."
                />
              ) : (
                <ul className="space-y-2 text-sm">
                  {files.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                    >
                      <span className="flex min-w-0 items-center gap-2 truncate text-foreground">
                        {f.file_type === "stl" && (
                          <FileBox className="size-3.5 shrink-0 text-primary" aria-hidden />
                        )}
                        {f.file_type === "zip" && (
                          <FileArchive className="size-3.5 shrink-0 text-warning" aria-hidden />
                        )}
                        {f.file_type === "image" && (
                          <ImageIcon className="size-3.5 shrink-0 text-success" aria-hidden />
                        )}
                        <span className="truncate">{f.original_name}</span>
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <Badge tone="neutral">{fileTypeLabel(f.file_type)}</Badge>
                        {(f.file_type === "3mf" ||
                          f.file_type === "zip" ||
                          f.file_type === "other") && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`${f.original_name} indir`}
                            onClick={() => void downloadFile(f.path, f.original_name)}
                          >
                            <Download className="size-3.5" aria-hidden />
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {files.some((f) => f.file_type === "3mf") && (
                <p className="mt-3 text-xs text-muted-foreground">
                  3MF dosyaları için tarayıcı önizleme yok; indirip slicer ile açın.
                </p>
              )}
            </CardContent>
          </Card>

          {images.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Görseller</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {images.map((f) => {
                    const url = imageUrls[f.id];
                    return (
                      <button
                        key={f.id}
                        type="button"
                        className="aspect-square overflow-hidden rounded-lg border border-border bg-surface-inset"
                        onClick={() => url && setLightboxUrl(url)}
                        aria-label={f.original_name}
                      >
                        {url ? (
                          <Image
                            src={url}
                            alt={f.original_name}
                            width={200}
                            height={200}
                            className="h-full w-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                            …
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === "stock" && (
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-base">Stok durumu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Eldeki</dt>
                <dd className="text-lg font-semibold tabular-nums text-foreground">
                  {inventory?.quantity_on_hand ?? 0}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Rezerve</dt>
                <dd className="text-lg font-semibold tabular-nums text-foreground">
                  {inventory?.quantity_reserved ?? 0}
                </dd>
              </div>
            </dl>
            <Button type="button" onClick={() => setStockOpen(true)}>
              Stok ayarla
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "sales" && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-base">Satışlar</CardTitle>
          </CardHeader>
          <CardContent>
            {sales.length === 0 ? (
              <EmptyState
                icon={ShoppingBag}
                title="Satış kaydı yok"
                description="Satış eklediğinizde stok otomatik güncellenir."
                action={
                  <Button type="button" size="sm" onClick={() => setSaleOpen(true)}>
                    Satış ekle
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {sales.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap justify-between gap-2 py-3 first:pt-0"
                  >
                    <span className="text-foreground">
                      {formatDateTR(s.sold_at.slice(0, 10))} · {s.quantity} adet
                      {s.customer?.name && ` · ${s.customer.name}`}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatCurrency(Number(s.unit_price) * s.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "production" && (
        <div className="space-y-4 lg:max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="size-4" aria-hidden />
                Bağlı iş emirleri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <select
                  className="flex h-[var(--density-control-h)] min-w-[200px] flex-1 rounded-lg border border-input bg-surface-inset px-3 text-sm"
                  value={linkJobId}
                  onChange={(e) => setLinkJobId(e.target.value)}
                  aria-label="İş emri seç"
                >
                  <option value="">Son işlerden seç…</option>
                  {recentJobs
                    .filter((j) => !linkedJobs.some((l) => l.job_id === j.id))
                    .map((j) => (
                      <option key={j.id} value={j.id}>
                        {formatDateTR(j.job_date)} · {j.title ?? j.machine?.name ?? j.id.slice(0, 6)}
                        {j.customer?.name ? ` · ${j.customer.name}` : ""}
                      </option>
                    ))}
                </select>
                <Button type="button" size="sm" disabled={!linkJobId} onClick={() => void linkJob()}>
                  <Plus className="size-4" aria-hidden />
                  Bağla
                </Button>
              </div>
              {linkedJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz bağlı iş emri yok.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {linkedJobs.map((link) => {
                    const j = link.job;
                    if (!j) return null;
                    return (
                      <li
                        key={link.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                      >
                        <span className="truncate text-foreground">
                          {formatDateTR(j.job_date)} · {j.title ?? "—"}
                          {j.customer?.name ? ` · ${j.customer.name}` : ""}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          aria-label="Bağlantıyı kaldır"
                          onClick={() => void unlinkJob(link.id)}
                        >
                          <Unlink className="size-3.5 text-destructive" aria-hidden />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Zaman çizelgesi</CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz olay kaydı yok.</p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-y-auto text-xs text-muted-foreground">
                  {events.map((ev) => (
                    <li key={ev.id}>
                      <span className="text-foreground">{ev.event_type}</span>
                      {" · "}
                      {new Date(ev.created_at).toLocaleString("tr-TR")}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <CatalogSaleDialog
        open={saleOpen}
        onOpenChange={setSaleOpen}
        form={saleForm}
        onFormChange={setSaleForm}
        customers={customers}
        saving={saving}
        onSave={() => void recordSale()}
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

      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Stok ayarla</DialogTitle>
          </DialogHeader>
          <FormField label="Miktar değişimi (+ / −)" description="ör. 10 veya -2">
            {(field) => (
              <Input
                {...field}
                type="number"
                value={stockDelta}
                onChange={(e) => setStockDelta(e.target.value)}
              />
            )}
          </FormField>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setStockOpen(false)}>
              İptal
            </Button>
            <Button type="button" onClick={() => void adjustStock()} disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
              Uygula
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal
          aria-label="Görsel önizleme"
          onClick={() => setLightboxUrl(null)}
          onKeyDown={(e) => e.key === "Escape" && setLightboxUrl(null)}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            aria-label="Kapat"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="size-5" aria-hidden />
          </Button>
          <Image
            src={lightboxUrl}
            alt="Önizleme"
            width={1200}
            height={900}
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
            unoptimized
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
