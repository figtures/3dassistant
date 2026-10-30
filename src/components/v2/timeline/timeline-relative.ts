const rtf = new Intl.RelativeTimeFormat("tr", { numeric: "auto" });

export function timelineRelativeShort(time: number, now: number): string {
  const diffSec = Math.round((time - now) / 1000);
  const absSec = Math.abs(diffSec);
  if (absSec < 60) return "az önce";
  const minutes = Math.round(diffSec / 60);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(diffSec / 3600);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  const days = Math.round(diffSec / 86400);
  return rtf.format(days, "day");
}

export function timelineRelativeLong(time: number, now: number): string {
  return timelineRelativeShort(time, now);
}
