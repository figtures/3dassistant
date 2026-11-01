const BRANDS = [
  "Bambu Lab",
  "Creality",
  "Prusa",
  "Klipper",
  "OctoPrint",
] as const;

export function TrustStrip() {
  return (
    <section
      className="border-b border-border bg-muted/20 py-8"
      aria-label="Desteklenen ekosistemler"
    >
      <div className="mx-auto max-w-6xl px-4">
        <p className="mb-4 text-center text-sm text-muted-foreground">
          Bulut ve yerel bağlantılarla tanıdık markalar
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-3">
          {BRANDS.map((name) => (
            <li key={name}>
              <span className="inline-flex rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground">
                {name}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
