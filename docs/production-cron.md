# Production cron ve e-posta

3D Asisstant, Vercel Cron ile saatlik geciken iş hatırlatmaları gönderir (`vercel.json`: `0 * * * *` → `/api/cron/overdue-reminders`).

## Vercel ortam değişkenleri

| Değişken | Açıklama |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (uygulama) |
| `SUPABASE_SERVICE_ROLE_KEY` | Cron sorguları için service role (RLS bypass) |
| `CRON_SECRET` | Cron isteğini doğrulayan Bearer token |
| `RESEND_API_KEY` | Resend API anahtarı |
| `EMAIL_FROM` | Gönderen adresi (ör. `3D Asisstant <noreply@3dasisstant.com>`) |
| `NEXT_PUBLIC_SITE_URL` | Canlı site URL (ör. `https://3dasisstant.com`; preview’da Vercel host) |

`RESEND_API_KEY` yoksa cron çalışır ancak e-postalar gönderilmez; logda `E-posta atlandı (Resend yok)` görünür ve `last_overdue_reminder_at` güncellenmez.

## Manuel test (curl)

Production (`NEXT_PUBLIC_SITE_URL`) veya `npm run dev` ile:

```bash
# Canlı: https://3dasisstant.com/api/cron/overdue-reminders
# Preview örneği: https://your-app.vercel.app/api/cron/overdue-reminders
curl -sS -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://3dasisstant.com/api/cron/overdue-reminders"
```

Yerel:

```bash
curl -sS -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "http://localhost:3000/api/cron/overdue-reminders"
```

Başarılı yanıt örneği:

```json
{ "ok": true, "checked": 12, "sent": 1, "skipped": 11, "errors": [] }
```

Yanlış veya eksik `CRON_SECRET` → `401 Unauthorized`.

## Birim testleri

```bash
npm run test:reminders
```
