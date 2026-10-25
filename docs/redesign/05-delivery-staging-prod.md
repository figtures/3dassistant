# 05 — Teslimat: Staging → Production

> Vercel MCP ile **salt okunur** inceleme yapıldı; hiçbir Vercel kaynağı değiştirilmedi.
> Next.js 16 notu: `proxy.ts`, `instrumentation`, CSP, üretim kontrol listesi için önce şunları okuyun:
> `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`, `…/02-guides/content-security-policy.md`, `…/02-guides/production-checklist.md`, `…/02-guides/upgrading/version-16.md`.

## 1. Mevcut durum (inceleme sonucu)

| Alan | Bulgu | Sonuç |
|---|---|---|
| Git | Proje `/Users/busraaktas` ev dizini deposunun içinde (remote `bsrakts/stage78`). | **Önce projeye özel depo** (Hat R-01). |
| Vercel | Hesapta (team `team_vXgwKgnud2udg1YIEc2qCaOc`) PrintFlow projesi yok; `.vercel` yok. | Yeni proje (R-02). |
| Vercel planı | `vercel.json` `*/2 * * * *` cron'u (bulut yazıcı senkronu) Hobby'de çalışmaz. | **Vercel Pro** gerekli. |
| Supabase | Tek proje (geliştirme + prod aynı mı belirsiz; `.env.local` yalnızca bir `DATABASE_URL`). Prod'da 024–027 bekliyor. | Ayrı **staging Supabase** projesi (R-03). |
| CI | Web için yok; yalnızca Go köprü release workflow'u. | `web-ci.yml` (P0-00). |
| E2E | 2 Playwright spec, `webServer` kapalı, kimlik bilgisi env'den. | CI'da staging'e karşı veya `next start` ile. |
| Gözlemlenebilirlik | `client_error_events` + `/support/admin` hata akışı; Vercel Analytics yok. | P5-03. |
| Env örneği | `.env.local.example` `.gitignore`'daki `.env*` yüzünden depoya girmiyor. | `.gitignore`'a `!.env.local.example` (P0-00). |

## 2. Ortamlar

| Ortam | URL (öneri) | Vercel | Supabase | Paddle | E-posta | `UI_V2_DEFAULT` |
|---|---|---|---|---|---|---|
| Local | `localhost:3000` (agent'lar `:3100`) | – | dev projesi | sandbox | Resend test / konsol | `true` (geliştirme v2 üzerinde) |
| Preview | `printflow-git-<branch>-<team>.vercel.app` | Preview | **staging** | sandbox | Resend (staging alan adı) | `true` |
| Staging | `staging.printflow.app` (Preview'a bağlı sabit alias, `staging` dalı) | Preview (custom env "staging") | **staging** | sandbox | Resend staging | `true` |
| Production | `app.printflow.app` (uygulama), `printflow.app` (pazarlama) | Production (`main`) | **prod** | live | Resend prod alan adı | `false` → beta'da cookie opt-in → GA'da `true` |

Alan adı ve marka kullanıcı kararıdır (bkz. README "Sizden gerekenler"). Tek alan adı da olur: `printflow.app` (pazarlama) + `/dashboard` (uygulama).

Dal stratejisi: `main` (prod) ← `staging` ← `feat/<ticket-id>-<slug>`. Her bilet ayrı PR; PR → Preview deploy → otomatik CI → inceleme → `staging`'e merge → staging QA → haftalık `main`'e release PR.

## 3. `ui_v2` özellik bayrağı

### 3.1 Çözümleme sırası (`src/lib/flags/ui-version.ts`, P0-03)

1. URL `?ui=v2` / `?ui=v1` → `proxy.ts` `pf_ui` cookie'sini yazar (1 yıl, `SameSite=Lax`, `Secure` prod'da) ve parametresiz URL'ye 307 yönlendirir.
2. Cookie `pf_ui` (`v1` | `v2`).
3. (P5-05) Kiracı bayrağı: `workspaces.ui_version` / kullanıcı `user_metadata.ui_version` — destek ekibi belirli müşterileri açabilir.
4. Env `UI_V2_DEFAULT` (`"true"` → v2).
5. Varsayılan `v1`.

```ts
// src/lib/flags/ui-version.ts (taslak — P0-03 bileti tam halini tanımlar)
import "server-only";
import { cookies } from "next/headers";

export type UiVersion = "v1" | "v2";
export const UI_COOKIE = "pf_ui";

export async function getUiVersion(): Promise<UiVersion> {
  const jar = await cookies();            // Next 16: cookies() async
  const c = jar.get(UI_COOKIE)?.value;
  if (c === "v1" || c === "v2") return c;
  return process.env.UI_V2_DEFAULT === "true" ? "v2" : "v1";
}

export async function isUiV2() {
  return (await getUiVersion()) === "v2";
}
```

Kullanıcı arayüzünde: v2'de kullanıcı menüsünde "Eski görünüme dön" (cookie `v1`) + geri bildirim formu; v1'de üstte ince bant "Yeni PrintFlow'u deneyin →" (yalnızca beta döneminde, `NEXT_PUBLIC_UI_V2_BETA=true`).

### 3.2 Rota deseni (her v2 ekran bileti bunu uygular)

```tsx
// src/app/(dashboard)/machines/page.tsx — ince server wrapper
import { isUiV2 } from "@/lib/flags/ui-version";
import MachinesLegacy from "@/legacy/pages/machines-page";
import { MachinesScreen } from "@/features/machines/machines-screen";

export default async function Page() {
  return (await isUiV2()) ? <MachinesScreen /> : <MachinesLegacy />;
}
```

- Legacy sayfa içeriği **taşınır, değiştirilmez**: `src/app/(dashboard)/machines/page.tsx` içeriği → `src/legacy/pages/machines-page.tsx` (aynı `"use client"` + default export). Yalnızca import yolları düzeltilir.
- Dinamik rotalar: `export default async function Page(props: PageProps<"/machines/[id]">) { const { id } = await props.params; ... }` (Next 16 `PageProps` yardımcı tipi — `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`).
- `(dashboard)/layout.tsx`: `isUiV2()` ? `<AppShellV2>` : `<AppShell>`; `SupportDiagnosticsRoot` her ikisini sarar.
- Kök `layout.tsx`: `<html lang="tr" data-ui={ui} data-theme="dark" data-density={density}>`.
- Yeni rotalar (yalnızca v2'de anlamlı: `/orders`, `/onboarding`, `/settings/*`, `/changelog`): v1'de erişilirse v2 kabuğu ile render edilir (yeni ekranlar için legacy yok) — yani bayrak yalnızca **mevcut** ekranları değiştirir; yeni rotalar her iki modda v2'dir ama v1 navigasyonunda link yoktur.
- Pazarlama sayfaları bayraksızdır: `(marketing)` grubunda geliştirilir, staging'de doğrulanır, tek PR ile değiştirilir (P4).

### 3.3 Yayın aşamaları

| Aşama | Bayrak | Kim | Çıkış kriteri |
|---|---|---|---|
| A — Dahili | staging `UI_V2_DEFAULT=true` | Ekip | Faz 0 + Faz 1 bitti, P0 kalite kapıları yeşil |
| B — Beta (opt-in) | prod `false`, bant ile `?ui=v2` | Gönüllü müşteriler (5–10) | 2 hafta, kritik hata 0, CSAT ≥ 4/5 |
| C — Varsayılan | prod `true`, "Eski görünüme dön" açık | Herkes | 2 hafta, v1'e dönüş oranı < %5 |
| D — Legacy kaldırma | bayrak silinir (P5-06) | – | C + 2 hafta |

## 4. Hat R — Gelir hazırlığı (redesign'dan bağımsız, **hemen** başlar)

| ID | İş | Sahibi | Bağımlılık | Kabul |
|---|---|---|---|---|
| R-01 | Projeye özel git deposu: `3d-management-system` klasöründen yeni repo (GitHub veya Cursor Origin), geçmişi `git subtree split`/`filter-repo` ile ayıkla **veya** temiz ilk commit; ev dizinindeki depodan bu klasörü çıkar | Kullanıcı + agent | – | `git rev-parse --show-toplevel` = proje kökü |
| R-02 | Vercel projesi (Pro), Git bağlantısı, `staging` custom environment, alan adları | Kullanıcı | R-01 | Preview deploy yeşil |
| R-03 | Staging Supabase projesi; tüm migration'lar 001–027 uygulanır; auth redirect URL'leri staging/preview | Kullanıcı + agent | – | `MIGRATION_FROM=1 DATABASE_URL=<staging> npm run db:migrate:pending` başarılı |
| R-04 | **Prod migration 024–027** + env (bkz. §7) | Kullanıcı (yetki) | yedek | §7 kontrol listesi |
| R-05 | Paddle canlı: ürün/fiyatlar (TRY, aylık+yıllık), webhook → `/api/billing/webhook`, `PADDLE_*` env | Kullanıcı | fiyat kararı | Sandbox'ta uçtan uca satın alma + webhook testi (`npm run test:billing`) |
| R-06 | Resend: alan adı doğrulama (SPF/DKIM/DMARC), `EMAIL_FROM`, `SUPPORT_EMAIL_FROM`, `SUPPORT_EMAIL_TO` | Kullanıcı | alan adı | Destek talebi e-postası teslim |
| R-07 | Köprü kurulum dosyaları CDN'de (`npm run cdn:bridge:publish`, `BRIDGE_CDN_DEST`, `NEXT_PUBLIC_PRINTFLOW_BRIDGE_BASE_URL`, `NEXT_PUBLIC_PRINTFLOW_BRIDGE_VERSION`); macOS notarization / Windows imzalama | Kullanıcı | sertifikalar | `/api/bridge/downloads` gerçek URL döndürür |
| R-08 | Yasal: KVKK aydınlatma, gizlilik, kullanım koşulları, çerez metinleri (hukuk onaylı) | Kullanıcı | – | Metinler P4-06'ya teslim |

## 5. Sürekli entegrasyon (`.github/workflows/web-ci.yml`, P0-00)

```yaml
name: web-ci
on:
  pull_request:
  push: { branches: [main, staging] }
concurrency: { group: web-ci-${{ github.ref }}, cancel-in-progress: true }
jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx eslint src --max-warnings=0   # P0-01 sonrası zorunlu; öncesinde yalnızca hata
      - run: npm run test:unit
      - run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-placeholder
  e2e:
    needs: checks
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci && npx playwright install --with-deps chromium
      - name: Wait for Vercel preview
        # Vercel preview URL'si deployment_status olayından veya sabit staging'den
        run: echo "PLAYWRIGHT_BASE_URL=${{ vars.STAGING_URL }}" >> $GITHUB_ENV
      - run: npx playwright test e2e/smoke.spec.ts e2e/visual e2e/a11y
        env:
          E2E_EMAIL: ${{ secrets.E2E_EMAIL }}
          E2E_PASSWORD: ${{ secrets.E2E_PASSWORD }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: playwright-report }
```

`package.json`'a eklenecek script'ler (P0-00 / P0-14 / P5-01):
- `"test:unit": "npx tsx --test \"src/**/*.test.ts\""`
- `"test:visual": "playwright test e2e/visual"`, `"test:visual:update": "playwright test e2e/visual --update-snapshots"`
- `"test:a11y": "playwright test e2e/a11y"`
- `"typecheck": "tsc --noEmit"`

Gerekli GitHub secrets/vars: `E2E_EMAIL`, `E2E_PASSWORD` (staging test kullanıcısı, Atölye planı `billing:dev-grant` ile), `STAGING_URL`.

## 6. Kalite kapıları

### 6.1 Her PR
- `tsc` temiz, `eslint` 0 hata (P0-01 sonrası 0 uyarı), birim testleri yeşil, `next build` başarılı.
- Token denetimi (v2 dosyaları için 0 sonuç): `rg -n "zinc-|sky-|indigo-|emerald-|amber-|violet-|#[0-9a-fA-F]{6}|text-\[1[01]px\]|glass|btn-gradient" src/components/ds src/components/v2 src/features`
- Görsel regresyon (P0-14 sonrası): `e2e/visual/*.spec.ts`, 1440×900 ve 390×844, koyu tema; `maxDiffPixelRatio: 0.01`; SSE/zamana bağlı alanlar `mask` ile maskelenir; legacy ekranlar için ayrı baseline (`?ui=v1`) — legacy'nin değişmediğini kanıtlar.
- a11y (P5-01 sonrası; öncesinde elle): `@axe-core/playwright`, WCAG 2.2 A/AA etiketleri, ihlal 0 (bilinen istisnalar `e2e/a11y/allowlist.ts` içinde gerekçeli).

### 6.2 Manuel QA (staging, her faz sonunda) — `docs/redesign/qa-checklist.md` P0-14'te oluşturulur
- Tarayıcılar: Chrome, Safari (macOS + iOS), Firefox, Edge; Android Chrome.
- Klavye-only tam akış: kayıt → onboarding → yazıcı bağla (elle) → sipariş oluştur → durum değiştir → sil (onay).
- Ekran okuyucu: VoiceOver (macOS/iOS) ile dashboard, sipariş formu, dialog.
- Yakınlaştırma %200 ve 320px genişlik (WCAG 1.4.10 reflow).
- `prefers-reduced-motion` açık.
- Yavaş 4G + CPU 4× yavaşlatma ile dashboard ve makineler.
- Canlı: SSE akışı (`e2e/machines-live.spec.ts`), sekme arka plana alınıp geri gelince yeniden bağlanma.
- Plan sınırları: free planda 3. makine → UpgradePrompt; bulut bağlantısı kilidi.
- Türkçe: ş/ğ/İ/ı glifleri, uzun Türkçe kelimelerde taşma, para/tarih biçimleri.

### 6.3 Performans bütçeleri (Vercel Speed Insights + Lighthouse CI isteğe bağlı)

| Metrik (p75, mobil) | Hedef |
|---|---|
| LCP | ≤ 2.5 s (dashboard), ≤ 2.0 s (landing) |
| INP | ≤ 200 ms |
| CLS | ≤ 0.05 |
| İlk yük JS (route başına, gzip) | ≤ 180 KB uygulama, ≤ 120 KB landing |
| ECharts / three / xlsx | yalnızca dinamik import (`next/dynamic` veya `await import()`) |

`next.config.ts`'e (P5-02): `experimental.optimizePackageImports: ["lucide-react", "date-fns", "radix-ui"]` — önce `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/optimizePackageImports.md` okuyun (sürümde varsayılan listede olabilir).

## 7. Production migration ve env kontrol listesi (R-04)

**Önkoşul:** Supabase Dashboard → Database → Backups'tan manuel yedek (veya PITR açık). Bakım penceresi: düşük trafik (gece 02:00–04:00 TR).

1. **Yedek al** ve geri yükleme adımını not et.
2. Migration içeriklerini gözden geçir: `supabase/migrations/024_machine_camera_frames.sql`, `025_bridge_vendors_discovery.sql`, `026_support_reports.sql`, `027_support_enhancements.sql` (idempotent mi? `IF NOT EXISTS` kontrolü).
3. Önce **staging**'e uygula ve smoke test.
4. Prod: `MIGRATION_FROM=24 PRODUCTION_DATABASE_URL='postgres://…' npm run db:migrate:pending`
5. Doğrula (SQL editor):
   ```sql
   select to_regclass('public.machine_camera_frames'), to_regclass('public.support_tickets'), to_regclass('public.client_error_events');
   select policyname, tablename from pg_policies where tablename in ('support_tickets','client_error_events') order by 2;
   ```
6. Vercel Production env (Sensitive işaretli):
   - `SUPABASE_SERVICE_ROLE_KEY` (destek, cron, webhook)
   - `RESEND_API_KEY`, `EMAIL_FROM`, `SUPPORT_EMAIL_FROM`, `SUPPORT_EMAIL_TO`
   - `SUPPORT_ADMIN_EMAILS` (virgülle ayrılmış)
   - `CRON_SECRET`, `INTEGRATION_ENCRYPTION_KEY` (32 bayt; staging'den **farklı**)
   - `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `NEXT_PUBLIC_PADDLE_ENV=production`, plan fiyat ID'leri `PADDLE_STARTER_PRICE_ID`, `PADDLE_PRO_PRICE_ID`, `PADDLE_FARM_PRICE_ID` (`src/lib/billing/plans.ts` `PRICE_ENV`; yıllık fiyatlar P4-04 ile `PADDLE_*_YEARLY_PRICE_ID` olarak eklenir)
   - `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_VERSION` (opsiyonel; yoksa `VERCEL_GIT_COMMIT_SHA`)
   - `NEXT_PUBLIC_PRINTFLOW_BRIDGE_BASE_URL`, `NEXT_PUBLIC_PRINTFLOW_BRIDGE_VERSION`
   - `UI_V2_DEFAULT=false` (aşama B'ye kadar)
   - İsteğe bağlı: `OPENAI_API_KEY` / `VOICE_LLM_*` (sesli not LLM)
7. Redeploy → `/support` talep oluştur → admin e-postası geldi mi → `/support/admin` erişimi.
8. Cron doğrulama: Vercel → Crons → son çalışmalar 200 (`docs/production-cron.md`).

## 8. Geri alma (rollback)

| Senaryo | Eylem | Süre |
|---|---|---|
| v2 ekranında kritik hata | Vercel env `UI_V2_DEFAULT=false` + redeploy **veya** (P5-05 sonrası) kiracı bayrağı; kullanıcı tarafında `?ui=v1` | < 5 dk |
| Deploy bozuk | Vercel → Deployments → önceki prod deploy → "Promote to Production" (Instant Rollback) | < 1 dk |
| Migration hatası | Migration'lar additive tasarlanır (kolon/tablo ekle, silme yok); gerekirse ters migration `supabase/migrations/rollback/0NN_*.sql` hazır tutulur; son çare yedekten geri yükleme | 15–60 dk |
| Paddle webhook sorunu | `PADDLE_WEBHOOK_SECRET` doğrula, Paddle'dan olayları yeniden gönder (idempotent işleyici) | – |

Kural: **Her migration için ters migration dosyası** aynı PR'da (`rollback/` altında, otomatik çalışmaz).

## 9. İzleme ve analitik

- **Hata**: `client_error_events` (mevcut) → `/support/admin` hata akışı; v2 `error.tsx` sınırları `reportClientError` çağırır (mevcut diagnostics). Etiket: `ui_version` alanı eklenir (P5-03, migration gerekirse `context jsonb` içine) → v1/v2 hata oranı karşılaştırması.
- **Web Vitals**: `@vercel/speed-insights` + `useReportWebVitals` (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-report-web-vitals.md`).
- **Ürün analitiği**: `@vercel/analytics` `track()` olayları (03 §7.3 hunisi) — kişisel veri gönderilmez (KVKK); çerez bandı gerekiyorsa P4-06.
- **Uptime**: Durum sayfası (P3-16) + harici ping (Better Stack/UptimeRobot — kullanıcı kararı).
- **Cron**: overdue-reminders ve cloud-printer-sync başarısızlığı → `client_error_events` kaynak `cron` + admin e-postası.
- **İş metrikleri (haftalık)**: yeni kayıt, aktivasyon (ilk yazıcı bağlama) oranı, deneme→ödeme dönüşümü, churn, NPS, CSAT, ortalama destek yanıt süresi.

## 10. Lansman planı (zaman çizelgesi)

| Hafta | Redesign | Hat R | Yayın |
|---|---|---|---|
| 1 | Faz 0 (temel) | R-01, R-02, R-03 | – |
| 2 | Faz 1 (ekranlar) | R-04 prod migration, R-05 Paddle sandbox | **Staging (aşama A)** |
| 3 | Faz 1 bitiş + Faz 2 başlangıç | R-06 Resend, R-07 köprü CDN | – |
| 4 | Faz 2 (onboarding, sihirbaz, yükseltme) + Faz 4 başlangıç | R-05 Paddle live, R-08 yasal | **Prod beta (aşama B)**, satışa açılış (yeni pricing + checkout) |
| 5–6 | Faz 4 (pazarlama) + Faz 3 başlangıç (ekip/rol) | – | Aşama C (v2 varsayılan) |
| 7–8 | Faz 3 (kurumsal) + Faz 5 (sertleştirme) | – | GA, aşama D (legacy kaldırma) |

İlk satış hedefi **4. hafta**: ödeme (R-05) + pricing (P1-14/P4-03) + yükseltme akışı (P2-07) + temel v2 deneyimi. Kurumsal özellikler (ekip/rol) 6–8. haftada kurumsal satışın önünü açar.
