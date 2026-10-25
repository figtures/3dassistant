# PrintFlow Bridge CDN

Varsayılan public URL (`.env.local.example`):

```env
NEXT_PUBLIC_PRINTFLOW_BRIDGE_BASE_URL=https://cdn.3dyanimda.com/bridge/releases
NEXT_PUBLIC_PRINTFLOW_BRIDGE_VERSION=0.1.0
```

Panel `GET /api/bridge/downloads` bu kökten `v{version}/{artifact}` üretir.

## Yayın

1. Go CI veya `apps/printflow-bridge/installers/build-all.sh` → `dist/`
2. `BRIDGE_CDN_DEST=... node scripts/cdn/publish-bridge.mjs`
3. CDN’de `latest.json` ve `v0.1.0/*` erişilebilir olsun

Geliştirme köprüsü: `npm run bridge:run` (installer gerekmez).
