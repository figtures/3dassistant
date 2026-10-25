# Creality LAN uçtan uca test (adım 2)

## 1. Teşhis

Atölye PC (yazıcı ile aynı Wi‑Fi):

```bash
CREALITY_HOST=192.168.x.x CREALITY_PORT=9999 node scripts/bridge-probe-creality.mjs
```

`websocket` veya `http` altında JSON görmelisiniz. Boşsa: yazıcıda uzaktan/LAN erişim, firewall, IP.

## 2. Eşleştirme

Panel → **Atölye köprüsü** → kod → PrintFlow Bridge:

```bash
printflow-bridge pair --url https://... --code 123456 --vendor creality \
  --host 192.168.x.x --serial DEVICE_ID --lan-port 9999
printflow-bridge run
```

## 3. ERP doğrulama

Makineler kartında **Köprü** rozeti, canlı durum / ilerleme.

## Payload ince ayarı

Farklı Creality OS sürümleri farklı alan adı kullanabilir. `bridge-probe-creality.mjs` çıktısını kaydedin; gerekirse `apps/printflow-bridge/internal/drivers/creality/creality.go` içinde alan eşlemesi güncellenir.
