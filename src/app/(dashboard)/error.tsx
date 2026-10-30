"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useUiVersion } from "@/components/flags/ui-version-provider";
import { useSupportReport } from "@/components/support/report-problem-modal";
import { ErrorState } from "@/components/v2/states/empty-state";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const ui = useUiVersion();
  const { openReport } = useSupportReport();

  useEffect(() => {
    console.error("[dashboard-error]", error);
  }, [error]);

  if (ui === "v2") {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <ErrorState error={error} onRetry={reset} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h2 className="text-lg font-semibold text-zinc-100">Bir şeyler ters gitti</h2>
      <p className="text-sm text-zinc-500">
        Sayfa yüklenirken hata oluştu. Tekrar deneyebilir veya sorunu bildirebilirsiniz.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={() => reset()}>
          Tekrar dene
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            openReport({
              category: "other",
              subject: "Sayfa hatası",
              description: `Hata: ${error.message}${error.digest ? `\nDigest: ${error.digest}` : ""}`,
            })
          }
        >
          Sorun bildir
        </Button>
      </div>
    </div>
  );
}
