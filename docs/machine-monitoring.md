# Makine izleme (PrintFlow)

> **SaaS ürününde yok.** Bulutta çalışan sunucu müşterinin yerel ağındaki OctoPrint'e erişemez ve
> müşteri adresine sunucudan istek atmak çok kiracılı ortamda güvenlik riskidir (SSRF). Bu yüzden
> panelde gösterilmez, `machine-poll` cron'u `vercel.json`'da planlı değildir ve LAN API'leri
> (`/api/machines/[id]/connection`, LAN senkronu, `machine-poll`) yalnızca tek kiracılı self-host
> kurulumda `PRINTFLOW_SELF_HOST_LAN=true` ile açılır.

PrintFlow, 3D yazıcıları **adaptör** katmanı üzerinden izler. Birincil akış **sıfır kurulum bulut** entegrasyonudur — bkz. [zero-install-cloud-printers.md](./zero-install-cloud-printers.md). Bu belge **LAN / OctoPrint** (gelişmiş, isteğe bağlı) izlemeyi açıklar.

## Mimari

```text
[OctoPrint cihaz] ←HTTP (poll)→ [Next.js API / Cron] → [Supabase machines + machine_connections]
                                      ↑
                               [Makineler UI] (30 sn otomatik yenileme)
```

- **Polling (MVP):** `POST /api/machines/[id]/sync` ve `GET /api/cron/machine-poll` (Vercel Cron, ~2 dk).
- **Webhook (gelecek):** OctoPrint plugin veya Moonraker `notify_*` ile anlık güncelleme; cron yedek kalır.

## Güvenlik

| Konu | MVP | Production hedefi |
|------|-----|-------------------|
| API anahtarı | `machine_connections.api_key`, yalnızca RLS + sunucu route okur | `pgcrypto` veya Supabase Vault; istemciye asla gönderilmez |
| Cron | `Authorization: Bearer $CRON_SECRET` | Aynı |
| İstemci | Bağlantı sihirbazı anahtarı yalnızca kayıt/test POST’unda gönderir | HTTPS zorunlu |

## OctoPrint bağlama

1. OctoPrint → **Settings → API** → API key oluşturun.
2. PrintFlow → **Makineler** → makine kartında **Bağla**.
3. `http://YAZICI_IP:5000` ve API anahtarını girin → **Bağlantıyı test et** → **Kaydet**.
4. **Şimdi güncelle** veya cron ile durum gelir.

Sunucunun (Vercel/local) OctoPrint’e ağ erişimi olmalıdır. Yerel OctoPrint + uzak Vercel genelde çalışmaz; aynı LAN’da self-host veya tünel gerekir.

## Veritabanı

Migration: `supabase/migrations/014_machine_monitoring.sql`

- `machine_connections`: `adapter_type`, `base_url`, `api_key`, test zaman damgaları
- `machines`: telemetri sütunları (`printer_state`, `progress_percent`, `last_seen_at`, …)

## Yeni adaptör ekleme

1. `src/lib/printer-monitoring/<adapter>.ts` — HTTP istemcisi + `NormalizedTelemetry`.
2. `pullTelemetryForConnection` içinde `adapter_type` dalı.
3. UI select’e seçenek ekle.
4. Dokümantasyon ve (varsa) cron testi.

### Moonraker / Klipper (plan)

- `GET /printer/objects/query` — `print_stats`, `display_status`
- WebSocket opsiyonel; poll ile başlanabilir.

### Bambu LAN (plan)

- Yerel MQTT/LAN protokolü; genelde edge agent veya kullanıcı ağındaki küçük köprü servisi gerekir (doğrudan Vercel → LAN zor).

## Arızalar modülü (öneri)

`printer_state = error` veya `connection_status = disconnected` uzun süre kalınca otomatik **fault** kaydı açılabilir (`faults` tablosu). MVP’de yalnızca kart üzerinde hata metni gösterilir.

## Ortam değişkenleri

- `CRON_SECRET` — `/api/cron/machine-poll` için
- Mevcut Supabase anahtarları (cron admin client kullanır)

## Yerel cron testi

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/machine-poll
```
