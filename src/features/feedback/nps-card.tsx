"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Textarea } from "@/components/ds";
import {
  readNpsSnoozeUntil,
  shouldShowNpsPrompt,
  snoozeUntilFromNow,
  writeNpsSnoozeUntil,
} from "@/features/feedback/schedule";
import { cn } from "@/lib/utils";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

type NpsMeta = {
  userCreatedAt: string;
  lastNpsSubmittedAt: string | null;
};

export function NpsCard() {
  const [visible, setVisible] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/feedback?kind=nps");
        if (!active) return;
        if (!res.ok) {
          setVisible(false);
          return;
        }
        const body = (await res.json()) as NpsMeta;
        const now = new Date();
        const show = shouldShowNpsPrompt({
          now,
          userCreatedAt: new Date(body.userCreatedAt),
          lastNpsSubmittedAt: body.lastNpsSubmittedAt ? new Date(body.lastNpsSubmittedAt) : null,
          snoozedUntil: readNpsSnoozeUntil(),
        });
        setVisible(show);
      } finally {
        if (active) setLoadingMeta(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function dismissSnooze() {
    writeNpsSnoozeUntil(snoozeUntilFromNow(new Date()));
    setVisible(false);
  }

  async function submit() {
    if (score === null) {
      toast.error("Lütfen 0–10 arasında bir puan seçin");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "nps",
          score,
          comment: comment.trim() || undefined,
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

  if (loadingMeta || !visible) {
    return null;
  }

  return (
    <Card className="border-primary/25 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base">PrintFlow&apos;u başkalarına önerir misiniz?</CardTitle>
          <CardDescription>
            0 = hiç olası değil · 10 = kesinlikle öneririm
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={dismissSnooze}
          aria-label="Kapat"
        >
          <X className="size-4" aria-hidden />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="flex flex-wrap gap-1.5"
          role="radiogroup"
          aria-label="Tavsiye puanı 0 ile 10 arası"
        >
          {Array.from({ length: 11 }, (_, i) => i).map((value) => {
            const selected = score === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setScore(value)}
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg border text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface-inset text-foreground hover:bg-surface-2"
                )}
              >
                {value}
              </button>
            );
          })}
        </div>
        <Textarea
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="İsterseniz kısa bir not ekleyin (isteğe bağlı)"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void submit()} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Gönder"}
          </Button>
          <Button type="button" variant="ghost" onClick={dismissSnooze} disabled={submitting}>
            Şimdi değil
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
