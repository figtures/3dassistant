"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type DragEndEvent,
  type DragStartEvent,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Job, Machine } from "@/types/database";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@/components/ds";
import { PlanJobBlock } from "@/features/planning/plan-cell";
import { cn } from "@/lib/utils";

export function planCellDroppableId(machineId: string, date: string): string {
  return `cell:${machineId}:${date}`;
}

export function parsePlanCellDroppableId(id: string): {
  machineId: string;
  date: string;
} | null {
  if (!id.startsWith("cell:")) return null;
  const parts = id.split(":");
  if (parts.length !== 3) return null;
  return { machineId: parts[1]!, date: parts[2]! };
}

type PlanDndProviderProps = {
  children: React.ReactNode;
  onJobMove: (
    jobId: string,
    target: { machineId: string; date: string }
  ) => void | Promise<void>;
  renderOverlay?: (job: Job) => React.ReactNode;
  jobsById: Map<string, Job>;
};

export function PlanDndProvider({
  children,
  onJobMove,
  renderOverlay,
  jobsById,
}: PlanDndProviderProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor)
  );

  const activeJob = activeId ? jobsById.get(activeId) : undefined;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null);
      const jobId = String(event.active.id);
      const over = event.over;
      if (!over) return;
      const parsed = parsePlanCellDroppableId(String(over.id));
      if (!parsed) return;
      await onJobMove(jobId, {
        machineId: parsed.machineId,
        date: parsed.date,
      });
    },
    [onJobMove]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={(e) => void handleDragEnd(e)}
      accessibility={{
        announcements: {
          onDragStart() {
            return "Sipariş bloğu taşınıyor";
          },
          onDragOver() {
            return "Hedef hücrenin üzerinde";
          },
          onDragEnd() {
            return "Sipariş yeni hücreye bırakıldı";
          },
          onDragCancel() {
            return "Taşıma iptal edildi";
          },
        },
        screenReaderInstructions: {
          draggable: `
            Bloğu taşımak için boşluk veya enter.
            Ok tuşlarıyla hedef hücreye gidin.
            Bırakmak için tekrar boşluk veya enter; iptal için escape.
          `,
        },
      }}
    >
      {children}
      <DragOverlay>
        {activeJob && renderOverlay ? (
          renderOverlay(activeJob)
        ) : activeJob ? (
          <div className="rounded-lg border border-primary/40 bg-card p-2 opacity-90 shadow-e2">
            <span className="text-xs font-medium">
              {activeJob.title ?? "Sipariş"}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export function DroppablePlanCell({
  machineId,
  date,
  className,
  children,
}: {
  machineId: string;
  date: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: planCellDroppableId(machineId, date),
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        isOver && "ring-2 ring-inset ring-primary/50 rounded-md"
      )}
    >
      {children}
    </div>
  );
}

export function DraggablePlanJobBlock({
  job,
  selected,
  onSelect,
  onOpen,
  onMoveRequest,
}: {
  job: Job;
  selected?: boolean;
  onSelect?: () => void;
  onOpen: () => void;
  onMoveRequest?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: job.id });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative",
        isDragging && "opacity-40",
        selected && "rounded-lg ring-2 ring-primary"
      )}
      data-testid={`plan-job-${job.id}`}
      onFocus={onSelect}
      onClick={onSelect}
      {...listeners}
      {...attributes}
    >
      <PlanJobBlock job={job} onOpen={onOpen} />
      {onMoveRequest ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="absolute right-1 top-1 h-7 px-2 text-xs opacity-0 transition-opacity group-hover/cell:opacity-100 focus-visible:opacity-100"
          aria-label={`${job.title ?? "Sipariş"} — taşı`}
          data-testid={`plan-move-${job.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onMoveRequest();
          }}
        >
          Taşı
        </Button>
      ) : null}
    </div>
  );
}

export function PlanMoveDialog({
  open,
  job,
  machines,
  dates,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  job: Job | null;
  machines: Machine[];
  dates: string[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (machineId: string, date: string) => void;
}) {
  const [machineId, setMachineId] = useState(job?.machine_id ?? "");
  const [date, setDate] = useState(job?.job_date ?? "");

  useEffect(() => {
    if (job) {
      setMachineId(job.machine_id);
      setDate(job.job_date);
    }
  }, [job]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Siparişi taşı</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {job?.title ?? "Sipariş"} için makine ve gün seçin.
        </p>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="plan-move-machine">Makine</Label>
            <select
              id="plan-move-machine"
              className="flex h-[var(--density-control-h)] w-full rounded-lg border border-input bg-surface-inset px-3 text-sm"
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
            >
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan-move-date">Gün</Label>
            <select
              id="plan-move-date"
              className="flex h-[var(--density-control-h)] w-full rounded-lg border border-input bg-surface-inset px-3 text-sm"
              value={dates.includes(date) ? date : (dates[0] ?? date)}
              onChange={(e) => setDate(e.target.value)}
            >
              {dates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Tarih"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button
            type="button"
            disabled={!machineId || !date}
            data-testid="plan-move-confirm"
            onClick={() => {
              if (!machineId || !date) return;
              onConfirm(machineId, date);
              onOpenChange(false);
            }}
          >
            Taşı
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function usePlanJobsById(jobs: Job[]): Map<string, Job> {
  return useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);
}
