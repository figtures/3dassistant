"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
} from "@/components/ds";
import { BulkBar } from "@/components/ds/data-table/bulk-bar";
import type { Machine } from "@/types/database";
import type { JobStatus } from "@/types/database";

const selectClassName =
  "flex h-[var(--density-control-h)] rounded-lg border border-input bg-surface-inset px-3 text-sm text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]";

export type OrdersBulkPanelProps = {
  count: number;
  machines: Machine[];
  showFinance: boolean;
  canEditFinance: boolean;
  onClear: () => void;
  onStatus: (status: JobStatus) => void;
  onAssignMachine: (machineId: string) => void;
  onShiftDelivery: (days: number) => void;
  onMarkPaid: () => void;
  onDelete: () => void;
};

export function OrdersBulkPanel({
  count,
  machines,
  showFinance,
  canEditFinance,
  onClear,
  onStatus,
  onAssignMachine,
  onShiftDelivery,
  onMarkPaid,
  onDelete,
}: OrdersBulkPanelProps) {
  const [machineOpen, setMachineOpen] = useState(false);
  const [machineId, setMachineId] = useState("");
  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftDays, setShiftDays] = useState("1");

  return (
    <>
      <BulkBar count={count} label="sipariş seçili" onClear={onClear}>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onStatus("in_progress")}
        >
          Üretime al
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onStatus("completed")}
        >
          Tamamla
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onStatus("pending")}
        >
          Beklemeye al
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            setMachineId(machines[0]?.id ?? "");
            setMachineOpen(true);
          }}
          disabled={!machines.length}
        >
          Makineye ata
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setShiftOpen(true)}
        >
          Teslim tarihi kaydır
        </Button>
        {showFinance && canEditFinance ? (
          <Button type="button" size="sm" variant="secondary" onClick={onMarkPaid}>
            Ödendi işaretle
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive"
          onClick={onDelete}
        >
          Sil
        </Button>
      </BulkBar>

      <Dialog open={machineOpen} onOpenChange={setMachineOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Makineye ata</DialogTitle>
          </DialogHeader>
          <FormField label="Makine" required>
            {(field) => (
              <select
                {...field}
                className={selectClassName}
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
              >
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <DialogFooter>
            <Button
              type="button"
              disabled={!machineId}
              onClick={() => {
                onAssignMachine(machineId);
                setMachineOpen(false);
              }}
            >
              Ata
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shiftOpen} onOpenChange={setShiftOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Teslim tarihi kaydır</DialogTitle>
          </DialogHeader>
          <FormField
            label="Gün (negatif = geri)"
            description="Seçili siparişlerin teslim tarihine eklenir."
            required
          >
            {(field) => (
              <Input
                {...field}
                type="number"
                value={shiftDays}
                onChange={(e) => setShiftDays(e.target.value)}
              />
            )}
          </FormField>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                const days = parseInt(shiftDays, 10);
                if (Number.isNaN(days)) return;
                onShiftDelivery(days);
                setShiftOpen(false);
              }}
            >
              Uygula
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
