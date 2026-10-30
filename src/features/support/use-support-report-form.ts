"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  isAllowedAttachmentMime,
  MAX_SUPPORT_ATTACHMENTS,
  MAX_SUPPORT_ATTACHMENT_BYTES,
  supportAttachmentStoragePath,
  SUPPORT_ATTACHMENT_BUCKET,
  type SupportAttachmentMeta,
} from "@/lib/support/attachments";
import {
  buildMailtoFallback,
  snapshotClientDiagnostics,
} from "@/lib/support/client-capture";
import type { SupportCategory } from "@/lib/support/types";
import { redactSecretsDeep } from "@/lib/support/redact";
import { toast } from "sonner";

export type SupportReportOpenOptions = {
  category?: SupportCategory;
  machineId?: string;
  subject?: string;
  description?: string;
};

export function useSupportReportForm(onSubmitted?: () => void) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<SupportCategory>("other");
  const [machineId, setMachineId] = useState<string>("");
  const [machines, setMachines] = useState<Array<{ id: string; name: string }>>([]);
  const [recentBundle, setRecentBundle] = useState<{ code: string; createdAt: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastTicketId, setLastTicketId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const uploadFolderId = useRef(crypto.randomUUID());

  const loadContext = useCallback(async () => {
    try {
      const res = await fetch("/api/support/context");
      if (!res.ok) return;
      const body = await res.json();
      setMachines(body.machines ?? []);
      setRecentBundle(body.recentBridgeBundle ?? null);
    } catch {
      /* ignore */
    }
  }, []);

  const resetForOpen = useCallback(
    (opts?: SupportReportOpenOptions) => {
      setSubject(opts?.subject ?? "");
      setDescription(opts?.description ?? "");
      setCategory(opts?.category ?? "other");
      setMachineId(opts?.machineId ?? "");
      setLastTicketId(null);
      setPendingFiles([]);
      setPreviewOpen(false);
      uploadFolderId.current = crypto.randomUUID();
      void loadContext();
    },
    [loadContext]
  );

  const currentDiagnostics = useCallback(() => {
    return redactSecretsDeep(
      snapshotClientDiagnostics({ bridgeBundleCode: recentBundle?.code })
    );
  }, [recentBundle?.code]);

  const handleSubmit = useCallback(async () => {
    if (subject.trim().length < 3 || description.trim().length < 10) {
      toast.error("Konu ve açıklama alanlarını doldurun");
      return;
    }
    setSending(true);
    try {
      const diagnostics = snapshotClientDiagnostics({
        bridgeBundleCode: recentBundle?.code,
      });

      const attachments: SupportAttachmentMeta[] = [];
      if (pendingFiles.length) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          toast.error("Oturum gerekli");
          return;
        }
        for (const file of pendingFiles) {
          if (!isAllowedAttachmentMime(file.type)) {
            toast.error("Yalnızca PNG, JPG veya WebP");
            return;
          }
          if (file.size > MAX_SUPPORT_ATTACHMENT_BYTES) {
            toast.error("Her görsel en fazla 5 MB olabilir");
            return;
          }
          const path = supportAttachmentStoragePath(user.id, uploadFolderId.current, file.name);
          const { error: upErr } = await supabase.storage
            .from(SUPPORT_ATTACHMENT_BUCKET)
            .upload(path, file, { contentType: file.type, upsert: false });
          if (upErr) {
            toast.error(upErr.message);
            return;
          }
          attachments.push({
            path,
            name: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          });
        }
      }

      const res = await fetch("/api/support/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          description: description.trim(),
          category,
          machineId: machineId || null,
          diagnostics,
          attachments,
          uploadFolderId: uploadFolderId.current,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? "Gönderilemedi");
        return;
      }
      setLastTicketId(body.ticketId);
      if (body.emailSkipped) {
        toast.success(`Kaydedildi: ${body.ticketId}. E-posta yapılandırılmadı; mailto kullanabilirsiniz.`, {
          duration: 8000,
        });
      } else {
        toast.success(`Talebiniz alındı: ${body.ticketId}`);
        onSubmitted?.();
      }
    } finally {
      setSending(false);
    }
  }, [
    category,
    description,
    machineId,
    onSubmitted,
    pendingFiles,
    recentBundle?.code,
    subject,
  ]);

  const mailto = buildMailtoFallback({
    ticketId: lastTicketId ?? undefined,
    subject,
    description,
    diagnostics: currentDiagnostics(),
  });

  return {
    subject,
    setSubject,
    description,
    setDescription,
    category,
    setCategory,
    machineId,
    setMachineId,
    machines,
    recentBundle,
    previewOpen,
    setPreviewOpen,
    sending,
    pendingFiles,
    setPendingFiles,
    resetForOpen,
    currentDiagnostics,
    handleSubmit,
    mailto,
  };
}

export type SupportReportFormState = ReturnType<typeof useSupportReportForm>;
