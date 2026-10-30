# 3D Print Manager

3D baskı firmaları için gelişmiş yönetim sistemi. Next.js 16 + Supabase (free plan) ile geliştirilmiştir.

## Özellikler

- **Güvenli Giriş**: Supabase Auth ile e-posta/şifre kimlik doğrulama, RLS ile veri izolasyonu
- **Dashboard**: ECharts ile çoklu filtreli metrikler (iş sayısı, malzeme kullanımı, makine dağılımı)
- **Planlama Tablosu**: Excel benzeri tarih × makine grid, hücre bazlı iş emirleri
- **Malzeme Yönetimi**: PETG, ASA, PLA vb. filament takibi
- **Müşteri Yönetimi**: Excel şablonu ile toplu içe/dışa aktarma
- **3D Görüntüleyici**: Three.js ile STL dosyalarını uygulama içinde görüntüleme
- **Sesli Not**: Web Speech API (tr-TR) ile ücretsiz sesli giriş, otomatik alan doldurma

## Kurulum

### 1. Bağımlılıklar

```bash
npm install
```

### 2. Supabase Projesi

1. [supabase.com](https://supabase.com) üzerinde yeni proje oluşturun (Free plan)
2. SQL Editor'de `supabase/migrations/001_initial_schema.sql` dosyasını çalıştırın
3. Authentication > Settings > Email auth'u etkinleştirin

### 3. Ortam Değişkenleri

```bash
cp .env.local.example .env.local
```

`.env.local` dosyasını doldurun:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
```

### 4. Çalıştırma

```bash
npm run dev
```

http://localhost:3000 adresinde açılır.

## Supabase Kurulumu (Access Token ile)

Supabase access token'ınızı verdiğinizde CLI ile otomatik kurulum yapılabilir:

```bash
npx supabase login --token YOUR_ACCESS_TOKEN
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

## Proje Yapısı

```
src/
├── app/
│   ├── (dashboard)/     # Korumalı sayfalar
│   │   ├── dashboard/   # ECharts dashboard
│   │   ├── planning/    # Excel grid
│   │   ├── materials/
│   │   ├── customers/
│   │   └── machines/
│   ├── login/
│   └── register/
├── components/
│   ├── dashboard/
│   ├── planning/
│   ├── viewer/          # Three.js STL
│   └── layout/
├── hooks/
├── lib/
└── types/
```

## Excel Müşteri Şablonu

Müşteriler sayfasından "Şablon İndir" ile Excel dosyasını indirin. Sütunlar:

| Ad Soyad | E-posta | Telefon | Firma | Notlar |
|----------|---------|---------|-------|--------|

Doldurduktan sonra "Excel İçe Aktar" ile yükleyin.

## Sesli Not Kullanımı

Planlama tablosunda bir hücreye tıklayın, mikrofon butonuna basın ve konuşun:

> "150 gram PETG, müşteri Ahmet Yılmaz, tamamlandı"

Sistem otomatik olarak gram, malzeme, müşteri ve durum alanlarını doldurur.

**Desteklenen tarayıcılar**: Chrome, Edge, Safari 14.5+

### LLM ile gelişmiş ayrıştırma (opsiyonel)

Sunucuda `OPENAI_API_KEY` (veya `VOICE_LLM_API_KEY` + isteğe bağlı `VOICE_LLM_BASE_URL`) tanımlıysa ses metni önce LLM ile yapılandırılır; yoksa mevcut kural tabanlı ayrıştırıcı kullanılır. Arayüzde **LLM** veya **Kural** rozeti görünür.

## Production deploy

1. Vercel’e deploy edin; `vercel.json` **app** + dahili **printflow-bridge** servislerini ve cron tanımlarını içerir.
2. Ortam değişkenlerini ayarlayın: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_SITE_URL`.
3. Servis düzeni ve yerel `vercel dev`: [docs/deployment.md](docs/deployment.md).
4. Cron ve e-posta testi: [docs/production-cron.md](docs/production-cron.md).

`.env.local.example` dosyasında tüm opsiyonel anahtarlar listelenir.

## E2E testleri (Playwright)

```bash
npx playwright install chromium
npm run dev   # ayrı terminal
npm run test:e2e
```

Giriş testleri için `E2E_EMAIL` ve `E2E_PASSWORD` (varsayılan dev hesabı `.env.local.example` içinde). UI modu: `npm run test:e2e:ui`.

## Lisans

Private — Tüm hakları saklıdır.
