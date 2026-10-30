export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-4 py-12 text-foreground">
      <article className="prose prose-invert mx-auto max-w-2xl prose-headings:font-semibold prose-p:text-muted-foreground">
        {children}
      </article>
    </div>
  );
}
