"use client";

import { useMemo, useState } from "react";
import { Download, ScrollText } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Skeleton,
} from "@/components/ds";
import { HelpTitleRow } from "@/components/v2/help/contextual-help";
import {
  AUDIT_ACTION_FILTER_OPTIONS,
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_FILTER_OPTIONS,
  AUDIT_ENTITY_LABELS,
} from "@/lib/audit/entities";
import {
  describeAuditEvent,
  formatActorName,
  summarizeAuditDiff,
} from "@/lib/audit/describe";
import { formatDateShort } from "@/lib/format";
import type { AuditEvent } from "@/types/database";
import { useAuditEvents } from "@/features/audit/queries";
import { cn } from "@/lib/utils";

const selectClassName =
  "flex h-[var(--density-control-h)] rounded-lg border border-input bg-surface-inset px-3 text-sm text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]";

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadAuditCsv(rows: AuditEvent[], labels: Record<string, string>) {
  const header = ["Zaman", "Kişi", "Eylem", "Kayıt türü", "Açıklama", "Değişiklik özeti"];
  const lines = [header.map(escapeCsvCell).join(",")];

  for (const event of rows) {
    const actorName = formatActorName(event.actor);
    const ctx = { actorName, entityLabels: labels };
    lines.push(
      [
        event.created_at,
        actorName,
        AUDIT_ACTION_LABELS[event.action] ?? event.action,
        AUDIT_ENTITY_LABELS[event.entity] ?? event.entity,
        describeAuditEvent(event, ctx),
        summarizeAuditDiff(event),
      ]
        .map((c) => escapeCsvCell(c))
        .join(",")
    );
  }

  const bom = "\uFEFF";
  const blob = new Blob([bom + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `denetim-kaydi-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function AuditScreen() {
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data: events = [], isLoading, isError, refetch } = useAuditEvents({
    entity: entityFilter || undefined,
    action: actionFilter || undefined,
  });

  const entityLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const event of events) {
      if (!event.entity_id) continue;
      const title =
        (event.diff &&
          (typeof event.diff.title === "string"
            ? event.diff.title
            : typeof (event.diff.title as { new?: string })?.new === "string"
              ? (event.diff.title as { new: string }).new
              : null)) ??
        (typeof event.diff?.name === "string" ? event.diff.name : null);
      if (title) map[event.entity_id] = title;
    }
    return map;
  }, [events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((event) => {
      const actorName = formatActorName(event.actor);
      const text = describeAuditEvent(event, { actorName, entityLabels }).toLowerCase();
      return (
        text.includes(q) ||
        actorName.toLowerCase().includes(q) ||
        (AUDIT_ENTITY_LABELS[event.entity] ?? event.entity).includes(q)
      );
    });
  }, [events, search, entityLabels]);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <HelpTitleRow>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              Denetim kaydı
            </h1>
          </HelpTitleRow>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Çalışma alanındaki sipariş, makine, malzeme ve ekip değişikliklerinin
            zaman damgalı günlüğü. Yalnızca sahip ve yöneticiler görüntüleyebilir.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0"
          disabled={!filtered.length}
          onClick={() => downloadAuditCsv(filtered, entityLabels)}
        >
          <Download className="size-4" aria-hidden />
          CSV dışa aktar
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Açıklamada ara…"
          className={cn(selectClassName, "min-w-[200px] flex-1 sm:max-w-xs")}
          aria-label="Denetim kaydında ara"
        />
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className={selectClassName}
          aria-label="Kayıt türü filtresi"
        >
          <option value="">Tüm kayıt türleri</option>
          {AUDIT_ENTITY_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className={selectClassName}
          aria-label="Eylem filtresi"
        >
          <option value="">Tüm eylemler</option>
          {AUDIT_ACTION_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : isError ? (
        <EmptyState
          icon={ScrollText}
          title="Kayıtlar yüklenemedi"
          description="Bağlantıyı kontrol edip tekrar deneyin."
          action={
            <Button type="button" variant="secondary" onClick={() => void refetch()}>
              Yenile
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Henüz denetim kaydı yok"
          description={
            events.length === 0
              ? "Veritabanı migration 031 uygulandıktan sonra değişiklikler burada listelenir."
              : "Filtrelere uyan kayıt bulunamadı."
          }
        />
      ) : (
        <Card className="overflow-hidden border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[880px] text-sm">
                <thead className="sticky top-0 z-[1] bg-surface-2">
                  <tr className="border-b border-border text-left text-muted-foreground">
                    {["Zaman", "Kişi", "Eylem", "Kayıt", "Açıklama", "Değişiklik"].map(
                      (h) => (
                        <th key={h} className="px-4 py-3 font-medium">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((event) => {
                    const actorName = formatActorName(event.actor);
                    const ctx = { actorName, entityLabels };
                    return (
                      <tr
                        key={event.id}
                        className="border-b border-border/60 transition-colors hover:bg-surface-2/50"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {formatDateShort(event.created_at)}
                          <div className="text-xs tabular-nums">
                            {new Date(event.created_at).toLocaleTimeString("tr-TR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-foreground">{actorName}</td>
                        <td className="px-4 py-3">
                          {AUDIT_ACTION_LABELS[event.action] ?? event.action}
                        </td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">
                          {AUDIT_ENTITY_LABELS[event.entity] ?? event.entity}
                        </td>
                        <td className="max-w-md px-4 py-3 text-foreground">
                          {describeAuditEvent(event, ctx)}
                        </td>
                        <td className="max-w-xs px-4 py-3 text-xs text-muted-foreground">
                          {summarizeAuditDiff(event)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
