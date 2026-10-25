# Marka ve kod adları

## Halka açık marka

- **Ürün adı:** `3dassistant` (küçük harf, tek kelime görünümü; başlıklarda **3dassistant**).
- **Alt başlık (Türkçe):** 3D atölye ERP / 3D baskı atölyeleri için üretim yönetimi.
- **GitHub / paket:** `figtures/3dassistant`, npm paket adı `3dassistant`.

Müşteri görünür metinlerde (giriş, pazarlama, e-posta konuları, metadata) PrintFlow yerine **3dassistant** kullanılır.

## Dahili / teknik adlar (değiştirilmedi)

Aşağıdakiler bilinçli olarak eski adları taşıyabilir; yeniden adlandırma ayrı bir migrasyon işidir:

| Alan | Ad |
|------|-----|
| Masaüstü ajan | **PrintFlow Bridge** (`printflow-bridge`, `apps/printflow-bridge`, `tools/printflow-bridge`) |
| API rotaları | `/api/bridge/*`, env `NEXT_PUBLIC_PRINTFLOW_BRIDGE_*` |
| Go modülü | `github.com/printflow/printflow-bridge` |
| Kurulum dizinleri (OS) | `PrintFlow Bridge` (Application Support / Program Files) |
| Üretici API User-Agent | `PrintFlow/1.0` (üretici tarafı tanımlayıcı) |

Köprü UI metninde ürün adı **PrintFlow Bridge** olarak kalabilir; bulut uygulaması **3dassistant** olarak anılır.

## Entegrasyonlar (beklemede)

- **Resend** (`EMAIL_FROM`, `SUPPORT_EMAIL_*`): yapılandırma kullanıcı kararıyla ertelendi; örnek env’de not edilir.
- **Paddle** (`PADDLE_*`): canlı faturalama ertelendi; mevcut kod ve env anahtarları dokunulmadı.

## Supabase

Mevcut proje URL’leri ve bağlantı dizeleri korunur; marka değişikliği yeni Supabase projesi gerektirmez.
