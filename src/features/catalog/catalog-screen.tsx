"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCatalogItems, useMaterials } from "@/hooks/use-data";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { mapCatalogVoiceToFormFields } from "@/lib/parse-note";
import { resolveVoiceParse, type VoiceParseSource } from "@/lib/voice-parse-client";
import { signCatalogCoverUrls, getCoverImageFile } from "@/lib/catalog-storage";
import { formatGrams } from "@/lib/utils";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Skeleton,
} from "@/components/ds";
import { HelpTitleRow } from "@/components/v2/help/contextual-help";
import {
  CatalogCreateDialog,
  type CatalogCreateForm,
} from "@/features/catalog/catalog-create-dialog";
import { hasStl, inventoryQty } from "@/features/catalog/catalog-utils";
import type { VoiceFieldConfidence } from "@/lib/voice-confidence";
import {
  FileBox,
  LayoutGrid,
  LayoutList,
  Loader2,
  Package,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

type ViewMode = "grid" | "list";

const emptyForm = (materialId: string): CatalogCreateForm => ({
  sku: "",
  name: "",
  description: "",
  default_material_id: materialId,
  default_grams: "",
  tags: "",
});

export function CatalogV2() {
  const queryClient = useQueryClient();
  const { data: items = [], isLoading, isError, refetch } = useCatalogItems();
  const { data: materials = [] } = useMaterials();

  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
  const [coversLoading, setCoversLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CatalogCreateForm>(() =>
    emptyForm(materials[0]?.id ?? "")
  );
  const [voiceMatched, setVoiceMatched] = useState<string[]>([]);
  const [voiceText, setVoiceText] = useState("");
  const [voiceFieldConfidence, setVoiceFieldConfidence] = useState<VoiceFieldConfidence>({});
  const [voiceParseSource, setVoiceParseSource] = useState<VoiceParseSource | undefined>();

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
    setForm(emptyForm(materials[0]?.id ?? ""));
    setVoiceMatched([]);
    setVoiceText("");
    setVoiceFieldConfidence({});
    setDialogOpen(true);
  }

  async function saveItem() {
    if (!form.sku.trim() || !form.name.trim()) {
      toast.error("SKU ve ürün adı gerekli");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
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
    setDialogOpen(false);
    await queryClient.invalidateQueries({ queryKey: ["catalog_items"] });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [items, search]);

  if (isLoading) {
    return (
      <div className="space-y-6 pb-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="aspect-[4/3] rounded-xl" />
          <Skeleton className="aspect-[4/3] rounded-xl" />
          <Skeleton className="aspect-[4/3] rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title="Katalog yüklenemedi"
        description="Bağlantınızı kontrol edip tekrar deneyin."
        action={
          <Button type="button" onClick={() => void refetch()}>
            Yeniden dene
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <HelpTitleRow>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              Katalog
            </h1>
          </HelpTitleRow>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Ürün vitrininiz — dosyalar, stok ve teklif metrikleri tek yerde.
          </p>
        </div>
        <Button type="button" onClick={openCreate} className="shrink-0">
          <Plus className="size-4" aria-hidden />
          Ürün ekle
        </Button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="SKU, ad veya etiket ara…"
          className="max-w-sm"
          aria-label="Katalog ara"
        />
        <div
          className="inline-flex rounded-lg border border-border p-0.5"
          role="group"
          aria-label="Görünüm"
        >
          <Button
            type="button"
            variant={view === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("grid")}
            aria-pressed={view === "grid"}
            aria-label="Izgara görünümü"
          >
            <LayoutGrid className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant={view === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            aria-label="Liste görünümü"
          >
            <LayoutList className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Katalog boş"
          description="İlk ürününüzü ekleyin; STL ve görselleri detay sayfasından yükleyebilirsiniz."
          action={
            <Button type="button" onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              Ürün ekle
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="Sonuç bulunamadı"
          description="Arama terimini değiştirmeyi deneyin."
        />
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => {
            const qty = inventoryQty(item);
            const low = qty <= 3;
            const cover = coverUrls[item.id];
            const coverFile = getCoverImageFile(item.catalog_files);
            const stl = hasStl(item);

            return (
              <Link
                key={item.id}
                href={`/catalog/${item.id}`}
                className="group block overflow-hidden rounded-xl border border-border bg-surface-raised transition-colors hover:border-primary/40 hover:bg-surface-overlay"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-surface-inset pf-layer-lines">
                  {cover ? (
                    <Image
                      src={cover}
                      alt={coverFile?.original_name ?? item.name}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                      {coversLoading && coverFile ? (
                        <Loader2 className="size-6 animate-spin" aria-hidden />
                      ) : (
                        <>
                          <FileBox className="size-8 opacity-50" aria-hidden />
                          <span className="text-xs">Kapak görseli yok</span>
                        </>
                      )}
                    </div>
                  )}
                  <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                    <Badge tone="neutral" className="font-mono text-xs">
                      {item.sku}
                    </Badge>
                    {stl && (
                      <Badge tone="info" className="gap-1 text-xs">
                        <FileBox className="size-3" aria-hidden />
                        STL
                      </Badge>
                    )}
                  </div>
                  <div className="absolute bottom-2 right-2">
                    <Badge tone={low ? "danger" : "neutral"} className="text-xs">
                      Stok {qty}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1.5 p-4">
                  <h2 className="font-medium leading-snug text-foreground group-hover:text-primary">
                    {item.name}
                  </h2>
                  {item.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                    {item.default_material?.name && (
                      <span>
                        {item.default_material.name}
                        {item.default_grams != null
                          ? ` · ${formatGrams(item.default_grams)}`
                          : ""}
                      </span>
                    )}
                    {item.tags?.slice(0, 2).map((t) => (
                      <Badge key={t} tone="neutral" className="text-[10px] uppercase">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface-raised">
          {filtered.map((item) => {
            const qty = inventoryQty(item);
            const low = qty <= 3;
            return (
              <li key={item.id}>
                <Link
                  href={`/catalog/${item.id}`}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-overlay sm:flex-nowrap"
                >
                  <Badge tone="neutral" className="shrink-0 font-mono text-xs">
                    {item.sku}
                  </Badge>
                  <span className="min-w-0 flex-1 font-medium text-foreground">
                    {item.name}
                  </span>
                  {item.default_material?.name && (
                    <span className="hidden text-sm text-muted-foreground sm:inline">
                      {item.default_material.name}
                    </span>
                  )}
                  <Badge tone={low ? "danger" : "neutral"} className="shrink-0 text-xs">
                    Stok {qty}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <CatalogCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        form={form}
        onFormChange={setForm}
        materials={materials}
        saving={saving}
        onSave={() => void saveItem()}
        voice={{
          isSupported,
          isListening,
          voiceText,
          onVoiceTextChange: setVoiceText,
          matched: voiceMatched,
          fieldConfidence: voiceFieldConfidence,
          parseSource: voiceParseSource,
          onToggleListen: () => (isListening ? stopListening() : startListening()),
        }}
      />
    </div>
  );
}
