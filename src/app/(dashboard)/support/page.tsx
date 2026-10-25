"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { SupportReportButton } from "@/components/support/report-problem-modal";
import { Loader2 } from "lucide-react";
import { SUPPORT_STATUS_LABELS, type SupportReportStatus } from "@/lib/support/status";

type TicketRow = {
  ticket_id: string;
  subject: string;
  category: string;
  status: SupportReportStatus;
  created_at: string;
  updated_at: string;
};

export default function SupportTicketsPage() {
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
    <div className="space-y-6">
      <PageHeader
        title="Destek talepleri"
        description="Biletlerinizi görüntüleyin ve ekiple mesajlaşın"
        action={<SupportReportButton variant="outline" />}
      />
      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      ) : (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.ticket_id}>
              <Link
                href={`/support/${t.ticket_id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 transition hover:border-zinc-700"
              >
                <div>
                  <span className="font-mono text-xs text-sky-400">{t.ticket_id}</span>
                  <p className="font-medium text-zinc-100">{t.subject}</p>
                  <p className="text-xs text-zinc-500">
                    {t.category} · {new Date(t.updated_at).toLocaleString("tr-TR")}
                  </p>
                </div>
                <Badge variant={t.status === "resolved" ? "success" : "warning"}>
                  {SUPPORT_STATUS_LABELS[t.status]}
                </Badge>
              </Link>
            </li>
          ))}
          {!tickets.length && (
            <p className="text-sm text-zinc-500">Henüz destek talebiniz yok. Sorun bildir ile başlayın.</p>
          )}
        </ul>
      )}
    </div>
  );
}
