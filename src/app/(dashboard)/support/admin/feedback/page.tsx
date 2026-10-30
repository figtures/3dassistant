"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type FeedbackRow = {
  id: string;
  kind: string;
  score: number;
  comment: string | null;
  context: Record<string, unknown> | null;
  created_at: string;
  user_id: string;
};

export default function SupportAdminFeedbackPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FeedbackRow[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await fetch("/api/support/admin/feedback");
      if (!active) return;
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Liste alınamadı");
        setLoading(false);
        return;
      }
      const body = await res.json();
      setRows(body.responses ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <PageHeader
        title="NPS / CSAT"
        description="Son geri bildirim yanıtları (v1 özet görünümü)."
      />
      <Link
        href="/support/admin"
        className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"
      >
        ← Destek yönetimi
      </Link>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Yükleniyor…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz kayıt yok.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">Tür</th>
                <th className="px-3 py-2">Puan</th>
                <th className="px-3 py-2">Bağlam</th>
                <th className="px-3 py-2">Yorum</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {new Date(row.created_at).toLocaleString("tr-TR")}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{row.kind}</td>
                  <td className="px-3 py-2">{row.score}</td>
                  <td className="max-w-[12rem] truncate px-3 py-2 font-mono text-xs">
                    {row.context?.ticketId ? String(row.context.ticketId) : "—"}
                  </td>
                  <td className="max-w-md truncate px-3 py-2">{row.comment ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
