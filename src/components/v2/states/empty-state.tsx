"use client";

import type { LucideIcon } from "lucide-react";
import { AlertCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button, EmptyState } from "@/components/ds";
import { useSupportReport } from "@/components/support/report-problem-modal";
import { useUiVersion } from "@/components/flags/ui-version-provider";

export function ErrorState({
  error,
  onRetry,
  title = "Bir şeyler ters gitti",
  description = "Sayfa yüklenirken hata oluştu. Tekrar deneyebilir veya sorunu bildirebilirsiniz.",
}: {
  error: Error & { digest?: string };
  onRetry?: () => void;
  title?: string;
  description?: string;
}) {
  const { openReport } = useSupportReport();
  const pathname = usePathname();
  const ui = useUiVersion();

  const digestLine = error.digest ? `\nDigest: ${error.digest}` : "";

  return (
    <EmptyState
      icon={AlertCircle}
      title={title}
      description={description}
      action={
        <>
          {onRetry ? (
            <Button type="button" variant="primary" size="sm" onClick={() => onRetry()}>
              Tekrar dene
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              openReport({
                category: "other",
                subject: "Sayfa hatası",
                description: [
                  `Hata: ${error.message}${digestLine}`,
                  `Rota: ${pathname}`,
                  `Arayüz: ${ui}`,
                ].join("\n"),
              })
            }
          >
            Sorun bildir
          </Button>
        </>
      }
    />
  );
}

export function FirstUseEmpty({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      action={
        primaryAction || secondaryAction ? (
          <>
            {primaryAction}
            {secondaryAction}
          </>
        ) : undefined
      }
    />
  );
}

export function FilteredEmpty({ onClear }: { onClear: () => void }) {
  return (
    <EmptyState
      title="Sonuç bulunamadı"
      description="Filtreleri gevşetin veya aramayı temizleyin."
      action={
        <Button type="button" variant="secondary" size="sm" onClick={onClear}>
          Filtreleri temizle
        </Button>
      }
    />
  );
}
