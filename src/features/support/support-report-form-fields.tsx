"use client";

import { MAX_SUPPORT_ATTACHMENTS } from "@/lib/support/attachments";
import { SUPPORT_CATEGORY_OPTIONS } from "@/lib/support/categories";
import type { SupportCategory } from "@/lib/support/types";
import type { SupportReportFormState } from "@/features/support/use-support-report-form";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const selectClassName =
  "flex h-[var(--density-control-h)] w-full rounded-lg border border-input bg-surface-inset px-3 text-sm text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]";

type FieldVariant = "legacy" | "v2";

type Props = {
  form: SupportReportFormState;
  variant: FieldVariant;
  Input: React.ComponentType<React.InputHTMLAttributes<HTMLInputElement>>;
  Textarea: React.ComponentType<React.TextareaHTMLAttributes<HTMLTextAreaElement>>;
  Label: React.ComponentType<{ children: React.ReactNode; className?: string }>;
};

export function SupportReportFormFields({ form, variant, Input, Textarea, Label }: Props) {
  const isV2 = variant === "v2";

  return (
    <div className={cn("space-y-4", isV2 && "py-1")}>
      <p
        className={cn(
          "text-xs",
          isV2 ? "text-muted-foreground" : "text-zinc-500"
        )}
      >
        Teknik ekibimizin sorunu çözmesi için tanılama bilgileri otomatik eklenir. Şifre, erişim
        kodu ve API anahtarları gönderilmez.
      </p>
      <div>
        <Label>Kategori</Label>
        {isV2 ? (
          <select
            className={selectClassName}
            value={form.category}
            onChange={(e) => form.setCategory(e.target.value as SupportCategory)}
          >
            {SUPPORT_CATEGORY_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        ) : (
          <select
            className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
            value={form.category}
            onChange={(e) => form.setCategory(e.target.value as SupportCategory)}
          >
            {SUPPORT_CATEGORY_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
      </div>
      <div>
        <Label>Konu</Label>
        <Input
          value={form.subject}
          onChange={(e) => form.setSubject(e.target.value)}
          placeholder="Kısa özet"
        />
      </div>
      <div>
        <Label>Açıklama</Label>
        <Textarea
          value={form.description}
          onChange={(e) => form.setDescription(e.target.value)}
          rows={5}
          placeholder="Ne oldu, ne bekliyordunuz?"
        />
      </div>
      {form.machines.length > 0 && (
        <div>
          <Label>İlgili makine (isteğe bağlı)</Label>
          {isV2 ? (
            <select
              className={selectClassName}
              value={form.machineId}
              onChange={(e) => form.setMachineId(e.target.value)}
            >
              <option value="">— Seçin —</option>
              {form.machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : (
            <select
              className="flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
              value={form.machineId}
              onChange={(e) => form.setMachineId(e.target.value)}
            >
              <option value="">— Seçin —</option>
              {form.machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      {form.recentBundle && (
        <p
          className={cn(
            "rounded-lg border px-3 py-2 text-xs",
            isV2
              ? "border-border bg-surface-inset text-muted-foreground"
              : "border-zinc-800 bg-zinc-900/50 text-zinc-400"
          )}
        >
          Son köprü tanılama paketi:{" "}
          <span className={cn("font-mono", isV2 ? "text-primary" : "text-sky-400")}>
            {form.recentBundle.code}
          </span>{" "}
          (otomatik eklenecek)
        </p>
      )}
      <div>
        <Label>Ekran görüntüleri (isteğe bağlı, en fazla {MAX_SUPPORT_ATTACHMENTS})</Label>
        <Input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="text-xs"
          onChange={(e) => {
            const list = Array.from(e.target.files ?? []).slice(0, MAX_SUPPORT_ATTACHMENTS);
            form.setPendingFiles(list);
          }}
        />
        {form.pendingFiles.length > 0 && (
          <p className={cn("mt-1 text-xs", isV2 ? "text-muted-foreground" : "text-zinc-500")}>
            {form.pendingFiles.map((f) => f.name).join(", ")}
          </p>
        )}
      </div>
      <button
        type="button"
        className={cn(
          "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors",
          isV2
            ? "border-border text-muted-foreground hover:bg-surface-2"
            : "border-zinc-800 text-zinc-400 hover:bg-zinc-900/60"
        )}
        onClick={() => form.setPreviewOpen((v) => !v)}
      >
        Gönderilecek tanılama bilgileri
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", form.previewOpen && "rotate-180")}
        />
      </button>
      {form.previewOpen && (
        <pre
          className={cn(
            "max-h-48 overflow-auto rounded-lg p-3 text-[10px]",
            isV2 ? "bg-surface-inset text-muted-foreground" : "bg-zinc-950 text-zinc-500"
          )}
        >
          {JSON.stringify(form.currentDiagnostics(), null, 2)}
        </pre>
      )}
    </div>
  );
}
