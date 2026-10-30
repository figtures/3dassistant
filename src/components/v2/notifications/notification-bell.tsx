"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  CircleDot,
  Filter,
  Loader2,
} from "lucide-react";
import { Button, EmptyState, Skeleton } from "@/components/ds";
import { groupNotificationsByDay } from "@/lib/notifications/group-by-day";
import {
  NOTIFICATION_KIND_LABELS,
  NOTIFICATION_KINDS,
  type NotificationKind,
} from "@/lib/notifications/kinds";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types/database";
import {
  useNotificationMutations,
  useNotifications,
  useUnreadNotificationCount,
} from "@/features/notifications/queries";

const filterClassName =
  "flex h-8 rounded-lg border border-input bg-surface-inset px-2 text-xs text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]";

function KindBadge({ kind }: { kind: NotificationKind }) {
  return (
    <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {NOTIFICATION_KIND_LABELS[kind]}
    </span>
  );
}

function NotificationRow({
  item,
  onMarkSeen,
  onMarkDone,
  busy,
}: {
  item: Notification;
  onMarkSeen: (id: string) => void;
  onMarkDone: (id: string) => void;
  busy: boolean;
}) {
  const unseen = !item.seen_at;
  const done = !!item.done_at;

  return (
    <li
      className={cn(
        "flex gap-3 border-b border-border/60 px-3 py-3 last:border-b-0",
        unseen && "bg-primary-subtle/30"
      )}
    >
      <div className="mt-0.5 shrink-0">
        {unseen ? (
          <CircleDot className="size-4 text-primary" aria-hidden />
        ) : (
          <span className="inline-block size-4" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-start gap-2">
          <KindBadge kind={item.kind} />
          {done ? (
            <span className="text-[10px] font-medium text-emerald-600">Tamamlandı</span>
          ) : null}
        </div>
        {item.href ? (
          <Link
            href={item.href}
            className="block text-sm font-medium text-foreground hover:underline"
            onClick={() => {
              if (unseen) onMarkSeen(item.id);
            }}
          >
            {item.title}
          </Link>
        ) : (
          <p className="text-sm font-medium text-foreground">{item.title}</p>
        )}
        {item.body ? (
          <p className="text-xs text-muted-foreground">{item.body}</p>
        ) : null}
        <div className="flex flex-wrap gap-1 pt-1">
          {unseen ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={busy}
              onClick={() => onMarkSeen(item.id)}
            >
              <Check className="size-3.5" aria-hidden />
              Görüldü
            </Button>
          ) : null}
          {!done ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={busy}
              onClick={() => onMarkDone(item.id)}
            >
              <CheckCheck className="size-3.5" aria-hidden />
              Tamamlandı
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [kindFilter, setKindFilter] = useState<string>("");
  const rootRef = useRef<HTMLDivElement>(null);

  const { data: unread = 0 } = useUnreadNotificationCount();
  const { data: items = [], isLoading, isError, refetch } = useNotifications(
    kindFilter || null
  );
  const { markSeen, markDone, markAllSeen } = useNotificationMutations();

  const groups = useMemo(() => groupNotificationsByDay(items), [items]);
  const busy =
    markSeen.isPending || markDone.isPending || markAllSeen.isPending;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative text-muted-foreground"
        aria-label={
          unread > 0 ? `Bildirimler, ${unread} okunmamış` : "Bildirimler"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-label="Bildirim paneli"
          className="absolute right-0 top-full z-50 mt-2 flex w-[min(100vw-2rem,380px)] flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <h2 className="text-sm font-semibold text-foreground">Bildirimler</h2>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                disabled={busy || unread === 0}
                onClick={() => markAllSeen.mutate()}
              >
                Tümünü görüldü say
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Filter className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <label className="sr-only" htmlFor="notification-kind-filter">
              Tür filtresi
            </label>
            <select
              id="notification-kind-filter"
              className={filterClassName}
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
            >
              <option value="">Tüm türler</option>
              {NOTIFICATION_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {NOTIFICATION_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
            <Link
              href="/settings/notifications"
              className="ml-auto text-xs text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              Tercihler
            </Link>
          </div>

          <div className="max-h-[min(60vh,420px)] overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : isError ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Bildirimler yüklenemedi.{" "}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => void refetch()}
                >
                  Tekrar dene
                </button>
              </div>
            ) : groups.length === 0 ? (
              <EmptyState
                className="py-10"
                title="Bildirim yok"
                description="Yeni uyarılar burada görünür."
              />
            ) : (
              groups.map((group) => (
                <section key={group.key} aria-label={group.label}>
                  <h3 className="sticky top-0 z-[1] bg-popover/95 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                    {group.label}
                  </h3>
                  <ul>
                    {group.items.map((item) => (
                      <NotificationRow
                        key={item.id}
                        item={item}
                        busy={busy}
                        onMarkSeen={(id) => markSeen.mutate(id)}
                        onMarkDone={(id) => markDone.mutate(id)}
                      />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>

          {busy ? (
            <div className="flex items-center justify-center gap-2 border-t border-border py-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Kaydediliyor…
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
