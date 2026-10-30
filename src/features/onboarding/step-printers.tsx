"use client";

import { Button } from "@/components/ds/button";
import { useMachines } from "@/hooks/use-data";
import { PrinterConnectWizard } from "@/features/printer-connect/printer-connect-wizard";

type StepPrintersProps = {
  onContinue: () => void;
  onSkip: () => void;
};

export function StepPrinters({ onContinue, onSkip }: StepPrintersProps) {
  const { data: machines = [] } = useMachines();
  const hasConnected = machines.some((m) => m.connection_status === "connected");

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Yazıcılarınız</h2>
        <p className="text-sm text-muted-foreground">
          Canlı takip için yazıcı bağlayın veya şimdilik elle ekleyin.
        </p>
      </header>

      {hasConnected ? (
        <p className="rounded-lg border border-primary/30 bg-primary-subtle px-3 py-2 text-sm text-foreground">
          İlk canlı veri alındı — en az bir yazıcınız bağlı görünüyor.
        </p>
      ) : null}

      <PrinterConnectWizard mode="embedded" />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onSkip}>
          Atla
        </Button>
        <Button type="button" onClick={onContinue}>
          Devam
        </Button>
      </div>
    </div>
  );
}
