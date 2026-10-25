# PrintFlow Bridge CDN

Varsayılan public URL (`.env.local.example`):

```env
NEXT_PUBLIC_PRINTFLOW_BRIDGE_BASE_URL=https://cdn.3dyanimda.com/bridge/releases
NEXT_PUBLIC_PRINTFLOW_BRIDGE_VERSION=0.1.0
```

Panel `GET /api/bridge/downloads` bu kökten `v{version}/{artifact}` üretir.

## Yayın

Ayrıntılı runbook: [docs/bridge-cdn-release.md](../../docs/bridge-cdn-release.md)

1. Go CI (`bridge-v*` → `.github/workflows/bridge-release.yml`) veya `apps/printflow-bridge/installers/build-all.sh` → `dist/`
2. `npm run cdn:bridge:manifest` (SHA256)
3. `BRIDGE_CDN_DEST=...` veya `BRIDGE_S3_BUCKET=...` ile `npm run cdn:bridge:publish`
4. CDN’de `latest.json`, `manifest.json` ve `v0.1.0/*` erişilebilir olsun

Geliştirme köprüsü: `npm run bridge:run` (installer gerekmez).
