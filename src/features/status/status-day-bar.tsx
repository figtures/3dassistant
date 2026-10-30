"use client";

import { useCallback, useId, useRef } from "react";
import { cn } from "@/lib/utils";
import type { DailyUptimeBar, DayUptimeState } from "@/lib/status/checks";

const STATE_CLASS: Record<DayUptimeState, string> = {
  operational: "bg-success",
  degraded: "bg-warning",
  down: "bg-destructive",
  unknown: "bg-muted",
};

const STATE_LABEL: Record<DayUptimeState, string> = {
  operational: "Sorunsuz",
  degraded: "Kısmi kesinti",
  down: "Kesinti",
  unknown: "Veri yok",
};

type StatusDayBarProps = {
  bars: DailyUptimeBar[];
  serviceLabel: string;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
};

export function StatusDayBar({
  bars,
  serviceLabel,
  selectedDate,
  onSelectDate,
}: StatusDayBarProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const detailId = useId();

  const focusIndex = useCallback(
    (index: number) => {
      const el = listRef.current?.querySelector<HTMLButtonElement>(
        `[data-day-index="${index}"]`
      );
      el?.focus();
    },
    []
  );

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (index < bars.length - 1) focusIndex(index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (index > 0) focusIndex(index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusIndex(bars.length - 1);
    }
  }

  const selected =
    selectedDate != null ? bars.find((b) => b.date === selectedDate) : null;

  return (
    <div className="space-y-2">
      <div
        ref={listRef}
        role="list"
        aria-label={`${serviceLabel} — son ${bars.length} gün`}
        className="flex gap-px rounded-md bg-border p-px"
      >
        {bars.map((bar, index) => {
          const selectedDay = bar.date === selectedDate;
          return (
            <button
              key={bar.date}
              type="button"
              role="listitem"
              data-day-index={index}
              aria-label={`${bar.date}: ${STATE_LABEL[bar.state]}`}
              aria-describedby={selectedDay ? detailId : undefined}
              aria-pressed={selectedDay}
              className={cn(
                "h-8 min-w-0 flex-1 rounded-[2px] outline-none transition-opacity",
                STATE_CLASS[bar.state],
                "hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                selectedDay && "ring-2 ring-foreground ring-offset-1 ring-offset-background"
              )}
              onClick={() => onSelectDate(selectedDay ? null : bar.date)}
              onKeyDown={(e) => onKeyDown(e, index)}
              onFocus={() => onSelectDate(bar.date)}
            />
          );
        })}
      </div>
      <p
        id={detailId}
        className="min-h-[2.5rem] text-sm text-muted-foreground"
        aria-live="polite"
      >
        {selected ? (
          <>
            <span className="font-medium text-foreground">{selected.date}</span>
            {" · "}
            {STATE_LABEL[selected.state]}
            {selected.totalChecks > 0 ? (
              <>
                {" · "}
                {selected.totalChecks} kontrol
                {selected.failedChecks > 0
                  ? ` (${selected.failedChecks} başarısız)`
                  : ""}
              </>
            ) : (
              " · Henüz kayıt yok"
            )}
          </>
        ) : (
          "Bir güne odaklanın veya ok tuşlarıyla gezinin."
        )}
      </p>
    </div>
  );
}
