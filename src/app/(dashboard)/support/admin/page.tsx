"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SUPPORT_STATUS_LABELS, type SupportReportStatus } from "@/lib/support/status";

type MessageRow = {
  id: string;
  author_type: string;
  author_email?: string;
  body: string;
  created_at: string;
};

type ReportRow = {
  ticket_id: string;
  subject: string;
  description: string;
  category: string;
  status: SupportReportStatus;
  created_at: string;
  diagnostics: Record<string, unknown>;
  profile: { email?: string; full_name?: string } | null;
  bridgeBundle: { bundle_code?: string; payload?: unknown } | null;
  messages: MessageRow[];
  attachmentUrls: Array<{ name: string; signedUrl?: string; path: string }>;
};

type ErrorGroup = {
  fingerprint: string;
  message: string;
  route: string | null;
  source: string;
  count: number;
  last_seen: string;
};

export default function SupportAdminPage() {
  const params = useSearchParams();
  const highlight = params.get("ticket");
  const [tab, setTab] = useState<"tickets" | "errors">("tickets");
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [errors, setErrors] = useState<ErrorGroup[]>([]);
  const [expanded, setExpanded] = useState<string | null>(highlight);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replying, setReplying] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/support/admin/reports");
        if (!active) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toast.error(body.error ?? "Liste alınamadı");
          return;
        }
        const body = await res.json();
        setReports(body.reports ?? []);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (tab !== "errors" || errors.length) return;
    void (async () => {
      const res = await fetch("/api/support/admin/errors");
      if (!res.ok) return;
      const body = await res.json();
      setErrors(body.errors ?? []);
    })();
  }, [tab, errors.length]);

  async function setStatus(ticketId: string, status: SupportReportStatus) {
    const res = await fetch("/api/support/admin/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, status }),
    });
    if (!res.ok) {
      toast.error("Güncellenemedi");
      return;
    }
    setReports((rows) => rows.map((r) => (r.ticket_id === ticketId ? { ...r, status } : r)));
  }

  async function sendReply(ticketId: string) {
    const body = replyDraft[ticketId]?.trim();
    if (!body) return;
    setReplying(ticketId);
    try {
      const res = await fetch("/api/support/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, body }),
      });
      if (!res.ok) {
        toast.error("Yanıt gönderilemedi");
        return;
      }
      toast.success("Yanıt gönderildi");
      setReplyDraft((d) => ({ ...d, [ticketId]: "" }));
      const listRes = await fetch("/api/support/admin/reports");
      if (listRes.ok) {
        const data = await listRes.json();
        setReports(data.reports ?? []);
      }
    } finally {
      setReplying(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Destek paneli"
        description="Müşteri bildirimleri, ekler ve istemci hataları (iç kullanım)"
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={tab === "tickets" ? "default" : "outline"}
          onClick={() => setTab("tickets")}
        >
          Biletler
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tab === "errors" ? "default" : "outline"}
          onClick={() => setTab("errors")}
        >
          Hatalar
        </Button>
      </div>

      {tab === "errors" ? (
        <ul className="space-y-2">
          {errors.map((e) => (
            <li key={`${e.fingerprint}-${e.source}`} className="rounded-lg border border-zinc-800 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-amber-400">{e.fingerprint.slice(0, 12)}…</span>
                <Badge variant="default">{e.source}</Badge>
                <span className="text-xs text-zinc-500">×{e.count}</span>
                <span className="text-xs text-zinc-600">{new Date(e.last_seen).toLocaleString("tr-TR")}</span>
              </div>
              <p className="mt-1 text-zinc-300">{e.message}</p>
              {e.route && <p className="text-xs text-zinc-500">{e.route}</p>}
            </li>
          ))}
          {!errors.length && <p className="text-sm text-zinc-500">Henüz kayıtlı hata yok.</p>}
        </ul>
      ) : loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => {
            const isOpen = expanded === r.ticket_id;
            return (
              <li
                key={r.ticket_id}
                className={`rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 ${
                  highlight === r.ticket_id ? "ring-1 ring-sky-500/40" : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-sm text-sky-400">{r.ticket_id}</span>
                    <h3 className="font-medium text-zinc-100">{r.subject}</h3>
                    <p className="text-xs text-zinc-500">
                      {r.profile?.email ?? "—"} · {r.category} ·{" "}
                      {new Date(r.created_at).toLocaleString("tr-TR")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        r.status === "resolved" ? "success" : r.status === "in_progress" ? "default" : "warning"
                      }
                    >
                      {SUPPORT_STATUS_LABELS[r.status]}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setExpanded(isOpen ? null : r.ticket_id)}
                    >
                      {isOpen ? "Gizle" : "Detay"}
                    </Button>
                    {r.status !== "in_progress" && r.status !== "resolved" && (
                      <Button type="button" size="sm" variant="outline" onClick={() => setStatus(r.ticket_id, "in_progress")}>
                        İşleme al
                      </Button>
                    )}
                    {r.status !== "resolved" ? (
                      <Button type="button" size="sm" onClick={() => setStatus(r.ticket_id, "resolved")}>
                        Çözüldü
                      </Button>
                    ) : (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setStatus(r.ticket_id, "open")}>
                        Yeniden aç
                      </Button>
                    )}
                  </div>
                </div>
                {isOpen && (
                  <div className="mt-4 space-y-3 text-sm">
                    <p className="whitespace-pre-wrap text-zinc-300">{r.description}</p>
                    {r.attachmentUrls?.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {r.attachmentUrls.map((a) =>
                          a.signedUrl ? (
                            <a
                              key={a.path}
                              href={a.signedUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-sky-400 underline"
                            >
                              {a.name}
                            </a>
                          ) : (
                            <span key={a.path} className="text-xs text-zinc-500">{a.name}</span>
                          )
                        )}
                      </div>
                    )}
                    {r.messages?.length > 0 && (
                      <ul className="space-y-2 rounded-lg border border-zinc-800/80 p-3">
                        {r.messages.map((m) => (
                          <li key={m.id} className="text-xs">
                            <span className="text-zinc-500">
                              {m.author_type === "staff" ? "Destek" : "Müşteri"}
                              {m.author_email ? ` · ${m.author_email}` : ""} ·{" "}
                              {new Date(m.created_at).toLocaleString("tr-TR")}
                            </span>
                            <p className="whitespace-pre-wrap text-zinc-300">{m.body}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Textarea
                      rows={3}
                      placeholder="Müşteriye yanıt yazın…"
                      value={replyDraft[r.ticket_id] ?? ""}
                      onChange={(e) =>
                        setReplyDraft((d) => ({ ...d, [r.ticket_id]: e.target.value }))
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={replying === r.ticket_id}
                      onClick={() => sendReply(r.ticket_id)}
                    >
                      {replying === r.ticket_id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yanıt gönder"}
                    </Button>
                    {r.bridgeBundle?.bundle_code && (
                      <p className="text-xs text-zinc-500">
                        Köprü paketi: <span className="font-mono">{r.bridgeBundle.bundle_code}</span>
                      </p>
                    )}
                    <pre className="max-h-64 overflow-auto rounded-lg bg-zinc-900 p-3 text-[10px] text-zinc-500">
                      {JSON.stringify(
                        {
                          diagnostics: r.diagnostics,
                          bridgeBundle: r.bridgeBundle?.payload ?? null,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}
              </li>
            );
          })}
          {!reports.length && <p className="text-sm text-zinc-500">Henüz bildirim yok.</p>}
        </ul>
      )}
    </div>
  );
}
