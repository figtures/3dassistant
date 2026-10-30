"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Badge, Button, Skeleton, Textarea } from "@/components/ds";
import type { BadgeTone } from "@/components/ds/badge";
import { SUPPORT_STATUS_LABELS, type SupportReportStatus } from "@/lib/support/status";
import { ArrowLeft, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  author_type: string;
  author_email?: string;
  body: string;
  created_at: string;
};

function statusTone(status: SupportReportStatus): BadgeTone {
  if (status === "resolved") return "success";
  if (status === "in_progress") return "info";
  return "warning";
}

function formatMessageTime(iso: string): string {
  try {
    return format(new Date(iso), "d MMM yyyy HH:mm", { locale: tr });
  } catch {
    return iso;
  }
}

export type TicketScreenProps = {
  ticketId: string;
};

export function TicketScreen({ ticketId }: TicketScreenProps) {
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
    return (
      <div className="mx-auto max-w-2xl space-y-4 pb-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="pb-8 text-sm text-muted-foreground">
        Bilet bulunamadı.{" "}
        <Link href="/support" className="font-medium text-primary hover:text-primary-hover">
          Listeye dön
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      <div className="space-y-3">
        <Link
          href="/support"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Tüm talepler
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="font-mono text-xs text-primary">{ticket.ticket_id}</p>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{ticket.subject}</h1>
            <p className="text-sm text-muted-foreground">
              Genellikle 4 iş saati içinde yanıt veriyoruz.
            </p>
          </div>
          <Badge tone={statusTone(ticket.status)}>{SUPPORT_STATUS_LABELS[ticket.status]}</Badge>
        </div>
      </div>

      {ticket.attachments?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ticket.attachments.map((a, i) =>
            a.signedUrl ? (
              <a
                key={i}
                href={a.signedUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-inset px-2.5 py-1 text-xs text-primary hover:bg-surface-2"
              >
                <Paperclip className="size-3.5" aria-hidden />
                {a.name}
              </a>
            ) : null
          )}
        </div>
      )}

      <ul
        className="space-y-4 rounded-xl border border-border bg-surface-inset/40 p-4"
        aria-label="Mesajlar"
      >
        {messages.map((m) => {
          const isStaff = m.author_type === "staff";
          return (
            <li
              key={m.id}
              className={cn(
                "max-w-[92%] rounded-xl px-3 py-2 text-sm",
                isStaff
                  ? "mr-auto border border-border bg-surface-2 text-foreground"
                  : "ml-auto bg-primary/15 text-foreground"
              )}
            >
              <p className="mb-1 text-xs text-muted-foreground">
                {isStaff ? "Destek ekibi" : "Siz"} · {formatMessageTime(m.created_at)}
              </p>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </li>
          );
        })}
      </ul>

      {ticket.status !== "resolved" && (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <Textarea
            rows={4}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Yanıtınız…"
          />
          <Button type="button" onClick={() => void sendMessage()} disabled={sending}>
            {sending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              "Gönder"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
