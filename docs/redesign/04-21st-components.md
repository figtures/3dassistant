# 04 — 21st.dev Bileşen Seçimi

> 21st.dev yer imi listesi: **"PrintFlow Redesign"** — `listId: 7ed44b6a-1880-411b-9725-e0921e2d3386` (1 tema + 31 bileşen).
> Üyelik: ücretli katman (kod alma sınırsız, **AI üretim kredisi yok** → `generate`/`edit_take` araçlarını kullanmayın).

## 1. Nasıl alınır (uygulayıcı için kesin prosedür)

**Tercih edilen yol: MCP ile kodu al, elle yerleştir.** (Kurulum URL'si API anahtarı ister ve dosyaları shadcn varsayılan yollarına yazar; bizim `components.json` aliaslarımızla çakışabilir.)

```text
1) GetDynamicTools {"namespace":"user-21st","toolName":"get_component"}
2) CallDynamicTool {"namespace":"user-21st","toolName":"get_component","arguments":{"id":<ID>},
                    "mcpDetails":{"description":"Fetch source code of 21st.dev component <ID> for PrintFlow redesign"}}
3) Dönen dosyaları bilette belirtilen hedef yola yaz (genelde src/components/ds/<ad>.tsx veya src/components/v2/...).
4) Aşağıdaki "Uyarlama kuralları"nı uygula.
5) Dosyanın başına kaynak yorumu EKLEME; kaynak bu dokümanda kayıtlı.
```

Alternatif (yalnızca kullanıcı `API_KEY_21ST` sağlarsa):
`npx shadcn@latest add "https://21st.dev/r/<author>/<slug>?api_key=$API_KEY_21ST"` → ardından `git diff` ile `globals.css`, `package.json` ve yazılan yolları gözden geçir; `globals.css`'e eklenen `:root` bloklarını **sil** (token'lar `src/styles/tokens.css`'de).

Yer imi listesini görmek: `CallDynamicTool {"namespace":"user-21st","toolName":"get_bookmark_list","arguments":{"listId":"7ed44b6a-1880-411b-9725-e0921e2d3386"}}`.

## 2. Uyarlama kuralları (her bileşen için zorunlu)

1. **Token'lar**: Bileşendeki tüm sabit renkleri (hex, `zinc-*`, `neutral-*`, `slate-*`, `gray-*`, `--primitive-*` gibi yazar-özel değişkenler) 02-design-system §4 token sınıflarına çevir. shadcn adları (`bg-background`, `text-muted-foreground`, `border-border`, `ring-ring`, `bg-popover`) zaten uyumlu — dokunma.
2. **İkonlar**: `@tabler/icons-react`, `@heroicons/*`, `react-icons` → `lucide-react` eşdeğeri. Yeni ikon paketi **eklenmez**.
3. **Animasyon**: `framer-motion` → `motion/react` (`import { motion, AnimatePresence, useReducedMotion } from "motion/react"`). `useReducedMotion` yoksa ekle; varsa koru.
4. **Primitifler**: `@base-ui/react/*` (ör. `useRender`) → Radix `Slot` (`radix-ui` paketinden `Slot`) veya düz element; ikinci bir headless kütüphane eklenmez. `@radix-ui/react-*` tekil paketleri → birleşik `radix-ui` paketinden import (`import { Dialog as DialogPrimitive } from "radix-ui"`) — shadcn'in güncel kalıbı; kurulu sürümde yoksa tekil paket kabul.
5. **Grafik**: Recharts kullanan bileşenler kurulmaz; görsel referans olarak ECharts/SVG ile yeniden üretilir.
6. **Metinler**: Tüm İngilizce demo metinleri Türkçe'ye (02 §12 sözlük). Demo verisi bileşene gömülmez; props ile gelir.
7. **z-index**: Bileşenin kendi katman sabitleri (ör. Command Menu `LAYER`) `var(--z-*)` değerlerine eşlenir.
8. **Erişilebilirlik**: `aria-label`'sız ikon butonlarına etiket ekle; odak halkası `focus-visible:shadow-[var(--focus-ring)]`.
9. **Client sınırı**: Etkileşimli bileşenlerin başında `"use client"`; saf görsel olanlar (Empty, Skeleton) server-uyumlu kalsın (hook yoksa `"use client"` ekleme).
10. **Demo dosyaları** (`demo.tsx`, `*.stories.tsx`) depoya alınmaz.

## 3. Tema

| Alan | Değer |
|---|---|
| Seçilen | **Darkmatter** — `a9787b53-a229-4bab-b4b1-14b94ec5444a` — serafimcloud — https://21st.dev/community/themes/darkmatter |
| Neden | Grafit zemin + sıcak turuncu primary (#e78a53) + çelik-teal ikincil (#5f8787) → "sıcak nozul / soğuk çelik" konseptiyle birebir; generic mavi/mor SaaS paletinden net ayrışma. |
| Nasıl kullanıldı | Temel alındı, **"Forge"** olarak türetildi (02-design-system §3): primary #ef8a4e'ye hafif açıldı (AA kontrast), `destructive` Darkmatter'da teal idi → kırmızıya düzeltildi (hata ≠ ikincil renk), `warning` sarıya ayrıştırıldı (turuncu primary ile karışmasın), font Geist Mono → Geist Sans (UI) + Geist Mono (sayısal), radius 0.75rem → bileşen bazında 6/8/12/16. |
| Reddedilenler | Amber Dark (`06da29bc-…`): primary gri, yalnızca halka amber → marka zayıf. Graphite (`a5448a89-…`): nötr, kimlik yok. |

## 4. Seçilen bileşenler (31)

Sütunlar: **ID · Ad · Yazar/slug · Sayfa · Kullanım yeri (bilet) · Neden · Beklenen bağımlılıklar · Token/uyarlama notu · Lisans**

> Bağımlılık sütunu: ✅ = `get_component` ile kaynak incelenip doğrulandı; diğerleri bileşen açıklamasından çıkarılan **beklenen** bağımlılıktır — uygulayıcı `get_component` çıktısındaki import'ları kontrol edip 2. bölüm kurallarıyla eşlemelidir.
>
> **Lisans**: 21st.dev topluluk bileşenleri yazar tarafından yayımlanır; büyük çoğunluğu MIT veya shadcn tarzı serbest kullanım içindir ama **bileşen bazında doğrulanmadı**. P5-07 (lansman) öncesi kontrol listesinde her bileşenin 21st sayfasındaki lisans/kaynak repo bağlantısı kontrol edilip bu tabloya "MIT ✓" vb. işlenir. shadcn/ui (#47) ve Dice UI (#29221) MIT'tir. Ticari SaaS içinde kullanım ve değiştirme için yeniden dağıtım kısıtı olan bileşen çıkarsa alternatif listeden (§5) değiştirin.

### 4.1 Uygulama kabuğu ve gezinme

| ID | Ad | Yazar/slug | Sayfa | Bilet | Neden | Bağımlılıklar | Uyarlama |
|---|---|---|---|---|---|---|---|
| **31454** | Sidebar | `wensity/sidebar` | https://21st.dev/wensity/sidebar | P0-11 | İkon rayına daralma, bölümler, rozetler, kullanıcı footer'ı, animasyonlu aktif gösterge, `useSidebar()` context; collapsible/floating/resizable varyantları. Alternatiflerin en olgunu. | ✅ `framer-motion` → `motion/react`; ✅ `@base-ui/react/use-render` → Radix `Slot`; ✅ `@tabler/icons-react` → lucide; ✅ yazar değişkenleri `--primitive-*` → `--sidebar-*`; ✅ 240ms + reduced-motion koruması var | Aktif öğe göstergesi `bg-sidebar-primary` 2px sol çubuk + `bg-sidebar-accent`; genişlik 248/56px; mobil varyantı kullanılmaz → Radix `Sheet`. |
| **33510** | Command Menu | `uvain/command-menu-palette` | https://21st.dev/uvain/command-menu-palette | P0-12 | cmdk tabanlı, gruplar + kısayol ipuçları, `useCommandShortcut()` ⌘K/Ctrl K kaydı, klavye-tam, açık/koyu. | ✅ `cmdk`, ✅ `@radix-ui/react-dialog`, ✅ `lucide-react`; ✅ shadcn token'ları; ✅ `LAYER` sabitleri (popover 60 / dialog 70 / toast 80) | `LAYER` → `var(--z-command)` (75) ve toast 80; `animate-in` sınıfları için `tw-animate-css` gerekli. |
| **28366** | Settings Sidebar Layout | `felipemenezes098/settings-2` | https://21st.dev/felipemenezes098/settings-2 | P3-12 | Ayarlar için ikinci seviye dikey menü + form düzeni (profil/güvenlik/bildirim/fatura/ekip/entegrasyon) — hedef IA ile birebir. | shadcn input/label/switch/button | Menü öğeleri `src/lib/nav.ts` `settingsNav`'dan; route bazlı (`/settings/*`), state bazlı değil. |

### 4.2 Temel primitifler ve geri bildirim

| ID | Ad | Yazar/slug | Sayfa | Bilet | Neden | Bağımlılıklar | Uyarlama |
|---|---|---|---|---|---|---|---|
| **47** | Dialog | `shadcn/dialog` | https://21st.dev/shadcn/dialog | P0-06 | Erişilebilir modal referansı (inert arka plan, odak tuzağı, Escape) — mevcut `Modal`'ın tüm eksiklerini kapatır. | `radix-ui` (Dialog), `lucide-react` | `size` varyantı ekle (sm 400 / md 560 / lg 720 / xl 960); overlay `bg-black/60`, `z-[var(--z-modal)]`. `AlertDialog` ve `Sheet` aynı kalıpla shadcn CLI'dan. |
| **27363** | Sonner Toast | `isaiahbjork/primitive-sonner` | https://21st.dev/isaiahbjork/primitive-sonner | P0-07 | Stilize Sonner toaster; mevcut `sonner` paketini korur, `!important` hack'lerini kaldırır. | `sonner` (kurulu) | `toastOptions.classNames` token sınıflarıyla; konum `bottom-right` (masaüstü) / `top-center` (mobil); `z-[var(--z-toast)]`. |
| **19745** | Empty | `cnippet-dev/cnippet-empty` | https://21st.dev/cnippet-dev/cnippet-empty | P0-08 | Bileşik (Header/Media/Title/Description/Content) boş durum; bağımlılıksız (cva + cn). | `class-variance-authority` (kurulu) | `EmptyMedia` arka planına `.pf-layer-lines`; ikon 20px lucide. |
| **18999** | Stat Cards Skeleton | `felipemenezes098/skeleton-10` | https://21st.dev/felipemenezes098/skeleton-10 | P0-08, P1-01 | KPI ızgarası iskeleti — dashboard `loading.tsx` için. | shadcn `skeleton` | Shimmer reduced-motion'da statik; `bg-surface-3`. |

### 4.3 Veri görüntüleme

| ID | Ad | Yazar/slug | Sayfa | Bilet | Neden | Bağımlılıklar | Uyarlama |
|---|---|---|---|---|---|---|---|
| **40086** | KPI Tile | `konsstepnov/kpi-tile` | https://21st.dev/konsstepnov/kpi-tile | P1-01 | Değer yuvarlanma animasyonu, değişim oku, SVG sparkline, klavyeyle gün değeri, yükleniyor/boş durumları — kurumsal dashboard kalitesi. | Muhtemelen `motion` | Sayı biçimi `src/lib/format.ts` (`formatCurrency`, `formatNumber`); artış rengi bağlama göre (gecikme artışı = kötü → `invertTrend` prop). |
| **34511** | Sparkline | `appica-dev/sparkline` | https://21st.dev/appica-dev/sparkline | P1-01, P1-06 | Saf SVG çizgi/alan/kolon mini grafik; tablo satırı ve makine kartı içinde (sıcaklık trendi). ECharts yükü olmadan. | Bağımlılıksız (beklenen) | Çizgi `stroke-[var(--chart-1)]`; tooltip Türkçe tarih. |
| **22177** | Complex Data Table | `felipemenezes098/table-20` | https://21st.dev/felipemenezes098/table-20 | P0-15 | TanStack Table ile sıralama, filtre, sayfalama, satır seçimi, sütun görünürlüğü, satır eylem menüsü — tüm liste sayfalarının tabanı. | `@tanstack/react-table`, shadcn table/checkbox/dropdown-menu/input/button | Genel `DataTable<T>` olarak soyutla; URL durumu `useTableUrlState`; satır yüksekliği `var(--density-row-h)`; mobil kart modu ekle. |
| **27325** | Advanced Data Table Filter Builder | `laziekiki/advanced-data-table-filter-builder` | https://21st.dev/laziekiki/advanced-data-table-filter-builder | P0-15, P3-08 | VE/VEYA mantıklı filtre çipleri, çoklu seçim, aranabilir popover — kurumsal filtreleme + kayıtlı görünümlerin temeli. | shadcn popover/command/badge | P0-15'te yalnızca basit mod (alan = değer çipleri); VE/VEYA P3-08'de. |
| **31659** | Server Card | `mohammadshehadeh/server-card` | https://21st.dev/mohammadshehadeh/server-card | P1-06 | "Host filosu" kartı: durum hapı, bölge, kaynak metreleri, eşik renkli göstergeler, bileşik parçalar → **makine kartı** için ideal iskelet. | Beklenen: yalnızca cn/lucide | Metreler → nozul/tabla sıcaklığı + `LayerProgress`; durum hapı → `MachineStateBadge`; bölge → bağlantı tipi (Bulut/Köprü/Elle). |
| **35051** | Timeline | `kuratlielia/timeline` | https://21st.dev/kuratlielia/timeline | P2-09, P3-06 | Güne göre gruplu dikey aktivite akışı, genişletilebilir satırlar, yeni öğe animasyonu — sipariş geçmişi ve denetim kaydı. | Muhtemelen `motion` | Göreli zaman `Intl.RelativeTimeFormat("tr")`; aktör avatarı. |
| **38523** | Gantt Chart | `klyv-ui/gantt-chart` | https://21st.dev/klyv-ui/gantt-chart | P3-17 | Erişilebilir zaman çizelgesi; şeritler (makine), ilerleme, bağımlılık okları, bugün işareti, gün/hafta/ay zoom. | Beklenen: `date-fns` (kurulu) | Şerit = makine, çubuk = sipariş; renk `cell_color` + kontrast düzeltme; tr locale. |
| **29221** | Kanban Board | `diceui/kanban` | https://21st.dev/diceui/kanban | P2-10 | Klavye destekli sürükle-bırak kolonlar (WCAG 2.5.7 için klavye alternatifi hazır). Dice UI MIT. | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`, Radix Slot | Kolon = sipariş durumu; kart = sipariş özeti; ek "Taşı" dropdown menüsü. |
| **26906** | Status Bar | `openstatusHQ/status-bar` | https://21st.dev/openstatusHQ/status-bar | P3-16 | OpenStatus'tan; gün bazlı uptime çubukları, hover kart, klavye/dokunma desteği. | shadcn hover-card | Durum renkleri success/warning/destructive. |
| **39964** | Uptime Card | `kokonutd/uptime-card` | https://21st.dev/kokonutd/uptime-card | P3-16 | Servis başına uptime kartı (büyüteç hover, olay sabitleme) — durum sayfasının başlık kartları. | Muhtemelen `motion` | Status Bar ile aynı veri kaynağı. |
| **30187** | Area Chart | `corr/area-chart` | https://21st.dev/corr/area-chart | P1-02 (referans) | Dokulu dolgu, zoom brush, shimmer yükleme — **yalnızca görsel referans**; Recharts kullandığı için kurulmaz, ECharts temasıyla aynı görünüm üretilir. | (Recharts — kurulmaz) | ECharts `areaStyle` gradient + `dataZoom` slider. |

### 4.4 Onboarding ve akışlar

| ID | Ad | Yazar/slug | Sayfa | Bilet | Neden | Bağımlılıklar | Uyarlama |
|---|---|---|---|---|---|---|---|
| **29442** | Onboarding Checklist | `ephraimduncan/onboarding-01` | https://21st.dev/ephraimduncan/onboarding-01 | P2-04 | Dairesel ilerleme, daraltılabilir adımlar, kapat menüsü — dashboard kurulum kartı. | shadcn dropdown-menu/collapsible | Adımlar `useOnboardingState()`'ten; ilerleme halkası `stroke-primary`. |
| **23576** | Wizard Steps | `ddoemonn/wizard-steps` | https://21st.dev/ddoemonn/wizard-steps | P2-03 | Tıklanabilir ilerleme rayı, yön duyarlı panel geçişleri, klavye gezinme, tamamlanma durumu — yazıcı bağlama sihirbazı. | Muhtemelen `motion` | Panel geçişi reduced-motion'da anlık; adım başlıkları Türkçe. |
| **28551** | Configuration Stepper | `shadcnspace/stepper-02` | https://21st.dev/shadcnspace/stepper-02 | P2-02 | Numaralı daire göstergeler + geri/devam — `/onboarding` üst ilerleme. | shadcn button | Aktif adım `bg-primary text-primary-foreground`. |
| **19201** | File Dropzone | `joyco/file-dropzone` | https://21st.dev/joyco/file-dropzone | P1-10, P2-05 | Sürükle-bırak yükleme, tür/boyut doğrulama, önizleme — katalog STL/görsel yükleme, müşteri Excel içe aktarma. | Beklenen: bağımlılıksız | Kabul türleri `.stl,.3mf,.png,.jpg,.xlsx`; Türkçe hata metinleri. |

### 4.5 Kurumsal

| ID | Ad | Yazar/slug | Sayfa | Bilet | Neden | Bağımlılıklar | Uyarlama |
|---|---|---|---|---|---|---|---|
| **27135** | Notification Panel | `uvain/notification-panel` | https://21st.dev/uvain/notification-panel | P3-07 (P1'de istemci türevli) | Zil'den açılır, Escape kapanır, güne göre gruplu, tür filtresi, "görüldü" ile "ilgilenildi" ayrımı. | Radix popover, lucide | Türler: makine, sipariş, stok, ödeme, ekip, sistem. |
| **26144** | Team Invite Sheet | `cnippet-dev/v-sheet-7` | https://21st.dev/cnippet-dev/v-sheet-7 | P3-04 | E-posta + rol seçimiyle davet sheet'i, canlı bekleyen davet listesi. | shadcn sheet/select/input | Roller 03 §4.2. |
| **28871** | Members Table | `uvain/members-table` | https://21st.dev/uvain/members-table | P3-04, P3-05 | Toplu eylemlerde reddedilecek satırları önceden söyler (sahip düşürülemez, kendin vb.) — tam da rol güvenliği UX'i. | `@tanstack/react-table`? (doğrula) | DataTable ile tutarlılık: kendi tablosu varsa yalnız toplu eylem mantığını al. |
| **28402** | Changelog | `mohammadshehadeh/changelog-01` | https://21st.dev/mohammadshehadeh/changelog-01 | P3-13 | Yapışkan tarih rayı, sürüm rozetleri, Yeni/İyileştirildi/Düzeltildi etiketleri, filtre. | cn/lucide | Etiketler "Yeni / İyileşme / Düzeltme"; kaynak `src/content/changelog.ts`. |
| **8241** | Rating Scale Group | `ruixen.ui/rating-scale-group` | https://21st.dev/ruixen.ui/rating-scale-group | P3-14 | 0–10 NPS ölçeği, net seçili durum. | shadcn radio-group (beklenen) | 0–10 (NPS standardı; bileşen 1–10 ise 0 ekle); uçlarda "Hiç olası değil / Kesinlikle". |
| **9753** | Feedback Widget | `dev.shejanmahamud/feedback-widget` | https://21st.dev/dev.shejanmahamud/feedback-widget | P3-14, P1-15 | Vercel tarzı emoji puan + metin — CSAT ve sayfa içi geri bildirim. | Muhtemelen `motion` | Emoji yerine 1–5 yüz ikonları (lucide `Frown`…`Laugh`) + `aria-label`. |

### 4.6 Pazarlama

| ID | Ad | Yazar/slug | Sayfa | Bilet | Neden | Bağımlılıklar | Uyarlama |
|---|---|---|---|---|---|---|---|
| **8948** | SaaS Template (hero) | `waleedkibhen/saa-s-template` | https://21st.dev/waleedkibhen/saa-s-template | P4-02 | Sabit gezinme + duyuru rozeti + ürün ekran görüntüsü mockup'ı + parıltı — yapı olarak. | Muhtemelen `motion` | **Gradient metin ve mor parıltı kaldırılır**; turuncu tek vurgu, `.pf-layer-lines` arka plan, gerçek ürün görüntüsü. |
| **18898** | Feature Bento | `uilayout.contact/feature-bento` | https://21st.dev/uilayout.contact/feature-bento | P4-02 | Hero kart + istatistik kutuları + CTA ile bento ızgara. | cn | 6 özellik (03 §7.1). |
| **29547** | Pricing Plans with Billing Toggle | `uiable/block-pricing-18` | https://21st.dev/uiable/block-pricing-18 | P1-14, P4-03 | Aylık/yıllık geçiş, animasyonlu fiyat, "en popüler" vurgusu. | Muhtemelen `motion` | 4 plan (bileşen 3 ise kolon ekle); TRY biçimi; veri `plans.ts` + `prices.ts`. |

**Toplam: 31 bileşen + 1 tema.**

## 5. Değerlendirilip seçilmeyenler (yedek)

| Alan | ID'ler | Neden seçilmedi |
|---|---|---|
| Sidebar | 29334, 21517, 28489, 8252, "Dashboard Sidebar" (arunjdass) | Daraltma/rozet/kullanıcı footer kombinasyonu eksik veya stil çok dekoratif. |
| Komut paleti | 2075, 31354, 23522 | Kısayol hook'u yok veya cmdk dışı özel arama. |
| Tablo | 28327, 31861, 98 | TanStack değil veya seçim/sütun görünürlüğü eksik. |
| Kanban | 26936, 32904 | Klavye desteği zayıf. |
| Boş durum | 1435, 27024 | Bileşik API yok. |
| Bildirim | 10479 | Görüldü/ilgilenildi ayrımı yok. |
| Hero | 8156, 36109 | Fazla dekoratif / generic. |
| Stepper | 1205 | Animasyonsuz, sınırlı. |
| Changelog | 36570 | Filtre yok. |

## 6. 21st dışı bağımlılıklar (plan gereği eklenecek)

| Paket | Neden | Bilet |
|---|---|---|
| `radix-ui` (birleşik) | Primitifler | P0-05 |
| `tw-animate-css` | `animate-in/out` sınıfları (shadcn + 21st) | P0-04 |
| `cmdk` | Komut paleti | P0-12 |
| `@tanstack/react-table` | DataTable | P0-15 |
| `motion` | Sidebar/21st animasyonları | P0-11 |
| `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`, `@dnd-kit/utilities` | Kanban, plan DnD | P2-10 |
| `vaul` (isteğe bağlı) | Mobil alt sheet (drawer) | P1-04 |
| `@axe-core/playwright` (dev) | a11y testleri | P5-01 |
| `@vercel/analytics`, `@vercel/speed-insights` | Ölçüm | P5-03 |

**Sürüm sabitleme:** Bu plan yazılırken npm sürümleri ağ kısıtı nedeniyle sorgulanamadı. Her bilette kurulumdan önce `npm view <paket> version peerDependencies` çalıştırın; React 19 / Next 16 peer uyumluluğunu doğrulayın; `package.json`'a `^x.y.z` olarak ekleyin; `package-lock.json` commit kapsamındadır.
