import Link from "next/link";

const footerLinkClass =
  "text-muted-foreground transition-colors hover:text-foreground";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-base text-foreground">
      <header className="sticky top-0 z-[var(--z-sticky,20)] border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-foreground"
          >
            3D Asisstant
          </Link>
          <nav
            className="hidden items-center gap-6 text-sm md:flex"
            aria-label="Ana menü"
          >
            <Link href="/#ozellikler" className={footerLinkClass}>
              Özellikler
            </Link>
            <Link href="/pricing" className={footerLinkClass}>
              Fiyatlar
            </Link>
            <Link href="/changelog" className={footerLinkClass}>
              Yenilikler
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/login" className={footerLinkClass}>
              Giriş
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90"
            >
              Ücretsiz dene
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-muted/30">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">Ürün</p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/#ozellikler" className={footerLinkClass}>
                  Özellikler
                </Link>
              </li>
              <li>
                <Link href="/pricing" className={footerLinkClass}>
                  Fiyatlar
                </Link>
              </li>
              <li>
                <Link href="/changelog" className={footerLinkClass}>
                  Yenilikler
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">Şirket</p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/status" className={footerLinkClass}>
                  Sistem durumu
                </Link>
              </li>
              <li>
                <a
                  href="mailto:destek@3dasisstant.com"
                  className={footerLinkClass}
                >
                  İletişim
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">Yasal</p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/legal/kvkk" className={footerLinkClass}>
                  KVKK
                </Link>
              </li>
              <li>
                <Link href="/legal/privacy" className={footerLinkClass}>
                  Gizlilik
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className={footerLinkClass}>
                  Kullanım koşulları
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">Durum</p>
            <p className="text-sm text-muted-foreground">
              <Link href="/status" className={footerLinkClass}>
                Canlı servis durumu
              </Link>{" "}
              ve olay geçmişi.
            </p>
          </div>
        </div>
        <div className="border-t border-border px-4 py-6">
          <p className="mx-auto max-w-6xl text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} 3D Asisstant ·{" "}
            <a
              href="https://3dasisstant.com"
              className="hover:text-foreground"
            >
              3dasisstant.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
