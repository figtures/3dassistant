"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buildMailtoFallback, snapshotClientDiagnostics } from "@/lib/support/client-capture";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  const mailto = buildMailtoFallback({
    subject: "3D Assistant kritik hata",
    description: `Hata: ${error.message}${error.digest ? `\nDigest: ${error.digest}` : ""}`,
    diagnostics: snapshotClientDiagnostics(),
  });

  return (
    <html lang="tr">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 p-6 text-center text-zinc-200">
        <h1 className="text-lg font-semibold">Uygulama hatası</h1>
        <p className="max-w-md text-sm text-zinc-500">
          Beklenmeyen bir sorun oluştu. Sayfayı yenileyebilir veya destek ekibine bildirebilirsiniz.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white"
            onClick={() => reset()}
          >
            Tekrar dene
          </button>
          <Link
            href="/support"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300"
          >
            Destek talepleri
          </Link>
          <a href={mailto} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300">
            E-posta ile bildir
          </a>
        </div>
      </body>
    </html>
  );
}
