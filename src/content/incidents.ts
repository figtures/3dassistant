import type { StatusService } from "@/lib/status/checks";

export type StatusIncident = {
  id: string;
  title: string;
  summary: string;
  services: StatusService[];
  startedAt: string;
  resolvedAt?: string;
  updates: { at: string; message: string }[];
};

/** Manuel olay notları — production'da güncellenir. */
export const STATUS_INCIDENTS: StatusIncident[] = [];
