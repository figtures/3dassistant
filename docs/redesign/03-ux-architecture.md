# 03 — UX Mimarisi

> Hedef kullanıcılar (persona) ve bunların temel işleri bu mimarinin dayanağıdır.

## 1. Personalar ve "yapılacak işler"

| Persona | Bağlam | Günlük sorusu | Başarı ölçüsü |
|---|---|---|---|
| **Atölye sahibi (Selin)** — 2–8 makine, tek başına veya 1–2 çalışan | Telefon + dizüstü | "Bugün hangi siparişler teslim, hangi makine boş, para nerede?" | Gecikmeyen teslim, tahsil edilen ödeme |
| **Filament çiftliği operatörü (Mert)** — 20–40 makine, vardiyalı | Atölyede büyük ekran / tablet, eldivenli | "Hangi makine durdu/hata verdi, sırada ne var, hangi filament bitiyor?" | Makine boş kalma süresi ↓ |
| **Üretim/planlama sorumlusu** | Masaüstü | "Gelecek haftanın kapasitesi yeter mi?" | Planlama doğruluğu |
| **Muhasebe** (P3) | Masaüstü | "Bu ayın geliri, bekleyen tahsilat, dışa aktarım" | Doğru rapor |
| **Kurumsal yönetici** (çok lokasyonlu / ajans) | Masaüstü | "Ekip ne yaptı, kim neyi değiştirdi, SLA" | Denetlenebilirlik, rol ayrımı |

## 2. Bilgi mimarisi (IA)

### 2.1 Navigasyon (AppShellV2 sidebar, `src/lib/nav.ts`)

```
PrintFlow  [çalışma alanı seçici ▾]          ← P3'te gerçek seçici; P0–P2'de firma adı
───────────────────────────
  Genel Bakış            /dashboard          LayoutDashboard
ÜRETİM
  Siparişler             /orders             ClipboardList     [rozet: geciken sayısı]
  Üretim Planı           /planning           CalendarRange
  Teslim Takvimi         /calendar           CalendarCheck
  Makineler              /machines           Printer           [rozet: hata sayısı, kırmızı]
  Arıza & Bakım          /faults             Wrench
STOK & SATIŞ
  Filament & Malzeme     /materials          Cylinder          [rozet: kritik stok, sarı]
  Tedarik                /procurement        Truck
  Katalog                /catalog            Boxes
  Müşteriler             /customers          Users
───────────────────────────  (alt bölüm)
  Yenilikler             /changelog          Sparkles          [nokta: okunmamış]
  Destek                 /support            LifeBuoy
  Ayarlar                /settings           Settings
YÖNETİM (yalnızca SUPPORT_ADMIN_EMAILS)
  Destek Yönetimi        /support/admin      ShieldCheck
───────────────────────────
  [Plan kullanım kartı: "Atölye · 6/8 makine" + Yükselt]   ← yalnızca limit %75+ veya ücretsiz planda
  [Kullanıcı: avatar, ad, e-posta ▾  → Profil, Tema, Kısayollar, Çıkış]
```

- Sidebar daraltılabilir (ikon rayı, 56px), durum `localStorage("pf.sidebar")` + cookie (SSR titremesiz).
- Mobil (<lg): sidebar `Sheet` olarak açılır (Radix, odak tuzağı + inert); alt kısımda **mobil alt bar yok** (atölyede tek elle kullanım için üst bar yeterli; ⌘K yerine arama ikonu).
- Rozetler canlı: makine hatası SSE'den (`useFleetLiveSse` mevcut hook), geciken/kritik stok react-query'den.

### 2.2 Üst bar (TopBar)

`[☰ mobil] [Breadcrumb]  ·····  [Filo nabzı ● 6 baskıda · 1 hata] [⌘K Ara] [+ Yeni ▾] [🔔] [?] [avatar]`

- **Breadcrumb**: `src/lib/nav.ts` rota haritasından otomatik; dinamik segmentler (makine adı, müşteri adı) sayfadan `useBreadcrumbLabel(id, label)` ile beslenir.
- **Filo nabzı**: `useFleetLiveSse()` sonuçlarını özetler; tıklayınca `/machines?state=error` vb. filtreli açılır. Makinesi olmayan kullanıcıda "Yazıcı bağla" hapı olarak görünür.
- **+ Yeni**: Sipariş (N), Müşteri, Makine, Malzeme alımı, Arıza kaydı.
- **🔔 Bildirimler**: P3-07'ye kadar istemci tarafı türetilmiş uyarılar (hata veren makine, bugün teslim, kritik stok, ödeme vadesi); P3-07'de kalıcı `notifications` tablosu.
- **? Yardım**: Kısayollar (?), Destek talebi oluştur, Sorun bildir (mevcut `ReportProblemModal` → sheet), Yenilikler, Durum sayfası.
- **"Sorun bildir"** artık yalnızca burada + Destek sayfasında + hata sınırlarında (tekrar yok; WCAG 3.2.6 tutarlı yardım).

### 2.3 Rota haritası (v2 hedefi)

| Rota | Amaç | Not |
|---|---|---|
| `/dashboard` | "Bugün" görünümü | P1-01 |
| `/orders` | Sipariş listesi (tablo) + `?view=board` (kanban) | **Yeni rota**, `jobs` verisi |
| `/orders/[id]` | Sipariş detayı (tam sayfa; listeden sheet olarak da açılır) | P2-09 |
| `/planning` | Makine × gün plan ızgarası | P1-05 |
| `/calendar` | Teslim takvimi | P1-13 |
| `/machines`, `/machines/[id]` | Filo + makine detayı (SSE) | P1-06/07 |
| `/machines/connect` | Birleşik yazıcı bağlama sihirbazı (tam sayfa; dialog'dan da açılır) | P2-03 |
| `/faults` | Arıza & bakım | P1-12 |
| `/materials`, `/procurement`, `/catalog`, `/catalog/[id]`, `/customers`, `/customers/[id]` | | P1 |
| `/onboarding` | İlk kurulum sihirbazı | P2-02 |
| `/settings` → `/settings/profile`, `/settings/workspace`, `/settings/team`, `/settings/notifications`, `/settings/integrations`, `/settings/billing`, `/settings/audit`, `/settings/appearance` | | P3-12; `/billing` → `/settings/billing` kalıcı yönlendirme (P3-12'den önce `/billing` aynen çalışır) |
| `/support`, `/support/[ticketId]`, `/support/admin` | | P1-15 |
| `/changelog` | Uygulama içi yenilikler | P3-13 |
| `/forgot-password`, `/reset-password` | | P1-16 |
| Pazarlama: `/`, `/pricing`, `/features/*` (isteğe bağlı), `/status`, `/legal/kvkk`, `/legal/terms`, `/legal/privacy`, `/legal/cookies` | `(marketing)` route grubu | P4 |

## 3. Global etkileşim desenleri

### 3.1 Komut paleti (⌘K / Ctrl K)
21st **Command Menu (#33510)** tabanlı. Gruplar:
1. **Hızlı eylemler**: Yeni sipariş, Yeni müşteri, Makine ekle, Yazıcı bağla, Sorun bildir, Tema değiştir.
2. **Git**: tüm nav öğeleri (anahtar kelimelerle: "fatura" → Abonelik, "filament" → Malzeme).
3. **Ara (canlı)**: müşteri adı, sipariş (iş adı / müşteri), makine adı, katalog SKU — 2+ karakterde debounce 200ms, Supabase `ilike` sorguları (`src/features/search/use-global-search.ts`), her grupta en fazla 5.
4. **Son görüntülenenler**: `localStorage("pf.recent")` son 8 kayıt.

Klavye: ↑↓ gezin, Enter aç, ⌘Enter yeni sekmede, Esc kapat. Mobilde üst bardaki arama ikonu aynı paleti tam ekran açar.

### 3.2 Klavye kısayolları (P3-11; ⌘K P0-12'de)

| Kısayol | Eylem |
|---|---|
| `⌘K` / `Ctrl K` | Komut paleti |
| `/` | Sayfa içi aramaya odaklan |
| `N` | Yeni sipariş (form alanında değilken) |
| `G` sonra `D/O/P/M/S/C` | Genel bakış / Siparişler / Plan / Makineler / Stok (malzeme) / Müşteriler |
| `?` | Kısayol listesi |
| `J` / `K` | Tabloda sonraki/önceki satır |
| `X` | Satır seç |
| `E` | Seçili kaydı düzenle |
| `Esc` | Kapat / seçimi temizle |

Kısayollar input/textarea/contenteditable içindeyken devre dışı; ayarlardan kapatılabilir (WCAG 2.1.4).

### 3.3 Tablolar
Tek `DataTable` (P0-15): sıralama, filtre çipleri (21st #27325 filtre oluşturucu), sütun gizle, yoğunluk, seçim + toplu eylem çubuğu, sayfalama (25/50/100), **URL durumu** (`?q=&status=&sort=&page=`) → paylaşılabilir linkler; boş/yükleniyor/hata durumları yerleşik; mobilde satırlar kart listesine döner.

### 3.4 Formlar
- Uzun formlar dialog'da değil **Sheet** (sağdan, 560px; mobilde tam ekran) içinde — arka plandaki listeyi görmeye devam etmek için.
- Doğrulama: `zod` şeması + alan altı hata metni + ilk hatalı alana odak. Kaydetme butonu `loading`.
- Kaydedilmemiş değişiklikle kapatma → `useConfirm` ("Değişiklikler kaydedilmedi. Çıkılsın mı?").
- Varsayılanlar akıllı: son kullanılan malzeme/makine, bugün tarihi.
- Sesli not (`VoiceParsePanel`) sipariş formunun en üstünde "Sesle doldur" düğmesi olarak kalır.

### 3.5 Geri bildirim
- Başarı: toast (4s), geri alınabilir işlemlerde "Geri al" aksiyonu (silme → soft-delete yoksa önce onay).
- Yıkıcı işlem: `ConfirmDialog` (`window.confirm` yasak). Toplu silmede adet yazılır.
- Hata: alanla ilgiliyse inline; sistemse toast + "Sorun bildir" aksiyonu (mevcut `reportFromToast` deseni).
- Arka plan senkronu (bulut sync): Filo nabzında "Senkronize ediliyor…" ince göstergesi.

### 3.6 Yükleniyor / boş / hata
- Her rota segmentinde `loading.tsx` (Next 16 dosya konvansiyonu: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md`) → içerik şeklinde skeleton, spinner değil.
- Boş durum 3 tür: **İlk kullanım** (illüstrasyon + açıklama + birincil CTA + "Örnek veriyle dene"), **Filtre sonucu boş** ("Filtreleri temizle"), **Hata** ("Tekrar dene" + "Sorun bildir").
- `not-found.tsx` (kök + dashboard), `error.tsx` mevcut → v2 görünümü.

### 3.7 Canlı veri (SSE) davranışı
- SSE hook'ları (`src/hooks/use-machine-sse.ts`) **değiştirilmez**; v2 bileşenleri yalnızca tüketir.
- UI: bağlantı durumu metin olarak "Canlı" (yeşil nokta) / "Bağlantı yeniden kuruluyor…" (sarı) / "Canlı veri durdu — son güncelleme 2 dk önce" (gri). "SSE" kelimesi asla görünmez.
- Değişen değerler 600ms hafif vurgu (`bg-primary-subtle` fade; reduced-motion'da yok).

## 4. Rol ve izin modeli

### 4.1 Bugün (P0–P2)
1 kullanıcı = 1 kiracı. Rol yok. Destek yöneticisi `SUPPORT_ADMIN_EMAILS` ile.

### 4.2 Hedef (P3) — Çalışma alanı
- `workspaces(id uuid PK = sahibin user_id, name, created_at)`, `workspace_members(workspace_id, user_id, role, created_at)`, `workspace_invites(id, workspace_id, email, role, token_hash, expires_at, accepted_at)`.
- **Veri taşıma yok**: mevcut tüm tablolardaki `user_id` sütunu "workspace id" anlamına gelir (sahip kullanıcının id'si = workspace id). RLS `auth.uid() = user_id` → `public.is_workspace_member(user_id)` (SECURITY DEFINER, `stable`) olarak değişir.
- İstemci insert'leri: `user_id: user.id` yerine `user_id: activeWorkspaceId` (`src/lib/workspace/active.ts`). Bu P3-03'te tek tek tüm insert noktalarına uygulanır (`rg -n "user_id: user" src`).
- Abonelik/plan çalışma alanına (sahibe) aittir — mevcut `billing_subscriptions.user_id` aynen çalışır.

| İzin | Sahip | Yönetici | Operatör | Muhasebe | İzleyici |
|---|---|---|---|---|---|
| Sipariş görüntüle | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sipariş oluştur/düzenle/durum | ✓ | ✓ | ✓ | – | – |
| Gelir/ödeme alanlarını gör | ✓ | ✓ | – (gizli) | ✓ | – |
| Ödeme kaydı düzenle | ✓ | ✓ | – | ✓ | – |
| Makine ekle/bağla/sil | ✓ | ✓ | – | – | – |
| Arıza kaydı | ✓ | ✓ | ✓ | – | – |
| Malzeme/tedarik | ✓ | ✓ | ✓ (stok düş) | ✓ (alım) | – |
| Dışa aktar | ✓ | ✓ | – | ✓ | – |
| Ekip yönet | ✓ | ✓ (sahip hariç) | – | – | – |
| Abonelik & fatura | ✓ | – | – | ✓ (görüntüle) | – |
| Denetim kaydı | ✓ | ✓ | – | – | – |
| Çalışma alanını sil | ✓ | – | – | – | – |

Uygulama: v1'de UI gizleme + API route kontrolü (`requireRole()`); RLS düzeyinde rol (ör. operatör gelir göremez) P3-05'te view/kolon güvenliği ile değerlendirilir — v1 dokümante edilmiş risk.

## 5. Ana akışlar

### 5.1 Kayıt → Onboarding → İlk değer ("aha" = ilk canlı baskıyı PrintFlow'da görmek)

```
/register (ad, firma, e-posta, şifre, KVKK onayı)
   → e-posta doğrulama ekranı ("Gelen kutunuzu kontrol edin" + tekrar gönder + yanlış e-posta düzelt)
   → /auth/callback → /onboarding
/onboarding  (tam ekran, sidebar yok, üstte 4 adımlı ilerleme; "Daha sonra" her adımda)
  1. Atölyeniz     : firma adı (dolu), makine sayısı aralığı (1–2 / 3–8 / 9–40 / 40+), ana kullanım (müşteri siparişi / kendi ürünleri / ikisi)
                     → plan önerisi metni ("9–40 makine için Filament Farm önerilir") ama zorlamaz
  2. Yazıcılarınız : PrinterConnectWizard gömülü (aşağıda 5.2)  → "İlk canlı veri alındı ✓"
  3. Filament      : en çok kullandığınız 3 malzemeyi hızlı seç (PLA/PETG/ABS/TPU şablonları + renk) veya "Atla"
  4. İlk sipariş   : mini sipariş formu (müşteri adı, ürün, gram, teslim tarihi) veya "Örnek verilerle keşfet"
   → /dashboard  (Kurulum kontrol listesi kartı sağ üstte, %progress; kapatılabilir)
```

Durum saklama (migration yok): adımların tamamlanma durumu **veriden hesaplanır** (`machines.count>0`, `connection_status='connected'` var mı, `materials.count>0`, `jobs.count>0`), yalnızca "kapatıldı/atlandı" bayrakları `supabase.auth.updateUser({ data: { onboarding: { dismissedAt, skipped: [...] } } })`.

Kontrol listesi (dashboard kartı, 21st #29442): Yazıcı bağla · Filament ekle · İlk sipariş · Müşteri ekle · Ekip arkadaşı davet et (P3) · Bildirimleri ayarla · Planı seç.

### 5.2 Birleşik yazıcı bağlama sihirbazı (en kritik akış)
Bugünkü 2 modal + 4 buton → **tek "Yazıcı bağla" girişi**.

```
Adım 1 — Yazıcınız hangisi?        [Bambu Lab] [Creality] [Prusa] [Diğer / Klipper / OctoPrint]
                                   (logolu kartlar, kısa açıklama, "Önerilen" etiketi)
Adım 2 — Nasıl bağlanalım?         Üreticiye göre seçenekler, öneri sıralı:
   Bambu Lab  → (A) Bambu hesabıyla bağlan [Atölye+ planı]  (B) Atölye Köprüsü (LAN, en hızlı)  (C) Elle ekle
   Creality   → (A) Creality Cloud hesabı [Atölye+]          (B) Atölye Köprüsü                  (C) Elle ekle
   Prusa      → (B) Atölye Köprüsü (PrusaLink)               (C) Elle ekle
   Diğer      → (B) Atölye Köprüsü (Moonraker/OctoPrint)     (C) Elle ekle
   Her seçenekte: "Ne gerekir", "Kurulum süresi ~2 dk", "Canlı veri: ✓ sıcaklık, ilerleme, kamera?"
   Plan kilitli seçenekler gri değil — görünür, "Atölye planında" rozetiyle; tıklayınca UpgradePrompt (P2-07).
Adım 3 — Bağlan
   (A) Bulut: mevcut CloudPrinterConnectModal mantığı (OAuth/giriş, 2FA) → cihaz listesi → seç
   (B) Köprü: işletim sistemi otomatik algılanır → [PrintFlow Köprü'yü indir (Windows/macOS/Linux)]
       → eşleştirme kodu büyük, kopyalanabilir, 10 dk geri sayım → "Köprü bekleniyor…" canlı durum
       → köprü bağlanınca bulunan yazıcılar listelenir → seç
       Geliştirici komutları (npm run bridge:*) ve repo dokümanı ASLA gösterilmez; yalnızca "Sorun mu yaşıyorsunuz?" altında
       "Destek paketini gönder" (mevcut /api/bridge/support-bundle akışı) ve "Kurulum rehberi" (yardım makalesi linki).
       İndirme henüz yayında değilse (CDN yok): seçenek "Yakında — erken erişim için bize yazın" + destek talebi ön-dolu.
   (C) Elle: ad, model, (isteğe bağlı) saatlik maliyet → canlı takip yok uyarısı + "Sonra canlı bağla" linki
Adım 4 — Doğrula
   İlk telemetri bekleniyor (SSE /api/machines/[id]/live) → ✓ "Canlı veri alındı: Nozul 24 °C, Durum: Hazır"
   30 sn içinde gelmezse: sorun giderme listesi (yazıcı açık mı, aynı ağda mı, LAN modu, köprü çalışıyor mu)
Bitti → "Bir yazıcı daha bağla" / "Makinelere git"
```

Bileşen: 21st **Wizard Steps (#23576)** (adım rayı) + **Configuration Stepper (#28551)** (onboarding içinde yatay). Mevcut iş mantığı (`cloud-printer-connect-modal.tsx`, `workshop-bridge-modal.tsx`, API route'ları) **yeniden kullanılır**, yalnızca sunum katmanı değişir.

### 5.3 Sipariş → üretim → teslim

```
Sipariş oluştur (Sheet: müşteri combobox [+ yeni], katalog ürünü/serbest ad, malzeme+renk, gram, adet,
                 makine (isteğe bağlı), başlangıç/teslim tarihi, fiyat, ödeme durumu/taksit, not, sesle doldur)
   → durum Bekliyor
Planla       : /planning ızgarasında sürükle-bırak (P2-10 sonrası) veya sipariş detayında "Makineye ata"
Üretim       : makine baskıya başlayınca (canlı veri) sipariş otomatik "Üretimde" önerisi (toast: "Ender-3 #2 'Vazo' baskısına başladı. Siparişi Üretimde olarak işaretle?")
Tamamla      : durum Tamamlandı → stoktan gram düşüm önerisi (mevcut mantık varsa) → teslim
Teslim/kargo : Teslim Takvimi + (katalog satışlarında) kargo durumu
Tahsilat     : ödeme durumu (Ödenmedi/Kısmi/Ödendi), taksitler; dashboard "Bekleyen tahsilat"
```

Görünümler: Liste (`/orders`), Pano (`/orders?view=board`, kolonlar = durum, 21st #29221 Kanban, klavyeyle "Taşı" menüsü), Plan (`/planning`), Takvim (`/calendar`).

Sipariş detay sayfası: başlık (ad, müşteri, durum rozeti, teslim geri sayımı), sol: bilgiler/maliyet-kâr; sağ: **zaman çizelgesi** (21st #35051 Timeline — oluşturuldu, durum değişti, makineye atandı, ödeme alındı; P3-06 denetim kaydı ile beslenir; öncesinde `created_at/updated_at` + durum alanlarından türetilir).

### 5.4 İş kuyruğu / üretim planı
- Satırlar = makineler (durum noktası + ad), sütunlar = günler (bugün vurgulu, hafta sonu soluk), hücreler = sipariş blokları (müşteri rengi `cell_color` korunur, ama metin kontrastı otomatik).
- Üst araç çubuğu: Bugün · ‹ › · aralık (7/14/30 gün) · makine filtresi · "Atanmamış siparişler (5)" çekmecesi → sürükle.
- Kapasite çubuğu her makine satırının sonunda (planlanan saat / mevcut saat).
- P3-17: Gantt görünümü (21st #38523) — bağımlılık ve kilometre taşı (kurumsal).
- Mobil: ızgara yerine "Gün" listesi (seçili günün makine→sipariş listesi).

### 5.5 Filo canlı görünümü (`/machines`)
- Üst: durum özet çipleri (Tümü 8 · Baskıda 5 · Hazır 1 · Hata 1 · Çevrimdışı 1) = filtre.
- Görünüm geçişi: **Kart** (varsayılan ≤12 makine) / **Yoğun liste** (varsayılan >12, çiftlik modu) / **Duvar** (P3, TV modu `/machines/wall` tam ekran, otomatik döngü yok, büyük tipografi).
- Kart (21st #31659 Server Card uyarlaması): ad + model + bağlantı tipi ikonu; durum rozeti; mevcut baskı adı; `LayerProgress` + kalan süre; nozul/tabla sıcaklığı (mono); kamera küçük resmi varsa; eylemler menüsü (⋯: Detay, Düzenle, Bakıma al, Sil) — **her zaman görünür**, `aria-label`'lı.
- Canlı takibi olmayan makinelerde tekrar eden uyarı metni yerine kartta tek satır "Canlı takip yok · Bağla" linki; sayfa üstünde bir kez bilgi bandı ("3 makine canlı takip edilmiyor — Bağla").
- Plan kullanımı: başlıkta ilerleme çubuğu "6 / 8 makine · Atölye planı" (limitte → UpgradePrompt).
- Başlık eylemleri: birincil **"Yazıcı bağla"** (sihirbaz), ikincil menü (⋯): "Elle makine ekle", "Bulut senkronunu şimdi çalıştır", "Köprüleri yönet".

### 5.6 Stok uyarıları
- Malzeme/renk bazında eşik (`low_stock_grams`, P2-06 migration 028; yoksa varsayılan 500 g).
- Tetikleyiciler: sidebar rozeti, dashboard "Kritik stok" kartı, bildirim (P3-07), e-posta özeti (P5-09, isteğe bağlı).
- Eylem: "Alım oluştur" → Tedarik formu malzeme/renk ön-dolu.
- Tahmin (P3+): son 30 gün tüketim hızına göre "~6 gün içinde bitecek".

### 5.7 Abonelik / yükseltme
- `/settings/billing` (önce `/billing` v2): mevcut plan kartı (kullanım: makine x/y, bulut senkronu), plan karşılaştırma (21st #29547, aylık/yıllık geçiş), fatura geçmişi (Paddle müşteri portalı linki), ödeme yöntemi.
- **Bağlamsal yükseltme** (`UpgradePrompt`, P2-07): limit aşımı (402 `PLAN_LIMIT`), kilitli özellik (bulut bağlantısı), %80 kullanımda nazik uyarı. Prompt: neyi açacağını söyler + fiyat + "Planları karşılaştır" + "Yükselt" → Paddle checkout overlay. Asla tam sayfa engelleme yok.
- Deneme: (karar kullanıcıda) 14 gün Atölye denemesi; kalan gün üst barda yalnızca son 5 günde.
- Ödeme başarısı → konfeti yok; sade "Atölye planı aktif. Bulut bağlantısını şimdi kurun →".
- `past_due`: üst bant (kırmızı değil, sarı) "Ödeme alınamadı — kart bilgisini güncelle", işlevler 7 gün çalışmaya devam (mevcut `ENTITLED_STATUSES` past_due içeriyor).
- "Paddle" adı müşteri arayüzünde geçmez ("güvenli ödeme sağlayıcımız").

### 5.8 Destek
- Her sayfada ? menüsünden "Sorun bildir" (ekran bağlamı + tanılama otomatik ekli, mevcut `ReportProblemModal` mantığı) ve "Destek talebi".
- `/support`: talepler tablosu (durum, kategori **Türkçe etiket**, son yanıt), talep detayı sohbet görünümü, yanıt süresi beklentisi ("Genellikle 4 iş saati içinde yanıt veriyoruz").
- Talep kapanınca **CSAT** (P3-14): "Bu talep nasıl çözüldü?" 1–5 + yorum.
- Durum sayfası `/status` (P3-16): bulut senkronu, köprü relay, uygulama, e-posta — son 90 gün (21st #26906 Status Bar / #39964 Uptime Card).

## 6. Kurumsal özellikler (P3)

| Özellik | Kapsam | Bilet |
|---|---|---|
| Ekip & davet | E-posta davet (Resend), rol seçimi, bekleyen davetler, rol değiştir, çıkar; 21st #26144, #28871 | P3-04 |
| Roller | Bkz. §4.2 | P3-05 |
| Denetim kaydı | `audit_events(workspace_id, actor_id, action, entity, entity_id, diff jsonb, created_at)`; DB trigger'larla (jobs, machines, materials, customers, billing) + `/settings/audit` filtreli tablo + CSV | P3-06 |
| Bildirimler | `notifications` tablosu + tercih matrisi (uygulama içi / e-posta × olay türü); 21st #27135 | P3-07 |
| Kayıtlı görünümler | DataTable filtre/sıralama/sütun kombinasyonunu adlandırıp kaydet (kişisel/ekip) | P3-08 |
| Dışa aktarma | Her tabloda CSV/XLSX (mevcut `xlsx` dinamik import), sipariş PDF/yazdır (tarayıcı print stylesheet) | P3-09 |
| Toplu işlemler | Seçili siparişler: durum değiştir, makineye ata, sil, dışa aktar | P3-10 |
| Kısayollar | §3.2 | P3-11 |
| Durum sayfası | §5.8 | P3-16 |
| Değişiklik günlüğü | `/changelog` (MDX/JSON kaynak `src/content/changelog.ts`), okunmamış noktası; 21st #28402 | P3-13 |
| NPS/CSAT | NPS: kayıttan 14 gün sonra + 90 günde bir, uygulama içi küçük kart (21st #8241); CSAT: destek kapanışı (21st #9753) — `feedback_responses` tablosu | P3-14 |
| Müşteri sağlığı | `/support/admin/health`: kiracı başına son aktivite, bağlı makine, 7 günlük sipariş, hata olayı sayısı (`client_error_events`), plan, NPS → skor (yeşil/sarı/kırmızı) | P3-15 |

## 7. Pazarlama, fiyatlandırma, deneme/ödeme hunisi (P4)

### 7.1 Landing (`/`)
1. **Hero**: "3D baskı atölyenizi tek ekrandan yönetin." Alt: "Siparişten teslimata, her yazıcının canlı durumu, filament stoğu ve tahsilat — Türkçe, atölyeler için." CTA: [14 gün ücretsiz dene] [Canlı demoyu izle]. Görsel: gerçek ürün ekran görüntüsü (Filo görünümü, koyu), `.pf-layer-lines` arka plan. (21st #8948 yapısı, gradient metin olmadan.)
2. **Güven şeridi**: desteklenen üreticiler (Bambu Lab, Creality, Prusa, Klipper/OctoPrint logoları — marka kullanım izinlerine dikkat; logolar yerine metin rozet de olabilir).
3. **Problem → çözüm** bento (21st #18898): Canlı filo · Üretim planı · Filament stoğu · Sipariş & tahsilat · Sesle sipariş · Türkçe destek.
4. **Nasıl çalışır** (3 adım): Yazıcını bağla → Siparişi gir → Teslim et.
5. **Fiyatlandırma özeti** → `/pricing`.
6. **SSS** (accordion): Verilerim nerede (KVKK)? İnternet kesilirse? Hangi yazıcılar? İptal?
7. **Son CTA** + footer (yasal linkler, durum sayfası, iletişim).

### 7.2 Fiyatlandırma (`/pricing`)
- 4 plan (Ücretsiz / Starter / Atölye / Filament Farm), aylık-yıllık geçişi (yıllıkta "2 ay bedava"), TRY, KDV notu. Önerilen: **Atölye**. Plan özellikleri `src/lib/billing/plans.ts` içinden üretilir (tek kaynak); tutarlar `src/lib/billing/prices.ts` (yeni, env'den Paddle price ID + görüntülenecek tutar).
- Özellik karşılaştırma tablosu, kurumsal satır ("40+ makine / çok lokasyon → Bize ulaşın").

### 7.3 Huni ve ölçüm
`landing_view → cta_click → register_start → register_complete → email_verified → onboarding_step_n → first_printer_connected (aktivasyon) → first_order → trial_day_7 → checkout_open → checkout_complete (dönüşüm)`
Olaylar: Vercel Analytics custom events (P5-03) + Supabase `product_events` (isteğe bağlı, P3-15 sağlık skoru için).

## 8. Müşteri sadakati için ilkeler (her bilette uygulanır)

1. **Hiçbir zaman çıkmaz sokak yok**: her boş/hata durumunda bir sonraki eylem.
2. **Veri kaybı yok**: kaydedilmemiş değişiklik uyarısı, silmede onay ve mümkünse geri al.
3. **Hız algısı**: skeleton, iyimser güncelleme (durum değişikliği), prefetch (sidebar linkleri).
4. **Şeffaflık**: canlı veri ne zaman güncellendi, senkron ne zaman çalıştı, sorun varsa durum sayfası.
5. **Saygılı satış**: yükseltme yalnızca bağlamsal ve değer anında.
6. **İnsan desteği**: talep yanıt süresi görünür, CSAT ile kapanış.
