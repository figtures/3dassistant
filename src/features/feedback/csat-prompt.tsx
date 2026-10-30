"use client";

import { useEffect, useState } from "react";
import { Button, Textarea } from "@/components/ds";
import { shouldShowCsatPrompt } from "@/features/feedback/schedule";
import { cn } from "@/lib/utils";
import { Angry, Frown, Laugh, Loader2, Meh, Smile } from "lucide-react";
import { toast } from "sonner";
import type { SupportReportStatus } from "@/lib/support/status";

const CSAT_OPTIONS = [
  { score: 1, label: "Çok kötü", Icon: Angry },
  { score: 2, label: "Kötü", Icon: Frown },
  { score: 3, label: "Orta", Icon: Meh },
  { score: 4, label: "İyi", Icon: Smile },
  { score: 5, label: "Mükemmel", Icon: Laugh },
] as const;

export type CsatPromptProps = {
  ticketId: string;
  status: SupportReportStatus;
};

export function CsatPrompt({ ticketId, status }: CsatPromptProps) {
  const [checking, setChecking] = useState(true);
  const [visible, setVisible] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status !== "resolved") {
      setVisible(false);
      setChecking(false);
      return;
    }

    let active = true;
    void (async () => {
      const res = await fetch(`/api/feedback?kind=csat&ticketId=${encodeURIComponent(ticketId)}`);
      if (!active) return;
      if (!res.ok) {
        setVisible(false);
        setChecking(false);
        return;
      }
      const body = (await res.json()) as { submitted?: boolean };
      setVisible(shouldShowCsatPrompt(status, Boolean(body.submitted)));
      setChecking(false);
    })();

    return () => {
      active = false;
    };
  }, [status, ticketId]);

  async function submit() {
    if (score === null) {
      toast.error("Lütfen 1–5 arasında bir puan seçin");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "csat",
          score,
          comment: comment.trim() || undefined,
          context: { ticketId },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Gönderilemedi");
        return;
      }
      toast.success("Teşekkürler — geri bildiriminiz kaydedildi");
      setVisible(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (checking || !visible) {
    return null;
  }

  return (
    <section
      className="space-y-4 rounded-xl border border-border bg-surface-inset/50 p-4"
      aria-labelledby="csat-heading"
    >
      <div className="space-y-1">
        <h2 id="csat-heading" className="text-sm font-semibold text-foreground">
          Bu talep nasıl çözüldü?
        </h2>
        <p className="text-sm text-muted-foreground">Deneyiminizi 1–5 arasında puanlayın.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Memnuniyet puanı">
        {CSAT_OPTIONS.map(({ score: value, label, Icon }) => {
          const selected = score === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${value} — ${label}`}
              title={label}
              onClick={() => setScore(value)}
              className={cn(
                "inline-flex flex-col items-center gap-1 rounded-xl border px-3 py-2 text-xs transition-colors",
                "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
                selected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-5" aria-hidden />
              <span>{value}</span>
            </button>
          );
        })}
      </div>
      <Textarea
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Eklemek istediğiniz bir şey var mı? (isteğe bağlı)"
      />
      <Button type="button" onClick={() => void submit()} disabled={submitting}>
        {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Geri bildirimi gönder"}
      </Button>
    </section>
  );
}
