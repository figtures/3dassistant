"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { useUiVersion } from "@/components/flags/ui-version-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Textarea } from "@/components/ui/select";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { ReportProblemSheet } from "@/features/support/report-problem-sheet";
import { SupportReportFormFields } from "@/features/support/support-report-form-fields";
import {
  useSupportReportForm,
  type SupportReportOpenOptions,
} from "@/features/support/use-support-report-form";
import { LifeBuoy, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

type SupportReportContextValue = {
  openReport: (opts?: SupportReportOpenOptions) => void;
};

const SupportReportContext = createContext<SupportReportContextValue | null>(null);

export function useSupportReport() {
  const ctx = useContext(SupportReportContext);
  if (!ctx) {
    return { openReport: () => toast.error("Destek formu yüklenemedi") };
  }
  return ctx;
}

export type { SupportReportOpenOptions };

export function SupportReportProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ui = useUiVersion();
  const form = useSupportReportForm(() => setOpen(false));
  const { resetForOpen } = form;

  const openReport = useCallback(
    (opts?: SupportReportOpenOptions) => {
      resetForOpen(opts);
      setOpen(true);
    },
    [resetForOpen]
  );

  return (
    <SupportReportContext.Provider value={{ openReport }}>
      {children}
      {ui === "v2" ? (
        <ReportProblemSheet open={open} onOpenChange={setOpen} form={form} />
      ) : (
        <Modal open={open} onOpenChange={setOpen}>
          <ModalContent className="max-w-lg">
            <ModalHeader title="Sorun bildir" subtitle="Teknik ekibe bildirim gönderin" />
            <ModalBody>
              <SupportReportFormFields
                form={form}
                variant="legacy"
                Input={Input}
                Textarea={Textarea}
                Label={Label}
              />
            </ModalBody>
            <ModalFooter className="flex-col gap-2 sm:flex-row">
              <a
                href={form.mailto}
                className="inline-flex items-center justify-center gap-2 text-xs text-zinc-500 hover:text-zinc-300"
              >
                <Mail className="h-3.5 w-3.5" />
                E-posta istemcisi (yedek)
              </a>
              <Button
                onClick={() => void form.handleSubmit()}
                disabled={form.sending}
                className="min-h-11 w-full sm:w-auto"
              >
                {form.sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gönder"}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </SupportReportContext.Provider>
  );
}

export function SupportReportButton({
  className,
  variant = "ghost",
}: {
  className?: string;
  variant?: "ghost" | "outline";
}) {
  const { openReport } = useSupportReport();
  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      onClick={() => openReport()}
    >
      <LifeBuoy className="h-4 w-4" />
      Sorun bildir
    </Button>
  );
}
