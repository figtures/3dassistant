# Atölye köprüsü (LAN → bulut)

**PrintFlow Bridge** — Windows / macOS / Linux tek kurulum; tarayıcı eklentisi yok, **ortam değişkeni gerekmez**.

## Müşteri akışı (sıfır yapılandırma)

1. **Makineler → Atölye köprüsü** → OS installer indir (`.pkg` / `.exe` / `.deb`).
2. Panelde **Eşleştirme kodu oluştur** → **Köprüyü aç** (`printflow://pair?code=…&url=…`).
3. Köprü yerel ağı tarar, bulunan yazıcıları listeler → kullanıcı seçer (birden fazla seçilebilir).
4. Gerekirse **tek bir** yerel bilgi sorulur (Bambu erişim kodu, PrusaLink şifresi…); bu bilgi yalnızca atölye bilgisayarında kalır.
5. Köprü yazıcıyı bir kez okuyup doğrular, sonra buluta bağlar; servis arka planda telemetri + kamera gönderir.

IP adresi, seri numarası, port, `BAMBU_TLS_*` gibi ayarlar **sorulmaz**.

## Keşif yöntemleri

| Marka / yazılım | Keşif | Kimlik (seri) | Kullanıcıdan istenen |
|---|---|---|---|
| Bambu Lab | SSDP NOTIFY/M-SEARCH (UDP 2021 + 1990); yedek: TLS 8883 sertifika CN | `USN` / sertifika CN = seri | Erişim kodu (Bambu Studio / OrcaSlicer’da kayıtlıysa onaylı içe aktarma) |
| Creality (K1/K2/Creality OS) | mDNS meta sorgu → `_Creality-<ID>._udp`; WS 9999 doğrulama | mDNS servis adındaki cihaz ID’si | — |
| Elegoo (Centauri, SDCP v3 reçine) | UDP yayın `M99999` → port 3000 | `MainboardID` | — |
| Flashforge | UDP 225.0.0.9:19000 / 48899 yayın; TCP 8899 `~M115` | `SN:` | — |
| Snapmaker | UDP yayın `discover` → 20054 | ad/model (+ MAC) | — |
| Klipper (Moonraker) | mDNS `_moonraker._tcp`; HTTP 7125 `/printer/info` | ağ MAC’i (`/machine/system_info`) | Yalnızca Moonraker yetki istiyorsa API anahtarı |
| OctoPrint | mDNS `_octoprint._tcp`; `/plugin/appkeys/probe` | MAC (ARP) | OctoPrint arayüzünde “İzin ver” (Application Keys) |
| Prusa (PrusaLink) | mDNS `_prusa-link._tcp` / `_http._tcp`; `/api/version` Digest | `/api/v1/info` seri | PrusaLink şifresi |
| Anycubic | port taraması (WS 6000) | MAC (ARP) | — |
| UltiMaker, Formlabs | mDNS | — | Listede “desteklenmiyor” olarak görünür; telemetri sürücüsü yok |

**Yedek tarama:** yayınlarla desteklenen hiçbir yazıcı bulunamazsa (veya `--scan always`) köprü her yerel arayüzün /24 ağında yalnızca bilinen portları yoklar (8883, 9999, 3030, 8899, 7125, 80, 5000, 6000, 8080; 192 eşzamanlı, 450 ms zaman aşımı, en fazla 1024 adres) ve açık portlarda marka parmak izi çalıştırır. Gerçek ağda /24 tarama ~14 sn.

Aynı yazıcı birden çok yöntemle bulunursa (SSDP + TLS, mDNS + WebSocket…) **marka + seri → marka + MAC → marka + IP** sırasıyla tek kayda birleştirilir; güven puanı artar. Aynı IP’de hem marka sürücüsü hem Klipper/OctoPrint bulunursa (ör. root’lu K1) marka seçeneği önce listelenir.

## Kenar durumlar

| Durum | Köprü davranışı |
|---|---|
| Birden fazla ağ kartı / VPN / Docker | `docker*`, `br-*`, `veth*`, `utun*`, `tun/tap`, `wg*`, `tailscale*`, `vmnet*`, `vboxnet*`, link-local (169.254) ve genel IP’ler atlanır; geniş ağlar /24’e daraltılır |
| Güvenlik duvarı çoklu yayını engelliyor | Port taraması devreye girer; kullanıcıya “UDP 2021 / mDNS 5353 engelli olabilir” uyarısı |
| Bambu Studio / OrcaSlicer açık (UDP 2021 meşgul) | M-SEARCH yanıtları ve TLS probu ile devam; uyarı gösterilir |
| Misafir Wi-Fi / farklı alt ağ | Seçim ekranında `m` → IP elle girilir (veya `--host IP`) ve tek host yoklanır |
| DHCP ile IP değişti | `run` döngüsünde 3 ardışık hata → seri/MAC ile yeniden keşif (5 dk’da en fazla bir kez); config ve buluttaki `lan_host` güncellenir (`PATCH /api/bridge/bindings`) |
| Zaten eşleşmiş yazıcı | Listede “✓ eşleşmiş”; `a` (tümü) seçmez; yeniden eşleştirme yeni makine açmaz, mevcut bağlamayı günceller |
| Bir kodla birden çok yazıcı | İlk eşleştirme köprü jetonu üretir; aynı kod 15 dk içinde **aynı köprü** tarafından tekrar kullanılabilir |
| Bambu erişim kodu yanlış | “Bambu erişim kodu hatalı …” — kod pair API’ye gitmeden önce yazıcıda doğrulanır; 3 deneme |
| Bambu LAN Only / Developer Mode kapalı | 8883 reddedilirse “LAN Only modu (yeni firmware’de Developer Mode) kapalı olabilir”; SSDP `DevConnect: cloud` ise listede not |
| Bambu TLS | Sertifika ilk bağlantıda sabitlenir (SHA-256, TOFU) ve CN = seri kontrol edilir; değişirse bağlanılmaz (erişim kodu sızmaz). Eski `BAMBU_TLS_INSECURE=true` hâlâ geçerli |
| Hiç yazıcı yok / zaman aşımı | Türkçe kontrol listesi: aynı ağ, misafir Wi-Fi, LAN modu, macOS Yerel Ağ izni, IP’yi elle girme |
| Eşleştirme kodu süresi doldu | “Panelden yeni kod alın” |
| Etkileşimsiz (servis / installer / deep link) | Tek desteklenen, eşleşmemiş ve sır gerektirmeyen yazıcı varsa otomatik eşleşir; aksi halde liste yazdırılır, çıkış kodu **3** (`--select`/`--all` ile seçilebilir) |

## Komutlar

```bash
npm install
npm run bridge:discover                 # tablo
npm run bridge:discover -- --json       # tepsi/installer UI için JSON (aşağıdaki şema)
npm run bridge:discover -- --scan always --host 10.0.5.20
npm run bridge:pair -- --url https://app… --code 123456   # keşif + seçim
npm run bridge:pair -- --deep-link "printflow://pair?code=123456&url=https://app…"
npm run bridge:run
npm run bridge:support [-- --json] [--upload]
```

### Sorun giderme (destek)

Köprü veya yazıcı bağlantısı sorunlarında atölyede tanılama paketi üretin; `--upload` ile buluta gönderildiğinde `BDL-XXXXXXXX` kodu paneldeki **Sorun bildir** formuna otomatik bağlanır. Ayrıntılar: [docs/support.md](./support.md).

`bridge:pair` bayrakları: `--select ID[,ID]`, `--all`, `--yes` (etkileşimsiz), `--json`, `--access-code`, `--password`, `--api-key`, `--use-slicer-codes`, `--no-slicer-codes`, `--scan auto|always|never`, `--timeout MS`, `--name`.

**Geriye uyumluluk:** eski kullanım aynen çalışır — `--vendor --host --serial --access-code --lan-port` ve `PRINTFLOW_URL`, `PAIRING_CODE`, `PRINTER_HOST`, `PRINTER_SERIAL`, `BAMBU_*`, `PRINTER_CAMERA_URL`. `--host` + `--serial` verilirse keşif atlanır; yalnızca `--host` verilirse o IP yoklanıp marka/seri otomatik doldurulur.

Go ajanı aynı alt komutları sunar: `printflow-bridge discover [--json]`, `pair` (keşif + seçim), `open-url printflow://…`, `run`, `support [--json] [--upload]`.

### `discover --json` şeması (Node ve Go aynı)

```json
{
  "version": 1,
  "scannedAt": "2026-10-24T23:25:17.254Z",
  "durationMs": 6030,
  "interfaces": [{ "name": "en0", "address": "192.168.1.112", "cidr": "192.168.1.0/24" }],
  "methods": { "ssdp": { "count": 9, "errors": [] }, "mdns": { "count": 3, "errors": [] } },
  "warnings": [],
  "printers": [{
    "id": "bambu:20P6BJ651701805", "vendor": "bambu", "vendorLabel": "Bambu Lab",
    "supported": true, "host": "192.168.1.151", "serial": "20P6BJ651701805",
    "mac": "78:be:81:f2:74:f8", "model": "X2D", "name": "3DP-20P-805", "lanPort": null,
    "methods": ["ssdp"], "confidence": 0.95,
    "needsSecret": "bambu_access_code", "secretAvailable": false, "cloudAlternative": true,
    "paired": false, "machineId": null, "notes": ["Erişim kodu gerekli (8 karakter): …", "Kod girmeden: …"]
  }],
  "bambuCloud": { "tokenSource": null, "slicerSession": "missing", "codesFound": 0, "error": null }
}
```

`needsSecret`: `bambu_access_code` \| `prusalink_password` \| `octoprint_api_key` \| `moonraker_api_key` \| `null`. `cloudAlternative`: Bambu yazıcı bulut modunda (`DevConnect: cloud`); panelden Bambu hesabı bağlanabilir. `bambuCloud`: hesaptan kod alma denemesinin özeti (jeton/kod JSON’a yazılmaz). Sırlar JSON’a ve PrintFlow bulutuna asla yazılmaz; yalnızca yerel `config.json` (0600).

`bridge:pair` / `discover` Bambu bayrakları: `--use-slicer-codes`, `--no-slicer-codes`, `--use-slicer-token`, `--no-slicer-token`, `--bambu-token` (veya `BAMBU_CLOUD_TOKEN`), `--no-cloud-codes`, `--bambu-region global|cn`.

## Bambu Lab: erişim kodu (sorun giderme)

| Durum | Ne olur |
|---|---|
| Bambu Studio / OrcaSlicer’da yazıcı kayıtlı | `BambuStudio.conf` / `OrcaSlicer.conf` içinde `access_code` veya `user_access_code` haritası; köprü `secretAvailable: true` işaretler, eşleştirmede onay sorar (`--use-slicer-codes` ile sormadan). |
| Dilimleyicide Bambu hesabına giriş yapılmış | `BambuNetworkEngine.conf` (veya bazen ana `.conf`) içinde düz metin `access_token` / `token` — yeni sürümlerde dosya **şifreli** olabilir; köprü `slicerSession: encrypted` uyarısı verir. Onaylı `--use-slicer-token` veya `--bambu-token` ile `GET …/user/bind` çağrılır; `dev_access_code` yalnızca yerel config’e yazılır. |
| Hiç dilimleyici / oturum yok | `secretAvailable: false`; eşleştirmede 8 karakterlik kod istenir (X2D: ekran → Ayarlar → Ağ/WLAN → Access Code). |
| `cloudAlternative: true` | Yazıcı Bambu bulutuna bağlı; **Makineler → Yazıcıları bağla** ile hesap bağlanırsa telemetri buluttan gelir (köprü ve LAN kodu gerekmez; planınızda canlı takip açık olmalı). |
| LAN MQTT reddedilirse | SSDP `DevConnect: cloud` ise yerel okuma için erişim kodu + uygun ağ modu gerekir; yeni firmware’de **LAN Only** veya **Developer Mode** gerekebilir (P1/X1 ile benzer). Kod doğru olsa bile bulut modunda bağlantı reddedilebilir. |

**Gizlilik / ToS:** Bambu Studio oturum jetonunu okumak kullanıcı onayına bağlıdır; jeton yalnızca bu bilgisayardan Bambu API’sine gider, PrintFlow sunucusuna veya `discover --json` çıktısına yazılmaz. Bambu’nun kullanım şartları üçüncü taraf araçlar için kısıt içerebilir; müşteriye opt-in metni köprü sorar.

Model kodu `N6` (SSDP `DevModel`) → **Bambu Lab X2D** olarak gösterilir.

## Gizlilik

- Bambu erişim kodu, PrusaLink şifresi, OctoPrint/Moonraker API anahtarı: yalnızca `config.json` (izin 0600).
- Bambu Studio / OrcaSlicer ayarlarından kod içe aktarma **onaylıdır** (`[E/h]` sorusu; `--no-slicer-codes` ile hiç okunmaz).
- Bambu bulut jetonu (`--use-slicer-token` / `--bambu-token`): **onaylıdır**; yalnızca yerelde Bambu `bind` API’sine gider; PrintFlow’a gönderilmez.
- Buluta giden (köprü telemetrisi): marka, seri/MAC tabanlı kimlik, LAN IP, etiket/model — erişim kodu ve Bambu JWT **asla**.

## Üretim installer (CI, isteğe bağlı Go)

1. `bridge-v*` etiketi → Actions → `.pkg` / `.exe` / `.deb`
2. Creality test: `docs/bridge-creality-lan-test.md`
3. Go ajanı: `apps/printflow-bridge` (Node ile aynı API ve keşif şeması)

## API

- `GET /api/bridge/downloads`
- `POST /api/bridge/pair` — `printer.vendor`: `bambu` \| `creality` \| `anycubic` \| `elegoo` \| `flashforge` \| `snapmaker` \| `klipper` \| `octoprint` \| `prusalink`; isteğe bağlı `printer.model`, `bridgeToken` (aynı köprüye ek yazıcı)
- `PATCH /api/bridge/bindings` — köprü bearer; `{ machineId, host }` (DHCP sonrası IP güncelleme)
- `POST /api/bridge/telemetry`
- `POST /api/bridge/camera` — köprü bearer; JSON `{ machineId, imageBase64, contentType? }` (LAN JPEG push)
- `GET /api/machines/[id]/camera` — oturumlu kullanıcı; son kare (`image/jpeg`)

## Uzaktan kamera

Tarayıcı yazıcı LAN IP’sine erişemez. **Köprü** yerel vendor snapshot URL’lerinden kare çeker (~2,5 sn baskıda, 30 sn boşta) ve buluta yükler. Klipper’da Moonraker `/server/webcams/list` kullanılır. ERP’de makine detayı ve filo önizlemesi `/api/machines/…/camera` kullanır.

İsteğe bağlı: `PRINTER_CAMERA_URL` (Node köprü).

Migration: `025_bridge_vendors_discovery.sql` (+ `024_machine_camera_frames.sql`, `021_bridge_vendors_extended.sql`).
