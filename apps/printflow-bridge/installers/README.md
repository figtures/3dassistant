# PrintFlow Bridge — kurulum paketleri

Tek masaüstü uygulaması; **Chrome / Firefox / Edge için ayrı eklenti yok**. ERP’ye hangi tarayıcıdan girerseniz girin, köprü arka planda çalışır.

## Güven

- Kaynak: `apps/printflow-bridge` (bu repo, açık derleme).
- CI: GitHub Actions `bridge-release.yml` — etiket `bridge-v*` (manifest + çoklu platform artefaktı). İmzalama: `docs/bridge-cdn-release.md`.
- **macOS:** Apple Developer ile `codesign` + `notarytool` (pkg).
- **Windows:** Authenticode (`.exe` / MSI); SmartScreen için EV sertifika önerilir.
- **Linux:** `.deb` + SHA256 checksum; isteğe bağlı GPG imza.
- Antivirüs: Tek statik Go binary; Node/Electron yok → yanlış pozitif riski düşük.

## Yerel derleme (adım 1)

```bash
cd apps/printflow-bridge
go mod tidy
chmod +x installers/build-all.sh installers/macos/package.sh installers/linux/package-deb.sh
./installers/build-all.sh
```

Üretir: ham binary + (araçlar yüklüyse) `.pkg`, `.deb`, Windows `setup.exe`.

İmza: `SIGN_IDENTITY` (macOS), `SIGNTOOL_PATH` + `WINDOWS_SIGN_CERT` (Windows).

## URL şeması

Kurulum `printflow://pair?code=XXXXXX&url=https://...` kaydeder. Panelde “Köprüyü aç” bu bağlantıyı tetikler.

## Servis

- **macOS:** `launchd` kullanıcı agent (`com.printflow.bridge`).
- **Windows:** Görev Zamanlayıcı veya Windows Service (kurulum betiği).
- **Linux:** `systemd` user unit `printflow-bridge.service`.
