# 02 — Tasarım Sistemi: "Forge"

> PrintFlow'un yeni tasarım dili. Kod tanımlayıcıları İngilizce, açıklamalar Türkçe.
> **Uygulayıcıya not:** Bu sürüm Next.js 16.3 + Tailwind v4'tür. Font/CSS/metadata işlerinden önce şunları okuyun:
> `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md`, `11-css.md`, `14-metadata-and-og-images.md`.

## 1. Marka konsepti

**Fikir: "Sıcak nozul, soğuk çelik."** Grafit/çelik bir endüstriyel yüzey üzerinde tek bir sıcak renk: erimiş filament turuncusu. Turuncu **yalnızca** (a) birincil aksiyon, (b) odak halkası, (c) aktif navigasyon göstergesi ve (d) **"Baskıda" makine durumu** için kullanılır. Böylece ekranda turuncu gördüğünüz yer ya "tıklanacak yer" ya da "şu an üreten makine"dir.

İmza öğeleri (benzersizlik):
1. **Katman çizgisi motifi (`.pf-layer-lines`)**: 3D baskı katmanlarını anımsatan 1px yatay çizgi dokusu — boş durumlarda, hero'da, onboarding'de (asla veri yüzeylerinde değil).
2. **Filo nabzı (Fleet Pulse)**: Üst barda her sayfada görünen canlı özet: `● 6 baskıda · 1 hata · 2 boşta`. Turuncu nokta yumuşak nabız animasyonu (reduced-motion'da statik).
3. **Katman ilerleme çubuğu (`LayerProgress`)**: Baskı ilerlemesi düz bar yerine ince segmentli (katman) bar; tamamlanan segmentler turuncu.
4. **Monospace telemetri**: Sıcaklık, süre, yüzde, SKU, bilet ID'leri `font-mono tabular-nums`.
5. **Sıkı radius (8–12px)**: Mühendislik hissi; "balon" 2xl köşeler yok.

İsim kullanımı: Ürün adı her zaman **PrintFlow** (tek kelime, P ve F büyük). Alt başlık: "3D baskı atölyeleri için üretim yönetimi". "3D Management" alt yazısı kaldırılır.

Ton: Sakin, net, uzman. Linear/Vercel/Stripe seviyesinde sadelik; ama renk ve motifle 3D baskıya ait.

## 2. Token mimarisi ve dosya yerleşimi

```
src/styles/tokens.css        ← YENİ: tüm CSS değişkenleri (primitive + semantic + tema + yoğunluk)
src/styles/motion.css        ← YENİ: keyframe'ler, reduced-motion kuralları, .pf-layer-lines
src/app/globals.css          ← @import "tailwindcss"; @import "tw-animate-css"; @import "../styles/tokens.css"; @import "../styles/motion.css"; + @theme inline eşleme + LEGACY blok
```

Kurallar:
- **Adlandırma sözleşmesi shadcn ile uyumludur** (`--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--chart-1..5`, `--sidebar-*`). Neden: 21st.dev bileşenleri bu adları bekler → kopyala-yapıştır sonrası minimum uyarlama.
- PrintFlow uzantıları `--surface-*`, `--state-*`, `--success/warning/info`, `--text-*`, `--density-*`, `--z-*`, `--motion-*` önekleriyle.
- Mevcut `:root` değişkenleri (`--primary: #38bdf8` vb.) TSX'te **hiç kullanılmıyor** (yalnızca `body` `var(--background)`); bu nedenle güvenle yeniden tanımlanır. Eski görünüm zinc sınıflarıyla çalışmaya devam eder.
- Tema: `<html data-theme="dark|light">` (varsayılan `dark`). Yoğunluk: `<html data-density="comfortable|compact">` (varsayılan `comfortable`). UI sürümü: `<html data-ui="v1|v2">` (bkz. 05 §3).

## 3. Renk sistemi

### 3.1 Primitive paletler (değişmez; doğrudan bileşende KULLANILMAZ)

```css
/* src/styles/tokens.css — bölüm 1: primitives */
:root {
  /* Graphite (nötr) */
  --graphite-0: #ffffff;
  --graphite-25: #fafaf9;
  --graphite-50: #f4f4f3;
  --graphite-100: #e8e8e6;
  --graphite-200: #d6d6d3;
  --graphite-300: #b4b4b0;
  --graphite-400: #8e8e93;
  --graphite-500: #6e6e76;
  --graphite-600: #55555c;
  --graphite-700: #3a3a40;
  --graphite-800: #26262b;
  --graphite-850: #1c1c20;
  --graphite-900: #141416;
  --graphite-925: #111113;
  --graphite-950: #0b0b0c;

  /* Nozzle (marka turuncusu) */
  --nozzle-50: #fff4ec;
  --nozzle-100: #ffe3cf;
  --nozzle-200: #fcc39e;
  --nozzle-300: #f6a36f;
  --nozzle-400: #ef8a4e;   /* koyu tema primary */
  --nozzle-500: #e0702f;
  --nozzle-600: #c2551a;   /* açık tema primary (beyaz üstünde 4.6:1) */
  --nozzle-700: #9c4114;
  --nozzle-800: #6e2e0f;
  --nozzle-900: #3d1a09;

  /* Steel (ikincil, soğuk teal) */
  --steel-300: #9dbdbd;
  --steel-400: #7aa3a3;
  --steel-500: #5f8787;
  --steel-600: #4a6c6c;
  --steel-700: #375252;

  /* Durum */
  --green-400: #4ad191;  --green-500: #2fb877;  --green-600: #1f8f5b;
  --yellow-400: #f2cb55; --yellow-500: #e3b324; --yellow-600: #a87f0c;
  --red-400: #f47272;    --red-500: #e5484d;    --red-600: #c22f36;
  --blue-400: #6fa8e8;   --blue-500: #4a8bd6;   --blue-600: #2f6db5;
  --violet-400: #a98bf0; --violet-500: #8b6be0;
}
```

### 3.2 Semantik token'lar — koyu tema (varsayılan)

```css
/* src/styles/tokens.css — bölüm 2: semantic (dark default) */
:root,
[data-theme="dark"] {
  color-scheme: dark;

  --background: var(--graphite-950);          /* uygulama zemini */
  --foreground: #ededef;                      /* ana metin: 17.4:1 */

  --surface-1: var(--graphite-925);           /* kart */
  --surface-2: var(--graphite-900);           /* yükseltilmiş: popover, dropdown, sheet */
  --surface-3: var(--graphite-850);           /* hover / seçili satır */
  --surface-inset: #08080a;                   /* kod, input içi, iz alanı */

  --card: var(--surface-1);
  --card-foreground: var(--foreground);
  --popover: var(--surface-2);
  --popover-foreground: var(--foreground);

  --text-secondary: #b4b4bb;                  /* 9.9:1 */
  --muted: var(--graphite-850);               /* shadcn: arka plan */
  --muted-foreground: #9a9aa3;                /* 7.1:1 — 12px dahil tüm küçük metin bu */
  --text-disabled: #6e6e76;                   /* 3.9:1 — yalnızca devre dışı / dekoratif */

  --border: var(--graphite-800);              /* 1px ayırıcılar */
  --border-strong: var(--graphite-700);       /* input, hover kenar */
  --input: var(--graphite-700);

  --primary: var(--nozzle-400);               /* #ef8a4e — zeminde 7.6:1 */
  --primary-hover: var(--nozzle-300);
  --primary-foreground: #1a0d05;              /* turuncu üstünde koyu metin 7.9:1 */
  --primary-subtle: color-mix(in oklab, var(--nozzle-400) 14%, transparent);

  --secondary: var(--graphite-850);
  --secondary-foreground: var(--foreground);
  --accent: var(--graphite-850);              /* shadcn: hover yüzeyi */
  --accent-foreground: var(--foreground);
  --steel: var(--steel-400);                  /* ikincil vurgu (bilgi grafikleri, köprü) */

  --success: var(--green-400);
  --success-subtle: color-mix(in oklab, var(--green-400) 14%, transparent);
  --warning: var(--yellow-400);
  --warning-subtle: color-mix(in oklab, var(--yellow-400) 14%, transparent);
  --destructive: var(--red-400);
  --destructive-foreground: #1a0606;
  --destructive-subtle: color-mix(in oklab, var(--red-400) 14%, transparent);
  --info: var(--blue-400);
  --info-subtle: color-mix(in oklab, var(--blue-400) 14%, transparent);

  --ring: var(--nozzle-400);
  --ring-offset: var(--background);

  /* Makine durumları (bkz. §3.4) */
  --state-printing: var(--nozzle-400);
  --state-idle: var(--green-400);
  --state-paused: var(--yellow-400);
  --state-error: var(--red-400);
  --state-offline: var(--graphite-500);
  --state-maintenance: var(--violet-400);
  --state-unknown: var(--graphite-600);

  /* Sidebar (21st/shadcn uyumu) */
  --sidebar: var(--graphite-950);
  --sidebar-foreground: var(--text-secondary);
  --sidebar-primary: var(--nozzle-400);
  --sidebar-primary-foreground: var(--primary-foreground);
  --sidebar-accent: var(--graphite-850);
  --sidebar-accent-foreground: var(--foreground);
  --sidebar-border: var(--graphite-800);
  --sidebar-ring: var(--nozzle-400);

  /* Veri görselleştirme (bkz. §8) */
  --chart-1: #ef8a4e;
  --chart-2: #7aa3a3;
  --chart-3: #6fa8e8;
  --chart-4: #c9a2f0;
  --chart-5: #e3c26a;
  --chart-6: #5fc8a0;
  --chart-grid: var(--graphite-800);
  --chart-axis: var(--muted-foreground);

  /* Yükselti gölgeleri (koyu temada kenar parlaması + derin gölge) */
  --elevation-0: 0 1px 0 0 rgb(255 255 255 / 0.03) inset;                                   /* kart */
  --elevation-1: 0 4px 12px -2px rgb(0 0 0 / 0.5), 0 0 0 1px rgb(255 255 255 / 0.04);      /* popover, dropdown */
  --elevation-2: 0 12px 32px -8px rgb(0 0 0 / 0.6), 0 0 0 1px rgb(255 255 255 / 0.05);     /* sheet */
  --elevation-3: 0 24px 64px -12px rgb(0 0 0 / 0.7), 0 0 0 1px rgb(255 255 255 / 0.06);    /* dialog, command */
}
```

### 3.3 Açık tema

```css
[data-theme="light"] {
  color-scheme: light;
  --background: var(--graphite-25);
  --foreground: #18181b;
  --surface-1: #ffffff;
  --surface-2: #ffffff;
  --surface-3: var(--graphite-50);
  --surface-inset: var(--graphite-50);
  --card: var(--surface-1);
  --card-foreground: var(--foreground);
  --popover: var(--surface-2);
  --popover-foreground: var(--foreground);
  --text-secondary: #3f3f46;
  --muted: var(--graphite-50);
  --muted-foreground: #57575f;     /* 7.0:1 */
  --text-disabled: #8e8e93;
  --border: var(--graphite-100);
  --border-strong: var(--graphite-200);
  --input: var(--graphite-200);
  --primary: var(--nozzle-600);    /* #c2551a — beyaz üstünde 4.6:1 */
  --primary-hover: var(--nozzle-700);
  --primary-foreground: #ffffff;
  --primary-subtle: color-mix(in oklab, var(--nozzle-600) 10%, transparent);
  --secondary: var(--graphite-50);
  --secondary-foreground: var(--foreground);
  --accent: var(--graphite-50);
  --accent-foreground: var(--foreground);
  --steel: var(--steel-600);
  --success: var(--green-600);
  --warning: var(--yellow-600);
  --destructive: var(--red-600);
  --destructive-foreground: #ffffff;
  --info: var(--blue-600);
  --ring: var(--nozzle-600);
  --ring-offset: var(--background);
  --state-printing: var(--nozzle-600);
  --state-idle: var(--green-600);
  --state-paused: var(--yellow-600);
  --state-error: var(--red-600);
  --state-offline: var(--graphite-400);
  --state-maintenance: var(--violet-500);
  --state-unknown: var(--graphite-300);
  --sidebar: var(--graphite-50);
  --sidebar-foreground: #3f3f46;
  --sidebar-primary: var(--nozzle-600);
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #ffffff;
  --sidebar-accent-foreground: var(--foreground);
  --sidebar-border: var(--graphite-100);
  --sidebar-ring: var(--nozzle-600);
  --chart-1: #c2551a; --chart-2: #4a6c6c; --chart-3: #2f6db5;
  --chart-4: #7d55c7; --chart-5: #a87f0c; --chart-6: #1f8f5b;
  --chart-grid: var(--graphite-100);
  --chart-axis: var(--muted-foreground);
  --elevation-0: 0 1px 2px rgb(16 16 20 / 0.04);
  --elevation-1: 0 4px 12px -2px rgb(16 16 20 / 0.08), 0 0 0 1px rgb(16 16 20 / 0.04);
  --elevation-2: 0 12px 32px -8px rgb(16 16 20 / 0.12), 0 0 0 1px rgb(16 16 20 / 0.05);
  --elevation-3: 0 24px 64px -12px rgb(16 16 20 / 0.16), 0 0 0 1px rgb(16 16 20 / 0.06);
}
```

Açık tema P5-04'te kullanıcıya açılır; ama **ilk günden** tüm v2 bileşenleri yalnızca semantik token kullanmalıdır ki açık tema "bedava" gelsin.

### 3.4 Makine durumu eşlemesi (tek kaynak)

Veri: `Machine.printer_state` (`printing|paused|idle|error|offline|unknown`), `Machine.connection_status` (`connected|disconnected|error|never`), `Machine.status` (`active|maintenance|offline`).

`src/lib/machine-state.ts` (P0-09) şu öncelikle **tek** UI durumu üretir:

| Öncelik | Koşul | `UiMachineState` | Etiket (TR) | Token | İkon (lucide) | Animasyon |
|---|---|---|---|---|---|---|
| 1 | `status === "maintenance"` | `maintenance` | Bakımda | `--state-maintenance` | `Wrench` | yok |
| 2 | `printer_state === "error"` veya `connection_status === "error"` | `error` | Hata | `--state-error` | `TriangleAlert` | yok (dikkat dağıtmaz) |
| 3 | `printer_state === "printing"` | `printing` | Baskıda | `--state-printing` | `Flame` | nokta nabzı 2s |
| 4 | `printer_state === "paused"` | `paused` | Duraklatıldı | `--state-paused` | `Pause` | yok |
| 5 | `printer_state === "idle"` | `idle` | Hazır | `--state-idle` | `CircleCheck` | yok |
| 6 | `printer_state === "offline"` veya `connection_status === "disconnected"` veya `status === "offline"` | `offline` | Çevrimdışı | `--state-offline` | `WifiOff` | yok |
| 7 | `connection_status === "never"` (canlı bağlantı kurulmamış) | `untracked` | Canlı takip yok | `--state-unknown` | `Unplug` | yok |
| 8 | diğer | `unknown` | Bilinmiyor | `--state-unknown` | `CircleHelp` | yok |

**Kural:** Durum asla yalnızca renkle verilmez: nokta + ikon + metin (WCAG 1.4.1).

## 4. Tailwind v4 eşlemesi (`src/app/globals.css`)

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "../styles/tokens.css";
@import "../styles/motion.css";

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-hover: var(--primary-hover);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary-subtle: var(--primary-subtle);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-destructive-subtle: var(--destructive-subtle);
  --color-success: var(--success);
  --color-success-subtle: var(--success-subtle);
  --color-warning: var(--warning);
  --color-warning-subtle: var(--warning-subtle);
  --color-info: var(--info);
  --color-info-subtle: var(--info-subtle);
  --color-steel: var(--steel);
  --color-border: var(--border);
  --color-border-strong: var(--border-strong);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-surface-1: var(--surface-1);
  --color-surface-2: var(--surface-2);
  --color-surface-3: var(--surface-3);
  --color-surface-inset: var(--surface-inset);
  --color-text-secondary: var(--text-secondary);
  --color-text-disabled: var(--text-disabled);
  --color-state-printing: var(--state-printing);
  --color-state-idle: var(--state-idle);
  --color-state-paused: var(--state-paused);
  --color-state-error: var(--state-error);
  --color-state-offline: var(--state-offline);
  --color-state-maintenance: var(--state-maintenance);
  --color-state-unknown: var(--state-unknown);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-chart-6: var(--chart-6);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace;

  /* Radius: Tailwind v4 varsayılan ölçeği KORUNUR (sm 4, md 6, lg 8, xl 12, 2xl 16) — legacy ekranlar değişmesin. */

  /* Gölgeler yeni adlarla: varsayılan shadow-sm/md/lg legacy'de kullanılıyor, ezilmez. */
  --shadow-e0: var(--elevation-0);
  --shadow-e1: var(--elevation-1);
  --shadow-e2: var(--elevation-2);
  --shadow-e3: var(--elevation-3);

  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-emphasized: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);
}

/* ===== LEGACY (v1) — P5-06'da silinecek ===== */
/* mevcut :root eski değişkenleri, body kuralı, .glass, .mesh-bg, .btn-gradient, .skeleton, .premium-table ... buraya taşınır, içerik değişmeden */
```

> **Dikkat:** Tailwind v4'te `@theme` içinde `--radius-*` veya `--shadow-*` tanımlamak varsayılan ölçeği *ezer* ve legacy ekranları sessizce değiştirir. Bu yüzden radius için varsayılan ölçek korunur, gölgeler `shadow-e0..e3` adıyla eklenir. `--color-*` adları da (ör. `--color-border`) Tailwind'in varsayılan paletiyle çakışmaz; ama `--color-primary` gibi yeni adlar legacy'de kullanılmadığı için güvenlidir. P0-04 kabul kriteri: legacy ekran görüntüleri (P0-14 öncesi elle, sonrası otomatik) piksel farkı göstermemeli.

### Kullanım örnekleri

| Amaç | Doğru | Yanlış |
|------|-------|--------|
| Kart | `bg-card border border-border rounded-xl shadow-e0` | `glass rounded-2xl bg-zinc-900/60` |
| İkincil metin | `text-muted-foreground` | `text-zinc-500` |
| Birincil buton | `bg-primary text-primary-foreground hover:bg-primary-hover` | `btn-gradient` |
| Baskıda nokta | `bg-state-printing` | `bg-orange-400` / `#ef8a4e` |
| Hata uyarısı | `bg-destructive-subtle text-destructive` | `bg-red-500/15 text-red-400` |

## 5. Tipografi

Font: **Geist Sans** (UI) + **Geist Mono** (sayısal/telemetri/ID). Mevcut; yalnızca subset düzeltilir.

```tsx
// src/app/layout.tsx (P0-04)
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "latin-ext"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin", "latin-ext"], display: "swap" });
```

Ölçek (uygulama içi taban 14px; pazarlama taban 16px):

| Token (Tailwind sınıfı) | Boyut / satır | Ağırlık | Kullanım |
|---|---|---|---|
| `text-xs` | 12 / 16 | 500 | Etiket, rozet, tablo başlığı (BÜYÜK HARF YOK; `tracking-normal`) |
| `text-[13px]` → `.text-body-sm` | 13 / 20 | 400 | Tablo hücresi (compact), yardımcı metin |
| `text-sm` | 14 / 20 | 400 | Uygulama gövde metni, input, buton |
| `text-base` | 16 / 24 | 400 | Pazarlama gövde, form açıklamaları |
| `text-lg` | 18 / 28 | 600 | Kart başlığı, dialog başlığı |
| `text-xl` | 20 / 28 | 600 | Bölüm başlığı |
| `text-2xl` | 24 / 32 | 600, `tracking-tight` | Sayfa başlığı (h1) |
| `text-3xl` | 30 / 36 | 600 | KPI değeri |
| `text-5xl` | 48 / 52 | 650, `tracking-[-0.02em]` | Pazarlama h1 (mobil) |
| `text-6xl` | 60 / 64 | 650 | Pazarlama h1 (masaüstü) |

Kurallar:
- `text-[10px]` ve `text-[11px]` **yasak**. En küçük metin 12px.
- Sayısal değerler: `tabular-nums` zorunlu; telemetri ve ID'ler `font-mono`.
- Büyük harf dönüşümü (`uppercase`) Türkçe'de "i→I" hatası üretir; `uppercase` yalnızca `lang="tr"` köküyle ve yalnızca kısa etiketlerde (zaten `<html lang="tr">` var). Tercihen kullanmayın.
- Satır uzunluğu: paragraflar `max-w-prose` (65ch).

## 6. Boşluk, yerleşim, yoğunluk

Taban birim 4px (Tailwind varsayılanı). İzinli adımlar: 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16 (×4px).

| Bağlam | Comfortable | Compact |
|---|---|---|
| Sayfa yatay padding | `px-6` (lg: `px-8`) | `px-4` (lg: `px-6`) |
| Bölümler arası | `gap-8` | `gap-6` |
| Kart iç padding | `p-5` | `p-4` |
| Tablo satır yüksekliği | 44px | 34px |
| Kontrol yüksekliği (input/buton) | 36px | 32px |
| Tablo hücre metni | 14px | 13px |

```css
/* src/styles/tokens.css — bölüm 3: density */
:root, [data-density="comfortable"] {
  --density-row-h: 44px;
  --density-control-h: 36px;
  --density-card-p: 20px;
  --density-cell-px: 12px;
  --density-cell-fs: 14px;
}
[data-density="compact"] {
  --density-row-h: 34px;
  --density-control-h: 32px;
  --density-card-p: 16px;
  --density-cell-px: 10px;
  --density-cell-fs: 13px;
}
```

Bileşenler yoğunluğa `h-[var(--density-control-h)]`, `p-[var(--density-card-p)]` ile bağlanır. Mobil dokunma hedefi minimum 44×44 (WCAG 2.5.8 için 24 yeterli ama atölye eldiveni/telefon gerçeği için 44 hedef) — compact modda bile `@media (pointer: coarse)` altında 44px.

Yerleşim:
- Uygulama içerik genişliği: tam genişlik (tablo/plan), metin ağırlıklı sayfalar `max-w-5xl`, ayarlar `max-w-3xl`.
- Kırılımlar: Tailwind varsayılanları (`sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`). Sidebar `lg` ve üstünde kalıcı.

## 7. Radius, kenar, yükselti

| Öğe | Radius | Kenar | Gölge |
|---|---|---|---|
| Rozet / kbd | `rounded-md` (6) | – | – |
| Buton, input, select | `rounded-lg` (8) | `border-input` | – |
| Kart, tablo kabı | `rounded-xl` (12) | `border-border` | `shadow-e0` |
| Popover, dropdown, tooltip | `rounded-lg` (8) | `border-border` | `shadow-e1` |
| Sheet | kenar yönünde radius yok, karşı kenar `rounded-l-2xl`/`rounded-t-2xl` (mobil alt sheet) | `border-border` | `shadow-e2` |
| Dialog, command | `rounded-2xl` (16) | `border-border` | `shadow-e3` |
| Avatar | `rounded-full` | – | – |

Yükselti seviyeleri: 0 = zemin (`background`), 1 = kart (`surface-1`), 2 = popover/sheet (`surface-2`), 3 = dialog (`surface-2` + `shadow-e3` + overlay `bg-black/60`). **`backdrop-blur` yalnızca overlay ve sticky header'da** (performans).

## 8. Veri görselleştirme

- Kategorik sıra: `--chart-1` (nozzle) → `--chart-2` (steel) → `--chart-3` (mavi) → `--chart-4` (lila) → `--chart-5` (sarı) → `--chart-6` (yeşil). 6'dan fazla seri → "Diğer" grubu.
- Anlamsal grafikler (durum dağılımı) **makine durumu token'larını** kullanır, kategorik paleti değil.
- Gelir/kâr: tek seri `--chart-1`; maliyet `--chart-2`; kâr çizgisi `--success`.
- Izgara `--chart-grid`, eksen metni `--chart-axis` 12px.
- Kütüphane: **ECharts kalır** (zaten telemetri + dashboard'da). Tema, CSS değişkenlerinden runtime'da okunur: `src/lib/charts/echarts-theme.ts` → `getComputedStyle(document.documentElement).getPropertyValue("--chart-1")` (P1-02). KPI içi mini grafikler 21st **Sparkline (#34511)** saf SVG ile (ECharts yok).
- Recharts **eklenmez** (iki grafik kütüphanesi = bundle şişmesi). 21st Area Chart (#30187) yalnızca görsel referanstır.
- Her grafiğin altında/yanında erişilebilir özet: `<p className="sr-only">` veya "Tablo olarak göster" düğmesi.

## 9. Hareket (motion)

```css
/* src/styles/motion.css */
:root {
  --motion-instant: 80ms;
  --motion-fast: 120ms;     /* hover, renk */
  --motion-base: 180ms;     /* dropdown, tooltip, toggle */
  --motion-slow: 240ms;     /* sheet, dialog, sidebar collapse */
  --motion-slower: 320ms;   /* sayfa içi büyük geçiş */
}

@keyframes pf-pulse-dot {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--state-printing) 55%, transparent); }
  50% { box-shadow: 0 0 0 5px color-mix(in oklab, var(--state-printing) 0%, transparent); }
}
.pf-pulse-dot { animation: pf-pulse-dot 2s var(--ease-standard, ease) infinite; }

.pf-layer-lines {
  background-image: repeating-linear-gradient(
    to bottom,
    color-mix(in oklab, var(--foreground) 5%, transparent) 0 1px,
    transparent 1px 6px
  );
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  .pf-pulse-dot { animation: none; }
}
```

Kurallar: hover'da `translateY` yok (mevcut `btn-gradient` ve `.grid-cell:hover { scale(1.03) }` kaldırılır). Animasyon kütüphanesi gerekiyorsa **`motion`** paketi (`import { motion, useReducedMotion } from "motion/react"`); 21st bileşenlerindeki `framer-motion` importları `motion/react`'a çevrilir. Liste ekleme/çıkarma ve sidebar dışında JS animasyonu kullanmayın; CSS + `tw-animate-css` (`animate-in fade-in-0 zoom-in-95`) yeterli.

Next 16 View Transitions: `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` — yalnızca P5'te, isteğe bağlı (makine kartı → detay morph).

## 10. İkonografi

- Kütüphane: **lucide-react** (tek kaynak). 21st bileşenlerindeki `@tabler/icons-react` lucide eşdeğerleriyle değiştirilir (ör. `IconChevronRight` → `ChevronRight`, `IconLayoutSidebarLeftCollapse` → `PanelLeftClose`, `IconLayoutSidebarLeftExpand` → `PanelLeftOpen`).
- Boyut: 16px (`size-4`) varsayılan, 14px (`size-3.5`) yoğun tablo, 20px (`size-5`) boş durum/başlık. `strokeWidth={1.75}`.
- Alan ikonları (sabit eşleme, `src/lib/nav.ts` içinde): Genel Bakış `LayoutDashboard`, Siparişler `ClipboardList`, Üretim Planı `CalendarRange`, Teslim Takvimi `CalendarCheck`, Makineler `Printer`, Arıza & Bakım `Wrench`, Filament & Malzeme `Cylinder`, Tedarik `Truck`, Katalog `Boxes`, Müşteriler `Users`, Ayarlar `Settings`, Destek `LifeBuoy`, Yenilikler `Sparkles`.
- Dekoratif ikonlar `aria-hidden`; tek başına ikon butonları `aria-label` + `Tooltip` zorunlu.
- Logo: yeni SVG işaret (P4-05): üç yığılmış katman çizgisinin "P" harfi oluşturması; tek renk `currentColor` + nozzle nokta.

## 11. Odak, z-index, erişilebilirlik

```css
/* src/styles/tokens.css — bölüm 4 */
:root {
  --focus-ring: 0 0 0 2px var(--ring-offset), 0 0 0 4px var(--ring);
  --z-base: 0;
  --z-sticky: 20;
  --z-header: 30;
  --z-sidebar: 40;
  --z-overlay: 50;
  --z-modal: 60;
  --z-popover: 70;     /* modal içindeki dropdown modalın üstünde */
  --z-command: 75;
  --z-toast: 80;
  --z-tooltip: 90;
}
```

- Tüm etkileşimli öğeler: `focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]` (ds bileşenlerinde gömülü). Asla `outline: none` tek başına.
- Hedef **WCAG 2.2 AA**: metin kontrastı ≥4.5:1 (büyük ≥3:1), UI bileşen kenarı ≥3:1 (`--border-strong` input kenarı için), odak görünür (2.4.7), odak gizlenmez (2.4.11 — sticky header altında kalmamalı: `scroll-margin-top: 72px` global), sürükle-bırak alternatifi (2.5.7 — kanban "Taşı" menüsü), hedef boyutu ≥24px (2.5.8), tutarlı yardım (3.2.6 — "Sorun bildir" her sayfada aynı yerde), gereksiz tekrar giriş yok (3.3.7), erişilebilir kimlik doğrulama (3.3.8 — şifre alanında yapıştırma serbest, göster/gizle).
- `lang="tr"` kökte var; İngilizce terimler (`STL`, `Bambu Lab`) için `lang` gerekmez.
- Canlı veriler: Filo nabzı `aria-live="polite"` yalnızca durum *değiştiğinde* özet okur (her SSE mesajında değil).

## 12. Türkçe metin rehberi

### 12.1 Ton
- "Siz" dili, kısa ve eylem odaklı. Ünlem yok (başarı mesajı dahil: "Makine eklendi", "Hoş geldiniz!" değil "Hoş geldiniz").
- Teknik jargon yasak: "SSE", "RLS", "API", "npm", "repo", "webhook", "Paddle" (müşteri arayüzünde). "ERP" yerine "PrintFlow".
- Hata mesajı formülü: **ne oldu + ne yapmalı**. Örn: "Yazıcıya ulaşılamadı. Yazıcının açık ve internete bağlı olduğunu kontrol edip tekrar deneyin."
- Buton metinleri fiil ile: "Sipariş oluştur", "Yazıcı bağla", "Kaydet", "Vazgeç" (İptal yerine; "İptal" sipariş durumu ile karışır).
- Onay diyaloğu: başlık soru, açıklama sonuç, buton eylem: "Makine silinsin mi? · Bu makineye bağlı 12 sipariş geçmişi korunur, canlı takip durur. · [Vazgeç] [Makineyi sil]".

### 12.2 Terim sözlüğü (tek doğru)

| Kavram | Kullan | Kullanma |
|---|---|---|
| `jobs` kaydı | **Sipariş** (liste/detay), "iş emri" yalnızca üretim planı hücresinde değil — her yerde "Sipariş" | İş, İş emri, Job |
| `jobs.status` | Bekliyor · Üretimde · Tamamlandı · İptal edildi | Devam Ediyor, pending |
| Yazıcının o anki baskısı (`job_name`) | Baskı | İş |
| `machines` | Makine (liste başlığı), Yazıcı (bağlantı bağlamında) | Printer, cihaz |
| Bulut entegrasyonu | Üretici hesabı (Bambu Lab hesabı, Creality hesabı) | Bulut OAuth |
| Workshop bridge | **Atölye Köprüsü** (ürün adı: PrintFlow Köprü) | Bridge, ajan |
| Manuel makine | Elle eklenen makine (canlı takip yok) | Mock |
| `materials` | Filament & malzeme; renk varyantı "Renk" | Material |
| Stok | Stok (gram/kg), "Kritik stok" eşik altı | Low stock |
| `procurement` | Tedarik; kayıt "Alım" | Purchase |
| `catalog_items` | Katalog ürünü; kod "SKU" | Item |
| `customers` | Müşteri | Client |
| `faults` | Arıza; sayfa "Arıza & Bakım" | Hata kaydı |
| Plan | Plan adları: Ücretsiz · Starter · Atölye · Filament Farm | Pro |
| Abonelik | Abonelik & Fatura | Billing |
| Workspace (P3) | Çalışma alanı | Workspace, tenant |
| Roller (P3) | Sahip · Yönetici · Operatör · Muhasebe · İzleyici | Admin, Viewer |
| Support ticket | Destek talebi; ID "Talep no" | Ticket |
| Telemetry | Canlı veri | Telemetri (kullanıcıya) |

### 12.3 Biçimlendirme (tek modül: `src/lib/format.ts`, P0-10)

| Tür | Kural | Örnek |
|---|---|---|
| Para | `Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"})` | `₺1.250,50` |
| Kısa para (KPI) | `notation:"compact"` | `₺12,4 B` |
| Sayı | `tr-TR`, binlik nokta | `12.480` |
| Yüzde | `style:"percent"`, 0–1 ondalık | `%42` |
| Gram | <1000 → `850 g`; ≥1000 → `1,25 kg` (virgül!) | Mevcut `formatGrams` `toFixed(2)` nokta kullanıyor → düzeltilir |
| Süre | `2 sa 15 dk`, <1 sa `45 dk`, ≥24 sa `1 g 3 sa` | |
| Tarih | `d MMM yyyy` → `25 Eki 2026`; tablo `dd.MM.yyyy` | |
| Tarih+saat | `25 Eki 2026, 14:05` | |
| Göreli | `Intl.RelativeTimeFormat("tr",{numeric:"auto"})` → "az önce", "3 dk önce", "dün" | |
| Hafta başı | Pazartesi (`weekStartsOn: 1`) | |
| Saat dilimi | `Europe/Istanbul` görüntüleme | |
| KDV | Fiyatlarda "KDV hariç" / "KDV dahil" açıkça | |
| Sıcaklık | `215 °C` (boşluklu) | |

## 13. Bileşen kataloğu (ds katmanı)

`src/components/ds/` (shadcn tarzı, Radix tabanlı, token'lı). Her biri tek dosya, `cva` varyantlı, `forwardRef`/React 19 `ref` prop, `data-slot` niteliği.

| Bileşen | Varyant/props | Kaynak |
|---|---|---|
| `button` | `variant: primary|secondary|outline|ghost|destructive|link`, `size: sm|md|lg|icon`, `loading`, `asChild` | shadcn + uyarlama |
| `input`, `textarea`, `label`, `form-field` (label+açıklama+hata+`aria-describedby`) | `invalid` | shadcn |
| `select` (Radix), `combobox` (cmdk+popover), `checkbox`, `radio-group`, `switch`, `date-picker` (react-day-picker değil — native `input[type=date]` stilize, P1'de yeterli) | | shadcn |
| `dialog`, `alert-dialog`, `sheet`, `confirm-dialog` + `useConfirm()` | `size: sm|md|lg|xl` | 21st #47 + shadcn |
| `dropdown-menu`, `popover`, `tooltip`, `tabs`, `separator`, `scroll-area`, `avatar`, `breadcrumb`, `kbd`, `progress`, `skeleton` | | shadcn |
| `badge` (`tone: neutral|primary|success|warning|danger|info|steel`) | | özel |
| `status-badge` / `machine-state-badge` / `state-dot` | `state: UiMachineState` | özel (P0-09) |
| `empty` | `Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent` | 21st #19745 |
| `kpi-tile`, `sparkline` | | 21st #40086, #34511 |
| `data-table` (+ `toolbar`, `filter-builder`, `pagination`, `column-toggle`, `bulk-bar`) | | 21st #22177, #27325 |
| `layer-progress` | `value 0-100`, `segments=20`, `state` | özel |
| `page-header`, `page-section`, `toolbar` | | özel (P0-13) |
| `inline-alert` | `tone`, `title`, `action` | özel |
| `toaster` | sonner token teması | 21st #27363 |

## 14. Eski (zinc) sınıflardan geçiş

Strateji: **ekran bazında yeniden yazım, toplu bul-değiştir değil.** Bir ekran v2'ye taşındığında o ekranın v2 dosyası yalnızca token sınıfları kullanır; eski dosya legacy olarak kalır ve P5-06'da silinir.

Hızlı eşleme (v2 yazarken referans):

| Eski | Yeni |
|---|---|
| `bg-zinc-950`, `app-bg`, `mesh-bg` | `bg-background` |
| `bg-zinc-900/60`, `glass` | `bg-card border border-border` |
| `bg-zinc-800`, `bg-zinc-800/60` | `bg-surface-3` / `bg-accent` |
| `border-zinc-800/80`, `border-zinc-700/80` | `border-border` / `border-input` |
| `text-zinc-50/100` | `text-foreground` |
| `text-zinc-300/400` | `text-text-secondary` |
| `text-zinc-500/600` | `text-muted-foreground` |
| `text-sky-400`, `ring-sky-500/20` | `text-primary`, `ring-ring` |
| `bg-sky-500/15 text-sky-400` | `bg-primary-subtle text-primary` |
| `bg-emerald-500/15 text-emerald-400` | `bg-success-subtle text-success` |
| `bg-amber-500/15 text-amber-400` | `bg-warning-subtle text-warning` |
| `bg-red-500/15 text-red-400` | `bg-destructive-subtle text-destructive` |
| `bg-indigo-500/10`, `violet` | `bg-info-subtle text-info` |
| `btn-gradient` | `<Button variant="primary">` |
| `rounded-2xl` (kart) | `rounded-xl` |
| `text-[10px]`, `text-[11px]` | `text-xs` |

Denetim komutu (her v2 PR'ında, v2 dosyaları için **0 sonuç** beklenir):

```bash
rg -n "zinc-|sky-|indigo-|emerald-|amber-|violet-|#[0-9a-fA-F]{6}|text-\[1[01]px\]|glass|btn-gradient" src/components/ds src/components/v2 src/features
```
