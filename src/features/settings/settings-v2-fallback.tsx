export function SettingsV2Fallback() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
      Bu ayar sayfası yalnızca yeni arayüzde kullanılabilir. Adres çubuğuna{" "}
      <code className="rounded bg-muted px-1 py-0.5 text-foreground">?ui=v2</code> ekleyerek
      geçiş yapabilirsiniz.
    </div>
  );
}
