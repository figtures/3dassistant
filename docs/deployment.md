# Vercel deployment (çoklu servis)

**3D Assistant** (`3dassistant.com`) Vercel **Services** ile iki birim çalıştırır; tüm kullanıcı trafiği Next.js üzerindedir.

| Servis | Kök | Rol |
|--------|-----|-----|
| **app** | repo kökü (`nextjs`) | UI, `/api/*`, cron'lar, `/api/bridge/*` (Supabase auth + service role) |
| **printflow-bridge** | `apps/printflow-bridge/cloud` | Dahili: `/health`, `/ready`, `/version` — dışarıya rewrite ile açılmaz |

`vercel.json` içinde `app` → `printflow-bridge` **service binding**; runtime'da `PRINTFLOW_BRIDGE_SERVICE_URL` otomatik dolar. Dashboard'a elle URL yazmayın.

- **Genel sağlık:** `GET /api/health` — binding varsa dahili köprü `/health` ping'lenir; köprü yanıt vermezse `503` + `degraded`.
- **Yerel geliştirme:** `npm run dev` — binding yok; `/api/health` köprüyü `skipped` olarak raporlar.
- **Çoklu servis yerel:** `vercel dev` (Vercel CLI) — binding davranışına daha yakın test.
- **Masaüstü 3D Assistant Bridge ajanı:** Her zaman herkese açık site URL'sini kullanır (`NEXT_PUBLIC_SITE_URL=https://3dassistant.com` / panel origin), `PRINTFLOW_BRIDGE_SERVICE_URL` değil.

Cron tanımları yalnızca **app** servisindedir (`vercel.json` → `crons`). Bkz. [production-cron.md](./production-cron.md).
