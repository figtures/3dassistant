"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plug } from "lucide-react";
import { Badge, Button, Card, CardContent, EmptyState } from "@/components/ds";
import { buttonVariants } from "@/components/ds/variants";
import { HelpTitleRow } from "@/components/v2/help/contextual-help";
import { VENDOR_LABELS, type PrinterVendor } from "@/lib/printer-cloud/types";

type AccountRow = {
  id: string;
  vendor: PrinterVendor;
  display_name: string;
  status: string;
  last_sync_at: string | null;
};

async function fetchAccounts(): Promise<AccountRow[]> {
  const res = await fetch("/api/integrations/printers/accounts");
  const data = (await res.json().catch(() => ({}))) as {
    accounts?: AccountRow[];
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? "Yüklenemedi");
  return data.accounts ?? [];
}

export function IntegrationsSettingsScreen() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["settings-integrations"],
    queryFn: fetchAccounts,
  });

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <header className="space-y-1">
          <HelpTitleRow>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              Entegrasyonlar
            </h1>
          </HelpTitleRow>
          <p className="max-w-xl text-sm text-muted-foreground">
            Üretici bulut hesapları ve atölye köprüsü bağlantıları.
          </p>
        </header>
        <Link
          href="/machines/connect"
          className={buttonVariants({ variant: "primary" })}
        >
          Yazıcı veya köprü bağla
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" aria-hidden />
          <span className="sr-only">Yükleniyor</span>
        </div>
      ) : isError ? (
        <EmptyState
          icon={Plug}
          title="Entegrasyonlar yüklenemedi"
          description="Bağlantınızı kontrol edip tekrar deneyin."
          action={
            <Button type="button" onClick={() => void refetch()}>
              Yenile
            </Button>
          }
        />
      ) : !data?.length ? (
        <EmptyState
          icon={Plug}
          title="Bağlı hesap yok"
          description="Bambu, Prusa veya Creality bulut hesabınızı bağlayarak makineleri senkronize edin."
          action={
            <Link
              href="/machines/connect"
              className={buttonVariants({ variant: "primary" })}
            >
              Bağlantı sihirbazını aç
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3">
          {data.map((acc) => (
            <Card key={acc.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium text-foreground">{acc.display_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {VENDOR_LABELS[acc.vendor] ?? acc.vendor}
                    {acc.last_sync_at
                      ? ` · Son senkron: ${new Date(acc.last_sync_at).toLocaleString("tr-TR")}`
                      : ""}
                  </p>
                </div>
                <Badge tone={acc.status === "active" ? "success" : "warning"}>
                  {acc.status === "active" ? "Aktif" : acc.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
