import type { Job } from "@/types/database";
import {
  addDays,
  format,
  isSameDay,
  parseISO,
  startOfDay,
} from "date-fns";
import { tr } from "date-fns/locale";

export type DeliveryAlertKind = "overdue" | "today" | "tomorrow";

export interface DeliveryAlertGroup {
  kind: DeliveryAlertKind;
  label: string;
  description: string;
  jobs: Job[];
}

const ALERT_META: Record<
  DeliveryAlertKind,
  { label: string; description: string }
> = {
  overdue: {
    label: "Teslimi Gecikenler",
    description: "Termin tarihi geçmiş, henüz tamamlanmamış işler",
  },
  today: {
    label: "Bugün Teslim Edilecekler",
    description: "Bugün teslim edilmesi gereken işler",
  },
  tomorrow: {
    label: "Yarın Teslim Edilecekler",
    description: "Yarın teslim edilmesi gereken işler",
  },
};

export function isActiveDeliveryJob(job: Job): boolean {
  return (
    !!job.delivery_date &&
    job.status !== "completed" &&
    job.status !== "cancelled"
  );
}

export function computeDeliveryAlerts(jobs: Job[]): DeliveryAlertGroup[] {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);

  const active = jobs.filter(isActiveDeliveryJob);

  const groups: DeliveryAlertGroup[] = [
    {
      kind: "overdue",
      ...ALERT_META.overdue,
      jobs: active
        .filter((j) => startOfDay(parseISO(j.delivery_date!)) < today)
        .sort((a, b) => a.delivery_date!.localeCompare(b.delivery_date!)),
    },
    {
      kind: "today",
      ...ALERT_META.today,
      jobs: active
        .filter((j) => isSameDay(parseISO(j.delivery_date!), today))
        .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "")),
    },
    {
      kind: "tomorrow",
      ...ALERT_META.tomorrow,
      jobs: active
        .filter((j) => isSameDay(parseISO(j.delivery_date!), tomorrow))
        .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "")),
    },
  ];

  return groups.filter((g) => g.jobs.length > 0);
}

export function formatDeliveryDate(dateStr: string): string {
  return format(parseISO(dateStr), "d MMM yyyy", { locale: tr });
}

export function totalDeliveryAlerts(groups: DeliveryAlertGroup[]): number {
  return groups.reduce((sum, g) => sum + g.jobs.length, 0);
}
