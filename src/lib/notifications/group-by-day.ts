import { format, isToday, isYesterday, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import type { Notification } from "@/types/database";

export type NotificationDayGroup = {
  key: string;
  label: string;
  items: Notification[];
};

export function labelNotificationDay(iso: string, now = new Date()): string {
  const date = parseISO(iso);
  if (isToday(date)) return "Bugün";
  if (isYesterday(date)) return "Dün";
  return format(date, "d MMMM yyyy", { locale: tr });
}

export function groupNotificationsByDay(
  items: Notification[],
  now = new Date()
): NotificationDayGroup[] {
  const map = new Map<string, NotificationDayGroup>();

  for (const item of items) {
    const dayKey = item.created_at.slice(0, 10);
    let group = map.get(dayKey);
    if (!group) {
      group = {
        key: dayKey,
        label: labelNotificationDay(item.created_at, now),
        items: [],
      };
      map.set(dayKey, group);
    }
    group.items.push(item);
  }

  return [...map.values()];
}
