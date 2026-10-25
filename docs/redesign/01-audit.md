# 01 — Mevcut Durum Denetimi (Audit)

> Tarih: 25 Ekim 2026 · Kapsam: `src/app`, `src/components`, `src/hooks`, `src/lib` (UI etkisi olanlar), deploy/CI yapılandırması, canlı geliştirme sunucusu (`http://localhost:3100`).
> Ekran görüntüleri: `docs/redesign/audit/` (dar/mobil görünüm, ~426 CSS px; masaüstü emülasyonu ekran görüntüsünü kırptığı için mobil görünüm kullanıldı — mobil denetimi için zaten gerekli).

## 0. Yönetici özeti (en kritik 12 bulgu)

| # | Bulgu | Etki | Önem |
|---|-------|------|------|
| 1 | **Proje kendi git deposu değil.** Git kökü `/Users/busraaktas` (ev dizini), remote `git@github.com:bsrakts/stage78.git`. `git status` masaüstü dosyalarını gösteriyor. | Staging/prod CI-CD kurulamaz; yanlışlıkla kişisel dosya commit riski. | **Engelleyici** |
| 2 | **Vercel'de PrintFlow projesi yok.** Hesapta 5 proje var (ai-blog-assistant, figrush-blog, …); `.vercel/` bağlantısı yok. | Staging URL yok. | **Engelleyici** |
| 3 | **Online ödeme kapalı.** `/billing`: "Online ödeme şu an kullanılamıyor"; Paddle env'leri tanımlı değil; plan fiyatları hiçbir yerde gösterilmiyor. | Satış yapılamıyor. | **Engelleyici (gelir)** |
| 4 | **Köprü (Bridge) modalı müşteriye geliştirici komutu gösteriyor**: "npm run bridge:pair", "repo docs/workshop-bridge.md", "Installer henüz yayında değil". | Güven kaybı; kurumsal müşteri için kabul edilemez. | Kritik |
| 5 | **Yazıcı bağlama 2 ayrı modal + 4 rakip buton** (Yazıcıları bağla / Atölye köprüsü / Sorun bildir / Makine Ekle). Kullanıcı hangi yöntemi seçeceğini bilmiyor. | Aktivasyonun en kritik adımı kafa karıştırıcı. | Kritik |
| 6 | **Şifre sıfırlama yok** (`/login`'de "Şifremi unuttum" yok, kodda `resetPasswordForEmail` yok). | Destek yükü, kayıp kullanıcı. | Kritik |
| 7 | **Modal erişilebilirliği**: `src/components/ui/modal.tsx` Escape ile kapanmıyor, odak tuzağı yok, odak modala taşınmıyor, `aria-labelledby` yok, arka plan inert değil. | WCAG 2.1.2 / 2.4.3 / 4.1.2 ihlali. | Yüksek |
| 8 | **İsimsiz ikon butonları**: makine kartlarındaki düzenle/sil butonlarının erişilebilir adı yok (snapshot'ta `button` adı boş, 16 adet). Ayrıca yalnızca hover'da görünür (`opacity-0 group-hover:opacity-100`) → klavye ve dokunmatikte görünmez. | Klavye/ekran okuyucu kullanılamaz. | Yüksek |
| 9 | **`<a>` içinde `<button>`** (landing: `<Link><Button/></Link>`), her CTA iki tab durağı. | Geçersiz HTML, a11y. | Orta |
| 10 | **6 adet `window.confirm()`** ile silme (makine, malzeme, müşteri, arıza, tedarikçi, alım). | Tarayıcı diyaloğu; marka dışı, mobilde kötü. | Orta |
| 11 | **Next.js 16 deprecation**: `src/middleware.ts` → `proxy.ts` olmalı (bkz. `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md`). | Gelecek sürümde kırılma. | Orta |
| 12 | **Kalite kapısı kırmızı**: `npx eslint src` → 12 hata, 13 uyarı (aşağıda). `npx tsc --noEmit` temiz. | CI eklenemez. | Orta |

## 1. Teknoloji envanteri

| Alan | Mevcut | Not |
|------|--------|-----|
| Framework | `next@16.3.2`, `react@19.2.8`, `reactCompiler: true` (`next.config.ts`) | Turbopack varsayılan. `middleware.ts` deprecated. |
| Stil | Tailwind **v4** (`@tailwindcss/postcss`), `tailwind.config` **yok**; tüm tema `src/app/globals.css` içinde | `@theme inline` yalnızca `--color-background/foreground` ve font eşliyor. |
| Bileşen kütüphanesi | **Yok** (Radix/shadcn yok). El yazımı `src/components/ui/*` (button, card, modal, select/label/textarea/date/color input, badge, empty-state, skeleton, page-header, icon-box, form-section, logo, toast-icons, voice-parse-panel) | `class-variance-authority` kurulu ama kullanılmıyor (button nesne-map ile). |
| İkon | `lucide-react@^1.33` | Tutarlı; korunacak. |
| Grafik | `echarts@6` + `echarts-for-react` (dashboard dinamik import, telemetri statik import) | Telemetri grafiği statik import → makine detay bundle'ı büyük. |
| 3D | `three`, `@react-three/fiber`, `@react-three/drei` (`stl-viewer.tsx`) | Dinamik import değil. |
| Veri | `@tanstack/react-query@5`, `@supabase/ssr`, `zustand` | `src/hooks/use-data.ts` (607 satır) tüm sorgular. |
| Form | Kontrollü `useState` formları, şema doğrulaması yok (zod var ama formlarda yok) | |
| Toast | `sonner` (`src/components/providers.tsx`, `!important` sınıflarla zinc teması) | |
| Font | `Geist` + `Geist_Mono` (`next/font/google`, `subsets: ["latin"]`) | **`latin-ext` önyüklenmiyor** → ş, ğ, İ glifleri ayrı dosyadan geç gelir (FOUT riski). |
| Tema | Yalnızca koyu; `body` `bg-zinc-950`; `.glass`, `.mesh-bg`, `.btn-gradient` (sky→indigo) | Açık tema yok. |
| i18n | Yok; tüm metin Türkçe sabit string. `formatCurrency` tr-TR/TRY doğru; tarihler yer yer `toLocaleString("tr-TR")`, yer yer date-fns `tr` | Merkezi format modülü yok. |
| Test | `node --test` birim testleri (`npm run test:*`), Playwright `e2e/smoke.spec.ts`, `e2e/machines-live.spec.ts` (yalnızca chromium, `webServer` kapalı) | Görsel regresyon yok, a11y testi yok. |
| CI | Yalnızca `.github/workflows/printflow-bridge-release.yml` (Go köprü) | Web için typecheck/lint/build/e2e yok. |
| Deploy | `vercel.json`: 2 cron (`0 * * * *` overdue-reminders, `*/2 * * * *` cloud-printer-sync) | `*/2` dakikalık cron **Vercel Pro gerektirir** (Hobby günlük). |
| Kiracı modeli | 1 kullanıcı = 1 kiracı; her tabloda `user_id` + RLS `auth.uid() = user_id` (docs/saas.md) | **Ekip/rol yok** → kurumsal müşteri için en büyük ürün açığı. |
| Kod ölçeği | 48 "use client" dosyası; zinc sınıfı 560 kez, renk sınıfı (sky/indigo/emerald/amber/red/violet/blue/green) 231 kez, TSX'te 60 hex sabit, `text-[10px]/[11px]` 47 kez | Token'a geçişin büyüklüğünü gösterir. |

## 2. Rota envanteri

| Rota | Dosya (satır) | Durum / sorunlar |
|------|---------------|------------------|
| `/` (pazarlama) | `src/app/page.tsx` (122) | Tek ekran; fiyat yok, ürün görseli yok, sosyal kanıt yok, SSS yok. `<Link><Button>` iç içe. Gradient metin + sky/indigo "generic AI SaaS" görünümü. |
| `/login` | `src/app/login/page.tsx` (110) | Şifremi unuttum yok, şifre göster/gizle yok, Supabase hata mesajı İngilizce olarak toast'ta (`error.message`). |
| `/register` | `src/app/register/page.tsx` (124) | Ad, firma, e-posta, şifre. Şifre kuralı ipucu yok; KVKK/koşullar onayı yok. |
| `/auth/callback` | route.ts | OK. |
| `/dashboard` | `(dashboard)/dashboard/page.tsx` (330) | 9 KPI + 3 ek kart + grafikler; hiyerarşi yok ("bugün ne yapmalıyım?" yanıtı yok). Filtreler native `<select>` + tag. "SSE" teknik kelimesi kullanıcıya gösteriliyor ("0 baskıda · 1 izlenen · SSE"). |
| `/planning` | `(dashboard)/planning/page.tsx` (279) | Tarih×makine grid. **Hata:** `format(..., "d MMM\nEEE")` `\n` render edilmiyor → "12 EkiPzt". Bugün vurgusu yok, "Bugün'e dön" yok, sticky ilk sütun/başlık zayıf. |
| `/calendar` | (107) + `components/calendar/delivery-calendar.tsx` (220) | Teslim takvimi. |
| `/materials` | (409) | Malzeme + renk stokları; `confirm()`. |
| `/procurement` | (621) | Tedarikçi + alımlar tek sayfada; 2 `confirm()`. |
| `/catalog`, `/catalog/[id]` | (332), (760) | Kart önizleme alanı boş (STL küçük resmi yok); `<img>` (no-img-element), set-state-in-effect hataları. |
| `/customers`, `/customers/[id]` | (407), (197) | Excel içe/dışa aktarım var; `confirm()`. |
| `/machines` | (392) | 4 rakip CTA; plan kullanımı düz metin; kartlarda tekrar eden "Canlı takip yok — …" metni 7/8 kartta; ikon butonlar isimsiz ve hover-only; yüklenirken kilit ikonu → bulut ikonuna dönüşüyor (layout/ikon titremesi). |
| `/machines/[id]` | (8) + `machine-detail-panel.tsx` (222) | SSE canlı (`useMachineLiveSse`). |
| `/faults` | (405) | Arıza kayıtları; `confirm()`. |
| `/billing` | (345) | Fiyat yok; "Paddle" adı müşteriye gösteriliyor; ödeme kapalı mesajı. |
| `/support`, `/support/[ticketId]` | (75), (138) | Liste spinner'la yükleniyor; kategori ham anahtar (`t.category`) gösteriliyor, Türkçe etiket değil. |
| `/support/admin` | layout (16) + page (299) | `SUPPORT_ADMIN_EMAILS` ile korunuyor (notFound). |
| `error.tsx` (dashboard), `global-error.tsx` | | Var; marka dışı sade. |
| **Eksik** | — | `/settings/*` (profil, ekip, bildirim, entegrasyonlar), `/onboarding`, `/orders` (sipariş listesi), `/forgot-password`, `/reset-password`, `/pricing`, yasal sayfalar (KVKK), `not-found.tsx`, hiçbir `loading.tsx`. |

**Önemli alan modeli notu:** Ayrı bir "sipariş" tablosu yok. `jobs` = sipariş/iş emri (müşteri, malzeme, gram, gelir, ödeme, teslim tarihi, durum). Job modal'ın ilk bölümü zaten "Sipariş bilgileri". Yeni tasarım bunu **"Sipariş"** olarak adlandırır (bkz. 02-design-system §12 sözlük); veri modeli değişmez.

## 3. Paylaşılan bileşen envanteri

| Bileşen | Dosya | Sorun | Yeni karşılığı |
|---------|-------|-------|----------------|
| `AppShell` | `components/layout/app-shell.tsx` | 11 düz menü öğesi grupsuz; breadcrumb yok, arama yok, kullanıcı menüsü yok; mobilde kapalı menü linkleri erişilebilirlik ağacında (inert değil); logo masaüstü üst barda tekrarlıyor. | `AppShellV2` (P0-11) |
| `Modal*` | `components/ui/modal.tsx` | Escape/odak/aria eksik (yukarıda). Sabit `max-w-[1080px]` sarmalayıcı. | Radix `Dialog`/`Sheet` (P0-06) |
| `Button` | `components/ui/button.tsx` | Varsayılan varyant gradient + `translateY(-1px)` hover; loading durumu yok; `asChild` yok. | `ds/button` (cva, `loading`, `asChild`) |
| `Input/Select/Textarea/DateInput/ColorInput/Label` | `ui/input.tsx`, `ui/select.tsx` | Label `select.tsx` içinde (yanlış yer); hata durumu/açıklama yok; native select. | `ds/*` + `FormField` (P0-05) |
| `Card` | `ui/card.tsx` | `.glass` + backdrop-blur her kartta (performans + düşük kontrast). | `ds/card` (düz yüzey) |
| `Badge`, `IconBox` | | Renk sabitleri. | Token tabanlı `Badge`, `StatusBadge` (P0-09) |
| `EmptyState`, `Skeleton`, `PageLoader` | | Spinner ağırlıklı; içerik iskeleti yok. | `ds/empty`, `ds/skeleton` (P0-08) |
| `PageHeader` | | OK ama breadcrumb/ikincil aksiyon yok. | `PageHeader v2` (P0-13) |
| `FormSection/FormRow/FormField` | | Label `<label>` ama `htmlFor` yok. | `ds/form-field` |
| `JobModal` | `components/planning/job-modal.tsx` (732) | Çok uzun tek modal. | `OrderSheet` (P1-04) |
| `CloudPrinterConnectModal` (569), `WorkshopBridgeModal` (391) | | İki ayrı akış, teknik metin. | `PrinterConnectWizard` (P2-03) |
| `ReportProblemModal` (311) | | İyi temel (diagnostics, kategori). | `ReportProblemSheet` (P1-15) |
| `DashboardCharts` (378), `MachineTelemetryChart` (65) | | ECharts renkleri sabit hex. | ECharts tema (P1-02) |
| `Providers` | | `Toaster` `!important` sınıflar. | Token'lı toaster (P0-07) |

## 4. UX sorunları (kategoriye göre)

### 4.1 Görsel tutarlılık
- Radius karmaşası: `rounded-2xl` 55, `rounded-xl` 43 kez + `rounded-lg`/`rounded-full`; bileşen bazında kural yok.
- 10–11 px metin 47 kez (`text-[10px]`) → okunabilirlik ve kontrast sorunu.
- Renk anlamı tutarsız: sky hem "primary" hem "info", indigo ve violet ikisi "info" (`dashboard/page.tsx` `colorMap`). Planlama durum renkleri hex sabit (`STATUS_COLORS`).
- Kimlik generic: sky→indigo gradient, glass, glow — "her AI SaaS şablonu" görünümü; 3D baskıya özgü hiçbir görsel dil yok.

### 4.2 Bilgi mimarisi
- 11 menü öğesi tek liste; "Abonelik" ve "Destek" ana iş akışıyla aynı seviyede.
- Ayarlar sayfası yok; profil/firma bilgisi kayıt sonrası değiştirilemiyor.
- Global arama yok; müşteri/sipariş bulmak için sayfa sayfa gezmek gerekiyor.

### 4.3 Akışlar
- **İlk çalıştırma (onboarding) yok.** Kayıt → boş dashboard. "Henüz iş emri yok" boş durumu kullanıcıyı Planlama'ya gönderiyor ama önce makine/malzeme gerekiyor.
- **Yazıcı bağlama**: bulut modalı (Bambu/Creality hesap girişi) ve köprü modalı ayrı; köprü butonu plan kilidi nedeniyle `disabled` (sebep yalnızca `title` tooltip'inde → dokunmatikte görünmez). Köprü modalı uzun teknik metin.
- **Sipariş girişi**: planlama hücresine tıklayınca 732 satırlık modal; liste görünümü yok; toplu işlem yok.
- **Yükseltme yolu**: 402 hatası toast + "Planı yükselt" aksiyonu; fiyat yok, karşılaştırma yok, ödeme kapalı.
- **Destek**: "Sorun bildir" iyi konumlanmış (header) ama mobilde 3 kez tekrar ediyor (sidebar + header + sayfa).

### 4.4 Durumlar
- Yükleme: `PageLoader` (spinner + "Yükleniyor...") neredeyse her sayfada → algılanan yavaşlık, layout shift.
- Boş durum: tek tip, aksiyonsuz veya yanlış yönlendiren.
- Hata: Supabase `error.message` doğrudan toast (İngilizce, teknik).
- Gerçek zamanlı: SSE bağlantı durumu kullanıcıya "SSE" olarak gösteriliyor; kopma durumunda kullanıcı bilgilendirilmiyor.

### 4.5 Mobil
- Sidebar off-canvas çalışıyor ama kapalıyken odaklanabilir.
- Planlama tablosu yatay kaydırma gerektiriyor ("Tabloyu yatay kaydırarak…" ipucu) — mobilde sipariş görünümü için liste alternatifi yok.
- Makineler header'ındaki 4 buton mobilde 2 satıra kırılıyor; birincil aksiyon belirsiz.

### 4.6 Erişilebilirlik (WCAG 2.2 AA hedefi)
- Modal: 2.1.2 (klavye tuzağı yok ama Escape yok), 2.4.3 odak sırası, 4.1.2 ad/rol.
- İsimsiz ikon butonlar (4.1.2), hover-only kontroller (2.1.1, 2.5.x).
- `text-zinc-500/600` küçük metinlerde: `#71717a` / `#09090b` ≈ 4.1:1 (<4.5 AA, küçük metin için yetersiz); `text-zinc-600` (`#52525b`) ≈ 2.6:1 → **başarısız** (sidebar "MENÜ" başlığı, kart alt metinleri).
- Durum yalnızca renkle (planlama hücre renkleri, badge'ler kısmen) — 1.4.1.
- Odak halkası tutarsız (`focus-ring` yardımcı sınıfı tanımlı, az kullanılıyor).
- Animasyonlarda `prefers-reduced-motion` desteği yok (`animate-fade-up`, `listening-pulse`, shimmer).

### 4.7 Performans
- Her kartta `backdrop-filter: blur(16px)` (`.glass`) → düşük donanımlı atölye PC'lerinde scroll jank.
- `machine-telemetry-chart.tsx` ECharts statik import; `stl-viewer.tsx` three.js statik import; `xlsx` statik import (`src/lib/excel.ts`).
- Dashboard 10 ayrı Supabase sorgusu (paralel, ama hepsi client-side; ilk boyamada boş ekran).
- SSE: `/api/machines/live` dashboard ve makineler sayfasında; bağlantı yeniden deneme/geri çekilme stratejisi tarayıcıya bırakılmış (`EventSource` varsayılan), görünürlük (tab gizli) durumunda kapatılmıyor.
- `lucide-react` named import (tree-shake OK).

### 4.8 Kalite kapısı (lint baseline)
`npx eslint src` (25 problem):
- `react-hooks/set-state-in-effect` (hata): `catalog/[id]/page.tsx` ×3, `catalog/page.tsx`, `machine-camera-panel.tsx`, `workshop-bridge-modal.tsx`, `job-modal.tsx`, `stl-viewer.tsx`, `use-speech-recognition.ts`
- `react-hooks/purity` (hata): `dashboard/machine-fleet-panel.tsx`
- `@typescript-eslint/no-empty-object-type` (hata): `ui/input.tsx`, `ui/select.tsx`
- Uyarılar: `no-unused-vars` (dashboard, materials, procurement ×2, delivery-calendar, job-modal), `exhaustive-deps` (catalog/[id] ×3, job-modal), `no-img-element` (catalog ×3)

### 4.9 Repo/operasyon
- `.gitignore` içindeki `.env*` kuralı `.env.local.example` dosyasını da yok sayıyor → örnek env repoya girmiyor.
- `public/` içinde Next varsayılan SVG'leri (`next.svg`, `vercel.svg`, …); `favicon.ico` varsayılan.
- Metadata: OG görseli, `robots`, `sitemap` yok.
- Prod DB: 024–027 migration'ları beklemede (kullanıcı bildirdi); `scripts/apply-pending-migrations.mjs` varsayılan `MIGRATION_FROM=19`.

## 5. Ekran görüntüleri

| Dosya | Gözlem |
|-------|--------|
| `audit/01-landing-mobile.png` | Generic gradient hero; fiyat/ürün görseli yok. |
| `audit/02-dashboard-mobile.png` | "Atölye canlı · SSE" teknik metin; makine durumu "Bilinmiyor". |
| `audit/03-machines-mobile.png` | 4 rakip buton; plan bilgisi düz metin. |
| `audit/04-planning-mobile.png` | "12 EkiPzt" tarih hatası; bugün vurgusu yok. |
| `audit/05-billing-mobile.png` | Fiyat yok; "Online ödeme şu an kullanılamıyor". |
| `audit/06-cloud-connect-modal-mobile.png` | Logosuz, büyük boş üretici kartları; çift "Kapat". |
| `audit/07-bridge-modal-mobile.png` | Teknik açıklama; npm komutları alt kısımda. |
| `audit/08-catalog-mobile.png` | Ürün kartında boş önizleme alanı. |

Masaüstü ekran görüntüleri P0-14 (görsel regresyon) kapsamında Playwright ile `e2e/visual/__screenshots__/` altına baseline olarak üretilecek.

## 6. Korunması gereken güçlü yönler
- Türkçe-öncelikli metin dili ve sektör terimleri (Planlama, Teslim, Arıza, Tedarik).
- Canlı telemetri altyapısı (SSE `src/hooks/use-machine-sse.ts`, `/api/machines/live`, `/api/machines/[id]/live`) — **yeniden tasarımda dokunulmaz, yalnızca tüketilir**.
- Sesli not ayrıştırma (`voice-parse-panel.tsx`, `src/lib/parse-note.ts`) — benzersiz değer önerisi; yeni sipariş formunda öne çıkarılmalı.
- Plan/kota iki katmanlı uygulama (API + DB trigger).
- Destek telemetrisi (`client_error_events`, diagnostics, ticket thread).
- Köprü otomatik keşif (Go `apps/printflow-bridge`) — **Go koduna dokunulmaz**.
