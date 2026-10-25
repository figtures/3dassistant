"use client";

import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCatalogItems, useMaterials } from "@/hooks/use-data";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { mapCatalogVoiceToFormFields } from "@/lib/parse-note";
import { resolveVoiceParse, type VoiceParseSource } from "@/lib/voice-parse-client";
import { signCatalogCoverUrls, getCoverImageFile } from "@/lib/catalog-storage";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoader } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, Textarea } from "@/components/ui/select";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { FormSection, FormField } from "@/components/ui/form-section";
import { LayoutGrid, Plus, Loader2, ImageOff, FileBox } from "lucide-react";
import { VoiceParsePanel } from "@/components/ui/voice-parse-panel";
import type { VoiceFieldConfidence } from "@/lib/voice-confidence";
import { toast } from "sonner";

function inventoryQty(item: { catalog_inventory?: unknown }) {
  const inv = item.catalog_inventory;
  if (Array.isArray(inv)) return inv[0]?.quantity_on_hand ?? 0;
  if (inv && typeof inv === "object" && "quantity_on_hand" in inv) {
    return (inv as { quantity_on_hand: number }).quantity_on_hand;
  }
  return 0;
}

function hasStl(item: { catalog_files?: { file_type: string }[] }) {
  return item.catalog_files?.some((f) => f.file_type === "stl") ?? false;
}

export default function CatalogPage() {
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useCatalogItems();
  const { data: materials = [] } = useMaterials();
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
  const [coversLoading, setCoversLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [voiceMatched, setVoiceMatched] = useState<string[]>([]);
  const [voiceText, setVoiceText] = useState("");
  const [voiceFieldConfidence, setVoiceFieldConfidence] = useState<VoiceFieldConfidence>({});
  const [voiceParseSource, setVoiceParseSource] = useState<VoiceParseSource | undefined>();
  const [form, setForm] = useState({
    sku: "",
    name: "",
    description: "",
    default_material_id: "",
    default_grams: "",
    tags: "",
  });

  useEffect(() => {
    if (!items.length) {
      setCoverUrls({});
      return;
    }
    let cancelled = false;
    setCoversLoading(true);
    signCatalogCoverUrls(items)
      .then((urls) => {
        if (!cancelled) setCoverUrls(urls);
      })
      .finally(() => {
        if (!cancelled) setCoversLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [items]);

  const applyVoice = useCallback(
    async (text: string) => {
      setVoiceText(text);
      const matList = materials.map((m) => ({ id: m.id, name: m.name }));
      const { source, result: mapped } = await resolveVoiceParse(
        "catalog",
        text,
        { materials: matList },
        () => mapCatalogVoiceToFormFields(text, matList)
      );
      setVoiceParseSource(source);
      setVoiceMatched(mapped.matched);
      setVoiceFieldConfidence(mapped.fieldConfidence ?? {});
      setForm((prev) => ({
        ...prev,
        sku: mapped.sku ?? prev.sku,
        name: mapped.name ?? prev.name,
        description: mapped.description ?? prev.description,
        default_material_id: mapped.defaultMaterialId ?? prev.default_material_id,
        default_grams: mapped.defaultGrams ?? prev.default_grams,
        tags: mapped.tags ?? prev.tags,
      }));
    },
    [materials]
  );

  const { isListening, isSupported, startListening, stopListening } = useSpeechRecognition({
    onResult: applyVoice,
    onInterim: setVoiceText,
  });

  function openCreate() {
    setForm({
      sku: "",
      name: "",
      description: "",
      default_material_id: materials[0]?.id ?? "",
      default_grams: "",
      tags: "",
    });
    setVoiceMatched([]);
    setVoiceText("");
    setVoiceFieldConfidence({});
    setModalOpen(true);
  }

  async function saveItem() {
    if (!form.sku.trim() || !form.name.trim()) {
      toast.error("SKU ve ürün adı gerekli");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const tags = form.tags
      .split(/[,;]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const { error } = await supabase.from("catalog_items").insert({
      user_id: user.id,
      sku: form.sku.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      default_material_id: form.default_material_id || null,
      default_grams: form.default_grams ? parseInt(form.default_grams, 10) : null,
      tags,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Katalog ürünü eklendi");
    setModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ["catalog_items"] });
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="catalog-showcase space-y-8">
      <PageHeader
        title="Katalog"
        description="Ürün vitrininiz — dosyalar, stok ve teklif metrikleri tek yerde"
        action={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Ürün Ekle
          </Button>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="Katalog boş"
          description="İlk ürününüzü ekleyin; STL ve görselleri detay sayfasından yükleyebilirsiniz."
          action={<Button onClick={openCreate}>Ürün Ekle</Button>}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const qty = inventoryQty(item);
            const low = qty <= 3;
            const cover = coverUrls[item.id];
            const coverFile = getCoverImageFile(item.catalog_files);
            const stl = hasStl(item);

            return (
              <Link
                key={item.id}
                href={`/catalog/${item.id}`}
                className="catalog-card group block overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-950/30 transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-500/35 hover:shadow-[0_20px_50px_-20px_rgba(56,189,248,0.25)]"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-950 to-black">
                  {cover ? (
                    <img
                      src={cover}
                      alt={coverFile?.original_name ?? item.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-600">
                      {coversLoading && coverFile ? (
                        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                      ) : (
                        <>
                          <ImageOff className="h-8 w-8 opacity-40" />
                          <span className="text-[11px]">Kapak görseli yok</span>
                        </>
                      )}
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
                  <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                    <Badge variant="primary" className="font-mono text-[10px] tracking-wide">
                      {item.sku}
                    </Badge>
                    {stl && (
                      <Badge variant="default" className="gap-1 text-[10px]">
                        <FileBox className="h-3 w-3" /> STL
                      </Badge>
                    )}
                  </div>
                  <div className="absolute bottom-3 right-3">
                    <Badge variant={low ? "danger" : "default"} className="text-[10px]">
                      Stok {qty}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2 p-4">
                  <h3 className="font-serif text-lg font-semibold leading-snug text-zinc-50 transition-colors group-hover:text-sky-200">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="line-clamp-2 text-xs leading-relaxed text-zinc-500">
                      {item.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {item.default_material?.name && (
                      <span className="text-[11px] text-zinc-400">
                        {item.default_material.name}
                        {item.default_grams ? ` · ${item.default_grams} g` : ""}
                      </span>
                    )}
                    {item.tags?.slice(0, 2).map((t) => (
                      <Badge key={t} variant="default" className="text-[9px] uppercase">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onOpenChange={setModalOpen}>
        <ModalContent className="max-w-lg">
          <ModalHeader title="Yeni Katalog Ürünü" />
          <ModalBody className="space-y-4">
            <VoiceParsePanel
              isSupported={isSupported}
              isListening={isListening}
              voiceText={voiceText}
              onVoiceTextChange={setVoiceText}
              matched={voiceMatched}
              fieldConfidence={voiceFieldConfidence}
              parseSource={voiceParseSource}
              onToggleListen={() => (isListening ? stopListening() : startListening())}
            />
            <FormSection title="Ürün">
              <FormField label="SKU">
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                />
              </FormField>
              <FormField label="Ad">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </FormField>
              <FormField label="Açıklama">
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </FormField>
              <FormField label="Varsayılan malzeme">
                <Select
                  value={form.default_material_id}
                  onChange={(e) =>
                    setForm({ ...form, default_material_id: e.target.value })
                  }
                >
                  <option value="">Seçiniz</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Varsayılan gram">
                <Input
                  type="number"
                  value={form.default_grams}
                  onChange={(e) => setForm({ ...form, default_grams: e.target.value })}
                />
              </FormField>
              <FormField label="Etiketler (virgülle)">
                <Input
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="hobi, otomotiv"
                />
              </FormField>
            </FormSection>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>İptal</Button>
            <Button onClick={saveItem} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kaydet
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
