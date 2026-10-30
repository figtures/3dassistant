import Link from "next/link";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-base text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-sm font-semibold tracking-tight text-foreground">
            PrintFlow
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              Giriş
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90"
            >
              Ücretsiz dene
            </Link>
          </nav>
        </div>
      </header>
      <main className="px-4 py-10">{children}</main>
    </div>
  );
}
