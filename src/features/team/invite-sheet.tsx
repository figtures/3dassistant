"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  nativeSelectClassName,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
} from "@/components/ds";
import {
  INVITABLE_WORKSPACE_ROLES,
  WORKSPACE_ROLE_LABELS,
} from "@/lib/workspace/role-labels";
import type { WorkspaceRole } from "@/types/database";

export type InviteSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: () => void;
};

export function InviteSheet({ open, onOpenChange, onSent }: InviteSheetProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<WorkspaceRole, "owner">>("operator");
  const [saving, setSaving] = useState(false);

  async function handleSend() {
    setSaving(true);
    const res = await fetch("/api/workspace/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; acceptUrl?: string };
    setSaving(false);

    if (!res.ok) {
      toast.error("Davet gönderilemedi", { description: data.error });
      return;
    }

    toast.success("Davet oluşturuldu", {
      description: data.acceptUrl
        ? "E-posta yapılandırması yoksa bağlantı sunucu günlüğünde."
        : undefined,
    });
    setEmail("");
    setRole("operator");
    onSent();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Ekip daveti</DialogTitle>
          <DialogDescription>
            Davet edilen kişi e-postasındaki bağlantı ile katılır. Davet 7 gün geçerlidir.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4 py-1">
          <FormField label="E-posta" required>
            {(field) => (
              <Input
                {...field}
                type="email"
                autoComplete="email"
                placeholder="ornek@firma.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Rol" required>
            {(field) => (
              <select
                {...field}
                className={nativeSelectClassName}
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as Exclude<WorkspaceRole, "owner">)
                }
              >
                {INVITABLE_WORKSPACE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {WORKSPACE_ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="button" loading={saving} onClick={() => void handleSend()}>
            Davet gönder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
