"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  useCatalogItem,
  useCatalogSales,
  useCatalogEvents,
  useCatalogItemJobs,
  useRecentJobs,
  useCustomers,
} from "@/hooks/use-data";
import { VoiceParsePanel } from "@/components/ui/voice-parse-panel";
import type { VoiceFieldConfidence } from "@/lib/voice-confidence";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { mapSaleVoiceToFormFields } from "@/lib/parse-note";
import { StlViewer } from "@/components/viewer/stl-viewer";
import { CatalogQuotePanel } from "@/components/catalog/catalog-quote-panel";
import type { MeshMetrics } from "@/lib/mesh-metrics";
import { MATERIAL_DENSITY_PRESETS } from "@/lib/mesh-metrics";
import { PageLoader } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, DateInput } from "@/components/ui/select";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { FormSection, FormField } from "@/components/ui/form-section";
import { formatCurrency } from "@/lib/utils";
import { formatDateTR } from "@/hooks/use-data";
import type { CatalogFileType, ShipmentStatus } from "@/types/database";
import {
  ArrowLeft,
  Upload,
  Loader2,
  ShoppingBag,
  Plus,
  Link2,
  Unlink,
  Download,
  FileArchive,
  FileBox,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";

const SALE_CHANNELS = ["Instagram", "Trendyol", "Web sitesi", "Mağaza", "Diğer"];
const SHIPMENT_STATUSES: { value: ShipmentStatus; label: string }[] = [
  { value: "pending", label: "Bekliyor" },
  { value: "shipped", label: "Kargolandı" },
  { value: "in_transit", label: "Yolda" },
  { value: "delivered", label: "Teslim" },
  { value: "returned", label: "İade" },
];

function detectFileType(name: string): CatalogFileType {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "stl") return "stl";
  if (ext === "3mf") return "3mf";
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext ?? "")) return "image";
  if (ext === "zip") return "zip";
  return "other";
}

function invQty(item: { catalog_inventory?: unknown }) {
  const inv = item.catalog_inventory;
  if (Array.isArray(inv)) return inv[0];
  return inv as { quantity_on_hand: number; quantity_reserved: number } | undefined;
}

export default function CatalogItemLegacyPage({ itemId }: { itemId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: item, isLoading } = useCatalogItem(itemId);
  const { data: sales = [] } = useCatalogSales(itemId);
  const { data: events = [] } = useCatalogEvents(itemId);
  const { data: customers = [] } = useCustomers();
  const { data: linkedJobs = [] } = useCatalogItemJobs(itemId);
  const { data: recentJobs = [] } = useRecentJobs(40);

  const [uploading, setUploading] = useState(false);
  const [stlUrl, setStlUrl] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [linkJobId, setLinkJobId] = useState("");
  const [voiceFieldConfidence, setVoiceFieldConfidence] = useState<VoiceFieldConfidence>({});
  const [saleModal, setSaleModal] = useState(false);
  const [stockModal, setStockModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [voiceMatched, setVoiceMatched] = useState<string[]>([]);
  const [voiceText, setVoiceText] = useState("");
  const [saleForm, setSaleForm] = useState({
    customer_id: "",
    channel: "",
    platform: "",
    unit_price: "",
    quantity: "1",
    sold_at: new Date().toISOString().slice(0, 10),
    carrier: "",
    tracking_number: "",
    shipment_status: "pending" as ShipmentStatus,
  });
  const [stockDelta, setStockDelta] = useState("");
  const [meshMetrics, setMeshMetrics] = useState<MeshMetrics | null>(null);
  const [densityId, setDensityId] = useState("pla");

  const catalogForVoice = item
    ? [{ id: item.id, sku: item.sku, name: item.name }]
    : [];

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
    const supabase = createClient();
    const { data, error } = await supabase.storage.from("catalog-files").createSignedUrl(path, 3600);
    if (!error && data?.signedUrl) setStlUrl(data.signedUrl);
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !item) return;
    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const path = `${user.id}/${item.id}/${Date.now()}_${file.name}`;
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
      user_id: user.id,
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
      user_id: user.id,
      item_id: item.id,
      event_type: "file_uploaded",
      payload: { name: file.name, file_type: fileType },
    });
    toast.success("Dosya yüklendi");
    queryClient.invalidateQueries({ queryKey: ["catalog_items", itemId] });
    if (fileType === "stl") loadStlPreview(path);
    e.target.value = "";
  }

  async function recordSale() {
    const qty = parseInt(saleForm.quantity, 10) || 1;
    const price = parseFloat(saleForm.unit_price) || 0;
    if (!item) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: sale, error: saleErr } = await supabase
      .from("sales")
      .insert({
        user_id: user.id,
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
        user_id: user.id,
        sale_id: sale.id,
        carrier: saleForm.carrier || null,
        tracking_number: saleForm.tracking_number || null,
        status: saleForm.shipment_status,
        shipped_at: saleForm.shipment_status !== "pending" ? new Date().toISOString() : null,
      });
    }

    setSaving(false);
    toast.success("Satış kaydedildi — stok güncellendi");
    setSaleModal(false);
    queryClient.invalidateQueries({ queryKey: ["catalog_items"] });
    queryClient.invalidateQueries({ queryKey: ["sales"] });
    queryClient.invalidateQueries({ queryKey: ["catalog_events", itemId] });
  }

  async function adjustStock() {
    const delta = parseInt(stockDelta, 10);
    if (!item || !delta) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const inv = invQty(item);
    const current = inv?.quantity_on_hand ?? 0;
    const next = Math.max(0, current + delta);
    const { error } = await supabase
      .from("catalog_inventory")
      .upsert(
        {
          user_id: user.id,
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
      user_id: user.id,
      item_id: item.id,
      event_type: "stock_adjusted",
      payload: { delta, quantity_on_hand: next },
    });
    setSaving(false);
    setStockModal(false);
    setStockDelta("");
    toast.success("Stok güncellendi");
    queryClient.invalidateQueries({ queryKey: ["catalog_items", itemId] });
    queryClient.invalidateQueries({ queryKey: ["catalog_events", itemId] });
  }

  const files = item?.catalog_files ?? [];
  const stlFile = files.find((f) => f.file_type === "stl");

  const loadImageThumbs = useCallback(async (imageFiles: { id: string; path: string }[]) => {
    const supabase = createClient();
    const next: Record<string, string> = {};
    for (const f of imageFiles) {
      const { data } = await supabase.storage.from("catalog-files").createSignedUrl(f.path, 3600);
      if (data?.signedUrl) next[f.id] = data.signedUrl;
    }
    setImageUrls(next);
  }, []);

  async function downloadFile(path: string, name: string) {
    const supabase = createClient();
    const { data, error } = await supabase.storage.from("catalog-files").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast.error("İndirme bağlantısı oluşturulamadı");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = name;
    a.rel = "noopener";
    a.click();
  }

  async function linkJob() {
    if (!linkJobId || !item) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("catalog_item_jobs").insert({
      user_id: user.id,
      catalog_item_id: item.id,
      job_id: linkJobId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("İş emri bağlandı");
    setLinkJobId("");
    queryClient.invalidateQueries({ queryKey: ["catalog_item_jobs", itemId] });
  }

  async function unlinkJob(linkId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("catalog_item_jobs").delete().eq("id", linkId);
    if (error) toast.error(error.message);
    else {
      toast.success("Bağlantı kaldırıldı");
      queryClient.invalidateQueries({ queryKey: ["catalog_item_jobs", itemId] });
    }
  }

  const fileTypeBadge = (t: string) => {
    const labels: Record<string, string> = {
      stl: "STL",
      "3mf": "3MF",
      image: "Görsel",
      zip: "ZIP",
      other: "Diğer",
    };
    return labels[t] ?? t;
  };

  useEffect(() => {
    if (stlFile) loadStlPreview(stlFile.path);
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

  useEffect(() => {
    const imgs = files.filter((f) => f.file_type === "image");
    if (imgs.length) loadImageThumbs(imgs);
  }, [files, loadImageThumbs]);

  if (isLoading || !item) return <PageLoader />;

  const inventory = invQty(item);
  const images = files.filter((f) => f.file_type === "image");

  return (
    <div className="catalog-detail space-y-8">
      <div className="flex flex-wrap items-start gap-4 border-b border-zinc-800/60 pb-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/catalog")}>
          <ArrowLeft className="h-4 w-4" /> Katalog
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-sky-400/80">
            {item.sku}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-50">{item.name}</h1>
          {item.description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">{item.description}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {item.default_material?.name && (
              <Badge variant="primary">{item.default_material.name}</Badge>
            )}
            <Badge variant="default">
              Stok {inventory?.quantity_on_hand ?? 0}
              {(inventory?.quantity_reserved ?? 0) > 0 &&
                ` · Rezerve ${inventory?.quantity_reserved}`}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setStockModal(true)}>
            <Plus className="h-4 w-4" /> Stok
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setSaleModal(true);
              setVoiceMatched([]);
              setVoiceText("");
              setVoiceFieldConfidence({});
            }}
          >
            <ShoppingBag className="h-4 w-4" /> Satış
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3 min-h-[420px]">
          {stlUrl ? (
            <StlViewer
              url={stlUrl}
              className="h-[min(70vh,520px)]"
              onMetrics={setMeshMetrics}
            />
          ) : (
            <div className="flex h-[min(50vh,420px)] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 text-center">
              <FileBox className="h-10 w-10 text-zinc-600" />
              <p className="text-sm text-zinc-500">3D önizleme için .stl dosyası yükleyin</p>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-100 ring-1 ring-zinc-700/50 hover:bg-zinc-700">
                <input type="file" className="hidden" accept=".stl" onChange={handleUpload} />
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                STL yükle
              </label>
            </div>
          )}
        </div>
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

      <div className="space-y-6">
        <div className="space-y-4 lg:max-w-3xl">
          <div className="glass rounded-2xl border border-zinc-800/80 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-zinc-300">Dosyalar</h2>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 ring-1 ring-zinc-700/50 hover:bg-zinc-700">
                <input type="file" className="hidden" onChange={handleUpload} />
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Yükle
              </label>
            </div>
            <ul className="space-y-2 text-sm text-zinc-400">
              {files.length === 0 && <li>Henüz dosya yok</li>}
              {files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2">
                  <span className="truncate flex items-center gap-2 min-w-0">
                    {f.file_type === "stl" && <FileBox className="h-3.5 w-3.5 shrink-0 text-sky-400" />}
                    {f.file_type === "3mf" && <FileBox className="h-3.5 w-3.5 shrink-0 text-violet-400" />}
                    {f.file_type === "zip" && <FileArchive className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                    {f.file_type === "image" && <ImageIcon className="h-3.5 w-3.5 shrink-0 text-emerald-400" />}
                    <span className="truncate">{f.original_name}</span>
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="primary">{fileTypeBadge(f.file_type)}</Badge>
                    {(f.file_type === "3mf" || f.file_type === "zip" || f.file_type === "other") && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => downloadFile(f.path, f.original_name)}
                        title="İndir"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {files.some((f) => f.file_type === "3mf") && (
              <p className="mt-2 text-[10px] text-zinc-600">3MF dosyaları için tarayıcı önizleme yok; indirip slicer ile açın.</p>
            )}
          </div>

          {images.length > 0 && (
            <div className="glass rounded-2xl border border-zinc-800/80 p-4">
              <h2 className="text-sm font-semibold text-zinc-300 mb-3">Görseller</h2>
              <div className="grid grid-cols-3 gap-2">
                {images.map((f) => {
                  const url = imageUrls[f.id];
                  return (
                    <button
                      key={f.id}
                      type="button"
                      className="aspect-square overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/60"
                      onClick={() => url && setLightboxUrl(url)}
                    >
                      {url ? (
                        <img src={url} alt={f.original_name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-zinc-600">…</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="glass rounded-2xl border border-zinc-800/80 p-4">
            <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Bağlı iş emirleri
            </h2>
            <div className="flex flex-wrap gap-2 mb-3">
              <Select
                value={linkJobId}
                onChange={(e) => setLinkJobId(e.target.value)}
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
              </Select>
              <Button type="button" size="sm" disabled={!linkJobId} onClick={linkJob}>
                <Plus className="h-4 w-4" /> Bağla
              </Button>
            </div>
            {linkedJobs.length === 0 ? (
              <p className="text-xs text-zinc-500">Henüz bağlı iş emri yok.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {linkedJobs.map((link) => {
                  const j = link.job;
                  if (!j) return null;
                  return (
                    <li
                      key={link.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-zinc-950/40 px-3 py-2"
                    >
                      <span className="truncate text-zinc-300">
                        {formatDateTR(j.job_date)} · {j.title ?? "—"}
                        {j.customer?.name ? ` · ${j.customer.name}` : ""}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => unlinkJob(link.id)}
                      >
                        <Unlink className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-2xl border border-zinc-800/80 p-4">
          <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" /> Satışlar
          </h2>
          {sales.length === 0 ? (
            <p className="text-sm text-zinc-500">Satış kaydı yok</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {sales.map((s) => (
                <li key={s.id} className="flex flex-wrap justify-between gap-2 border-b border-zinc-800/50 py-2">
                  <span>
                    {formatDateTR(s.sold_at.slice(0, 10))} · {s.quantity} adet
                    {s.customer?.name && ` · ${s.customer.name}`}
                  </span>
                  <span className="text-zinc-300">{formatCurrency(Number(s.unit_price) * s.quantity)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass rounded-2xl border border-zinc-800/80 p-4">
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">Zaman çizelgesi</h2>
          <ul className="space-y-2 text-xs text-zinc-500 max-h-64 overflow-y-auto">
            {events.map((ev) => (
              <li key={ev.id}>
                <span className="text-zinc-400">{ev.event_type}</span>
                {" · "}
                {new Date(ev.created_at).toLocaleString("tr-TR")}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Modal open={saleModal} onOpenChange={setSaleModal}>
        <ModalContent className="max-w-lg">
          <ModalHeader title="Satış Kaydı" />
          <ModalBody className="space-y-4">
            <VoiceParsePanel
              isSupported={isSupported}
              isListening={isListening}
              voiceText={voiceText}
              onVoiceTextChange={setVoiceText}
              matched={voiceMatched}
              fieldConfidence={voiceFieldConfidence}
              onToggleListen={() => (isListening ? stopListening() : startListening())}
            />
            <FormSection title="Satış">
              <FormField label="Müşteri">
                <Select
                  value={saleForm.customer_id}
                  onChange={(e) => setSaleForm({ ...saleForm, customer_id: e.target.value })}
                >
                  <option value="">Seçiniz</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Kanal">
                <Select
                  value={saleForm.channel}
                  onChange={(e) => setSaleForm({ ...saleForm, channel: e.target.value })}
                >
                  <option value="">Seçiniz</option>
                  {SALE_CHANNELS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Platform">
                <Input
                  value={saleForm.platform}
                  onChange={(e) => setSaleForm({ ...saleForm, platform: e.target.value })}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Birim fiyat">
                  <Input
                    type="number"
                    value={saleForm.unit_price}
                    onChange={(e) => setSaleForm({ ...saleForm, unit_price: e.target.value })}
                  />
                </FormField>
                <FormField label="Adet">
                  <Input
                    type="number"
                    value={saleForm.quantity}
                    onChange={(e) => setSaleForm({ ...saleForm, quantity: e.target.value })}
                  />
                </FormField>
              </div>
              <FormField label="Satış tarihi">
                <DateInput
                  value={saleForm.sold_at}
                  onChange={(e) => setSaleForm({ ...saleForm, sold_at: e.target.value })}
                />
              </FormField>
            </FormSection>
            <FormSection title="Kargo (isteğe bağlı)">
              <FormField label="Kargo firması">
                <Input
                  value={saleForm.carrier}
                  onChange={(e) => setSaleForm({ ...saleForm, carrier: e.target.value })}
                />
              </FormField>
              <FormField label="Takip no">
                <Input
                  value={saleForm.tracking_number}
                  onChange={(e) =>
                    setSaleForm({ ...saleForm, tracking_number: e.target.value })
                  }
                />
              </FormField>
              <FormField label="Durum">
                <Select
                  value={saleForm.shipment_status}
                  onChange={(e) =>
                    setSaleForm({
                      ...saleForm,
                      shipment_status: e.target.value as ShipmentStatus,
                    })
                  }
                >
                  {SHIPMENT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </Select>
              </FormField>
            </FormSection>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setSaleModal(false)}>İptal</Button>
            <Button onClick={recordSale} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kaydet
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal open={stockModal} onOpenChange={setStockModal}>
        <ModalContent>
          <ModalHeader title="Stok Ayarla" />
          <ModalBody>
            <FormField label="Miktar değişimi (+ / -)">
              <Input
                type="number"
                value={stockDelta}
                onChange={(e) => setStockDelta(e.target.value)}
                placeholder="ör. 10 veya -2"
              />
            </FormField>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setStockModal(false)}>İptal</Button>
            <Button onClick={adjustStock} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Uygula
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-5 w-5" />
          </Button>
          <img
            src={lightboxUrl}
            alt="Önizleme"
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
