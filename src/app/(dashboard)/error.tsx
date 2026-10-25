"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useSupportReport } from "@/components/support/report-problem-modal";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { openReport } = useSupportReport();

  useEffect(() => {
    console.error("[dashboard-error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h2 className="text-lg font-semibold text-zinc-100">Bir şeyler ters gitti</h2>
      <p className="text-sm text-zinc-500">
        Sayfa yüklenirken hata oluştu. Tekrar deneyebilir veya sorunu bildirebilirsiniz.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={() => reset()}>Tekrar dene</Button>
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
