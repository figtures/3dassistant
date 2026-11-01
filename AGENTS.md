<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cloud Agent

Yerel geliştirme yığını Docker üzerinde Supabase ve `npm run dev` ile ayağa kalkar. Node 22 ve Go 1.22 temel imajda vardır.

- Bağımlılıklar: `npm ci`, ardından `go -C apps/printflow-bridge mod download`.
- Docker daemon `fuse-overlayfs` ile çalışır. `supabase` CLI `/usr/local/bin/supabase` altındadır. `psql` için `postgresql-client` kuruludur.
- Açılışta API `http://127.0.0.1:54321/auth/v1/health` yanıt vermezse `supabase start` çalıştırılır. `.env.local` gitignore'dadır ve `supabase status -o env` çıktısından üretilir.
- Demo kullanıcı yoksa `npm run seed:dev` makine limitinde durabilir. Ardından `npm run billing:dev-grant -- farm` ve tekrar `npm run seed:dev`.
- Uygulamayı tarayıcıda `http://localhost:3000` üzerinden açın. `127.0.0.1` Next.js geliştirme kaynaklarını engelleyebilir.
- `npx tsc --noEmit` şu an `PageProps` bulunamadığı için başarısız. Bu, ortam kurulumundan bağımsız mevcut bir tip hatasıdır.
