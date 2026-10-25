"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SUPPORT_STATUS_LABELS, type SupportReportStatus } from "@/lib/support/status";

type Message = {
  id: string;
  author_type: string;
  author_email?: string;
  body: string;
  created_at: string;
};

export default function SupportTicketDetailPage() {
  const params = useParams();
  const ticketId = String(params.ticketId ?? "");
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<{
    ticket_id: string;
    subject: string;
    status: SupportReportStatus;
    attachments: Array<{ name: string; signedUrl?: string }>;
  } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}`);
      if (!active) return;
      if (!res.ok) {
        toast.error("Bilet yüklenemedi");
        setLoading(false);
        return;
      }
      const body = await res.json();
      setTicket(body.ticket);
      setMessages(body.messages ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [ticketId]);

  async function reload() {
    const res = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}`);
    if (!res.ok) return;
    const body = await res.json();
    setTicket(body.ticket);
    setMessages(body.messages ?? []);
  }

  async function sendMessage() {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Gönderilemedi");
        return;
      }
      setReply("");
      await reload();
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />;
  }

  if (!ticket) {
    return (
      <p className="text-sm text-zinc-500">
        Bilet bulunamadı. <Link href="/support" className="text-sky-400">Listeye dön</Link>
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={ticket.subject} description={`Bilet ${ticket.ticket_id}`} />
      <div className="flex items-center gap-2">
        <Badge variant={ticket.status === "resolved" ? "success" : "warning"}>
          {SUPPORT_STATUS_LABELS[ticket.status]}
        </Badge>
        <Link href="/support" className="text-xs text-zinc-500 hover:text-zinc-300">← Tüm talepler</Link>
      </div>
      {ticket.attachments?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ticket.attachments.map((a, i) =>
            a.signedUrl ? (
              <a key={i} href={a.signedUrl} target="_blank" rel="noreferrer" className="text-xs text-sky-400 underline">
                {a.name}
              </a>
            ) : null
          )}
        </div>
      )}
      <ul className="space-y-3 rounded-xl border border-zinc-800 p-4">
        {messages.map((m) => (
          <li key={m.id} className="text-sm">
            <p className="text-xs text-zinc-500">
              {m.author_type === "staff" ? "Destek ekibi" : "Siz"} ·{" "}
              {new Date(m.created_at).toLocaleString("tr-TR")}
            </p>
            <p className="whitespace-pre-wrap text-zinc-200">{m.body}</p>
          </li>
        ))}
      </ul>
      {ticket.status !== "resolved" && (
        <div className="space-y-2">
          <Textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Yanıtınız…" />
          <Button type="button" onClick={sendMessage} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gönder"}
          </Button>
        </div>
      )}
    </div>
  );
}
