# PrintFlow Bridge (Node)

**Go gerekmez** — repo kökünde `npm install` yeterli. Ortam değişkeni gerekmez.

```bash
npm run bridge:discover                         # yerel ağdaki yazıcılar
npm run bridge:pair -- --url https://... --code 123456   # listeden seç, eşleştir
npm run bridge:run
```

Eski kullanım da çalışır: `--vendor bambu --host IP --serial SERI --access-code KOD` (keşif atlanır).

Keşif modülleri: `discovery/` (SSDP, mDNS, SDCP, Flashforge/Snapmaker UDP, port taraması, birleştirme). Testler: `npm run test:bridge-discovery`.

Config: `tools/printflow-bridge/config.local.json` (geliştirme) veya kullanıcı dizini (`npm run bridge:config`).

Ayrıntılar ve kenar durumlar: `docs/workshop-bridge.md`.
