import type {
  ParsedNoteData,
  ParsedFaultData,
  ParsedProcurementData,
  ParsedCatalogData,
  ParsedSaleData,
  JobStatus,
  PaymentStatus,
  FaultStatus,
} from "@/types/database";
import { confidenceFromMatchedLabels, type VoiceFieldConfidence } from "@/lib/voice-confidence";
import { addDays, format } from "date-fns";

const MATERIAL_KEYWORDS = [
  "petg", "asa", "pla", "abs", "tpu", "nylon", "hips",
  "pva", "wood", "carbon", "silk", "marble", "glow",
];
/** Kısa kodlar yalnızca kelime sınırında (parçası → PA olmasın) */
const SHORT_MATERIAL_KEYWORDS = ["pa", "pc"];

/** Konuşma tanıma (STT) yazım hatalarını düzeltir */
const STT_MATERIAL_FIXES: [RegExp, string][] = [
  [/@get/gi, "PETG"],
  [/\bpet\s*g\b/gi, "PETG"],
  [/\bpet\s*c\b/gi, "PETG"],
  [/\bpetg\b/gi, "PETG"],
  [/\bpla\b/gi, "PLA"],
  [/\babs\b/gi, "ABS"],
  [/\basa\b/gi, "ASA"],
  [/\btpu\b/gi, "TPU"],
];

const STATUS_KEYWORDS: Record<string, JobStatus> = {
  tamamlandı: "completed",
  tamamlandi: "completed",
  bitti: "completed",
  hazır: "completed",
  hazir: "completed",
  yapıldı: "completed",
  yapildi: "completed",
  basıldı: "completed",
  basildi: "completed",
  ödendi: "completed",
  odendi: "completed",
  tasarımda: "in_progress",
  tasarimda: "in_progress",
  tasarlaniyor: "in_progress",
  tasarlanıyor: "in_progress",
  devam: "in_progress",
  "devam ediyor": "in_progress",
  basladı: "in_progress",
  basladi: "in_progress",
  başladı: "in_progress",
  basliyor: "in_progress",
  iptal: "cancelled",
  "iptal edildi": "cancelled",
  bekliyor: "pending",
  beklemde: "pending",
};

const CUSTOMER_STOP =
  /\s+(?:di[sş]li|parça|parca|araba|kapak|klips|yap[iı]ld[iı]|bas[iı]l|basim|baskı|gram|gr\b|kg\b|g\b|teslim|termin|petg|pla|abs|tpu|asa|siyah|beyaz|\d)/i;

function normalizeTr(text: string): string {
  return text
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

function cleanVoiceText(text: string): string {
  let cleaned = text.replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of STT_MATERIAL_FIXES) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  return cleaned;
}

function extractSpokenCustomerName(raw: string): string {
  return raw
    .trim()
    .split(CUSTOMER_STOP)[0]
    .trim()
    .replace(/\s+(?:için|ad[ıi])\s*$/i, "")
    .trim();
}

function namesEqual(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase() || normalizeTr(a) === normalizeTr(b);
}

function matchCustomerInList(
  spoken: string,
  customers: { name: string }[]
): string | undefined {
  const parts = spoken.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return undefined;

  for (let n = parts.length; n >= 1; n--) {
    const candidate = parts.slice(0, n).join(" ");
    const exact = customers.find((c) => namesEqual(c.name, candidate));
    if (exact) return exact.name;
  }

  const lower = spoken.toLowerCase();
  const partial = customers.find((c) => {
    const nameParts = c.name.toLowerCase().split(/\s+/);
    const spokenParts = parts.slice(0, Math.min(2, parts.length));
    return spokenParts.every((p) =>
      nameParts.some((np) => np === p || np.startsWith(p) || p.startsWith(np))
    );
  });
  if (partial) return partial.name;

  const byFirst = customers.find((c) => {
    const first = c.name.split(/\s+/)[0].toLowerCase();
    return first === parts[0] || lower.startsWith(first) || namesEqual(first, parts[0]);
  });
  if (byFirst) return byFirst.name;

  return parts.slice(0, 2).join(" ");
}

function findCustomer(
  text: string,
  customers: { id?: string; name: string }[]
): string | undefined {
  const lower = text.toLowerCase();
  const norm = normalizeTr(text);

  for (const cust of customers) {
    if (lower.includes(cust.name.toLowerCase()) || norm.includes(normalizeTr(cust.name))) {
      return cust.name;
    }
  }

  const customerMatch = text.match(
    /m[uü]şteri(?:\s+ad[ıi])?\s+([A-Za-zÇçĞğİıÖöŞşÜü][A-Za-zÇçĞğİıÖöŞşÜü\s]{1,50})/i
  );
  if (customerMatch) {
    const spoken = extractSpokenCustomerName(customerMatch[1]);
    if (spoken.length >= 2) {
      return matchCustomerInList(spoken, customers);
    }
  }

  for (const cust of customers) {
    const firstName = cust.name.split(/\s+/)[0];
    if (firstName.length >= 3 && norm.includes(normalizeTr(firstName))) {
      return cust.name;
    }
  }

  return undefined;
}

function hasStandaloneKeyword(text: string, kw: string): boolean {
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-zçğıöşü0-9])${escaped}(?:$|[^a-zçğıöşü0-9])`, "i").test(
    text
  );
}

function findMaterial(
  text: string,
  materials: { name: string }[]
): string | undefined {
  const lower = text.toLowerCase();
  const sorted = [...materials].sort((a, b) => b.name.length - a.name.length);
  for (const mat of sorted) {
    if (hasStandaloneKeyword(lower, mat.name.toLowerCase())) return mat.name;
  }
  for (const kw of MATERIAL_KEYWORDS) {
    if (hasStandaloneKeyword(lower, kw)) {
      const fromList = materials.find((m) =>
        m.name.toLowerCase().includes(kw)
      );
      return fromList?.name ?? kw.toUpperCase();
    }
  }
  for (const kw of SHORT_MATERIAL_KEYWORDS) {
    if (hasStandaloneKeyword(lower, kw)) {
      const fromList = materials.find((m) =>
        m.name.toLowerCase() === kw || m.name.toLowerCase().includes(` ${kw}`)
      );
      return fromList?.name ?? kw.toUpperCase();
    }
  }
  return undefined;
}

const TR_MONTHS: Record<string, number> = {
  ocak: 1, subat: 2, şubat: 2, mart: 3, nisan: 4, mayis: 5, mayıs: 5,
  haziran: 6, temmuz: 7, agustos: 8, ağustos: 8, eylul: 9, eylül: 9,
  ekim: 10, kasim: 11, kasım: 11, aralik: 12, aralık: 12,
};

function findTitle(text: string): string | undefined {
  const specific = text.match(
    /\b(di[sş]li\s*set(?:i)?|telefon\s*tutucu|prototip\s*\w*|sensor\s*\w*|drone\s*\w*|klips\s*\w*|bracket\s*\w*|flan[sş]\w*|maket\s*\w*)/i
  );
  if (specific) {
    const raw = specific[1].split(/[,.!?]/)[0].trim();
    if (raw.length >= 3 && raw.length <= 60) {
      return raw.replace(/\s+set$/i, " seti");
    }
  }

  const piece = text.match(
    /(?:^|[^a-zçğıöşüA-ZÇĞİÖŞÜ])([a-zçğıöşüA-ZÇĞİÖŞÜ]{3,})\s+parça(?:s[ıi])?(?=$|[^a-zçğıöşü])/i
  );
  if (piece) {
    const noun = piece[1];
    const skip = /^(teslim|termin|musteri|tarih|gram|basilacak)$/;
    if (!skip.test(normalizeTr(noun))) {
      return `${noun.toLowerCase()} parçası`;
    }
  }

  const generic = text.match(
    /(?:sipari[sş]|baskı|basim)\s*[:\-]?\s*([a-zçğıöşü0-9\s\-]{3,40})/i
  );
  if (generic) {
    const raw = generic[1]
      .split(/\s+(?:teslim|termin|gram|müşteri|musteri|\d)/i)[0]
      .trim();
    if (raw.length >= 3 && raw.length <= 60) return raw;
  }

  return undefined;
}

/** 3.800 → 3800, 4,5 → 4.5 (TR binlik/ondalık) */
function parseTurkishNumber(raw: string): number {
  const s = raw.trim().replace(/\s/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    return parseFloat(s.replace(/\./g, "").replace(",", "."));
  }
  if (/^\d+,\d+$/.test(s)) {
    return parseFloat(s.replace(",", "."));
  }
  return parseFloat(s.replace(",", "."));
}

function findRevenue(text: string): number | undefined {
  const lower = text.toLowerCase();
  const amount = `(\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?)`;

  const paidMatch = lower.match(
    new RegExp(
      `${amount}\\s*(?:tl|lira|₺)\\s*(?:ödendi|ödedi|odedi|odendi|aldi|aldı|alindi|alındı|alındı)`,
      "i"
    )
  );
  const remainingMatch = lower.match(
    new RegExp(
      `${amount}\\s*(?:tl|lira|₺)\\s*(?:daha\\s+(?:alınacak|alinacak|ödenecek|odenecek|ödeyecek|odeyecek)|kalan|kalacak)`,
      "i"
    )
  );
  if (paidMatch && remainingMatch) {
    return parseTurkishNumber(paidMatch[1]) + parseTurkishNumber(remainingMatch[1]);
  }

  const matches = [
    ...lower.matchAll(new RegExp(`${amount}\\s*(?:tl|lira|₺|try)\\b`, "gi")),
    ...lower.matchAll(
      new RegExp(
        `(?:tutar|ucret|ücret|fiyat|kazanc|kazanç|ödendi|odendi)\\s*[:\\-]?\\s*${amount}`,
        "gi"
      )
    ),
  ];

  if (!matches.length) return undefined;

  const values = matches.map((m) => parseTurkishNumber(m[1])).filter((n) => !Number.isNaN(n));
  return values.length ? Math.max(...values) : undefined;
}

function findGrams(text: string): number | undefined {
  const lower = text.toLowerCase();
  const matches = [
    ...lower.matchAll(/(\d+(?:[.,]\d+)?)\s*gram/gi),
    ...lower.matchAll(/(\d+(?:[.,]\d+)?)\s*gram@/gi),
    ...lower.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:gr)\b/gi),
    ...lower.matchAll(/(\d+(?:[.,]\d+)?)\s*kg\b/gi),
  ];

  if (!matches.length) return undefined;

  let best = 0;
  for (const m of matches) {
    let grams = parseTurkishNumber(m[1]);
    if (/kg\b/i.test(m[0])) grams *= 1000;
    if (grams > best && grams <= 50000) best = Math.round(grams);
  }
  return best || undefined;
}

function findDeliveryDate(text: string): string | undefined {
  const lower = text.toLowerCase();
  const today = new Date();

  if (/\byarin\b|\byarın\b/.test(lower)) {
    return format(addDays(today, 1), "yyyy-MM-dd");
  }
  if (/\bbug[uü]n\b/.test(lower) && /teslim|termin/.test(lower)) {
    return format(today, "yyyy-MM-dd");
  }

  const daysLater = lower.match(/(\d+)\s*g[uü]n\s*(?:sonra|i[cç]inde)/);
  if (daysLater && /teslim|termin/.test(lower)) {
    return format(addDays(today, parseInt(daysLater[1], 10)), "yyyy-MM-dd");
  }

  const isoMatch = text.match(
    /(?:teslim|termin)(?:\s*tarihi)?\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})/i
  );
  if (isoMatch) return isoMatch[1];

  const dmyMatch = text.match(
    /(?:teslim|termin)(?:\s*tarihi)?\s*[:\-]?\s*(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/i
  );
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = dmyMatch[3]
      ? parseInt(dmyMatch[3].length === 2 ? `20${dmyMatch[3]}` : dmyMatch[3], 10)
      : today.getFullYear();
    return format(new Date(year, month - 1, day), "yyyy-MM-dd");
  }

  const monthNameMatch = text.match(
    /(?:teslim|termin)(?:\s*tarihi)?\s*(\d{1,2})\s+([a-zçğıöşüA-ZÇĞİÖŞÜ]+)(?:\s+(\d{4}))?/i
  );
  if (monthNameMatch) {
    const day = parseInt(monthNameMatch[1], 10);
    const monthKey = normalizeTr(monthNameMatch[2]);
    const month = TR_MONTHS[monthKey];
    if (month) {
      let year = monthNameMatch[3]
        ? parseInt(monthNameMatch[3], 10)
        : today.getFullYear();
      if (!monthNameMatch[3] && month < today.getMonth() + 1) {
        year += 1;
      }
      return format(new Date(year, month - 1, day), "yyyy-MM-dd");
    }
  }

  return undefined;
}

function findStatus(text: string): JobStatus | undefined {
  const lower = text.toLowerCase();
  const norm = normalizeTr(text);

  if (/tasarimda|tasarımda|su anda tasarim|şu an tasarim/i.test(norm)) {
    return "in_progress";
  }
  if (
    /yapildi|yapıldı|basildi|basıldı/.test(norm) &&
    !/tasarimda|tasarımda|basilacak|basılacak|yapilacak|yapılacak/.test(norm)
  ) {
    return "completed";
  }

  for (const [keyword, status] of Object.entries(STATUS_KEYWORDS).sort(
    (a, b) => b[0].length - a[0].length
  )) {
    if (lower.includes(keyword) || norm.includes(normalizeTr(keyword))) {
      return status;
    }
  }

  return undefined;
}

function findColor(text: string, materialColors?: { color_name: string }[]): string | undefined {
  const renkMatch = text.match(/renk\s+([a-zçğıöşüA-ZÇĞİÖŞÜ]+)/i);
  if (renkMatch) return capitalizeColor(renkMatch[1].trim());

  const norm = normalizeTr(text);

  if (materialColors?.length) {
    const sorted = [...materialColors].sort(
      (a, b) => b.color_name.length - a.color_name.length
    );
    for (const c of sorted) {
      if (hasStandaloneKeyword(norm, normalizeTr(c.color_name))) return c.color_name;
    }
  }

  const common: [string, string][] = [
    ["antrasit", "Antrasit"],
    ["natural", "Natural"],
    ["seffaf", "Şeffaf"],
    ["kirmizi", "Kırmızı"],
    ["turuncu", "Turuncu"],
    ["siyah", "Siyah"],
    ["beyaz", "Beyaz"],
    ["yesil", "Yeşil"],
    ["altin", "Altın"],
    ["pembe", "Pembe"],
    ["mavi", "Mavi"],
    ["sari", "Sarı"],
    ["gri", "Gri"],
    ["mor", "Mor"],
  ];
  for (const [key, label] of common) {
    if (hasStandaloneKeyword(norm, key)) return label;
  }

  return undefined;
}

function capitalizeColor(raw: string): string {
  const norm = normalizeTr(raw);
  const map: Record<string, string> = {
    siyah: "Siyah",
    beyaz: "Beyaz",
    kirmizi: "Kırmızı",
    mavi: "Mavi",
    yesil: "Yeşil",
    gri: "Gri",
    altin: "Altın",
    seffaf: "Şeffaf",
  };
  return map[norm] ?? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function findDurationMinutes(text: string): number | undefined {
  const lower = text.toLowerCase();
  const norm = normalizeTr(text);

  const hourMin = norm.match(/(\d+(?:[.,]\d+)?)\s*saat\s*(\d+)\s*(?:dakika|dk)/);
  if (hourMin) {
    return Math.round(parseTurkishNumber(hourMin[1]) * 60 + parseInt(hourMin[2], 10));
  }

  const hours = [...norm.matchAll(/(\d+(?:[.,]\d+)?)\s*saat/g)];
  if (hours.length) {
    const total = hours.reduce((s, m) => s + parseTurkishNumber(m[1]), 0);
    return Math.round(total * 60);
  }

  const minutes = [...lower.matchAll(/(\d+)\s*(?:dakika|dk)\b/g)];
  if (minutes.length) {
    return minutes.reduce((s, m) => s + parseInt(m[1], 10), 0);
  }

  const sureMatch = norm.match(/(?:sure|süre|calisma|çalışma)\s*[:.]?\s*(\d+(?:[.,]\d+)?)\s*(saat|dakika|dk|sa)/);
  if (sureMatch) {
    const val = parseTurkishNumber(sureMatch[1]);
    return /saat|sa\b/.test(sureMatch[2]) ? Math.round(val * 60) : Math.round(val);
  }

  return undefined;
}

const SOURCE_KEYWORDS: [RegExp, string][] = [
  [/instagram(?:dan|\'dan| uzerinden| üzerinden)?/i, "Instagram"],
  [/facebook(?:tan|\'tan)?/i, "Facebook"],
  [/google(?:\'dan|dan)?/i, "Google"],
  [/(?:tavsiye|referans)\s*(?:ile|uzerinden|üzerinden)?/i, "Tavsiye"],
  [/fuardan|fuar(?:dan)?/i, "Fuar"],
  [/web\s*sites/i, "Web sitesi"],
  [/sosyal\s*medya/i, "Instagram"],
];

function findCustomerSource(text: string): string | undefined {
  const norm = normalizeTr(text);
  for (const [pattern, label] of SOURCE_KEYWORDS) {
    if (pattern.test(text) || pattern.test(norm)) return label;
  }
  const explicit = text.match(
    /(?:kaynak|nereden|source)\s*[:.]?\s*([a-zçğıöşüA-ZÇĞİÖŞÜ0-9\s]{2,30})/i
  );
  if (explicit) return explicit[1].trim();
  return undefined;
}

function findReferral(text: string, customers: { name: string }[]): string | undefined {
  const possessiveMatches = [
    ...text.matchAll(
      /(?:^|\s)([A-Za-zÇçĞğİıÖöŞşÜü]{2,})'?(?:in|ın|un|ün|nin|nın|nun|nün)\s*(?:referans|yönlendirme|yonlendirme|tavsiye)(?:si|sı)?(?:yla| ile| uzerinden| üzerinden)?/gi
    ),
  ];
  if (possessiveMatches.length) {
    const name = possessiveMatches[possessiveMatches.length - 1][1]?.trim();
    if (name && !/m[uü]şteri|ad[ıi]/i.test(name)) {
      return matchCustomerInList(name, customers) ?? name;
    }
  }

  const explicit = text.match(
    /(?:referans|yönlendirme|yonlendirme|tavsiye)\s*(?:[:.]?\s*(?:ile|uzerinden|üzerinden)\s*)?([A-Za-zÇçĞğİıÖöŞşÜü][A-Za-zÇçĞğİıÖöŞşÜü\s]{1,40})/i
  );
  if (explicit) {
    const name = extractSpokenCustomerName(explicit[1]);
    if (name.length >= 2 && !/m[uü]şteri|ad[ıi]/i.test(name)) {
      return matchCustomerInList(name, customers) ?? name;
    }
  }
  return undefined;
}

function findAmountPaid(text: string): number | undefined {
  const lower = text.toLowerCase();
  const amount = `(\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?)`;
  const patterns = [
    new RegExp(`${amount}\\s*(?:tl|lira|₺)\\s*(?:ödendi|ödedi|odedi|odendi|aldi|aldı|alindi|alındı|peşin|pesin)`, "i"),
    new RegExp(`(?:ödenen|odenen|peşin|pesin|kapora)\\s*[:.]?\\s*${amount}`, "i"),
  ];
  for (const p of patterns) {
    const m = lower.match(p);
    if (m) return parseTurkishNumber(m[1]);
  }
  return undefined;
}

function findAmountRemaining(text: string): number | undefined {
  const lower = text.toLowerCase();
  const amount = `(\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?)`;
  const patterns = [
    new RegExp(`${amount}\\s*(?:tl|lira|₺)\\s*(?:daha\\s+(?:alınacak|alinacak|ödenecek|odenecek|ödeyecek|odeyecek)|kalan|kalacak)`, "i"),
    new RegExp(`(?:kalan|kalacak)\\s*[:.]?\\s*${amount}`, "i"),
  ];
  for (const p of patterns) {
    const m = lower.match(p);
    if (m) return parseTurkishNumber(m[1]);
  }
  return undefined;
}

function findPaymentDueDate(text: string): string | undefined {
  const lower = text.toLowerCase();
  const today = new Date();

  if (/ay\s*sonu|ay\s*sonunda/.test(lower) && /ödeme|odeme/.test(lower)) {
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return format(end, "yyyy-MM-dd");
  }

  const isoMatch = text.match(
    /(?:ödeme|odeme)(?:\s*tarihi)?\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})/i
  );
  if (isoMatch) return isoMatch[1];

  const dmyMatch = text.match(
    /(?:ödeme|odeme)(?:\s*tarihi)?\s*[:\-]?\s*(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/i
  );
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = dmyMatch[3]
      ? parseInt(dmyMatch[3].length === 2 ? `20${dmyMatch[3]}` : dmyMatch[3], 10)
      : today.getFullYear();
    return format(new Date(year, month - 1, day), "yyyy-MM-dd");
  }

  const monthNameMatch = text.match(
    /(?:ödeme|odeme)(?:\s*tarihi)?\s*(\d{1,2})\s+([a-zçğıöşüA-ZÇĞİÖŞÜ]+)(?:\s+(\d{4}))?/i
  );
  if (monthNameMatch) {
    const day = parseInt(monthNameMatch[1], 10);
    const monthKey = normalizeTr(monthNameMatch[2]);
    const month = TR_MONTHS[monthKey];
    if (month) {
      let year = monthNameMatch[3]
        ? parseInt(monthNameMatch[3], 10)
        : today.getFullYear();
      if (!monthNameMatch[3] && month < today.getMonth() + 1) year += 1;
      return format(new Date(year, month - 1, day), "yyyy-MM-dd");
    }
  }

  return undefined;
}

function findInstallments(text: string): { count?: number; amount?: number } {
  const lower = text.toLowerCase();
  const result: { count?: number; amount?: number } = {};

  const countMatch = lower.match(/(\d+)\s*taksit/);
  if (countMatch) result.count = parseInt(countMatch[1], 10);

  const monthlyMatch = lower.match(
    /(?:ayda|her\s*ay|aylik|aylık)\s*(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)\s*(?:tl|lira|₺)?/
  );
  if (monthlyMatch) result.amount = parseTurkishNumber(monthlyMatch[1]);

  return result;
}

function findPaymentStatus(
  text: string,
  amountPaid?: number,
  amountRemaining?: number,
  paymentDueDate?: string
): PaymentStatus | undefined {
  const norm = normalizeTr(text);

  if (/tam\s*odendi|tam\s*ödendi|pesin|peşin|tamami\s*odendi|tamamı\s*ödendi/.test(norm)) {
    return "paid";
  }
  if (/odenmedi|ödenmedi|odeme\s*alınmadı|odeme\s*alinmadi|hic\s*odeme|hiç\s*ödeme/.test(norm)) {
    return "unpaid";
  }
  if (
    amountPaid != null &&
    amountRemaining != null &&
    amountPaid > 0 &&
    amountRemaining > 0
  ) {
    return "partial";
  }
  if (/kismi|kısmi|yarisini|yarısını|yari\s*odendi|yarı\s*ödendi/.test(norm)) {
    return "partial";
  }
  if (paymentDueDate || /odeme\s*tarihi|ödeme\s*tarihi|ay\s*sonu/.test(norm)) {
    return "upcoming";
  }
  if (amountPaid != null && amountPaid > 0 && !amountRemaining) {
    return "paid";
  }
  return undefined;
}

function findMachine(
  text: string,
  machines: { name: string }[]
): string | undefined {
  const lower = text.toLowerCase();
  const sorted = [...machines].sort((a, b) => b.name.length - a.name.length);
  for (const m of sorted) {
    if (lower.includes(m.name.toLowerCase())) return m.name;
    const first = m.name.split(/\s+/)[0];
    if (first.length >= 4 && lower.includes(first.toLowerCase())) return m.name;
  }
  const explicit = text.match(
    /(?:makine|printer|yazici|yazıcı)\s*[:.]?\s*([A-Za-zÇçĞğİıÖöŞşÜü0-9#\s.]{2,40})/i
  );
  if (explicit) return explicit[1].trim();
  return undefined;
}

function findFaultType(
  text: string,
  faultTypes: { name: string }[] = []
): string | undefined {
  const norm = normalizeTr(text);
  const sorted = [...faultTypes].sort((a, b) => b.name.length - a.name.length);
  for (const ft of sorted) {
    if (hasStandaloneKeyword(norm, normalizeTr(ft.name))) return ft.name;
  }

  const presets: [RegExp, string][] = [
    [/nozzle\s*tikan|nozzle\s*tıkan/i, "Nozzle tıkanması"],
    [/filament\s*kop|filament\s*kop/i, "Filament kopması"],
    [/isitici|ısıtıcı|heater/i, "Isıtıcı arızası"],
    [/motor\s*ariza|motor\s*arıza/i, "Motor arızası"],
    [/kalibrasyon/i, "Kalibrasyon"],
    [/elektronik/i, "Elektronik arıza"],
    [/mekanik/i, "Mekanik arıza"],
  ];
  for (const [pattern, label] of presets) {
    if (pattern.test(text) || pattern.test(norm)) return label;
  }

  const explicit = text.match(
    /(?:ariza\s*tipi|arıza\s*tipi|sorun\s*tipi|hata\s*tipi)\s*[:.]?\s*([a-zçğıöşüA-ZÇĞİÖŞÜ0-9\s]{2,40})/i
  );
  if (explicit) return explicit[1].trim();
  return undefined;
}

function findFaultDurationHours(text: string): number | undefined {
  const norm = normalizeTr(text);
  const hourMatch = norm.match(/(\d+(?:[.,]\d+)?)\s*saat/);
  if (hourMatch) return parseTurkishNumber(hourMatch[1]);

  const minMatch = norm.match(/(\d+)\s*(?:dakika|dk)/);
  if (minMatch) return parseInt(minMatch[1], 10) / 60;

  const downtime = norm.match(/(?:durus|duruş|ariza\s*suresi|arıza\s*süresi)\s*[:.]?\s*(\d+(?:[.,]\d+)?)\s*(saat|dakika|dk|sa)/);
  if (downtime) {
    const val = parseTurkishNumber(downtime[1]);
    return /saat|sa\b/.test(downtime[2]) ? val : val / 60;
  }
  return undefined;
}

function findFaultDate(text: string): string | undefined {
  const lower = text.toLowerCase();
  const today = new Date();
  if (/\bd[uü]n\b|\bbug[uü]n\b/.test(lower)) return format(today, "yyyy-MM-dd");
  if (/\bd[uü]n\b|\bdun\b/.test(lower)) return format(addDays(today, -1), "yyyy-MM-dd");

  const isoMatch = text.match(/(?:tarih|ariza\s*tarihi|arıza\s*tarihi)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})/i);
  if (isoMatch) return isoMatch[1];
  return undefined;
}

function findFaultStatus(text: string): FaultStatus | undefined {
  const norm = normalizeTr(text);
  if (/cozuldu|çözüldü|tamamlandi|tamamlandı|duzeltildi|düzeltildi/.test(norm)) return "resolved";
  if (/devam|cozuluyor|çözülüyor|bakimda|bakımda/.test(norm)) return "in_progress";
  if (/acik|açık|yeni\s*ariza|yeni\s*arıza/.test(norm)) return "open";
  return undefined;
}

export function parseTurkishNote(
  text: string,
  materials: { name: string; material_colors?: { color_name: string }[] }[] = [],
  customers: { name: string }[] = []
): ParsedNoteData {
  const cleaned = cleanVoiceText(text);
  const result: ParsedNoteData = {};

  result.grams = findGrams(cleaned);
  result.revenue = findRevenue(cleaned);
  result.material = findMaterial(cleaned, materials);
  result.color = findColor(
    cleaned,
    result.material
      ? materials.find((m) => m.name.toLowerCase() === result.material!.toLowerCase())
          ?.material_colors
      : undefined
  );
  result.customer = findCustomer(cleaned, customers);
  result.deliveryDate = findDeliveryDate(cleaned);
  result.status = findStatus(cleaned);
  result.title = findTitle(cleaned);
  result.durationMinutes = findDurationMinutes(cleaned);
  result.customerSource = findCustomerSource(cleaned);
  result.referral = findReferral(cleaned, customers);

  result.amountPaid = findAmountPaid(cleaned);
  result.amountRemaining = findAmountRemaining(cleaned);
  result.paymentDueDate = findPaymentDueDate(cleaned);
  const installments = findInstallments(cleaned);
  result.installmentCount = installments.count;
  result.installmentAmount = installments.amount;
  result.paymentStatus = findPaymentStatus(
    cleaned,
    result.amountPaid,
    result.amountRemaining,
    result.paymentDueDate
  );

  return result;
}

const PROCUREMENT_CHANNELS = [
  { keys: ["trendyol"], label: "Trendyol" },
  { keys: ["hepsiburada", "hepsi burada"], label: "Hepsiburada" },
  { keys: ["amazon"], label: "Amazon" },
  { keys: ["n11"], label: "N11" },
  { keys: ["direkt", "yerel", "mağaza"], label: "Direkt" },
];

function findProcurementChannel(text: string): string | undefined {
  const norm = normalizeTr(text);
  for (const ch of PROCUREMENT_CHANNELS) {
    if (ch.keys.some((k) => norm.includes(normalizeTr(k)))) return ch.label;
  }
  const m = text.match(/kanal\s+([A-Za-zÇçĞğİıÖöŞşÜü0-9\s]{2,30})/i);
  return m?.[1]?.trim();
}

function findSupplier(
  text: string,
  suppliers: { name: string }[]
): string | undefined {
  const norm = normalizeTr(text);
  for (const s of suppliers) {
    if (norm.includes(normalizeTr(s.name))) return s.name;
  }
  const m = text.match(/tedarik[cç]i\s+([A-Za-zÇçĞğİıÖöŞşÜü0-9\s.&-]{2,40})/i);
  if (m) return m[1].trim().split(/\s+(?:den|dan|için)\s/i)[0].trim();
  return undefined;
}

function findUnitPrice(text: string): number | undefined {
  const m = text.match(/birim\s*(?:fiyat|ücret|ucret)?\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(?:tl|lira|₺)?/i);
  if (m) return parseFloat(m[1].replace(",", "."));
  const perKg = text.match(/(\d+(?:[.,]\d+)?)\s*(?:tl|lira|₺)?\s*(?:\/|per)\s*kg/i);
  if (perKg) return parseFloat(perKg[1].replace(",", "."));
  return undefined;
}

function findQuantity(text: string): number | undefined {
  const m = text.match(/(\d+)\s*(?:adet|tane|parça|parca)\b/i);
  if (m) return parseInt(m[1], 10);
  const sold = text.match(/sat[ıi]ld[ıi]\s*(\d+)/i);
  if (sold) return parseInt(sold[1], 10);
  return undefined;
}

function findSku(text: string): string | undefined {
  const m = text.match(/\bsku\s*[:=]?\s*([A-Za-z0-9_-]{2,24})\b/i);
  return m?.[1];
}

function findCatalogName(text: string): string | undefined {
  const m = text.match(/(?:ürün|urun|katalog)\s+(?:ad[ıi]\s+)?([A-Za-zÇçĞğİıÖöŞşÜü0-9\s.-]{2,50})/i);
  if (m) return m[1].trim().split(/\s+(?:sku|petg|pla)\b/i)[0].trim();
  return undefined;
}

function findCarrier(text: string): string | undefined {
  const carriers = ["yurtiçi", "yurtici", "aras", "mng", "ptt", "sürat", "surat", "ups", "dhl"];
  const norm = normalizeTr(text);
  for (const c of carriers) {
    if (norm.includes(c)) {
      if (c === "yurtici" || c === "yurtiçi") return "Yurtiçi Kargo";
      if (c === "surat" || c === "sürat") return "Sürat Kargo";
      return c.toUpperCase();
    }
  }
  const m = text.match(/kargo\s+([A-Za-zÇçĞğİıÖöŞşÜü\s]{2,25})/i);
  return m?.[1]?.trim();
}

function findTrackingNumber(text: string): string | undefined {
  const m = text.match(/takip\s*(?:no|numaras[ıi])?\s*[:=]?\s*([A-Za-z0-9]{8,24})/i);
  return m?.[1];
}

export function parseProcurementNote(
  text: string,
  materials: { id?: string; name: string; material_colors?: { color_name: string }[] }[] = [],
  suppliers: { name: string }[] = []
): ParsedProcurementData {
  const cleaned = cleanVoiceText(text);
  const mat = findMaterial(cleaned, materials);
  const matRow = mat ? materials.find((m) => m.name === mat) : undefined;
  const grams = findGrams(cleaned);
  const unitPrice = findUnitPrice(cleaned);
  const total = findRevenue(cleaned);
  return {
    supplier: findSupplier(cleaned, suppliers),
    material: mat,
    color: matRow ? findColor(cleaned, matRow.material_colors) : findColor(cleaned),
    grams,
    unitPrice,
    total: total ?? (unitPrice != null && grams != null ? Math.round((unitPrice * grams) / 1000 * 100) / 100 : undefined),
    purchaseDate: findDeliveryDate(cleaned) ?? findFaultDate(cleaned),
    channel: findProcurementChannel(cleaned),
    invoiceRef: cleaned.match(/fatura\s*(?:no|ref)?\s*[:=]?\s*([A-Za-z0-9-]{3,30})/i)?.[1],
    notes: cleaned.length > 8 ? cleaned : undefined,
  };
}

export function parseCatalogNote(
  text: string,
  materials: { name: string }[] = []
): ParsedCatalogData {
  const cleaned = cleanVoiceText(text);
  const tagsMatch = cleaned.match(/etiket(?:ler)?\s+([A-Za-zÇçĞğİıÖöŞşÜü0-9,\s]+)/i);
  const tags = tagsMatch
    ? tagsMatch[1].split(/[,;]/).map((t) => t.trim()).filter(Boolean)
    : undefined;
  return {
    sku: findSku(cleaned),
    name: findCatalogName(cleaned) ?? findTitle(cleaned),
    material: findMaterial(cleaned, materials),
    grams: findGrams(cleaned),
    tags,
  };
}

export function parseSaleNote(
  text: string,
  customers: { name: string }[] = [],
  catalogItems: { sku: string; name: string }[] = []
): ParsedSaleData {
  const cleaned = cleanVoiceText(text);
  const sku = findSku(cleaned);
  let itemName: string | undefined;
  if (sku) {
    const item = catalogItems.find((c) => c.sku.toLowerCase() === sku.toLowerCase());
    if (item) itemName = item.name;
  }
  if (!itemName) {
    for (const item of catalogItems) {
      if (normalizeTr(cleaned).includes(normalizeTr(item.name))) {
        itemName = item.name;
        break;
      }
    }
  }
  const platformMatch = cleaned.match(/platform\s+([A-Za-zÇçĞğİıÖöŞşÜü0-9\s]+)/i);
  return {
    sku,
    itemName,
    customer: findCustomer(cleaned, customers),
    channel: findProcurementChannel(cleaned) ?? findCustomerSource(cleaned),
    platform: platformMatch?.[1]?.trim(),
    unitPrice: findRevenue(cleaned),
    quantity: findQuantity(cleaned) ?? 1,
    carrier: findCarrier(cleaned),
    trackingNumber: findTrackingNumber(cleaned),
  };
}

export interface ProcurementVoiceFormResult {
  supplierId?: string;
  supplierName?: string;
  materialId?: string;
  materialName?: string;
  materialColorId?: string;
  colorName?: string;
  grams?: string;
  unitPrice?: string;
  total?: string;
  purchaseDate?: string;
  channel?: string;
  invoiceRef?: string;
  notes?: string;
  matched: string[];
  fieldConfidence?: VoiceFieldConfidence;
}

export function mapProcurementVoiceToFormFields(
  text: string,
  materials: { id: string; name: string; material_colors?: { id: string; color_name: string }[] }[],
  suppliers: { id: string; name: string }[]
): ProcurementVoiceFormResult {
  const parsed = parseProcurementNote(text, materials, suppliers);
  const matched: string[] = [];
  const result: ProcurementVoiceFormResult = { matched };

  if (parsed.supplier) {
    result.supplierName = parsed.supplier;
    const s = suppliers.find((x) => namesEqual(x.name, parsed.supplier!));
    if (s) {
      result.supplierId = s.id;
      matched.push("Tedarikçi");
    } else matched.push(`Tedarikçi (${parsed.supplier})`);
  }
  if (parsed.material) {
    result.materialName = parsed.material;
    const matId = resolveMaterialId(parsed.material, materials);
    if (matId) {
      result.materialId = matId;
      matched.push("Malzeme");
      const mat = materials.find((m) => m.id === matId);
      if (parsed.color && mat?.material_colors?.length) {
        result.colorName = parsed.color;
        const color = mat.material_colors.find((c) =>
          namesEqual(c.color_name, parsed.color!)
        );
        if (color) {
          result.materialColorId = color.id;
          matched.push("Renk");
        }
      }
    }
  }
  if (parsed.grams != null) {
    result.grams = String(parsed.grams);
    matched.push("Gram");
  }
  if (parsed.unitPrice != null) {
    result.unitPrice = String(parsed.unitPrice);
    matched.push("Birim fiyat");
  }
  if (parsed.total != null) {
    result.total = String(parsed.total);
    matched.push("Toplam");
  }
  if (parsed.purchaseDate) {
    result.purchaseDate = parsed.purchaseDate;
    matched.push("Tarih");
  }
  if (parsed.channel) {
    result.channel = parsed.channel;
    matched.push("Kanal");
  }
  if (parsed.invoiceRef) {
    result.invoiceRef = parsed.invoiceRef;
    matched.push("Fatura");
  }
  if (parsed.notes) result.notes = parsed.notes;
  result.fieldConfidence = confidenceFromMatchedLabels(matched, {
    Tedarikçi: !!result.supplierId,
    Malzeme: !!result.materialId,
    Renk: !!result.materialColorId,
  });
  return result;
}

export interface CatalogVoiceFormResult {
  sku?: string;
  name?: string;
  description?: string;
  defaultMaterialId?: string;
  defaultGrams?: string;
  tags?: string;
  matched: string[];
  fieldConfidence?: VoiceFieldConfidence;
}

export function mapCatalogVoiceToFormFields(
  text: string,
  materials: { id: string; name: string }[]
): CatalogVoiceFormResult {
  const parsed = parseCatalogNote(text, materials);
  const matched: string[] = [];
  const result: CatalogVoiceFormResult = { matched };
  if (parsed.sku) {
    result.sku = parsed.sku;
    matched.push("SKU");
  }
  if (parsed.name) {
    result.name = parsed.name;
    matched.push("Ürün adı");
  }
  if (parsed.material) {
    const id = resolveMaterialId(parsed.material, materials);
    if (id) {
      result.defaultMaterialId = id;
      matched.push("Malzeme");
    }
  }
  if (parsed.grams != null) {
    result.defaultGrams = String(parsed.grams);
    matched.push("Gram");
  }
  if (parsed.tags?.length) {
    result.tags = parsed.tags.join(", ");
    matched.push("Etiket");
  }
  result.fieldConfidence = confidenceFromMatchedLabels(matched, {
    Malzeme: !!result.defaultMaterialId,
  });
  return result;
}

export interface SaleVoiceFormResult {
  itemId?: string;
  customerId?: string;
  channel?: string;
  platform?: string;
  unitPrice?: string;
  quantity?: string;
  carrier?: string;
  trackingNumber?: string;
  matched: string[];
  fieldConfidence?: VoiceFieldConfidence;
}

export function mapSaleVoiceToFormFields(
  text: string,
  customers: { id: string; name: string }[],
  catalogItems: { id: string; sku: string; name: string }[]
): SaleVoiceFormResult {
  const parsed = parseSaleNote(text, customers, catalogItems);
  const matched: string[] = [];
  const result: SaleVoiceFormResult = { matched };
  if (parsed.sku || parsed.itemName) {
    const item = catalogItems.find(
      (c) =>
        (parsed.sku && c.sku.toLowerCase() === parsed.sku.toLowerCase()) ||
        (parsed.itemName && namesEqual(c.name, parsed.itemName))
    );
    if (item) {
      result.itemId = item.id;
      matched.push("Ürün");
    } else if (parsed.itemName) matched.push(`Ürün (${parsed.itemName})`);
  }
  if (parsed.customer) {
    const id = resolveCustomerId(parsed.customer, customers);
    if (id) {
      result.customerId = id;
      matched.push("Müşteri");
    }
  }
  if (parsed.channel) {
    result.channel = parsed.channel;
    matched.push("Kanal");
  }
  if (parsed.platform) {
    result.platform = parsed.platform;
    matched.push("Platform");
  }
  if (parsed.unitPrice != null) {
    result.unitPrice = String(parsed.unitPrice);
    matched.push("Fiyat");
  }
  if (parsed.quantity != null) {
    result.quantity = String(parsed.quantity);
    matched.push("Adet");
  }
  if (parsed.carrier) {
    result.carrier = parsed.carrier;
    matched.push("Kargo");
  }
  if (parsed.trackingNumber) {
    result.trackingNumber = parsed.trackingNumber;
    matched.push("Takip no");
  }
  result.fieldConfidence = confidenceFromMatchedLabels(matched, {
    Ürün: !!result.itemId,
    Müşteri: !!result.customerId,
  });
  return result;
}

export interface CustomerVoiceFormResult {
  name?: string;
  source?: string;
  referral?: string;
  referredByCustomerId?: string;
  matched: string[];
  fieldConfidence?: VoiceFieldConfidence;
}

/** Müşteri formu için sesli giriş (referans → referred_by_customer_id) */
export function mapCustomerVoiceToFormFields(
  text: string,
  customers: { id: string; name: string }[]
): CustomerVoiceFormResult {
  const parsed = parseTurkishNote(text, [], customers);
  const matched: string[] = [];
  const result: CustomerVoiceFormResult = { matched };

  const nameMatch = text.match(
    /m[uü]şteri(?:\s+ad[ıi])?\s+([A-Za-zÇçĞğİıÖöŞşÜü][A-Za-zÇçĞğİıÖöŞşÜü\s]{1,50})/i
  );
  if (nameMatch) {
    const spoken = extractSpokenCustomerName(
      nameMatch[1].split(/\s+referans\b|\s+kaynak\b/i)[0]
    );
    if (spoken.length >= 2) {
      result.name = spoken;
      matched.push("Ad");
    }
  } else if (parsed.customer) {
    result.name = parsed.customer;
    matched.push("Ad");
  }

  if (parsed.customerSource) {
    result.source = parsed.customerSource;
    matched.push("Kaynak");
  }
  if (parsed.referral) {
    result.referral = parsed.referral;
    const refId = resolveCustomerId(parsed.referral, customers);
    if (refId) {
      result.referredByCustomerId = refId;
      matched.push("Referans müşteri");
    } else {
      matched.push(`Referans (${parsed.referral})`);
    }
  }

  result.fieldConfidence = confidenceFromMatchedLabels(matched, {
    "Referans müşteri": !!result.referredByCustomerId,
  });
  return result;
}

export function parseFaultNote(
  text: string,
  machines: { name: string }[] = [],
  faultTypes: { name: string }[] = []
): ParsedFaultData {
  const cleaned = cleanVoiceText(text);
  return {
    machine: findMachine(cleaned, machines),
    faultType: findFaultType(cleaned, faultTypes),
    durationHours: findFaultDurationHours(cleaned),
    faultDate: findFaultDate(cleaned),
    status: findFaultStatus(cleaned),
    description: cleaned.length > 10 ? cleaned : undefined,
  };
}

export interface VoiceFormApplyResult {
  customerId?: string;
  materialId?: string;
  materialColorId?: string;
  gramsUsed?: string;
  revenueAmount?: string;
  status?: JobStatus;
  title?: string;
  description?: string;
  deliveryDate?: string;
  customerName?: string;
  materialName?: string;
  colorName?: string;
  durationMinutes?: string;
  paymentStatus?: PaymentStatus;
  amountPaid?: string;
  amountRemaining?: string;
  paymentDueDate?: string;
  installmentCount?: string;
  installmentAmount?: string;
  customerSource?: string;
  referral?: string;
  referredByCustomerId?: string;
  createCustomer?: boolean;
  matched: string[];
  fieldConfidence?: VoiceFieldConfidence;
}

export interface FaultVoiceFormResult {
  machineId?: string;
  machineName?: string;
  faultTypeId?: string;
  faultTypeName?: string;
  durationHours?: string;
  faultDate?: string;
  status?: FaultStatus;
  description?: string;
  matched: string[];
  fieldConfidence?: VoiceFieldConfidence;
}

function resolveMaterialId(
  materialName: string,
  materials: { id: string; name: string }[]
): string | undefined {
  return (
    materials.find((m) => m.name.toLowerCase() === materialName.toLowerCase())
      ?.id ??
    materials.find((m) =>
      m.name.toLowerCase().includes(materialName.toLowerCase())
    )?.id ??
    materials.find((m) =>
      materialName.toLowerCase().includes(m.name.toLowerCase())
    )?.id
  );
}

function resolveCustomerId(
  customerName: string,
  customers: { id: string; name: string }[]
): string | undefined {
  const matched = matchCustomerInList(customerName, customers) ?? customerName;
  return (
    customers.find((c) => c.name.toLowerCase() === matched.toLowerCase())?.id ??
    customers.find((c) => {
      const parts = customerName.toLowerCase().split(/\s+/);
      const nameParts = c.name.toLowerCase().split(/\s+/);
      return parts.every((p) => nameParts.some((np) => np.startsWith(p)));
    })?.id
  );
}

/** Ses metnini form alanlarına map eder */
export function mapVoiceToFormFields(
  text: string,
  materials: {
    id: string;
    name: string;
    material_colors?: { id: string; color_name: string }[];
  }[],
  customers: { id: string; name: string }[]
): VoiceFormApplyResult {
  const parsed = parseTurkishNote(text, materials, customers);
  const matched: string[] = [];
  const result: VoiceFormApplyResult = { matched };

  if (parsed.title) {
    result.title = parsed.title;
    matched.push("Başlık");
  }
  if (parsed.grams != null) {
    result.gramsUsed = String(parsed.grams);
    matched.push("Gram");
  }
  if (parsed.revenue != null) {
    result.revenueAmount = String(parsed.revenue);
    matched.push("Sipariş tutarı");
  }
  if (parsed.status) {
    result.status = parsed.status;
    matched.push("Durum");
  }
  if (parsed.material) {
    result.materialName = parsed.material;
    const matId = resolveMaterialId(parsed.material, materials);
    if (matId) {
      result.materialId = matId;
      matched.push("Malzeme");
      const mat = materials.find((m) => m.id === matId);
      if (parsed.color && mat?.material_colors?.length) {
        result.colorName = parsed.color;
        const color = mat.material_colors.find(
          (c) => c.color_name.toLowerCase() === parsed.color!.toLowerCase()
        ) ?? mat.material_colors.find((c) =>
          c.color_name.toLowerCase().includes(parsed.color!.toLowerCase()) ||
          parsed.color!.toLowerCase().includes(c.color_name.toLowerCase())
        );
        if (color) {
          result.materialColorId = color.id;
          matched.push("Renk");
        } else {
          matched.push(`Renk (${parsed.color})`);
        }
      }
    } else {
      matched.push(`Malzeme (${parsed.material})`);
    }
  } else if (parsed.color) {
    result.colorName = parsed.color;
    matched.push(`Renk (${parsed.color})`);
  }
  if (parsed.customer) {
    result.customerName = parsed.customer;
    const custId = resolveCustomerId(parsed.customer, customers);
    if (custId) {
      result.customerId = custId;
      matched.push("Müşteri");
    } else {
      matched.push(`Müşteri (${parsed.customer})`);
    }
  }
  if (parsed.deliveryDate) {
    result.deliveryDate = parsed.deliveryDate;
    matched.push("Teslim tarihi");
  }
  if (parsed.durationMinutes != null) {
    result.durationMinutes = String(parsed.durationMinutes);
    matched.push("Süre");
  }
  if (parsed.paymentStatus) {
    result.paymentStatus = parsed.paymentStatus;
    matched.push("Ödeme durumu");
  }
  if (parsed.amountPaid != null) {
    result.amountPaid = String(parsed.amountPaid);
    matched.push("Ödenen tutar");
  }
  if (parsed.amountRemaining != null) {
    result.amountRemaining = String(parsed.amountRemaining);
    matched.push("Kalan tutar");
  }
  if (parsed.paymentDueDate) {
    result.paymentDueDate = parsed.paymentDueDate;
    matched.push("Ödeme tarihi");
  }
  if (parsed.installmentCount != null) {
    result.installmentCount = String(parsed.installmentCount);
    matched.push("Taksit sayısı");
  }
  if (parsed.installmentAmount != null) {
    result.installmentAmount = String(parsed.installmentAmount);
    matched.push("Taksit tutarı");
  }
  if (parsed.customerSource) {
    result.customerSource = parsed.customerSource;
    matched.push("Müşteri kaynağı");
  }
  if (parsed.referral) {
    result.referral = parsed.referral;
    const refId = resolveCustomerId(parsed.referral, customers);
    if (refId) {
      result.referredByCustomerId = refId;
      matched.push("Referans müşteri");
    } else {
      matched.push(`Referans (${parsed.referral})`);
    }
  }
  if (parsed.customer && !result.customerId) {
    result.createCustomer = true;
  }

  result.fieldConfidence = confidenceFromMatchedLabels(matched, {
    Müşteri: !!result.customerId,
    Malzeme: !!result.materialId,
    Renk: !!result.materialColorId,
    "Referans müşteri": !!result.referredByCustomerId,
  });

  return result;
}

export function mapFaultVoiceToFormFields(
  text: string,
  machines: { id: string; name: string }[],
  faultTypes: { id: string; name: string }[] = []
): FaultVoiceFormResult {
  const parsed = parseFaultNote(text, machines, faultTypes);
  const matched: string[] = [];
  const result: FaultVoiceFormResult = { matched };

  if (parsed.machine) {
    result.machineName = parsed.machine;
    const machine = machines.find(
      (m) => m.name.toLowerCase() === parsed.machine!.toLowerCase()
    ) ?? machines.find((m) =>
      m.name.toLowerCase().includes(parsed.machine!.toLowerCase()) ||
      parsed.machine!.toLowerCase().includes(m.name.toLowerCase())
    );
    if (machine) {
      result.machineId = machine.id;
      matched.push("Makine");
    } else {
      matched.push(`Makine (${parsed.machine})`);
    }
  }
  if (parsed.faultType) {
    result.faultTypeName = parsed.faultType;
    const ft = faultTypes.find(
      (f) => f.name.toLowerCase() === parsed.faultType!.toLowerCase()
    );
    if (ft) {
      result.faultTypeId = ft.id;
      matched.push("Arıza tipi");
    } else {
      matched.push(`Arıza tipi (${parsed.faultType})`);
    }
  }
  if (parsed.durationHours != null) {
    result.durationHours = String(parsed.durationHours);
    matched.push("Süre");
  }
  if (parsed.faultDate) {
    result.faultDate = parsed.faultDate;
    matched.push("Tarih");
  }
  if (parsed.status) {
    result.status = parsed.status;
    matched.push("Durum");
  }
  if (parsed.description) {
    result.description = parsed.description;
  }

  result.fieldConfidence = confidenceFromMatchedLabels(matched, {
    Makine: !!result.machineId,
    "Arıza tipi": !!result.faultTypeId,
  });

  return result;
}
