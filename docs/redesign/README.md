# 3dasisstant Yeniden Tasarım Planı

> Durum: **Planlama tamamlandı — uygulama başlamadı.** (25 Ekim 2026)
> Bu klasör, **3dasisstant** (3D atölye ERP; eski çalışma adı PrintFlow) ürününün uçtan uca UI/UX yeniden tasarımını ve staging → production yayınını tanımlar. Uygulama, `06-backlog.md`'deki biletlerin `07-implementer-prompt.md` şablonuyla tek tek yürütülmesiyle yapılır.

## Hedef

3D baskı atölyelerinden 40 makinelik filament çiftliklerine ve kurumsal müşterilere kadar herkesin **profesyonel, hızlı, güvenilir ve özgün** bulacağı bir ürün; en kısa sürede satışa açılmak ve müşteri memnuniyetiyle sadakat yaratmak.

## Belgeler

| Dosya | İçerik |
|---|---|
| [`01-audit.md`](./01-audit.md) | Mevcut durum denetimi: rota/bileşen envanteri, UX ve erişilebilirlik sorunları, kalite metrikleri, operasyon engelleri. Ekran görüntüleri `audit/` altında. |
| [`02-design-system.md`](./02-design-system.md) | **"Forge"** tasarım sistemi: kod olarak token'lar (açık/koyu), makine durumu renkleri, tipografi, yoğunluk, hareket, ikonlar, grafik paleti, odak/z-index, Türkçe metin rehberi ve sözlük, zinc'ten geçiş. |
| [`03-ux-architecture.md`](./03-ux-architecture.md) | Bilgi mimarisi, navigasyon, ⌘K, roller, ana akışlar (onboarding, yazıcı bağlama, sipariş → teslim, plan, filo, stok, yükseltme, destek), kurumsal özellikler, pazarlama hunisi. |
| [`04-21st-components.md`](./04-21st-components.md) | 21st.dev'den seçilen **31 bileşen + 1 tema**, alma prosedürü, uyarlama kuralları, alternatifler. Yer imi listesi: "PrintFlow Redesign". |
| [`05-delivery-staging-prod.md`](./05-delivery-staging-prod.md) | Ortamlar, `ui_v2` bayrağı, gelir hazırlığı hattı (Hat R), CI, kalite kapıları, performans bütçeleri, prod migration ve env kontrol listesi, geri alma, izleme, zaman çizelgesi. |
| [`06-backlog.md`](./06-backlog.md) | **74 bilet** (Faz 0–5) + 8 Hat R işi; her bilette dosya yolları, 21st çağrısı, kabul kriterleri, doğrulama komutları, boyut, bağımlılık, "yapma" listesi. |
| [`07-implementer-prompt.md`](./07-implementer-prompt.md) | Uygulayıcı prompt şablonu, ortam hazırlığı, genel YAPMA listesi, inceleme kontrol listesi. |

## Tasarım yönü (tek paragraf)

**"Sıcak nozul, soğuk çelik."** Grafit/çelik endüstriyel bir yüzeyde tek sıcak renk olarak erimiş filament turuncusu: yalnızca birincil eylem, odak, aktif gezinme ve "Baskıda" durumunda kullanılır. Geist Sans + Geist Mono (telemetri ve sayılar), sıkı 8–12px köşeler, katman çizgisi motifi, üst barda canlı "Filo nabzı", katmanlı ilerleme çubukları. Koyu tema varsayılan, açık tema token'larla hazır. Sky/indigo gradyanlı, glass efektli "generic SaaS" görünümünden kesin ayrışma.

## Fazlar

| Faz | Odak | Bilet | Hafta |
|---|---|---|---|
| R | Gelir hazırlığı: ayrı repo, Vercel Pro, staging Supabase, prod migration 024–027, Paddle canlı, Resend, köprü CDN, yasal | 8 | 1–4 (paralel) |
| 0 | Temel: CI, lint, proxy, bayrak, token, primitifler, kabuk, ⌘K, tablo, test altyapısı | 16 | 1 |
| 1 | Tüm mevcut ekranların v2'si + yeni Siparişler listesi + şifre sıfırlama | 16 | 2–3 |
| 2 | Aktivasyon & gelir: onboarding, birleşik yazıcı sihirbazı, yükseltme, stok uyarıları, kanban | 10 | 3–4 |
| 3 | Kurumsal: çalışma alanı/ekip/roller, denetim kaydı, bildirimler, dışa aktarım, NPS/CSAT, durum sayfası | 17 | 5–8 |
| 4 | Pazarlama: landing, fiyatlandırma, deneme/ödeme hunisi, marka, yasal | 6 | 4–6 |
| 5 | Sertleştirme: a11y, performans, analitik, açık tema, CSP, e-postalar, legacy temizliği, lansman | 9 | 6–8 |

Yayın aşamaları: **A** staging dahili (2. hafta) → **B** prod beta opt-in + satışa açılış (4. hafta) → **C** v2 varsayılan (5–6. hafta) → **D** legacy kaldırma / GA (8. hafta).

## Hemen başlanacak ilk 3 bilet

1. **P0-00 Depo hijyeni + web CI** (önce Hat R-01: projeye özel depo) — diğer her şeyin güvenli zemini.
2. **P0-03 `ui_v2` bayrağı → P0-04 token'lar ve fontlar** (P0-02 proxy ile birlikte küçük bir zincir) — legacy'yi bozmadan yeni görünümü açar.
3. **P0-11 AppShellV2** (P0-05 primitiflerinden sonra) — yeni deneyimin iskeleti; tüm ekranlar bunun içine taşınır.

Paralelde kullanıcı tarafında: **R-04 prod migration 024–027 + env** ve **R-05 Paddle** — satışın önündeki gerçek engeller.

## Sizden gerekenler (staging öncesi)

| # | Gereken | Neden | Ne zaman |
|---|---|---|---|
| 1 | Projeye özel Git deposu (GitHub veya Cursor Origin) — proje şu an ev dizini deposunun içinde | CI/CD, Vercel bağlantısı | Hemen |
| 2 | Vercel projesi + **Pro plan** | Staging URL; 2 dakikalık bulut senkron cron'u Hobby'de çalışmaz | 1. hafta |
| 3 | Ayrı **staging Supabase** projesi (URL, anon key, service role, DB URL) | Prod veriyi korumak | 1. hafta |
| 4 | Prod `PRODUCTION_DATABASE_URL` erişimi ve migration penceresi onayı (024–027) | Destek/kamera özellikleri prod'da | 2. hafta |
| 5 | Paddle: canlı hesap, ürünler, **TRY fiyatları** (aylık + yıllık?), deneme süresi kararı (öneri: 14 gün Atölye) | Satış | 2–4. hafta |
| 6 | Resend: doğrulanmış alan adı, `EMAIL_FROM`, `SUPPORT_EMAIL_FROM/TO` | Şifre sıfırlama, davet, destek e-postaları | 2. hafta |
| 7 | `SUPPORT_ADMIN_EMAILS`, `CRON_SECRET`, `INTEGRATION_ENCRYPTION_KEY` (staging ve prod için ayrı) | Destek paneli, cron, bulut entegrasyon şifreleme | 1–2. hafta |
| 8 | Köprü kurulum dosyalarının CDN yayını + macOS notarization / Windows kod imzalama sertifikaları | Yazıcı bağlama sihirbazında indirme | 3. hafta |
| 9 | Alan adı kararı (ör. `printflow.app` / `app.` / `staging.`) | Staging ve prod URL'leri, OG, e-posta | 1. hafta |
| 10 | KVKK aydınlatma, gizlilik, kullanım koşulları, çerez metinleri (hukuk onaylı) | Kayıt ve satış için yasal zorunluluk | 4. hafta |
| 11 | Marka/logo onayı (yön: katman çizgisi "P" işareti) ve renk yönünün ("Forge") onayı | P0-04 ve P4-05 | 1. hafta |
| 12 | E2E test kullanıcısı (staging, Atölye planı) — `E2E_EMAIL`, `E2E_PASSWORD` | CI ve görsel regresyon | 1. hafta |
| 13 | (İsteğe bağlı) `API_KEY_21ST` | Yalnızca shadcn kurulum URL'leri kullanılacaksa; MCP ile alma için gerekmez | – |

## Bu planlama görevinin sınırları

- Hiçbir uygulama kodu değiştirilmedi; commit yapılmadı.
- Vercel yalnızca okundu; hiçbir kaynak değiştirilmedi.
- 21st.dev'de yalnızca "PrintFlow Redesign" yer imi listesi oluşturuldu (1 tema + 31 bileşen).
- npm paket sürümleri ağ kısıtı nedeniyle sabitlenemedi; her bilet kurulumdan önce `npm view` ile doğrular.
- Ekran görüntüleri dar (mobil) görünümde alındı; masaüstü baseline'ları P0-14'te otomatik üretilecek.
