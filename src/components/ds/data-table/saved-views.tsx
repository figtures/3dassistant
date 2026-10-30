"use client";

import { useEffect, useId, useState } from "react";
import { Bookmark, ChevronDown, Trash2, Users } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@/components/ds";
import {
  useDeleteSavedViewMutation,
  useSaveViewMutation,
  useSavedViews,
  useUpdateSavedViewMutation,
} from "@/features/saved-views/queries";
import type { TableUrlSnapshot } from "@/types/database";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export type SavedViewsToolbarProps = {
  tableId: string;
  snapshot: TableUrlSnapshot;
  onApply: (state: TableUrlSnapshot) => void;
  excludeFromSave?: readonly string[];
  className?: string;
};

export function SavedViewsToolbar({
  tableId,
  snapshot,
  onApply,
  className,
}: SavedViewsToolbarProps) {
  const selectId = useId();
  const shareId = useId();
  const { data: views = [], isLoading } = useSavedViews(tableId);
  const saveMutation = useSaveViewMutation(tableId);
  const updateMutation = useUpdateSavedViewMutation(tableId);
  const deleteMutation = useDeleteSavedViewMutation(tableId);

  const [selectedId, setSelectedId] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!cancelled) setCurrentUserId(data.user?.id ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = views.find((v) => v.id === selectedId);
  const canManageSelected =
    selected != null &&
    currentUserId != null &&
    selected.user_id === currentUserId;

  function handleSelect(id: string) {
    setSelectedId(id);
    if (!id) return;
    const view = views.find((v) => v.id === id);
    if (!view) return;
    const state =
      view.state && typeof view.state === "object" && !Array.isArray(view.state)
        ? (view.state as TableUrlSnapshot)
        : {};
    onApply(state);
    toast.success(`"${view.name}" görünümü uygulandı`);
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Görünüm adı girin");
      return;
    }
    try {
      if (selectedId && canManageSelected) {
        await updateMutation.mutateAsync({
          id: selectedId,
          name: trimmed,
          state: snapshot,
          shared,
        });
        toast.success("Görünüm güncellendi");
      } else {
        const created = await saveMutation.mutateAsync({
          name: trimmed,
          state: snapshot,
          shared,
        });
        setSelectedId(created.id);
        toast.success("Görünüm kaydedildi");
      }
      setSaveOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    }
  }

  async function handleDelete() {
    if (!selectedId || !canManageSelected) return;
    const view = views.find((v) => v.id === selectedId);
    try {
      await deleteMutation.mutateAsync(selectedId);
      setSelectedId("");
      toast.success(view ? `"${view.name}" silindi` : "Görünüm silindi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silinemedi");
    }
  }

  function openSaveDialog() {
    setName(selected?.name ?? "");
    setShared(selected?.shared ?? false);
    setSaveOpen(true);
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="relative min-w-[180px]">
        <label htmlFor={selectId} className="sr-only">
          Kayıtlı görünüm
        </label>
        <select
          id={selectId}
          className="flex h-[var(--density-control-h)] w-full appearance-none rounded-lg border border-input bg-surface-inset py-0 pl-9 pr-8 text-sm text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:opacity-50"
          value={selectedId}
          onChange={(e) => handleSelect(e.target.value)}
          disabled={isLoading}
          aria-busy={isLoading}
        >
          <option value="">Varsayılan görünüm</option>
          {views.map((view) => (
            <option key={view.id} value={view.id}>
              {view.shared ? "↗ " : ""}
              {view.name}
              {view.user_id !== currentUserId && view.shared ? " (ekip)" : ""}
            </option>
          ))}
        </select>
        <Bookmark
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <ChevronDown
          className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      </div>

      <Button type="button" variant="secondary" size="sm" onClick={openSaveDialog}>
        Görünümü kaydet
      </Button>

      {canManageSelected ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void handleDelete()}
          disabled={deleteMutation.isPending}
          aria-label="Seçili görünümü sil"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      ) : null}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>
              {canManageSelected ? "Görünümü güncelle" : "Görünümü kaydet"}
            </DialogTitle>
            <DialogDescription>
              Mevcut filtreler, sıralama ve sayfalama bu adla saklanır. Paylaşılan
              görünümler ekip üyelerine listelenir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-1">
            <div className="space-y-2">
              <Label htmlFor={`${selectId}-name`}>Ad</Label>
              <Input
                id={`${selectId}-name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn. Geciken ödemeler"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id={shareId}
                type="checkbox"
                checked={shared}
                onChange={(e) => setShared(e.target.checked)}
                className="size-4 rounded border border-input accent-primary"
              />
              <Label htmlFor={shareId} className="inline-flex items-center gap-1.5">
                <Users className="size-4 text-muted-foreground" aria-hidden />
                Ekiple paylaş
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setSaveOpen(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={saveMutation.isPending || updateMutation.isPending}
              onClick={() => void handleSave()}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
