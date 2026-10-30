import type { Job, JobStatus } from "@/types/database";
import { ORDER_STATUS_LABELS } from "@/features/orders/order-constants";

export const BOARD_COLUMN_STATUSES: JobStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
];

export type KanbanColumns = Record<JobStatus, Job[]>;

export function emptyKanbanColumns(): KanbanColumns {
  return {
    pending: [],
    in_progress: [],
    completed: [],
    cancelled: [],
  };
}

export function jobsToKanbanColumns(jobs: Job[]): KanbanColumns {
  const columns = emptyKanbanColumns();
  for (const job of jobs) {
    const status = BOARD_COLUMN_STATUSES.includes(job.status)
      ? job.status
      : "pending";
    columns[status].push(job);
  }
  for (const status of BOARD_COLUMN_STATUSES) {
    columns[status].sort((a, b) =>
      (a.delivery_date ?? a.job_date).localeCompare(
        b.delivery_date ?? b.job_date
      )
    );
  }
  return columns;
}

export function findJobStatusInColumns(
  columns: KanbanColumns,
  jobId: string
): JobStatus | null {
  for (const status of BOARD_COLUMN_STATUSES) {
    if (columns[status].some((j) => j.id === jobId)) return status;
  }
  return null;
}

export function kanbanColumnLabel(status: JobStatus): string {
  return ORDER_STATUS_LABELS[status];
}
