import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

export function AuthBrandPanel({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative hidden flex-col justify-between overflow-hidden border-l border-border bg-surface-inset p-10 lg:flex lg:w-[min(44%,520px)] pf-layer-lines",
        className
      )}
    >
      <div className="relative z-10">
        <Logo size="md" />
      </div>
      <blockquote className="relative z-10 max-w-md space-y-4">
        <p className="text-lg font-medium leading-relaxed text-foreground">
          &ldquo;Filo durumunu, siparişleri ve malzemeyi tek ekranda görmek atölye günümü
          kurtardı.&rdquo;
        </p>
        <footer className="text-sm text-muted-foreground">— 3D baskı atölyesi operatörü</footer>
      </blockquote>
      <p className="relative z-10 text-xs text-muted-foreground">
        Üretim planı · Canlı makine takibi · Stok ve tedarik
      </p>
    </div>
  );
}

export function AuthShell({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
      <div className="flex flex-1 flex-col justify-center px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="inline-flex">
              <Logo size="md" />
            </Link>
          </div>
          {title ? (
            <header className="mb-8 space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </header>
          ) : null}
          {children}
        </div>
      </div>
      <AuthBrandPanel />
    </div>
  );
}
