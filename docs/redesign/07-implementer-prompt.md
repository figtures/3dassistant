# 07 — Uygulayıcı Prompt Şablonu ve İnceleme Kontrol Listesi

> Bu dosya, backlog biletlerini **Composer 2.5 fast** (veya herhangi bir agent) ile Opus kalitesinde uygulatmak için tasarlandı. Bir bileti başlatırken §1'deki şablonu kopyalayın, `<…>` alanlarını doldurun ve agent'a verin. İş bitince §5'teki kontrol listesiyle (tercihen ayrı bir agent oturumunda) inceleyin.

## 1. IMPLEMENTER PROMPT TEMPLATE

```text
Sen PrintFlow (3D baskı atölyeleri için çok kiracılı Next.js 16 + Supabase SaaS) yeniden tasarım projesinde çalışan kıdemli bir frontend/fullstack mühendisisin.
Çalışma dizini: /Users/busraaktas/Projects/3d-management-system
Yanıt dili: Türkçe. Kod tanımlayıcıları İngilizce, kullanıcıya görünen tüm metinler Türkçe.

GÖREV: docs/redesign/06-backlog.md içindeki <BİLET-ID> · <BİLET BAŞLIĞI> biletini uygula. Yalnızca bu bileti.

ADIM 0 — OKU (kod yazmadan önce, sırayla):
  1. docs/redesign/06-backlog.md → "Ortak tanımlar" bölümü + <BİLET-ID> bileti (tamamı) + bağımlı biletlerin "Dosyalar" kısımları.
  2. docs/redesign/02-design-system.md → token'lar (§3–§4), tipografi (§5), yoğunluk (§6), radius/gölge (§7), hareket (§9), ikon (§10), odak/z-index (§11), Türkçe sözlük ve biçimlendirme (§12), geçiş tablosu (§14).
  3. docs/redesign/03-ux-architecture.md → biletin ilgili bölümü: <§ NUMARASI>.
  4. docs/redesign/04-21st-components.md → §1 alma prosedürü, §2 uyarlama kuralları, biletteki bileşen satırı.
  5. docs/redesign/05-delivery-staging-prod.md → §3 bayrak ve rota deseni.
  6. NEXT.JS: Bu proje Next.js 16.3 kullanıyor ve eğitim verindeki Next.js'ten FARKLI (middleware → proxy, async params/cookies, PageProps yardımcıları, Turbopack varsayılan, next lint yok).
     Next API'si kullanacağın her konu için önce node_modules/next/dist/docs/ altındaki ilgili rehberi oku. Bu bilet için en az: <DOKÜMAN YOLLARI — biletteki "Önce oku" satırı; yoksa ilgili file-conventions / functions dokümanı>.
     Deprecation notlarına uy. Okuduğun doküman yollarını sonuç raporunda listele.
  7. Biletin değiştireceği/taşıyacağı mevcut dosyaların TAMAMINI oku (kısmi okuma ile davranış taşıma yapma).

ADIM 1 — PLAN: Kod yazmadan önce kısa bir plan yaz: oluşturulacak/değişecek dosyalar, taşınacak davranışların listesi (legacy'den), riskler. TodoWrite ile adımları takip et.

ADIM 2 — 21st BİLEŞENİ (bilette varsa):
  GetDynamicTools {"namespace":"user-21st","toolName":"get_component"}
  CallDynamicTool {"namespace":"user-21st","toolName":"get_component","arguments":{"id":<ID>},"mcpDetails":{"description":"Fetch 21st.dev component <ID> source for PrintFlow"}}
  Dönen kodu biletteki hedef yola yerleştir ve 04 §2 uyarlama kurallarının HEPSİNİ uygula (token, lucide, motion/react, Radix Slot, Türkçe metin, z-index, a11y). AI üretim araçlarını (generate, edit_take vb.) KULLANMA.

ADIM 3 — UYGULA:
  - Yeni paket gerekiyorsa önce: npm view <paket> version peerDependencies → React 19 / Next 16 uyumunu doğrula → npm i <paket>.
  - Yalnızca semantik token sınıfları (bg-background, bg-card, text-muted-foreground, border-border, bg-primary, text-state-printing …). Sabit hex, zinc/sky/indigo/emerald/amber/violet sınıfı, text-[10px]/[11px], glass, btn-gradient YASAK (v2 dosyalarında).
  - Biçimlendirme yalnızca src/lib/format.ts; makine durumu yalnızca src/lib/machine-state.ts; onay yalnızca useConfirm; bildirim yalnızca notify.
  - Bayrak deseni (05 §3.2): legacy sayfa src/legacy/pages/ altına içerik değişmeden taşınır; rota page.tsx ince server wrapper.
  - React Compiler açık: gereksiz useMemo/useCallback ekleme; effect içinde setState yapma (lint kuralı).
  - Kod yorumları: yalnızca kodun kendisinin gösteremediği bir kısıtı açıklamak için. "Bu satır X yapar" veya "21st'ten alındı" yorumu yazma.
  - Her ikon butonuna aria-label; her form alanına label; her canlı değere data-live niteliği.

ADIM 4 — DOĞRULA (hepsini çalıştır, çıktılarını rapora koy):
  npx tsc --noEmit
  npx eslint <değişen dosyalar>
  npm run test:unit   (+ biletteki ek test komutları)
  npm run build
  rg -n "zinc-|sky-|indigo-|emerald-|amber-|violet-|#[0-9a-fA-F]{6}|text-\[1[01]px\]|glass|btn-gradient" src/components/ds src/components/v2 src/features
  UI içeriyorsa: PORT=3100 npm run dev (arka planda) → cursor-ide-browser ile http://localhost:3100/<rota>?ui=v2 aç; 1440 ve 390 genişlikte ekran görüntüsü; yalnızca klavye ile akışı tamamla; ?ui=v1 ile legacy'nin değişmediğini kontrol et; konsol temiz.
  E2E: PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test <biletteki spec'ler>
  Bir doğrulama başarısızsa düzelt ve tekrar çalıştır. Geçemiyorsan nedenini ve denediklerini raporla — gizleme, testi gevşetme.

ADIM 5 — RAPOR (Türkçe, kısa):
  - Ne yapıldı (1–3 cümle), değişen/eklenen dosyalar listesi
  - Kabul kriterleri: her madde için ✓ / ✗ + kanıt (komut çıktısı özeti, ekran görüntüsü yolu)
  - Okunan Next.js doküman yolları
  - Kullanılan 21st bileşeni ve yapılan uyarlamalar
  - Kalan riskler / takip biletleri önerisi

YAPMA (kesin):
  - git commit / push / branch oluşturma (kullanıcı açıkça istemedikçe).
  - Kapsam dışı dosyaları "iyileştirme" (yalnızca bu bilet).
  - Aşağıdaki §4 genel YAPMA listesindeki her madde.
<BİLETE ÖZEL "Yapma" maddeleri buraya>
```

### 1.1 Doldurma örneği (P0-11)

- `<BİLET-ID>`: `P0-11` · `<BİLET BAŞLIĞI>`: `AppShellV2 (sidebar, üst bar, mobil sheet)`
- `<§ NUMARASI>`: `03 §2.1, §2.2, §3.7`
- `<DOKÜMAN YOLLARI>`: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md`, `…/04-functions/cookies.md`, `…/01-getting-started/05-server-and-client-components.md` (dosya adları sürümde farklıysa `ls node_modules/next/dist/docs/01-app/**` ile bul)
- `<ID>`: `31454`
- Bilete özel yapma: `src/hooks/use-machine-sse.ts`'i değiştirme; legacy `app-shell.tsx`'e dokunma.

## 2. Bilet seçimi ve sıralama kuralları

1. Biletin "Bağımlılık" alanındaki biletler bitmeden başlama (yumuşak bağımlılıklar hariç — bilette belirtilen yedek davranışı uygula).
2. Aynı anda iki agent aynı dosyaya dokunan biletleri almasın (06 "Paralelleştirme önerisi").
3. L biletlerde alt adımları ayrı oturumlarda yürütmek serbesttir; her alt adım sonunda SV çalıştır.
4. Migration içeren biletler yalnızca **staging** veritabanına uygulanır. Prod migration'ı agent yapmaz.

## 3. Ortam hazırlığı (her oturum başında)

```bash
cd /Users/busraaktas/Projects/3d-management-system
node -v                     # ≥ 20 (CI 22)
npm ci                      # package-lock değiştiyse
PORT=3100 npm run dev       # arka planda; 3000 kullanıcıya ait olabilir
```

- Test kullanıcısı: `E2E_EMAIL` / `E2E_PASSWORD` (`.env.local`); yoksa kullanıcıdan iste — kendi hesap oluşturup veri kirletme.
- v2'yi görmek: `http://localhost:3100/dashboard?ui=v2`; geri dönmek: `?ui=v1`.
- Token referansı: `http://localhost:3100/design-tokens` (P0-04 sonrası).

## 4. Genel YAPMA listesi

1. **SSE canlı sayfalarını bozma.** `src/hooks/use-machine-sse.ts`, `/api/machines/live`, `/api/machines/[id]/live` ve canlı telemetri akışı değiştirilmez; v2 bileşenleri yalnızca bu hook'ları tüketir. `e2e/machines-live.spec.ts` her UI biletinde geçmeli.
2. **Türkçe metinleri silme**, İngilizceye çevirme veya anlamını değiştirme. Metin değişikliği yalnızca 02 §12 sözlüğüne uyum veya teknik jargonun kaldırılması içindir.
3. **Token yerine sabit renk yazma** (hex, rgb, zinc/sky/… sınıfları) — v2 dosyalarında. Grafiklerde de CSS değişkeninden oku.
4. **Next.js dokümanlarını yok sayma.** `node_modules/next/dist/docs/` okunmadan Next API'si (proxy, params, cookies, metadata, image, font, dynamic, redirects, headers) kullanılmaz.
5. **Köprü Go koduna dokunma:** `apps/printflow-bridge/**`, `tools/printflow-bridge/**`, `.github/workflows/printflow-bridge-release.yml`.
6. **Commit/push yapma**, dal oluşturma, PR açma (kullanıcı istemedikçe).
7. **Legacy ekranın davranışını değiştirme** (bilette açıkça izin verilen metin istisnaları hariç). Legacy dosyaları taşırken içerik aynen kalır.
8. **Migration'ı prod'a uygulama**; geri alma dosyası olmadan migration yazma; mevcut migration dosyalarını düzenleme.
9. **API sözleşmelerini kırma** (`/api/**` istek/yanıt şekilleri) — UI biletlerinde API değişikliği yapılmaz; gerekiyorsa raporla.
10. **Fiyat, istatistik, müşteri yorumu uydurma.** Fiyatlar env/`prices.ts`'ten; yoksa "Yakında".
11. **Gizli bilgi yazma/loglama** (env değerleri, token'lar); `.env.local`'ı okuma ihtiyacı yalnızca var/yok kontrolü için.
12. **Yeni ikon/animasyon/grafik/headless kütüphanesi ekleme** (lucide, motion, ECharts, Radix dışında); Recharts ekleme.
13. **`window.confirm/alert/prompt`, `text-[10px]`, hover-only kontrol, isimsiz ikon butonu** kullanma.
14. **21st AI üretim araçlarını** kullanma (kredi yok); yalnızca `get_component`, `search`, `get_bookmark_list`.
15. **`npx shadcn init`** çalıştırma; `shadcn add` sonrası `globals.css`'e eklenen tema bloklarını bırakma.
16. **Testleri gevşetme** (beklenti silme, `skip`, eşik büyütme) — kırmızı testi düzelt veya raporla.

## 5. REVIEW CHECKLIST (inceleyici için)

İnceleme, uygulayıcıdan **ayrı** bir oturumda yapılmalı. Her maddeyi kanıtla işaretle.

### 5.1 Kapsam ve süreç
- [ ] Yalnızca bilette listelenen dosyalar değişti (`git status`, `git diff --stat`); kapsam dışı değişiklik yok.
- [ ] Commit atılmamış (kullanıcı istemediyse).
- [ ] Rapor, okunan Next.js doküman yollarını içeriyor ve kullanılan Next API'leri bu dokümanlarla uyumlu (async `params`/`cookies`, `proxy.ts`, `PageProps`).
- [ ] Yeni paketler `package.json` + `package-lock.json`'da; peer uyumluluğu kontrol edilmiş.

### 5.2 Kalite kapıları (kendin çalıştır)
- [ ] `npx tsc --noEmit` temiz.
- [ ] `npx eslint <değişen dosyalar> --max-warnings=0` temiz (P0-01 sonrası).
- [ ] `npm run test:unit` + biletteki testler yeşil.
- [ ] `npm run build` başarılı; route boyutu beklenmedik şekilde büyümemiş.
- [ ] Token denetimi `rg` komutu v2 klasörlerinde 0 sonuç.
- [ ] `PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test e2e/smoke.spec.ts e2e/machines-live.spec.ts` yeşil.
- [ ] Görsel regresyon: legacy baseline'lar değişmemiş; yeni v2 baseline'ları gözle kontrol edilmiş.

### 5.3 Görsel
- [ ] 02 token'ları ve tipografi ölçeği; en küçük metin 12px; sayılar `tabular-nums`.
- [ ] Radius/gölge tablosuna uygun (kart `rounded-xl shadow-e0`, popover `rounded-lg shadow-e1`, dialog `rounded-2xl shadow-e3`).
- [ ] Turuncu yalnızca birincil eylem / odak / aktif nav / "Baskıda" için.
- [ ] 1440 ve 390 px'de taşma, kesilme, yatay kaydırma (planlama hariç) yok; uzun Türkçe kelimeler kırılıyor (`break-words`).
- [ ] Boş, yükleniyor (skeleton), hata ve filtre-boş durumları mevcut ve tasarımlı.

### 5.4 İşlevsel
- [ ] Legacy'deki tüm işlevler v2'de mevcut (rapordaki karşılaştırma tablosunu doğrula; en az 3 akışı elle dene).
- [ ] Veri hook'ları ve hesaplamalar değiştirilmemiş (veya değişiklik gerekçeli ve testli).
- [ ] URL durumu (filtre, sekme, sheet) yenilemede korunuyor.
- [ ] Canlı değerler güncelleniyor; bağlantı kopunca metinle bildiriliyor; "SSE" kelimesi görünmüyor.
- [ ] `?ui=v1` legacy aynı; `?ui=v2` yeni; bayrak geçişi titremesiz.
- [ ] Hatalar Türkçe ve eyleme dönük (`humanize`); "Sorun bildir" erişilebilir.

### 5.5 Erişilebilirlik (WCAG 2.2 AA)
- [ ] Yalnızca klavye ile tüm akış tamamlanabiliyor; odak sırası mantıklı; odak halkası her yerde görünür ve sticky header altında kalmıyor.
- [ ] Dialog/sheet: odak tuzağı, Escape, açılışta odak içeride, kapanışta tetikleyiciye dönüş, başlık okunuyor.
- [ ] İkon butonlarında `aria-label`; form alanlarında label + `aria-describedby` hata.
- [ ] Durum yalnızca renkle iletilmiyor (ikon + metin).
- [ ] Kontrast: metin ≥ 4.5:1, UI kenarları ≥ 3:1 (DevTools kontrast denetimi).
- [ ] `prefers-reduced-motion` açıkken animasyon yok.
- [ ] Sürükle-bırak varsa klavye/menü alternatifi var.
- [ ] (P5-01 sonrası) `npm run test:a11y` yeşil.

### 5.6 Metin ve yerelleştirme
- [ ] 02 §12.2 sözlüğü (Sipariş, Baskı, Makine, Atölye Köprüsü, Vazgeç…).
- [ ] Para `₺1.250,50`, gram `1,25 kg`, tarih `25 Eki 2026`, hafta Pazartesi başlıyor.
- [ ] Teknik jargon yok (SSE, API, npm, repo, Paddle, RLS).
- [ ] Ünlem ve gereksiz pazarlama dili yok; buton metinleri fiil.

### 5.7 21st bileşeni
- [ ] `get_component` ile alınmış; demo dosyaları alınmamış.
- [ ] Tabler/Base UI/framer-motion bağımlılıkları kalmamış (`rg -n "@tabler|@base-ui|framer-motion" src` 0).
- [ ] Yazar-özel CSS değişkenleri token'lara eşlenmiş; z-index `var(--z-*)`.

### 5.8 Güvenlik ve veri
- [ ] Yeni sorgular RLS'e güveniyor; service role yalnızca server route'larında.
- [ ] Gizli bilgi istemci paketine sızmıyor (`NEXT_PUBLIC_` olmayan env istemcide yok).
- [ ] Migration varsa: idempotent, rollback dosyası var, yalnızca staging'de uygulanmış.

**Karar:** ✅ Onay · 🔁 Düzeltme gerekli (madde listesi ile uygulayıcıya geri) · ⛔ Red (kapsam/mimari sorun).
