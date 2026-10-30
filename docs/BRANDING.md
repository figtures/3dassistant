# Marka ve kod adları

## Halka açık marka

- **Ürün adı (UI):** **3D Assistant**
- **Alan adı (kanonik):** [https://3dassistant.com](https://3dassistant.com) — `NEXT_PUBLIC_SITE_URL`
- **Alt başlık (Türkçe):** 3D atölye ERP / 3D baskı atölyeleri için üretim yönetimi.
- **GitHub / paket:** `figtures/3dassistant`, npm paket adı `3dassistant`.

Müşteri görünür metinlerde (giriş, pazarlama, e-posta konuları, metadata) PrintFlow yerine **3D Assistant** kullanılır.

## Köprü CDN

- Varsayılan installer kökü: `https://cdn.3dassistant.com/bridge/releases`
- Ortam: `NEXT_PUBLIC_PRINTFLOW_BRIDGE_BASE_URL` (env adı dahili; değiştirilmedi)
- Yol: `/v{VERSION}/printflow-bridge_{VERSION}_{platform}.{pkg|exe|deb}` (dosya adları dahili)

Yeni CDN’e dosya yüklenmeden panel indirmeleri 404 verebilir; bkz. `docs/bridge-cdn-release.md` ve `scripts/cdn/publish-bridge.mjs`.

## Dahili / teknik adlar (değiştirilmedi)

Aşağıdakiler bilinçli olarak eski adları taşıyabilir; yeniden adlandırma ayrı bir migrasyon işidir:

| Alan | Ad |
|------|-----|
| Masaüstü ajan | **3D Assistant Bridge** (UI); binary `printflow-bridge`, `apps/printflow-bridge`, `tools/printflow-bridge` |
| API rotaları | `/api/bridge/*`, env `NEXT_PUBLIC_PRINTFLOW_BRIDGE_*` |
| Go modülü | `github.com/printflow/printflow-bridge` |
| Kurulum dizinleri (OS) | `PrintFlow Bridge` (Application Support / Program Files) — OS paketleri ayrı migrasyon |
| Üretici API User-Agent | `PrintFlow/1.0` (üretici tarafı tanımlayıcı) |
| Derin bağlantı şeması | `printflow://pair?…` |

## Entegrasyonlar (beklemede)

- **Resend** (`EMAIL_FROM`, `SUPPORT_EMAIL_*`): yapılandırma kullanıcı kararıyla ertelendi; örnek env’de not edilir.
- **Paddle** (`PADDLE_*`): canlı faturalama ertelendi; mevcut kod ve env anahtarları dokunulmadı.

## Supabase

Mevcut proje URL’leri ve bağlantı dizeleri korunur; marka değişikliği yeni Supabase projesi gerektirmez.

## UI v2 bayrağı (`ui_v2`)

Yeni Forge arayüzü (grafit + turuncu aksan) v1 ile yan yana çalışır. Çözümleme sırası:

1. URL `?ui=v2` veya `?ui=v1` → `src/proxy.ts` `pf_ui` çerezini yazır ve parametreyi kaldırarak yönlendirir.
2. Çerez `pf_ui` (`v1` | `v2`) — **çerez v1 ise env varsayılanı geçersiz kılınır.**
3. Ortam: `UI_V2_DEFAULT=true` (sunucu) ve/veya `NEXT_PUBLIC_UI_V2_DEFAULT=true` (istemci varsayılanı).
4. Çerez yokken varsayılan: env yoksa `v1`; production’da `UI_V2_DEFAULT=true` önerilir.

**Yerelde v2**

- Tarayıcı: `http://localhost:3000/?ui=v2` (veya herhangi bir sayfa `?ui=v2`).
- `.env.local`: `UI_V2_DEFAULT=true` ve `NEXT_PUBLIC_UI_V2_DEFAULT=true` (bkz. `.env.local.example`).

**Vercel production**

- `UI_V2_DEFAULT=true` (ve isteğe bağlı `NEXT_PUBLIC_UI_V2_DEFAULT=true`) — redeploy gerekir.
- Eski `pf_ui=v1` çerezi olan kullanıcılar `?ui=v2` veya çerezi silerek geçer.

**Legacy’ye dönmek:** `?ui=v1` veya çerezi silin.

**Kod**

- Sunucu: `getUiVersion()`, `isUiV2()` → `@/lib/flags/ui-version.server`
- İstemci: `isUiV2()`, `getClientUiVersion()` → `@/lib/flags/ui-version.client`
- React: `useUiVersion()` → `@/components/flags/ui-version-provider`

Kök `layout.tsx` `<html data-ui="v1|v2" data-theme="dark">` üretir. Token referansı (geliştirme): `/design-tokens`. Detay: `docs/redesign/05-delivery-staging-prod.md` §3.
