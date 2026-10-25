# Atölye köprüsü CDN yayını (imzalı installer)

Ürün markası **3dassistant**; köprü binary ve dosya adları şimdilik `printflow-bridge` kalır. Panel indirme linkleri `src/lib/bridge/downloads.ts` ve `GET /api/bridge/downloads` üzerinden üretilir.

## URL yapısı

| Ortam değişkeni | Açıklama |
|---|---|
| `NEXT_PUBLIC_PRINTFLOW_BRIDGE_BASE_URL` | CDN kökü (sonunda `/` olmasa da olur). Varsayılan: `https://cdn.3dyanimda.com/bridge/releases` |
| `NEXT_PUBLIC_PRINTFLOW_BRIDGE_VERSION` | Yayın sürümü, örn. `0.1.0` |

Her platform dosyası:

```text
{BASE}/v{VERSION}/printflow-bridge_{VERSION}_{platform}.{pkg|exe|deb}
```

Örnek (Apple Silicon):

```text
https://cdn.3dyanimda.com/bridge/releases/v0.1.0/printflow-bridge_0.1.0_darwin_arm64.pkg
```

Ek dosyalar (yayın betiği yazar):

- `v{VERSION}/manifest.json` — sürüm manifesti + SHA256
- `bridge/releases/manifest.json` — son yüklenen sürümün manifesti
- `bridge/releases/latest.json` — `latest: "v0.1.0"` + artefakt listesi

**Not:** Secrets yapılandırılmadan yüklenen `.pkg` / `.exe` dosyaları **imzasız** olabilir; macOS Gatekeeper ve Windows SmartScreen uyarı verir. Üretimde imzalama zorunludur.

---

## 1. Derleme

### Yerel (tüm platformlar — macOS’ta en kolay)

```bash
cd apps/printflow-bridge
export PRINTFLOW_BRIDGE_VERSION=0.1.0   # sürümünüz
chmod +x installers/build-all.sh installers/macos/package.sh installers/linux/package-deb.sh
./installers/build-all.sh
```

`dist/` altında ham binary’ler + (araçlar varsa) `.pkg`, `.deb`, Windows `setup.exe`.

### CI (GitHub)

Etiket:

```bash
git tag bridge-v0.1.0
git push origin bridge-v0.1.0
```

Workflow: `.github/workflows/bridge-release.yml` (önerilen). Eski `printflow-bridge-release.yml` tek Ubuntu runner kullanır ve etiket adını sürüm olarak yanlış geçirebilir; yeni workflow’u kullanın.

CI çıktısı: Actions artefaktı `printflow-bridge-release-{version}` — CDN’e yüklemeden önce imzalama adımlarını (özellikle macOS) yerelde veya secrets ile tamamlayın.

---

## 2. macOS: codesign + notarize

Gereksinimler: **Apple Developer Program**, **Developer ID Application** sertifikası (Keychain’de), App Store Connect API anahtarı (`notarytool`).

### 2.1 Paketi imzalı yeniden üretmek (önerilen)

Mevcut imzasız `.pkg` yerine binary’den tekrar paketlemek tutarlıdır:

```bash
cd apps/printflow-bridge
export PRINTFLOW_BRIDGE_VERSION=0.1.0
export SIGN_IDENTITY="Developer ID Application: Şirket Adı (TEAMID)"

./installers/macos/package.sh arm64
# Intel gerekiyorsa: ./installers/macos/package.sh amd64
```

`installers/macos/package.sh` binary’yi `codesign --options runtime` ile imzalar, `productsign` ile `.pkg` imzalar.

### 2.2 Notarize (mevcut `.pkg` — örn. `dist/printflow-bridge_0.1.0_darwin_arm64.pkg`)

Önce paketin **Developer ID** ile imzalı olduğundan emin olun (`pkgutil --check-signature dist/....pkg`). İmzasızsa 2.1 adımını uygulayın.

App Store Connect → Keys → **App Store Connect API** anahtarı oluşturun (Issuer ID, Key ID, `.p8` dosyası). Anahtarları repoya **koymayın**.

```bash
# Bir kez: notarytool kimlik bilgisi (Keychain profili)
xcrun notarytool store-credentials "3dassistant-notary" \
  --apple-id "you@company.com" \
  --team-id "TEAMID" \
  --key ~/Downloads/AuthKey_XXXXXXXXXX.p8 \
  --key-id "KEYID" \
  --issuer "ISSUER-UUID"

PKG="apps/printflow-bridge/dist/printflow-bridge_0.1.0_darwin_arm64.pkg"

xcrun notarytool submit "$PKG" --keychain-profile "3dassistant-notary" --wait
xcrun stapler staple "$PKG"
xcrun stapler validate "$PKG"
```

Başarılı notarize sonrası kullanıcılar indirdiğinde Gatekeeper “doğrulanmış geliştirici” görmelidir.

### CI secrets (isteğe bağlı)

| Secret | Açıklama |
|---|---|
| `APPLE_SIGN_IDENTITY` | `Developer ID Application: …` tam adı |
| `APPLE_ID` | Apple ID e-posta |
| `APPLE_TEAM_ID` | 10 karakter Team ID |
| `APPLE_NOTARY_KEY_ID` | API Key ID |
| `APPLE_NOTARY_ISSUER_ID` | Issuer UUID |
| `APPLE_NOTARY_KEY_P8` | `.p8` içeriği (tek satır veya PEM) |

`bridge-release.yml` bu secret’lar doluysa notarize çalıştırır; boşsa yalnızca imzasız veya yerel `SIGN_IDENTITY` ile codesign kalır.

---

## 3. Windows: Authenticode

NSIS çıktısı: `printflow-bridge_{VERSION}_windows_amd64-setup.exe`.

Yerel (`installers/windows/package.ps1`):

```powershell
$env:PRINTFLOW_BRIDGE_VERSION = "0.1.0"
$env:SIGNTOOL_PATH = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe"
$env:WINDOWS_SIGN_CERT = "C:\certs\codesign.pfx"   # veya EV USB token — signtool /a
.\installers\windows\package.ps1
```

Alternatif (Linux/macOS CI sonrası): [osslsigncode](https://github.com/mtrojnar/osslsigncode) + PFX (yine repoda değil).

SmartScreen itibarı için EV sertifika önerilir; standart OV yine de Authenticode sağlar.

---

## 4. Linux (isteğe bağlı)

Varsayılan: `.deb` + manifest içinde **SHA256**. GPG ile dağıtım imzası:

```bash
gpg --armor --detach-sign apps/printflow-bridge/dist/printflow-bridge_0.1.0_linux_amd64.deb
# dist/ içine .deb.asc koyup publish ile birlikte yükleyin
```

Panel şu an `.asc` linki üretmez; gelişmiş kullanıcılar manifest checksum ile doğrular.

---

## 5. Manifest ve CDN yükleme

```bash
export NEXT_PUBLIC_PRINTFLOW_BRIDGE_VERSION=0.1.0

# dist/ içine manifest.json (SHA256)
npm run cdn:bridge:manifest

# Yerel CDN kökü (rsync/Nginx)
BRIDGE_CDN_DEST=/var/www/cdn/bridge/releases npm run cdn:bridge:publish

# veya S3 uyumlu
BRIDGE_S3_BUCKET=cdn-3dyanimda \
BRIDGE_S3_PREFIX=bridge/releases \
npm run cdn:bridge:publish

# Yükleme sonrası public HEAD doğrulama
BRIDGE_CDN_PUBLIC_BASE_URL=https://cdn.3dyanimda.com/bridge/releases \
NEXT_PUBLIC_PRINTFLOW_BRIDGE_VERSION=0.1.0 \
npm run cdn:bridge:publish
```

`publish-bridge.mjs` her artefakt için SHA256 hesaplar, `manifest.json` / `latest.json` yazır, S3 veya yerel kopyadan sonra (base URL verilmişse) **HEAD** ile erişilebilirliği kontrol eder.

---

## 6. Vercel / panel

Production ve Preview ortamlarında:

```env
NEXT_PUBLIC_PRINTFLOW_BRIDGE_BASE_URL=https://cdn.3dyanimda.com/bridge/releases
NEXT_PUBLIC_PRINTFLOW_BRIDGE_VERSION=0.1.0
```

Deploy sonrası panel **Makineler → Atölye köprüsü** indirme URL’leri bu değişkenlerle oluşur. `bridgeInstallersPublished()` eski placeholder URL’yi (`printflow/printflow-bridge`) filtreler.

CDN’de dosya yoksa kullanıcı 404 görür; sürümü Vercel’de CDN’deki `v*` klasörüyle eşleştirin.

---

## 7. DNS: `cdn.3dyanimda.com`

1. DNS sağlayıcıda **CNAME** veya **A** kaydı: `cdn` → barındırma (S3/CloudFront, Nginx VPS, R2 + custom domain, vb.).
2. TLS sertifikası (Let’s Encrypt veya CDN sağlayıcı otomatik).
3. Statik dosya kökü `bridge/releases/` altında `v0.1.0/` ve `latest.json` sunulmalı.

### Geliştirme Mac’te DNS hatası (sık görülen)

Belirti: `nslookup cdn.3dyanimda.com` başarısız, `Could not resolve host`, veya yalnızca şirket VPN kapalıyken çalışmıyor.

Kontrol listesi:

```bash
# Sistem çözümleyici
scutil --dns | head -40
dig cdn.3dyanimda.com +short
dig @1.1.1.1 cdn.3dyanimda.com +short

# macOS önbellek (dikkatli kullanın)
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
```

- **Split DNS / VPN:** Kurumsal DNS kaydı yoksa Mac yanlış sunucuya soruyor olabilir; `dig @1.1.1.1` çalışıp varsayılan çalışmıyorsa DNS sunucusunu düzeltin veya `/etc/hosts` ile geçici test (üretimde hosts kullanmayın).
- **Kayıt henüz yayılmadı:** TTL sonrası tekrar deneyin.
- **Yerel test:** CDN hazır değilken `BRIDGE_CDN_DEST` ile yerel klasör + `next dev` için `.env.local` içinde geçici `NEXT_PUBLIC_PRINTFLOW_BRIDGE_BASE_URL=http://localhost:8787/bridge/releases` (statik sunucu) kullanın.

HEAD doğrulama başarısızsa publish betiği çıkış kodu 1 verir — önce `curl -I` ile URL’yi tarayıcı dışında test edin.

---

## 8. Güvenlik

- **Private key, PFX, `.p8`, API secret’lar asla repoya commit edilmez.**
- GitHub Actions secret’ları yalnızca org/repo ayarlarında.
- Manifest SHA256, kullanıcıların indirdiği dosyayı doğrulamasına yardım eder; imza yerine geçmez.
- CDN bucket’ı **public read** yalnızca `bridge/releases/` prefix’i için açın; yazma IAM ile kısıtlı olsun.

---

## 9. İlk imzalı macOS `.pkg` kontrol listesi

Mevcut artefakt: `apps/printflow-bridge/dist/printflow-bridge_0.1.0_darwin_arm64.pkg` (sürümünüze göre yolu güncelleyin).

- [ ] Apple Developer ID Application sertifikası Keychain’de
- [ ] `PRINTFLOW_BRIDGE_VERSION` ve `SIGN_IDENTITY` export
- [ ] Gerekirse `./installers/macos/package.sh arm64` ile imzalı `.pkg` yeniden üret
- [ ] `pkgutil --check-signature` OK
- [ ] `notarytool store-credentials` (bir kez)
- [ ] `notarytool submit` + `stapler staple` + `stapler validate`
- [ ] `npm run cdn:bridge:manifest`
- [ ] `BRIDGE_S3_*` veya `BRIDGE_CDN_DEST` ile `npm run cdn:bridge:publish`
- [ ] `BRIDGE_CDN_PUBLIC_BASE_URL` ile HEAD doğrulama geçti
- [ ] Vercel’de `NEXT_PUBLIC_PRINTFLOW_BRIDGE_VERSION` güncel
- [ ] Panelden indirme linki tarayıcıda 200 ve doğru dosya boyutu

---

## 10. Hızlı komut özeti (ilk imzalı arm64 yayın)

```bash
cd /path/to/3d-management-system
export PRINTFLOW_BRIDGE_VERSION=0.1.0
export NEXT_PUBLIC_PRINTFLOW_BRIDGE_VERSION=0.1.0
export SIGN_IDENTITY="Developer ID Application: YOUR NAME (TEAMID)"

cd apps/printflow-bridge
./installers/macos/package.sh arm64

PKG="dist/printflow-bridge_${PRINTFLOW_BRIDGE_VERSION}_darwin_arm64.pkg"
xcrun notarytool submit "$PKG" --keychain-profile "3dassistant-notary" --wait
xcrun stapler staple "$PKG"

cd ../..
npm run cdn:bridge:publish
```

S3 kullanıyorsanız `BRIDGE_S3_BUCKET` ve `BRIDGE_S3_PREFIX` ekleyin; public doğrulama için `BRIDGE_CDN_PUBLIC_BASE_URL=https://cdn.3dyanimda.com/bridge/releases`.
