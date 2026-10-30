"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Badge, Button, EmptyState, Skeleton } from "@/components/ds";
import { HelpTitleRow } from "@/components/v2/help/contextual-help";
import type { BadgeTone } from "@/components/ds/badge";
import { useSupportReport } from "@/components/support/report-problem-modal";
import { getSupportCategoryLabel } from "@/lib/support/categories";
import { SUPPORT_STATUS_LABELS, type SupportReportStatus } from "@/lib/support/status";
import { LifeBuoy, MessageCircleWarning } from "lucide-react";

type TicketRow = {
  ticket_id: string;
  subject: string;
  category: string;
  status: SupportReportStatus;
  created_at: string;
  updated_at: string;
};

function statusTone(status: SupportReportStatus): BadgeTone {
  if (status === "resolved") return "success";
  if (status === "in_progress") return "info";
  return "warning";
}

function formatUpdatedAt(iso: string): string {
  try {
    return format(new Date(iso), "d MMM yyyy HH:mm", { locale: tr });
  } catch {
    return iso;
  }
}

export function SupportV2() {
  const { openReport } = useSupportReport();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketRow[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/support/tickets");
        if (res.ok) {
          const body = await res.json();
          setTickets(body.tickets ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <HelpTitleRow>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
              <LifeBuoy className="h-6 w-6 text-primary" aria-hidden />
              Destek talepleri
            </h1>
          </HelpTitleRow>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Biletlerinizi görüntüleyin ve ekibimizle mesajlaşın. Genellikle 4 iş saati içinde yanıt
            veriyoruz.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => openReport()}>
          <MessageCircleWarning className="size-4" aria-hidden />
          Sorun bildir
        </Button>
      </header>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="Henüz talebiniz yok — bir sorun mu var?"
          description="Sorun bildir ile teknik ekibe ulaşın; tanılama bilgileri otomatik eklenir."
          action={
            <Button type="button" onClick={() => openReport()}>
              Sorun bildir
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 z-[1] bg-surface-2">
                <tr className="border-b border-border text-left text-muted-foreground">
                  {["Talep no", "Konu", "Kategori", "Durum", "Son güncelleme"].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr
                    key={t.ticket_id}
                    className="border-b border-border/60 transition-colors hover:bg-surface-2/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/support/${t.ticket_id}`}
                        className="font-mono text-xs text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                      >
                        {t.ticket_id}
                      </Link>
                    </td>
                    <td className="max-w-[280px] px-4 py-3">
                      <Link
                        href={`/support/${t.ticket_id}`}
                        className="font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                      >
                        {t.subject}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {getSupportCategoryLabel(t.category)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(t.status)}>{SUPPORT_STATUS_LABELS[t.status]}</Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {formatUpdatedAt(t.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
