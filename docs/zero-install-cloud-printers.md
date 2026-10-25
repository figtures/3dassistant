# Sıfır kurulum — bulut yazıcı entegrasyonu

Müşteri tarafında köprü, eklenti veya ayar yok. PrintFlow, müşterinin verdiği yetkiyle üretici
bulutuna bağlanır. İşletme: [saas.md](./saas.md). Partner başvurusu: [partner-printer-oauth.md](./partner-printer-oauth.md).

## Müşteri akışı

1. Atölye veya Filament Farm planına abone olur (`/billing`). Ücretsizde bağlama kilitlidir.
2. **Makineler → Yazıcıları bağla → Bambu Lab veya Creality**
3. Hesabıyla giriş yapar; yazıcılar listelenir (kota kadar seçili) → **Tümünü ekle**
4. Atölyede tek iş: yazıcının ekranından Wi‑Fi ve üretici uygulaması.

| Üretici | Durum |
|---------|-------|
| Bambu Lab | Hesap girişi; partner OAuth varsa OAuth |
| Creality | Hesap girişi; partner OAuth varsa OAuth |
| Prusa, OctoPrint (LAN) | SaaS ürününde yok |

## API

Bambu: `GET /v1/iot-service/api/user/bind`, `GET /v1/user-service/my/tasks`.
Creality: cihaz dizin uçları + `local_device` + `myPrints`; telemetri IoT RPC.

401/403 → `CloudAuthError` → (OAuth ise) refresh → olmazsa "yeniden bağla".

## Geliştirme

```env
PRINTER_CLOUD_MOCK=true   # yalnızca NODE_ENV=development
```

```bash
npm run billing:dev-grant -- farm
npm run test:bambu-cloud
npm run test:creality-cloud
npm run test:device-catalog
npm run test:cloud-sync
```
