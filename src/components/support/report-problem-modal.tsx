"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  isAllowedAttachmentMime,
  MAX_SUPPORT_ATTACHMENTS,
  MAX_SUPPORT_ATTACHMENT_BYTES,
  supportAttachmentStoragePath,
  SUPPORT_ATTACHMENT_BUCKET,
  type SupportAttachmentMeta,
} from "@/lib/support/attachments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, Select, Textarea } from "@/components/ui/select";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { ChevronDown, LifeBuoy, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import {
  buildMailtoFallback,
  snapshotClientDiagnostics,
} from "@/lib/support/client-capture";
import type { SupportCategory } from "@/lib/support/types";
import { redactSecretsDeep } from "@/lib/support/redact";

type OpenOptions = {
  category?: SupportCategory;
  machineId?: string;
  subject?: string;
  description?: string;
};

type SupportReportContextValue = {
  openReport: (opts?: OpenOptions) => void;
};

const SupportReportContext = createContext<SupportReportContextValue | null>(null);

export function useSupportReport() {
  const ctx = useContext(SupportReportContext);
  if (!ctx) {
    return { openReport: () => toast.error("Destek formu yüklenemedi") };
  }
  return ctx;
}

const CATEGORY_LABELS: Record<SupportCategory, string> = {
  bridge: "Köprü / yazıcı",
  billing: "Fatura / abonelik",
  order: "Sipariş / iş",
  other: "Diğer",
};

export function SupportReportProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
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

  const openReport = useCallback(
    (opts?: OpenOptions) => {
      setSubject(opts?.subject ?? "");
      setDescription(opts?.description ?? "");
      setCategory(opts?.category ?? "other");
      setMachineId(opts?.machineId ?? "");
      setLastTicketId(null);
      setPendingFiles([]);
      uploadFolderId.current = crypto.randomUUID();
      setOpen(true);
      void loadContext();
    },
    [loadContext]
  );

  function currentDiagnostics() {
    return redactSecretsDeep(
      snapshotClientDiagnostics({ bridgeBundleCode: recentBundle?.code })
    );
  }

  async function handleSubmit() {
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
        setOpen(false);
      }
    } finally {
      setSending(false);
    }
  }

  const mailto = buildMailtoFallback({
    ticketId: lastTicketId ?? undefined,
    subject,
    description,
    diagnostics: currentDiagnostics(),
  });

  return (
    <SupportReportContext.Provider value={{ openReport }}>
      {children}
      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent className="max-w-lg">
          <ModalHeader title="Sorun bildir" subtitle="Teknik ekibe bildirim gönderin" />
          <ModalBody className="space-y-4">
            <p className="text-xs text-zinc-500">
              Teknik ekibimizin sorunu çözmesi için tanılama bilgileri otomatik eklenir. Şifre, erişim
              kodu ve API anahtarları gönderilmez.
            </p>
            <div>
              <Label>Kategori</Label>
              <Select value={category} onChange={(e) => setCategory(e.target.value as SupportCategory)}>
                {(Object.entries(CATEGORY_LABELS) as [SupportCategory, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Konu</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Kısa özet" />
            </div>
            <div>
              <Label>Açıklama</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Ne oldu, ne bekliyordunuz?"
              />
            </div>
            {machines.length > 0 && (
              <div>
                <Label>İlgili makine (isteğe bağlı)</Label>
                <Select value={machineId} onChange={(e) => setMachineId(e.target.value)}>
                  <option value="">— Seçin —</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Select>
              </div>
            )}
            {recentBundle && (
              <p className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-400">
                Son köprü tanılama paketi: <span className="font-mono text-sky-400">{recentBundle.code}</span>
                {" "}(otomatik eklenecek)
              </p>
            )}
            <div>
              <Label>Ekran görüntüleri (isteğe bağlı, en fazla {MAX_SUPPORT_ATTACHMENTS})</Label>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="text-xs"
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? []).slice(0, MAX_SUPPORT_ATTACHMENTS);
                  setPendingFiles(list);
                }}
              />
              {pendingFiles.length > 0 && (
                <p className="mt-1 text-xs text-zinc-500">
                  {pendingFiles.map((f) => f.name).join(", ")}
                </p>
              )}
            </div>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg border border-zinc-800 px-3 py-2 text-left text-xs text-zinc-400 hover:bg-zinc-900/60"
              onClick={() => setPreviewOpen((v) => !v)}
            >
              Gönderilecek tanılama bilgileri
              <ChevronDown className={`h-4 w-4 transition-transform ${previewOpen ? "rotate-180" : ""}`} />
            </button>
            {previewOpen && (
              <pre className="max-h-48 overflow-auto rounded-lg bg-zinc-950 p-3 text-[10px] text-zinc-500">
                {JSON.stringify(currentDiagnostics(), null, 2)}
              </pre>
            )}
          </ModalBody>
          <ModalFooter className="flex-col gap-2 sm:flex-row">
            <a
              href={mailto}
              className="inline-flex items-center justify-center gap-2 text-xs text-zinc-500 hover:text-zinc-300"
            >
              <Mail className="h-3.5 w-3.5" />
              E-posta istemcisi (yedek)
            </a>
            <Button onClick={handleSubmit} disabled={sending} className="min-h-11 w-full sm:w-auto">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gönder"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
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
