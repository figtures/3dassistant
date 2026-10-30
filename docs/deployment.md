# Vercel deployment (çoklu servis)

**3D Asisstant** (`3dasisstant.com`) Vercel **Services** ile iki birim çalıştırır; tüm kullanıcı trafiği Next.js üzerindedir.

| Servis | Kök | Rol |
|--------|-----|-----|
| **app** | repo kökü (`nextjs`) | UI, `/api/*`, cron'lar, `/api/bridge/*` (Supabase auth + service role) |
| **printflow-bridge** | `apps/printflow-bridge/cloud` | Dahili: `/health`, `/ready`, `/version` — dışarıya rewrite ile açılmaz |

`vercel.json` içinde `app` → `printflow-bridge` **service binding**; runtime'da `PRINTFLOW_BRIDGE_SERVICE_URL` otomatik dolar. Dashboard'a elle URL yazmayın.

- **Genel sağlık:** `GET /api/health` — binding varsa dahili köprü `/health` ping'lenir; köprü yanıt vermezse `503` + `degraded`.
- **Yerel geliştirme:** `npm run dev` — binding yok; `/api/health` köprüyü `skipped` olarak raporlar.
- **Çoklu servis yerel:** `vercel dev` (Vercel CLI) — binding davranışına daha yakın test.
- **Masaüstü 3D Asisstant Bridge ajanı:** Her zaman herkese açık site URL'sini kullanır (`NEXT_PUBLIC_SITE_URL=https://3dasisstant.com` / panel origin), `PRINTFLOW_BRIDGE_SERVICE_URL` değil.

Cron tanımları yalnızca **app** servisindedir (`vercel.json` → `crons`). Bkz. [production-cron.md](./production-cron.md).

## Özel alan adları (`3dasisstant.com`)

Vercel projesine (ör. `figtures1/3dassistant`) apex ve `www` ekleyin:

```bash
vercel domains add 3dasisstant.com --scope figtures1
vercel domains add www.3dasisstant.com --scope figtures1
```

Vercel panelinde veya `vercel domains inspect 3dasisstant.com` çıktısındaki kayıtları DNS sağlayıcıda oluşturun (genelde):

| Host | Tür | Değer |
|------|-----|--------|
| `@` (apex) | **A** | `76.76.21.21` |
| `www` | **CNAME** | `cname.vercel-dns.com` |

Kayıtlar yayıldıktan sonra Vercel sertifikayı otomatik verir. Production ortam değişkenleri:

- `NEXT_PUBLIC_SITE_URL=https://3dasisstant.com`
- `NEXT_PUBLIC_PRINTFLOW_BRIDGE_BASE_URL=https://cdn.3dasisstant.com/bridge/releases`

Köprü CDN DNS: bkz. [bridge-cdn-release.md](./bridge-cdn-release.md) §7 (`cdn.3dasisstant.com`).
