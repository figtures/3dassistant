"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Skeleton,
} from "@/components/ds";
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanItem,
  KanbanOverlay,
} from "@/components/ds/kanban";
import { formatDateShort } from "@/lib/format";
import { ORDER_STATUS_LABELS } from "@/features/orders/order-constants";
import {
  BOARD_COLUMN_STATUSES,
  findJobStatusInColumns,
  jobsToKanbanColumns,
  kanbanColumnLabel,
  type KanbanColumns,
} from "@/features/orders/orders-board-utils";
import { useOrdersBoard } from "@/features/orders/queries";
import { updateOrderStatus } from "@/features/orders/use-order-mutations";
import type { Job, JobStatus } from "@/types/database";
import { ClipboardList, GripVertical, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

type OrdersBoardProps = {
  q?: string;
  machineId?: string;
  customerId?: string;
  from?: string;
  to?: string;
  onOpenOrder: (id: string) => void;
};

function OrderBoardCard({
  job,
  onOpen,
  onMoveRequest,
}: {
  job: Job;
  onOpen: () => void;
  onMoveRequest: () => void;
}) {
  const title = job.title ?? "Sipariş";
  const customer = job.customer?.name;
  const machine = job.machine?.name;
  const delivery =
    job.delivery_date ?? job.job_date
      ? formatDateShort(job.delivery_date ?? job.job_date)
      : null;

  return (
    <div
      className="rounded-lg border border-border bg-card p-3 shadow-e0"
      data-testid={`kanban-card-${job.id}`}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 shrink-0 p-1 text-muted-foreground"
          aria-hidden
          data-testid={`kanban-drag-${job.id}`}
        >
          <GripVertical className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <button
            type="button"
            onClick={onOpen}
            className="block w-full truncate text-left text-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          >
            {title}
          </button>
          {customer ? (
            <p className="truncate text-xs text-muted-foreground">{customer}</p>
          ) : null}
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {delivery ? <span>Teslim: {delivery}</span> : null}
            {machine ? <span>{machine}</span> : null}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label={`${title} — taşı`}
          data-testid={`kanban-move-${job.id}`}
          onClick={onMoveRequest}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function MoveStatusDialog({
  open,
  job,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  job: Job | null;
  onOpenChange: (open: boolean) => void;
  onSelect: (status: JobStatus) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Siparişi taşı</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {job?.title ?? "Sipariş"} için yeni durum seçin.
        </p>
        <div className="flex flex-col gap-2 py-2">
          {BOARD_COLUMN_STATUSES.map((status) => (
            <Button
              key={status}
              type="button"
              variant="secondary"
              className="justify-start"
              disabled={job?.status === status}
              data-testid={`move-to-${status}`}
              onClick={() => onSelect(status)}
            >
              {kanbanColumnLabel(status)}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OrdersBoard({
  q,
  machineId,
  customerId,
  from,
  to,
  onOpenOrder,
}: OrdersBoardProps) {
  const queryClient = useQueryClient();
  const { data: jobs = [], isLoading, isError, refetch } = useOrdersBoard({
    q,
    machineId,
    customerId,
    from,
    to,
  });

  const serverColumns = useMemo(() => jobsToKanbanColumns(jobs), [jobs]);
  const [columns, setColumns] = useState<KanbanColumns>(serverColumns);
  const snapshotRef = useRef<KanbanColumns>(serverColumns);
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const dragOriginRef = useRef<KanbanColumns>(serverColumns);
  const [moveJob, setMoveJob] = useState<Job | null>(null);

  useEffect(() => {
    setColumns(serverColumns);
    snapshotRef.current = serverColumns;
  }, [serverColumns]);

  const persistStatus = useCallback(
    async (jobId: string, fromStatus: JobStatus, toStatus: JobStatus) => {
      if (fromStatus === toStatus) return;
      const supabase = createClient();
      const { error } = await updateOrderStatus(supabase, jobId, toStatus);
      if (error) {
        toast.error(error);
        setColumns({ ...snapshotRef.current });
        return;
      }
      snapshotRef.current = columns;
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders-board"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Durum güncellendi");
    },
    [columns, queryClient, serverColumns]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const jobId = String(event.active.id);
      const fromStatus = findJobStatusInColumns(dragOriginRef.current, jobId);
      const afterStatus = findJobStatusInColumns(columnsRef.current, jobId);
      if (!fromStatus || !afterStatus || fromStatus === afterStatus) return;
      void persistStatus(jobId, fromStatus, afterStatus);
    },
    [persistStatus]
  );

  const handleMoveDialogSelect = useCallback(
    (status: JobStatus) => {
      if (!moveJob) return;
      const fromStatus = moveJob.status;
      if (fromStatus === status) {
        setMoveJob(null);
        return;
      }

      const next = { ...columns };
      for (const col of BOARD_COLUMN_STATUSES) {
        next[col] = next[col].filter((j) => j.id !== moveJob.id);
      }
      next[status] = [...next[status], { ...moveJob, status }];
      setColumns(next);
      setMoveJob(null);
      void persistStatus(moveJob.id, fromStatus, status);
    },
    [columns, moveJob, persistStatus]
  );

  if (isLoading) {
    return <Skeleton className="h-[420px] w-full rounded-xl" aria-busy="true" />;
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-border p-5" role="alert">
        <p className="text-sm">Pano yüklenemedi.</p>
        <Button type="button" size="sm" className="mt-3" onClick={() => refetch()}>
          Tekrar dene
        </Button>
      </div>
    );
  }

  const totalCards = BOARD_COLUMN_STATUSES.reduce(
    (n, s) => n + columns[s].length,
    0
  );

  if (totalCards === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Pano boş"
        description="Filtrelere uyan sipariş yok veya henüz sipariş eklenmedi."
      />
    );
  }

  return (
    <>
      <Kanban
        value={columns}
        onValueChange={(next) => {
          setColumns(next as KanbanColumns);
        }}
        getItemValue={(item) => item.id}
        onDragStart={() => {
          dragOriginRef.current = columnsRef.current;
        }}
        onDragEnd={handleDragEnd}
        accessibility={{
          announcements: {
            onDragStart({ active }) {
              return `Sipariş kartı taşınıyor`;
            },
            onDragOver({ over }) {
              if (!over) return;
              const col = String(over.id) as JobStatus;
              return BOARD_COLUMN_STATUSES.includes(col)
                ? `${ORDER_STATUS_LABELS[col]} sütununun üzerinde`
                : undefined;
            },
            onDragEnd({ over }) {
              if (!over) return;
              const col = String(over.id) as JobStatus;
              if (BOARD_COLUMN_STATUSES.includes(col)) {
                return `${ORDER_STATUS_LABELS[col]} sütununa bırakıldı`;
              }
              return "Kart bırakıldı";
            },
            onDragCancel() {
              return "Taşıma iptal edildi";
            },
          },
        }}
      >
        <KanbanBoard
          className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-4"
          data-testid="order-board"
        >
          {BOARD_COLUMN_STATUSES.map((status) => (
            <KanbanColumn key={status} value={status}>
              <div className="flex items-center gap-2 px-1 pb-1">
                <span className="text-sm font-semibold text-foreground">
                  {kanbanColumnLabel(status)}
                </span>
                <Badge tone="neutral" className="tabular-nums">
                  {columns[status].length}
                </Badge>
              </div>
              <div className="flex flex-col gap-2">
                {columns[status].map((job) => (
                  <KanbanItem key={job.id} value={job.id} asHandle>
                    <OrderBoardCard
                      job={job}
                      onOpen={() => onOpenOrder(job.id)}
                      onMoveRequest={() => setMoveJob(job)}
                    />
                  </KanbanItem>
                ))}
              </div>
            </KanbanColumn>
          ))}
        </KanbanBoard>
        <KanbanOverlay>
          <div className="size-full rounded-lg border border-primary/30 bg-primary-subtle/80" />
        </KanbanOverlay>
      </Kanban>

      <MoveStatusDialog
        open={moveJob != null}
        job={moveJob}
        onOpenChange={(open) => {
          if (!open) setMoveJob(null);
        }}
        onSelect={handleMoveDialogSelect}
      />
    </>
  );
}
