# Partner client nasıl alınır — Bambu Lab ve Creality

Müşteriler env veya API anahtarı görmez. PrintFlow’un **tek bir** üretici uygulaması olur;
her müşteri kendi hesabıyla yetki verir, jetonlar kiracıya özel ve şifreli saklanır.

Partner onayı gelene kadar panel **hesap girişi** kullanır (şifre kaydedilmez, yalnızca jeton).
Onay gelince aynı panel otomatik OAuth’a geçer (`BAMBU_OAUTH_*` / `CREALITY_OAUTH_*`).

## Bambu Lab

Bambu’da self-servis “OAuth uygulaması oluştur” ekranı yok. Resmi yol iş ortaklığı / SDK
değerlendirmesi.

1. Şirket adına [Bambu Lab hesabı](https://bambulab.com) açın.
2. Üçüncü taraf entegrasyon özeti: [wiki](https://wiki.bambulab.com/en/software/third-party-integration).
3. Ortaklık / SDK başvurusu: [Trust Center → Collaboration](https://bambulab.com/en-us/trust-center/collaboration)
   (sayfadaki Collaboration formunu doldurun).
4. İş / teknik takip: `devpartner@bambulab.com`.
5. Başvuruda yazın:
   - Ürün: PrintFlow — atölyeler için çok kiracılı ERP
   - Kullanım: müşteri Bambu hesabını yetkilendirir; yazıcı listesi + baskı durumu (okuma)
   - Kontrol / firmware / canlı kamera **istemiyoruz** (Bambu Connect şartı yok)
   - Redirect URI: `https://<alan-adınız>/api/integrations/printers/oauth/bambu/callback`
   - PKCE + refresh token
6. Verilen `client_id` / `secret` / authorize-token URL / scope’u Vercel env’e yazın.

**Fleet Hub / Local Server** bu ürün için doğru kapı değil: LAN’da donanım veya SDK ister,
müşterinin kurulum yapmamasını bozar. SaaS için istenen şey **bulut hesap yetkisi (OAuth)**.

Cihazınızı bugün denemek için partner beklemeyin: Atölye planında **Bambu Lab hesabımla bağlan**
→ Bambu e-posta/şifre (gerekirse 6 haneli e-posta kodu).

## Creality

Creality Cloud’un üçüncü taraflara açık self-servis OAuth kayıt paneli yok.
`id.creality.com` ve `crealitycloud.com/oauth` kendi mağaza / uygulama hesapları içindir;
PrintFlow oraya kendi client ID’sini yazamaz.

1. Marka / iş ortaklığı: `brand@creality.com` ([iletişim listesi](https://forum.creality.com/t/creality-contact-list/30843)).
2. Creality Cloud: [crealitycloud.com](https://www.crealitycloud.com) yardım / iş birliği
   (Designer Partnership ayrı bir program; siz **API / hesap yetkisi** isteyin).
3. Destek: `cs@creality.com` — “Cloud Open Platform / third-party OAuth client” diye yönlendirin.
4. İstenecekler:
   - PrintFlow çok kiracılı atölye ERP’si
   - Müşteri Creality Cloud hesabını yetkilendirir
   - Cihaz listesi + baskı durumu (okuma)
   - Redirect: `https://<alan-adınız>/api/integrations/printers/oauth/creality/callback`
5. Client gelince `CREALITY_OAUTH_CLIENT_ID`, `AUTHORIZE_URL`, `TOKEN_URL` (ve secret/scope).

Onay gelene kadar panel Creality Cloud **hesap girişi** kullanır (`loginV2` + `cxy` uçları;
Creality Print ile aynı aile). Şifre saklanmaz.

## Ortak kontrol listesi

- [ ] Şirket unvanı, site, kısa ürün videosu / ekran görüntüsü
- [ ] Yalnızca okuma (liste + durum) olduğunu net yazın
- [ ] Redirect URI production + isteğe bağlı staging
- [ ] Verilen client’ı env’e koyun; müşteri tarafında ekstra ayar yok
- [ ] Rate limit’i cron kotalarına işleyin (`docs/saas.md`)
