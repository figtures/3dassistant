# PrintFlow Bridge — tasarım (2026-10-20)

## Amaç

Müşteri atölyede **tek kurulum** yapar; Bambu ve Creality yazıcıları LAN’dan okunur; telemetri PrintFlow bulutuna gider; ERP panelinden **her tarayıcıda** uzaktan izlenir.

## Tarayıcı bağımsızlığı

- **Yok:** Chrome/Firefox/Safari eklentisi, “bu tarayıcı için kur” adımları.
- **Var:** Masaüstü köprü (Windows/macOS/Linux), sistem servisi, `printflow://pair` derin bağlantı.

## Güvenilirlik / antivirüs

- Go, statik binary, açık kaynak bu repo.
- Resmi CI derlemesi + checksum; imzalı installer (Apple / Microsoft).
- LAN access code / Bambu kodu yalnızca yerel `config.json` (0600).

## Desteklenen köprü markaları

Bambu, Creality, Anycubic, Elegoo, Flashforge, Snapmaker — LAN profilleri `vendorlan` + Creality özel sürücü.

## Creality (adım 2)

- WebSocket `:9999` + HTTP yedek; `scripts/bridge-probe-creality.mjs` teşhis.

## Bambu (adım 3)

- MQTT TLS `:8883` — `internal/drivers/bambu/mqtt.go` (harici binary gerekmez).

## API

- `POST /api/bridge/pair` — `vendor`, isteğe bağlı `bridgeToken` (çoklu yazıcı, tek köprü).
- `GET /api/bridge/downloads` — platform installer URL’leri.

## Onay

Kullanıcı: Creality + çok platform + tek installer + tarayıcı bağımsız — bu belgeye göre uygulama devam eder.
