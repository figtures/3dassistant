import { notFound } from "next/navigation";
import { Inbox } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Skeleton,
  Textarea,
} from "@/components/ds";
import { DesignTokensDialogDemo } from "@/app/(dev)/design-tokens/dialog-demo";

const semanticColors = [
  { name: "background", className: "bg-background" },
  { name: "foreground", className: "bg-foreground" },
  { name: "surface-1", className: "bg-surface-1" },
  { name: "surface-2", className: "bg-surface-2" },
  { name: "surface-3", className: "bg-surface-3" },
  { name: "surface-inset", className: "bg-surface-inset" },
  { name: "card", className: "bg-card" },
  { name: "muted", className: "bg-muted" },
  { name: "primary", className: "bg-primary" },
  { name: "primary-subtle", className: "bg-primary-subtle" },
  { name: "secondary", className: "bg-secondary" },
  { name: "accent", className: "bg-accent" },
  { name: "success", className: "bg-success" },
  { name: "success-subtle", className: "bg-success-subtle" },
  { name: "warning", className: "bg-warning" },
  { name: "warning-subtle", className: "bg-warning-subtle" },
  { name: "destructive", className: "bg-destructive" },
  { name: "destructive-subtle", className: "bg-destructive-subtle" },
  { name: "info", className: "bg-info" },
  { name: "info-subtle", className: "bg-info-subtle" },
  { name: "border", className: "bg-border" },
  { name: "steel", className: "bg-steel" },
];

const machineStates = [
  { name: "printing", className: "bg-state-printing" },
  { name: "idle", className: "bg-state-idle" },
  { name: "paused", className: "bg-state-paused" },
  { name: "error", className: "bg-state-error" },
  { name: "offline", className: "bg-state-offline" },
  { name: "maintenance", className: "bg-state-maintenance" },
  { name: "unknown", className: "bg-state-unknown" },
];

const charts: { name: string; className: string }[] = [
  { name: "chart-1", className: "bg-chart-1" },
  { name: "chart-2", className: "bg-chart-2" },
  { name: "chart-3", className: "bg-chart-3" },
  { name: "chart-4", className: "bg-chart-4" },
  { name: "chart-5", className: "bg-chart-5" },
  { name: "chart-6", className: "bg-chart-6" },
];

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className={`h-14 w-full rounded-lg border border-border shadow-e0 ${className}`}
      />
      <span className="font-mono text-xs text-muted-foreground">{name}</span>
    </div>
  );
}

export default function DesignTokensPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Forge tasarım token&apos;ları
          </h1>
          <p className="text-sm text-muted-foreground">
            Geliştirme referansı — 3D Assistant v2. Açık tema:{" "}
            <code className="rounded bg-surface-inset px-1.5 py-0.5 font-mono text-xs">
              document.documentElement.dataset.theme = &quot;light&quot;
            </code>
          </p>
          <p className="text-sm text-foreground">
            Türkçe glifler: ŞşĞğİıÖöÜüÇç
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Semantik renkler</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {semanticColors.map((token) => (
              <Swatch key={token.name} name={token.name} className={token.className} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Makine durumları</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {machineStates.map((token) => (
              <Swatch key={token.name} name={token.name} className={token.className} />
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span
              className="size-3 rounded-full bg-state-printing pf-pulse-dot"
              aria-hidden
            />
            <span className="text-muted-foreground">Baskıda nabız (pf-pulse-dot)</span>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Grafik paleti</h2>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
            {charts.map((token) => (
              <Swatch
                key={token.name}
                name={token.name}
                className={token.className}
              />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Tipografi</h2>
          <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-e0">
            <p className="text-xs text-muted-foreground">text-xs — 12px</p>
            <p className="text-sm">text-sm — 14px gövde</p>
            <p className="text-lg font-semibold">text-lg — kart başlığı</p>
            <p className="text-2xl font-semibold tracking-tight">
              text-2xl — sayfa başlığı
            </p>
            <p className="font-mono text-sm tabular-nums text-primary">
              font-mono 215 °C · %42 · SKU-001
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Radius ve gölge</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4 shadow-e0">
              rounded-lg + shadow-e0
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-e1">
              rounded-xl + shadow-e1
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-e3">
              rounded-2xl + shadow-e3
            </div>
            <div className="rounded-xl border border-border bg-card p-6 pf-layer-lines">
              pf-layer-lines motif
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Bileşenler (ds)</h2>
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap gap-2">
              <Button variant="primary">Birincil</Button>
              <Button variant="secondary">İkincil</Button>
              <Button variant="ghost">Hayalet</Button>
              <Button variant="danger">Tehlike</Button>
              <Button variant="primary" size="sm">
                Küçük
              </Button>
              <Button variant="primary" loading>
                Yükleniyor
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Card surface={1}>
                <CardHeader>
                  <CardTitle>surface-1 kart</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="space-y-2">
                    <Label htmlFor="demo-input">Etiket</Label>
                    <Input id="demo-input" placeholder="Örnek metin" />
                    <Textarea placeholder="Çok satırlı alan" rows={2} />
                  </div>
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
              <Card surface={2}>
                <CardHeader>
                  <CardTitle>surface-2 kart</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 pt-0">
                  <Badge tone="primary">primary</Badge>
                  <Badge tone="success">success</Badge>
                  <Badge tone="warning">warning</Badge>
                  <Badge machineState="printing" />
                  <Badge machineState="error" />
                  <Badge machineState="idle" />
                </CardContent>
              </Card>
            </div>
            <EmptyState
              icon={Inbox}
              title="Henüz kayıt yok"
              description="İlk siparişinizi oluşturduğunuzda burada görünür."
              action={
                <Button variant="primary" size="sm">
                  Sipariş oluştur
                </Button>
              }
            />
            <DesignTokensDialogDemo />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Yoğunluk</h2>
          <p className="text-sm text-muted-foreground">
            Kontrol yüksekliği:{" "}
            <span
              className="inline-flex items-center rounded-lg border border-input bg-surface-inset px-3 font-mono text-sm"
              style={{ height: "var(--density-control-h)" }}
            >
              var(--density-control-h)
            </span>
          </p>
        </section>
      </div>
    </main>
  );
}
