"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { ChevronDown } from "lucide-react";
import { motionTokens } from "@/components/v2/timeline/motion-tokens";
import {
  timelineRelativeLong,
  timelineRelativeShort,
} from "@/components/v2/timeline/timeline-relative";
import styles from "@/components/v2/timeline/timeline.module.css";

export interface TimelineEvent {
  id: string;
  at: string | number;
  actor?: string;
  title: string;
  meta?: string;
  detail?: ReactNode;
  avatar?: string;
  icon?: ReactNode;
  tone?: "neutral" | "success" | "danger";
}

export interface TimelineProps {
  events: TimelineEvent[];
  now: number;
  label: string;
  timeZone?: string;
  locale?: string;
  maxHeight?: number | string;
  scrollToNew?: boolean;
  defaultExpanded?: string[];
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

type Row = TimelineEvent & { time: number; day: string };
type Group = { day: string; label: string; rows: Row[] };

const HOUR = 3_600_000;
const enter = [...motionTokens.ease.enter] as [number, number, number, number];
const standard = [...motionTokens.ease.standard] as [
  number,
  number,
  number,
  number,
];
const STEP = 0.09;
const noopSubscribe = () => () => {};

function useReducedMotionSafe() {
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
  const reduced = useReducedMotion();
  return hydrated && !!reduced;
}

type Clock = { schedule: () => number; reduced: boolean; fresh: Set<string> };
const RevealClock = createContext<Clock | null>(null);

function RiseText({
  text,
  reduced,
  direction = 1,
}: {
  text: string;
  reduced: boolean;
  direction?: number;
}) {
  return (
    <span className={styles.rise} aria-hidden="true">
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.span
          key={text}
          className={styles.riseLine}
          custom={direction}
          variants={{
            from: (dir: number) =>
              reduced
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    y: `${0.3 * dir}em`,
                    filter: `blur(${motionTokens.blur.soft}px)`,
                  },
            to: { opacity: 1, y: "0em", filter: "blur(0px)" },
            gone: (dir: number) =>
              reduced
                ? { opacity: 0, transition: { duration: 0 } }
                : {
                    opacity: 0,
                    y: `${-0.3 * dir}em`,
                    filter: `blur(${motionTokens.blur.subtle}px)`,
                    transition: { duration: 0.14, ease: standard },
                  },
          }}
          initial="from"
          animate="to"
          exit="gone"
          transition={{ duration: reduced ? 0.15 : 0.22, ease: enter }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function RollingCount({ value, reduced }: { value: number; reduced: boolean }) {
  const [state, setState] = useState({ value, direction: 1 });
  if (state.value !== value)
    setState({ value, direction: value > state.value ? 1 : -1 });
  const chars = [...String(value)];
  return (
    <span className={styles.rolling} aria-hidden="true">
      {chars.map((char, index) => (
        <span key={chars.length - index} className={styles.place}>
          <RiseText text={char} reduced={reduced} direction={state.direction} />
        </span>
      ))}
    </span>
  );
}

function dayKey(time: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(time));
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function DaySection({
  id,
  fresh,
  reduced,
  children,
}: {
  id: string;
  fresh: boolean;
  reduced: boolean;
  children: ReactNode;
}) {
  const [entering, setEntering] = useState(fresh);
  return (
    <motion.section
      className={styles.group}
      aria-labelledby={id}
      data-entering={entering || undefined}
      initial={fresh ? { height: 0, opacity: 0 } : false}
      animate={{ height: "auto", opacity: 1 }}
      exit={{
        height: 0,
        opacity: 0,
        transition: { duration: reduced ? 0.1 : 0.2, ease: standard },
      }}
      transition={
        reduced
          ? { duration: 0.15 }
          : {
              height: motionTokens.spring.smooth,
              opacity: {
                duration: motionTokens.duration.standard,
                ease: enter,
              },
            }
      }
      onAnimationComplete={() => setEntering(false)}
    >
      {children}
    </motion.section>
  );
}

function TimelineRow({
  row,
  last,
  expanded,
  onToggle,
  timeLabel,
  timeFull,
}: {
  row: Row;
  last: boolean;
  expanded: boolean;
  onToggle: () => void;
  timeLabel: string;
  timeFull: string;
}) {
  const clock = useContext(RevealClock)!;
  const { reduced } = clock;
  const detailId = useId();
  const [revealDelay, setRevealDelay] = useState<number | null>(null);
  const fresh = clock.fresh.has(row.id);
  const [entering, setEntering] = useState(fresh);
  const shown = revealDelay !== null;
  const delay = (revealDelay ?? 0) + (fresh ? 0.12 : 0);
  const pop: Transition = reduced
    ? { duration: 0, opacity: { duration: 0.15 } }
    : {
        ...motionTokens.spring.morph,
        visualDuration: 0.36,
        bounce: 0.32,
        delay,
        opacity: { duration: motionTokens.duration.fast, ease: enter, delay },
      };
  const draw: Transition = reduced
    ? { duration: 0 }
    : {
        ...motionTokens.spring.smooth,
        visualDuration: 0.34,
        delay: delay + 0.1,
      };
  const tone = row.avatar ? undefined : (row.tone ?? "neutral");
  const Trigger = row.detail ? "button" : "div";

  return (
    <motion.li
      className={styles.item}
      data-entering={entering || undefined}
      initial={fresh ? { height: 0 } : false}
      animate={{ height: "auto" }}
      exit={{
        height: 0,
        opacity: 0,
        transition: reduced
          ? { duration: 0.1 }
          : {
              height: { ...motionTokens.spring.smooth, visualDuration: 0.3 },
              opacity: { duration: 0.12 },
            },
      }}
      transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}
      onAnimationComplete={() => setEntering(false)}
      onViewportEnter={() =>
        setRevealDelay((current) => current ?? clock.schedule())
      }
      viewport={{ once: true, amount: 0.2 }}
    >
      <motion.span
        className={styles.marker}
        data-tone={tone}
        aria-hidden="true"
        initial={{ scale: 0.4, opacity: 0 }}
        animate={shown ? { scale: 1, opacity: 1 } : undefined}
        transition={pop}
      >
        {row.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.avatar}
            alt=""
            width={28}
            height={28}
            decoding="async"
          />
        ) : (
          row.icon
        )}
      </motion.span>
      {!last && (
        <motion.span
          className={styles.segment}
          aria-hidden="true"
          initial={{ scaleY: 0 }}
          animate={shown ? { scaleY: 1 } : undefined}
          transition={draw}
        />
      )}
      <motion.div
        className={styles.content}
        initial={
          fresh
            ? reduced
              ? { opacity: 0 }
              : {
                  opacity: 0,
                  y: -10,
                  filter: `blur(${motionTokens.blur.soft}px)`,
                }
            : false
        }
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={
          reduced
            ? { duration: 0.15 }
            : {
                y: motionTokens.spring.smooth,
                opacity: {
                  duration: motionTokens.duration.standard,
                  ease: enter,
                  delay: 0.05,
                },
                filter: {
                  duration: motionTokens.duration.standard,
                  ease: enter,
                  delay: 0.05,
                },
              }
        }
      >
        <Trigger
          className={styles.trigger}
          {...(row.detail
            ? {
                type: "button" as const,
                "data-timeline-trigger": "",
                "aria-expanded": expanded,
                "aria-controls": expanded ? detailId : undefined,
                onClick: onToggle,
              }
            : {})}
        >
          <span className={styles.text}>
            <span className={styles.title}>
              {row.actor && <span className={styles.actor}>{row.actor}</span>}
              {row.actor ? " " : ""}
              {row.title}
            </span>
            {row.meta && <span className={styles.meta}>{row.meta}</span>}
          </span>
          <time
            className={styles.time}
            dateTime={new Date(row.time).toISOString()}
            title={timeFull}
          >
            <RiseText text={timeLabel} reduced={reduced} />
            <span className={styles.srOnly}>{timeFull}</span>
          </time>
          {row.detail && (
            <motion.span
              className={styles.chevron}
              aria-hidden="true"
              initial={false}
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={
                reduced ? { duration: 0 } : motionTokens.spring.snappy
              }
            >
              <ChevronDown size={16} strokeWidth={1.75} />
            </motion.span>
          )}
        </Trigger>
        <AnimatePresence initial={false}>
          {expanded && row.detail && (
            <motion.div
              key="detail"
              id={detailId}
              className={styles.detail}
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{
                height: 0,
                transition: reduced
                  ? { duration: 0 }
                  : { ...motionTokens.spring.smooth, visualDuration: 0.28 },
              }}
              transition={
                reduced ? { duration: 0 } : motionTokens.spring.smooth
              }
            >
              <motion.div
                className={styles.detailInner}
                initial={
                  reduced
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        y: -4,
                        filter: `blur(${motionTokens.blur.soft}px)`,
                      }
                }
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{
                  opacity: 0,
                  transition: { duration: 0.1, ease: standard },
                }}
                transition={
                  reduced
                    ? { duration: 0.15 }
                    : {
                        duration: motionTokens.duration.standard,
                        ease: enter,
                        delay: 0.06,
                      }
                }
              >
                {row.detail}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.li>
  );
}

export function Timeline({
  events,
  now,
  label,
  timeZone = "Europe/Istanbul",
  locale = "tr-TR",
  maxHeight,
  scrollToNew = true,
  defaultExpanded = [],
  headingLevel = 3,
  className,
}: TimelineProps) {
  const reduced = useReducedMotionSafe();
  const id = useId();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(() => new Set(defaultExpanded));

  const ids = events.map((event) => event.id).join("|");
  const [known, setKnown] = useState(() => ({
    ids,
    set: new Set(events.map((event) => event.id)),
    fresh: new Set<string>(),
    announcement: "",
  }));
  if (known.ids !== ids) {
    const added = events.filter((event) => !known.set.has(event.id));
    setKnown({
      ids,
      set: new Set(events.map((event) => event.id)),
      fresh: new Set([...known.fresh, ...added.map((event) => event.id)]),
      announcement: added.length
        ? `Yeni kayıt: ${added.map((event) => [event.actor, event.title].filter(Boolean).join(" ")).join(". ")}`
        : known.announcement,
    });
  }

  const trackRef = useRef<HTMLDivElement>(null);
  const scrolls = maxHeight !== undefined;
  useEffect(() => {
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    if (
      !scrolls ||
      !scroller ||
      !track ||
      typeof ResizeObserver === "undefined"
    )
      return;
    const update = () => {
      if (
        scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop >
        2
      )
        scroller.dataset.more = "";
      else delete scroller.dataset.more;
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    observer.observe(track);
    return () => {
      scroller.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [scrolls]);

  const newestId = events.reduce<TimelineEvent | null>(
    (latest, event) =>
      !latest || new Date(event.at).getTime() > new Date(latest.at).getTime()
        ? event
        : latest,
    null
  )?.id;
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scrollToNew || !scroller || scroller.scrollTop < 1) return;
    scroller.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }, [newestId, scrollToNew, reduced]);

  const [initialDays] = useState(
    () =>
      new Set(
        events.map((event) => dayKey(new Date(event.at).getTime(), timeZone))
      )
  );
  const groups = useMemo<Group[]>(() => {
    const today = dayKey(now, timeZone);
    const yesterday = dayKey(now - 24 * HOUR, timeZone);
    const heading = new Intl.DateTimeFormat(locale, {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone,
    });
    const byDay = new Map<string, Row[]>();
    [...events]
      .map((event) => ({ ...event, time: new Date(event.at).getTime() }))
      .sort((a, b) => b.time - a.time)
      .forEach((event) => {
        const day = dayKey(event.time, timeZone);
        byDay.set(day, [...(byDay.get(day) ?? []), { ...event, day }]);
      });
    return [...byDay].map(([day, rows]) => ({
      day,
      rows,
      label:
        day === today
          ? "Bugün"
          : day === yesterday
            ? "Dün"
            : heading.format(new Date(rows[0].time)),
    }));
  }, [events, now, timeZone, locale]);
  const formats = useMemo(
    () => ({
      clock: new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
        timeZone,
      }),
      full: new Intl.DateTimeFormat(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone,
      }),
    }),
    [locale, timeZone]
  );

  const nextReveal = useRef(0);
  const schedule = useCallback(() => {
    if (reduced) return 0;
    const current = performance.now() / 1000;
    const start = Math.min(
      Math.max(current, nextReveal.current),
      current + 0.45
    );
    nextReveal.current = start + STEP;
    return start - current;
  }, [reduced]);
  const clock = useMemo<Clock>(
    () => ({ schedule, reduced, fresh: known.fresh }),
    [schedule, reduced, known.fresh]
  );

  function toggle(eventId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const triggers = [
      ...(scrollerRef.current?.querySelectorAll<HTMLElement>(
        "[data-timeline-trigger]"
      ) ?? []),
    ];
    const index = triggers.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? triggers.length - 1
          : Math.min(
              Math.max(index + (event.key === "ArrowDown" ? 1 : -1), 0),
              triggers.length - 1
            );
    triggers[next]?.focus();
  }

  return (
    <RevealClock.Provider value={clock}>
      <div
        className={[styles.root, className].filter(Boolean).join(" ")}
        role="region"
        aria-label={label}
      >
        <div
          ref={scrollerRef}
          className={styles.scroller}
          data-scrolls={scrolls || undefined}
          style={
            scrolls
              ? ({
                  "--timeline-height":
                    typeof maxHeight === "number"
                      ? `${maxHeight}px`
                      : maxHeight,
                } as CSSProperties)
              : undefined
          }
          onKeyDown={onKeyDown}
        >
          <div ref={trackRef}>
            <AnimatePresence>
              {groups.map((group) => (
                <DaySection
                  key={group.day}
                  id={`${id}-${group.day}`}
                  fresh={!initialDays.has(group.day)}
                  reduced={reduced}
                >
                  <div
                    className={styles.day}
                    role="heading"
                    aria-level={headingLevel}
                    id={`${id}-${group.day}`}
                  >
                    <span>{group.label}</span>
                    <span className={styles.count} aria-hidden="true">
                      <RollingCount
                        value={group.rows.length}
                        reduced={reduced}
                      />{" "}
                      {group.rows.length === 1 ? "kayıt" : "kayıt"}
                    </span>
                    <span className={styles.srOnly}>
                      {`, ${group.rows.length} kayıt`}
                    </span>
                  </div>
                  <ol className={styles.list}>
                    <AnimatePresence>
                      {group.rows.map((row, index) => {
                        const todayGroup =
                          group.label === "Bugün" && now - row.time < 12 * HOUR;
                        const time = todayGroup
                          ? {
                              short: timelineRelativeShort(row.time, now),
                              long: timelineRelativeLong(row.time, now),
                            }
                          : {
                              short: formats.clock.format(new Date(row.time)),
                              long: "",
                            };
                        return (
                          <TimelineRow
                            key={row.id}
                            row={row}
                            last={index === group.rows.length - 1}
                            expanded={expanded.has(row.id)}
                            onToggle={() => toggle(row.id)}
                            timeLabel={time.short}
                            timeFull={
                              todayGroup
                                ? `${time.long}, ${formats.full.format(new Date(row.time))}`
                                : formats.full.format(new Date(row.time))
                            }
                          />
                        );
                      })}
                    </AnimatePresence>
                  </ol>
                </DaySection>
              ))}
            </AnimatePresence>
          </div>
        </div>
        <span className={styles.srOnly} role="status">
          {known.announcement}
        </span>
      </div>
    </RevealClock.Provider>
  );
}
