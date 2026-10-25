export type SupportReportStatus = "open" | "in_progress" | "resolved";

const TRANSITIONS: Record<SupportReportStatus, SupportReportStatus[]> = {
  open: ["in_progress", "resolved"],
  in_progress: ["open", "resolved"],
  resolved: ["open", "in_progress"],
};

export function canTransitionSupportStatus(
  from: SupportReportStatus,
  to: SupportReportStatus
): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export const SUPPORT_STATUS_LABELS: Record<SupportReportStatus, string> = {
  open: "Açık",
  in_progress: "İşleniyor",
  resolved: "Çözüldü",
};
