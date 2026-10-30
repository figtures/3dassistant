export const NPS_MIN_DAYS_AFTER_SIGNUP = 14;
export const NPS_REPEAT_DAYS = 90;
export const NPS_SNOOZE_DAYS = 30;

export const NPS_SNOOZE_STORAGE_KEY = "pf.feedback.nps.snoozeUntil";

export type FeedbackKind = "nps" | "csat" | "page";

export function diffCalendarDays(from: Date, to: Date): number {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((end - start) / (24 * 60 * 60 * 1000));
}

export type NpsScheduleInput = {
  now: Date;
  userCreatedAt: Date;
  lastNpsSubmittedAt: Date | null;
  snoozedUntil: Date | null;
};

export function shouldShowNpsPrompt(input: NpsScheduleInput): boolean {
  const daysSinceSignup = diffCalendarDays(input.userCreatedAt, input.now);
  if (daysSinceSignup < NPS_MIN_DAYS_AFTER_SIGNUP) {
    return false;
  }

  if (input.snoozedUntil && input.snoozedUntil.getTime() > input.now.getTime()) {
    return false;
  }

  if (!input.lastNpsSubmittedAt) {
    return true;
  }

  return diffCalendarDays(input.lastNpsSubmittedAt, input.now) >= NPS_REPEAT_DAYS;
}

export function snoozeUntilFromNow(now: Date): Date {
  const until = new Date(now);
  until.setUTCDate(until.getUTCDate() + NPS_SNOOZE_DAYS);
  return until;
}

export function readNpsSnoozeUntil(): Date | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(NPS_SNOOZE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

export function writeNpsSnoozeUntil(until: Date): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NPS_SNOOZE_STORAGE_KEY, until.toISOString());
  } catch {
    // localStorage dolu veya devre dışı
  }
}

export function shouldShowCsatPrompt(ticketStatus: string, alreadySubmitted: boolean): boolean {
  return ticketStatus === "resolved" && !alreadySubmitted;
}
