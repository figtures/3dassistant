"use client";

import { Button, Card, CardContent } from "@/components/ds";
import type { Supplier } from "@/types/database";
import { Pencil, Trash2 } from "lucide-react";

export type SuppliersTableProps = {
  suppliers: Supplier[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
};

export function SuppliersTable({ suppliers, onEdit, onDelete }: SuppliersTableProps) {
  return (
    <>
      <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-3">
        {suppliers.map((s) => (
          <Card key={s.id} className="border-border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-medium text-foreground">{s.name}</h3>
                  {s.contact_phone && (
                    <p className="mt-1 text-sm text-muted-foreground">{s.contact_phone}</p>
                  )}
                  {s.contact_email && (
                    <p className="truncate text-sm text-muted-foreground">{s.contact_email}</p>
                  )}
                  {s.website && (
                    <p className="truncate text-sm text-primary">{s.website}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(s.id)}
                    aria-label={`${s.name} düzenle`}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(s.id)}
                    aria-label={`${s.name} sil`}
                  >
                    <Trash2 className="size-4 text-destructive" aria-hidden />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3 sm:hidden">
        {suppliers.map((s) => (
          <Card key={s.id} className="border-border">
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{s.name}</p>
                {s.contact_phone && (
                  <p className="text-sm text-muted-foreground">{s.contact_phone}</p>
                )}
              </div>
              <div className="flex gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(s.id)}
                  aria-label={`${s.name} düzenle`}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(s.id)}
                  aria-label={`${s.name} sil`}
                >
                  <Trash2 className="size-4 text-destructive" aria-hidden />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
