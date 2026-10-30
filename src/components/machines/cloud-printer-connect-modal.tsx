"use client";

import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { CloudConnectStep } from "@/features/printer-connect/cloud-connect-step";
import type { PrinterVendor } from "@/lib/printer-cloud/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  initialAccountId?: string | null;
  initialMock?: boolean;
  reconnectAccountId?: string | null;
  reconnectVendor?: PrinterVendor | null;
};

export function CloudPrinterConnectModal({
  open,
  onOpenChange,
  onSaved,
  initialAccountId = null,
  initialMock = false,
  reconnectAccountId = null,
  reconnectVendor = null,
}: Props) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-lg">
        {open && (
          <>
            <ModalHeader
              title="Yazıcıları bağla"
              subtitle="Üretici hesabınızla giriş yapın ve yazıcıları seçin"
            />
            <ModalBody>
              <CloudConnectStep
                key={`${initialAccountId ?? "vendor"}-${reconnectAccountId ?? ""}`}
                initialAccountId={initialAccountId}
                initialMock={initialMock}
                reconnectAccountId={reconnectAccountId}
                reconnectVendor={reconnectVendor}
                onLinked={() => {
                  onSaved();
                  onOpenChange(false);
                }}
                onBack={() => onOpenChange(false)}
              />
            </ModalBody>
            <ModalFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Kapat
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
