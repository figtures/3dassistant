export type ChangelogItemType = "new" | "improved" | "fixed";

export type ChangelogItem = {
  type: ChangelogItemType;
  text: string;
};

export type ChangelogRelease = {
  version: string;
  date: string;
  title: string;
  items: ChangelogItem[];
};

/** En yeniden eskiye; ilk kayıt `getLatestChangelogVersion` ile okunur. */
export const CHANGELOG_RELEASES: ChangelogRelease[] = [
  {
    version: "2.4.0",
    date: "2026-10-28",
    title: "Klavye kısayolları ve toplu işlemler",
    items: [
      { type: "new", text: "Klavye kısayolları: ⌘K komut paleti, ? kısayol listesi, ekrana özel eylemler." },
      { type: "new", text: "Sipariş listesinde çoklu seçim ve toplu durum güncelleme." },
      { type: "new", text: "Tablo ve pano görünümlerinde dışa aktarma ve yazdırma." },
      { type: "improved", text: "Kayıtlı görünümler sipariş filtresiyle senkron çalışır." },
    ],
  },
  {
    version: "2.3.0",
    date: "2026-10-12",
    title: "Bildirimler ve denetim",
    items: [
      { type: "new", text: "Üst bardaki bildirim zili: makine hatası, geciken teslim, kritik stok." },
      { type: "new", text: "Denetim kaydı ekranı — çalışma alanı olay geçmişi." },
      { type: "improved", text: "Dashboard grafikleri tembel yüklenir; açılış daha hızlı." },
      { type: "fixed", text: "Ana sayfa ve dashboard derleme takılması giderildi." },
    ],
  },
  {
    version: "2.2.0",
    date: "2026-09-24",
    title: "Ayarlar ve ekip",
    items: [
      { type: "new", text: "Ayarlar bölümü: profil, çalışma alanı, ekip, görünüm, entegrasyonlar." },
      { type: "new", text: "Rol tabanlı izinler — kenar çubuğu ve eylemler role göre filtrelenir." },
      { type: "new", text: "Birden fazla çalışma alanı arasında geçiş." },
      { type: "improved", text: "Uygulama içi yardım ipuçları ve bağlamsal rehber." },
    ],
  },
];

export function getLatestChangelogVersion(
  releases: readonly ChangelogRelease[] = CHANGELOG_RELEASES
): string | null {
  return releases[0]?.version ?? null;
}
