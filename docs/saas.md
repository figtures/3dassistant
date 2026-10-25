# PrintFlow SaaS — işletme (operatör) rehberi

Bu belge **PrintFlow'u işleten sizin** içindir. Müşteriler hiçbir ortam değişkeni, API anahtarı veya
sunucu ayarı görmez; tek yaptıkları kayıt olmak, plan seçmek ve üretici hesaplarıyla giriş yapmaktır.

## Kiracı modeli

- 1 kayıtlı hesap = 1 müşteri (kiracı). Ekip / çalışma alanı bu fazda yok.
- Her tabloda `user_id` + RLS `auth.uid() = user_id`. Müşteri yalnızca kendi verisini okur/yazar.
- Abonelik tabloları (`subscriptions`, `billing_customers`) müşteriye **salt okunur**; yazma yalnızca
  Paddle webhook'u (service role) ile olur. Tarayıcı plan hakkı yazamaz.

## Planlar ve kotalar

| Plan | Makine | Canlı yazıcı takibi | Tick başına senkron |
|------|--------|---------------------|---------------------|
| Ücretsiz (abonelik yok) | 2 | Yok | 0 |
| Starter | 5 | Yok | 0 |
| Atölye (`pro`) | 8 | Var | 8 |
| Filament Farm (`farm`) | 40 | Var | 20 |

Tanımlar: `src/lib/billing/plans.ts`. Ücretsiz katman değerleri ayrıca
`supabase/migrations/016_subscriptions.sql` → `effective_entitlements()` içinde; ikisi aynı tutulmalı.

Kotalar iki katmanda uygulanır:

1. **API** (`/api/integrations/printers/*`, OAuth start/callback, manuel senkron) — anlaşılır Türkçe
   hata + `/billing` yönlendirmesi.
2. **Veritabanı tetikleyicileri** — `machines` ekleme kotası, bulut hesap / bağlantı için
   `cloud_monitoring` şartı. İstemci API'yi atlayıp doğrudan Supabase'e yazsa bile aşılamaz.

`trialing`, `active`, `past_due` durumları hak verir (ödeme yeniden denenirken kesinti olmaz);
`canceled` / `paused` ücretsiz katmana düşer. Kota düşünce mevcut makineler silinmez, yalnızca yenisi
eklenemez; bulut senkron durur.

## Ödeme: Paddle Billing

1. Paddle'da (önce **Sandbox**) üç ürün/fiyat oluşturun: Starter, Atölye, Filament Farm (aylık).
2. **Developer Tools → Authentication**: API key (sunucu) ve client-side token oluşturun.
3. **Checkout → Default payment link**: `https://<alan-adınız>/billing` olarak ayarlayın
   (Paddle, işlem ödeme linklerini buna göre üretir).
4. **Developer Tools → Notifications**: yeni webhook
   - URL: `https://<alan-adınız>/api/webhooks/paddle`
   - Olaylar: `subscription.created`, `subscription.updated`, `subscription.canceled`,
     `subscription.paused`, `subscription.resumed`, `subscription.past_due`, `subscription.activated`,
     `subscription.trialing`
   - Gizli anahtarı `PADDLE_WEBHOOK_SECRET` olarak kaydedin.
5. Canlıya geçerken production anahtarlarıyla aynı adımlar + `NEXT_PUBLIC_PADDLE_ENV=production`.

Akış: `/billing` → sunucu Paddle'da işlem açar (fiyat ID'si yalnızca sunucuda, `custom_data.user_id`
ile) → Paddle.js ödeme penceresi → Paddle webhook → `subscriptions` güncellenir → sayfa planı görür.
Plan değişikliği mevcut aboneliği orantılı (prorated) günceller; fatura/iptal Paddle müşteri portalında.

Webhook güvenliği: `Paddle-Signature` HMAC-SHA256 doğrulaması (5 dk tolerans), olay ID'siyle
tekrar engelleme, eski (`occurred_at` daha eski) güncellemeleri yok sayma.

## Yazıcı bağlama

Ücretsiz ve Starter'da **buluttan bağlama kilitlidir** (`cloudMonitoring: false`). API 402 döner,
veritabanı tetikleyicisi de reddeder. Atölye / Filament Farm gerekir.

- **Bambu Lab ve Creality:** Müşteri "Hesabımla bağlan" der. Partner OAuth varsa üretici
  giriş sayfasına gider; yoksa e-posta + şifre PrintFlow sunucusuna gelir, üreticiye iletilir,
  **şifre saklanmaz**, jeton `INTEGRATION_ENCRYPTION_KEY` ile şifreli ve `user_id` ile izole durur.
  Jeton düşünce hesap "yeniden bağla" olur.
- **Cihaz kapsamı:** Katalog Bambu X1/P1/A1/H2 ve Creality K1/K2/Ender/CR/Sermoon/Hi ailelerini
  tanır. Cloud'da görünen diğer modeller de bağlanır (filtre yok).
- **Atölye köprüsü:** PrintFlow Bridge (Win/macOS/Linux); Bambu + Creality LAN; tarayıcı eklentisi yok. Bkz. [workshop-bridge.md](./workshop-bridge.md).
- **Prusa / OctoPrint (LAN):** SaaS ürününde yok.

Partner client nasıl alınır: [partner-printer-oauth.md](./partner-printer-oauth.md).

## Bulut senkron (cron)

`/api/cron/cloud-printer-sync` her 2 dakikada (`vercel.json`):

- Yalnızca hakkı olan (`cloud_monitoring`, hak veren durum) kiracıları alır.
- En uzun süredir senkronlanmamış bağlantılardan başlar (`machine_cloud_links.last_synced_at`).
- Kiracı başına plan kotası (`sync_per_tick`), tick başına toplam 40 yazıcı, 5 hesap paralel,
  ~90 sn zaman bütçesi. Büyük bir kiracı küçükleri aç bırakmaz.
- Yetki hatası yalnızca o hesabı `error` yapar ve o hesabın kalan cihazlarını atlar; diğer kiracılar
  etkilenmez. Cihazın çevrimdışı olması hesabı hataya düşürmez.

## Ortam değişkenleri (yalnızca sizin deploy'unuz)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # webhook + cron
NEXT_PUBLIC_SITE_URL=https://...
CRON_SECRET=                        # Vercel Cron Authorization: Bearer

# Paddle
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=
PADDLE_STARTER_PRICE_ID=pri_...
PADDLE_PRO_PRICE_ID=pri_...
PADDLE_FARM_PRICE_ID=pri_...
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=
NEXT_PUBLIC_PADDLE_ENV=sandbox      # canlıda: production

# Yazıcı entegrasyonu
INTEGRATION_ENCRYPTION_KEY=         # min 32 karakter, production'da zorunlu
# Partner OAuth (yoksa hesap girişi kullanılır)
BAMBU_OAUTH_CLIENT_ID=
BAMBU_OAUTH_CLIENT_SECRET=
BAMBU_OAUTH_AUTHORIZE_URL=
BAMBU_OAUTH_TOKEN_URL=
BAMBU_OAUTH_SCOPE=
CREALITY_OAUTH_CLIENT_ID=
CREALITY_OAUTH_AUTHORIZE_URL=
CREALITY_OAUTH_TOKEN_URL=
```

Paddle değişkenleri eksikse `/billing` planları gösterir, satın alma düğmeleri kapalı olur ve
"Online ödeme şu an kullanılamıyor" notu çıkar; hata vermez.

## Yerel geliştirme

```bash
# Migration'lar (016, 017 dahil) — supabase/run-dev-setup.sql
npm run billing:dev-grant -- farm            # dev kullanıcıya Filament Farm ver (Paddle'sız)
npm run billing:dev-grant -- free            # ücretsiz katmana dön
npm run billing:dev-grant -- pro kisi@ornek.com
```

`PRINTER_CLOUD_MOCK=true` (yalnızca `NODE_ENV=development`): Bambu OAuth sahte cihazlarla tamamlanır.

`scripts/seed-dev.mjs` birden fazla makine ekler; ücretsiz katmanda 2 makine kotasına takılır —
önce `npm run billing:dev-grant -- farm` çalıştırın.

## Testler

```bash
npm run test:billing        # webhook imzası, abonelik normalizasyonu, haklar
npm run test:cloud-sync     # kiracı başı senkron seçimi, eşzamanlılık
npm run test:integration-crypto
npm run test:bambu-cloud
npm run test:creality-cloud
npm run test:device-catalog
```
