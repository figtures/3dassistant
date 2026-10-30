# Destek ve sorun bildirimi

Müşteriler panelden **Sorun bildir** ile teknik ekibe ulaşır; köprü sorunlarında atölyede tanılama paketi üretilir.

## Müşteri akışı

1. Üst çubuk, mobil yan menü veya **Destek** sayfasından **Sorun bildir** açın.
2. Kategori, konu ve açıklamayı yazın; isteğe bağlı makine ve en fazla 3 ekran görüntüsü (PNG/JPG/WebP, ≤5 MB) ekleyin.
3. **Gönderilecek tanılama bilgileri** bölümünden ne paylaşıldığını önizleyin.
4. Gönder → bilet numarası (`PF-XXXXXX`) ve (yapılandırıldıysa) onay e-postası.
5. **/support** — bilet listesi, durum (`Açık` / `İşleniyor` / `Çözüldü`) ve ekiple mesajlaşma.

E-posta yapılandırılmadıysa kayıt yine veritabanına yazılır (service role **gerekmez**); formdaki **mailto** yedek bağlantısı kullanılabilir.

## Köprü tanılama paketi

Atölye bilgisayarında (eşleştirme yapılmış köprü):

```bash
npm run bridge:support              # yerel JSON (stderr özet)
npm run bridge:support -- --json
npm run bridge:support -- --upload    # buluta yükle → BDL-XXXXXXXX kodu
```

Go köprü: `printflow-bridge support [--json] [--upload]`

Köprü paketi yükleme API’si `SUPABASE_SERVICE_ROLE_KEY` gerektirir.

Son 24 saat içinde yüklenen paket, paneldeki sorun bildirimine otomatik bağlanır.

## Ekler (storage)

- Bucket: `support-attachments` (özel)
- Yol: `{user_id}/{geçici veya bilet klasörü}/dosya`
- RLS: yalnızca dosya sahibi yükleme/okuma
- Destek e-postası ve admin paneli: 7 günlük imzalı URL (service role ile)

## Yerleşik hata telemetrisi

- İstemci: örneklenmiş (`~25%`), dedupe, `POST /api/telemetry/client-errors`
- Sunucu: `src/instrumentation.ts` → `onRequestError`
- Tablo: `client_error_events` (fingerprint, sayaç, ilk/son görülme)
- Sorun bildirimi tanılamasına son hata fingerprint’leri eklenir
- İç panel: **Hatalar** sekmesi (`/support/admin`)
- Harici Sentry: yalnızca `SENTRY_DSN` tanımlıysa (opsiyonel; varsayılan kapalı)

## Toplanan veriler

| Dahil | Hariç / redakte |
|--------|------------------|
| Bilet metni, kategori, URL, tarayıcı, saat dilimi | Şifreler, erişim kodları, API anahtarları |
| Plan, kullanıcı id, e-posta (destek için) | E-posta adresleri hata mesajı içinde maskelenir |
| Son istemci hataları, başarısız API yolları (gövde yok) | Yanıt gövdeleri |
| Köprü son görülme, makine köprü bağlantısı | Köprü jetonu (yalnızca ilk 2 karakter özeti) |
| Köprü paketi: keşif özeti, ağ arayüzleri (özel IP), log son satırlar | Tam config sırları |

## İç ekip

- Panel: `/support/admin` — yalnızca `SUPPORT_ADMIN_EMAILS` (route seviyesinde 404)
- API: `GET/PATCH/POST /api/support/admin/reports`, `GET /api/support/admin/errors`

## Ortam değişkenleri

| Değişken | Açıklama |
|----------|-----------|
| `RESEND_API_KEY` | E-posta gönderimi (yoksa DB kaydı + uyarı logu) |
| `SUPPORT_EMAIL_TO` | Destek kutusu (varsayılan `destek@3dasisstant.com`) |
| `SUPPORT_EMAIL_FROM` / `EMAIL_FROM` | Gönderen adresi |
| `SUPPORT_ADMIN_EMAILS` | Virgülle ayrılmış iç panel e-postaları |
| `SUPABASE_SERVICE_ROLE_KEY` | Köprü paketi, admin listesi, imzalı ek URL’leri, sunucu hata kaydı |
| `SENTRY_DSN` | Opsiyonel; tanımlı değilse yerleşik telemetri kullanılır |

## Migration

- `026_support_reports.sql` — temel biletler ve köprü paketleri
- `027_support_enhancements.sql` — ekler, mesajlar, telemetri, storage
