"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from "@/components/ds";
import { SupportReportFormFields } from "@/features/support/support-report-form-fields";
import type { SupportReportFormState } from "@/features/support/use-support-report-form";
import { Loader2, Mail } from "lucide-react";

export type ReportProblemSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: SupportReportFormState;
};

export function ReportProblemSheet({ open, onOpenChange, form }: ReportProblemSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-sm:max-h-[95dvh]">
        <DialogHeader>
          <DialogTitle>Sorun bildir</DialogTitle>
          <DialogDescription>Teknik ekibe bildirim gönderin</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          <SupportReportFormFields
            form={form}
            variant="v2"
            Input={Input}
            Textarea={Textarea}
            Label={({ children, className }) => (
              <Label className={className}>{children}</Label>
            )}
          />
        </div>
        <DialogFooter className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <a
            href={form.mailto}
            className="inline-flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Mail className="h-3.5 w-3.5" aria-hidden />
            E-posta istemcisi (yedek)
          </a>
          <Button
            type="button"
            onClick={() => void form.handleSubmit()}
            disabled={form.sending}
            className="min-h-11 w-full sm:w-auto"
          >
            {form.sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Gönder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
