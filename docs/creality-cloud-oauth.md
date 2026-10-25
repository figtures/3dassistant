# Creality Cloud

Creality panelde **açık**. Akış: Makineler → Yazıcıları bağla → Creality hesabımla bağlan
(e-posta + şifre). Şifre kaydedilmez; `access_token` + kullanıcı kimliği şifreli saklanır.

Ücretsiz / Starter planda bu özellik kilitlidir (Atölye veya Filament Farm gerekir).

Resmi üçüncü taraf OAuth client’ı yok. Partner alınca env’e yazılır, panel OAuth’a döner.
Başvuru adımları: [partner-printer-oauth.md](./partner-printer-oauth.md).

## Cihaz listesi

Sunucu şu kaynakları birleştirir (model elemez; katalog dışı cihaz da eklenir):

- Cihaz dizin uçları (`userDeviceList`, IoT / P2P list)
- Dilimleme `local_device` profili
- `myPrints` geçmişi

Telemetri: IoT RPC anlık görüntü + aktif baskı kaydı.

Desteklenen (tanınan) modeller: K1 / K1C / K1 Max / K1 SE, K2 / K2 Plus, Ender-3 V3 ailesi,
S1 / V2, Ender-5 S1 / Max, CR-10 SE, CR-M4, Sermoon D3, Hi. Cloud’daki diğer FDM’ler de gelir.
