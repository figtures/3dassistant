"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from "@/components/ds";
import { useConfirm } from "@/hooks/use-confirm";

export function DesignTokensDialogDemo() {
  const [open, setOpen] = useState(false);
  const confirm = useConfirm();

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm">
            Dialog aç
          </Button>
        </DialogTrigger>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Örnek dialog</DialogTitle>
            <DialogDescription>
              Escape ile kapatın; odak dialog içinde kalır. Tab ile gezinin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 px-5 py-2">
            <Label htmlFor="dialog-demo-field">İlk odak alanı</Label>
            <Input id="dialog-demo-field" placeholder="Makine adı" autoFocus />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Kapat
            </Button>
            <Button type="button" variant="primary" onClick={() => setOpen(false)}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button
        variant="danger"
        size="sm"
        onClick={async () => {
          const ok = await confirm({
            title: "Kaydı sil",
            description: "Bu işlem geri alınamaz. Devam edilsin mi?",
            confirmLabel: "Sil",
            tone: "destructive",
          });
          if (ok) setOpen(false);
        }}
      >
        ConfirmDialog dene
      </Button>
    </div>
  );
}
