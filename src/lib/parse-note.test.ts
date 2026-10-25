import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseTurkishNote,
  mapVoiceToFormFields,
  mapCustomerVoiceToFormFields,
  parseFaultNote,
  parseProcurementNote,
  mapProcurementVoiceToFormFields,
  parseCatalogNote,
  parseSaleNote,
} from "./parse-note";

const materials = [
  { id: "m1", name: "PETG" },
  { id: "m2", name: "PLA" },
  { id: "m3", name: "Silk PLA" },
  { id: "m4", name: "ASA" },
];

const customers = [
  { id: "c1", name: "Ahmet Yılmaz" },
  { id: "c2", name: "Ayşe Demir" },
  { id: "c3", name: "Mehmet Kaya" },
  { id: "c4", name: "Eyüp Mert" },
];

describe("parseTurkishNote", () => {
  it("gram ve malzeme çıkarır", () => {
    const r = parseTurkishNote("150 gram PETG ile basıldı", materials, customers);
    assert.equal(r.grams, 150);
    assert.equal(r.material, "PETG");
  });

  it("kg birimini grama çevirir", () => {
    const r = parseTurkishNote("0.5 kg PLA kullanıldı", materials, customers);
    assert.equal(r.grams, 500);
  });

  it("müşteri tam isim eşleşir", () => {
    const r = parseTurkishNote("müşteri Ahmet Yılmaz için tamamlandı", materials, customers);
    assert.equal(r.customer, "Ahmet Yılmaz");
    assert.equal(r.status, "completed");
  });

  it("müşteri kısmi isim eşleşir", () => {
    const r = parseTurkishNote("müşteri Ahmet için 200 gram", materials, customers);
    assert.equal(r.customer, "Ahmet Yılmaz");
  });

  it("sipariş tutarı parse eder", () => {
    const r = parseTurkishNote("450 lira PETG 120 gram müşteri Ayşe", materials, customers);
    assert.equal(r.revenue, 450);
    assert.equal(r.grams, 120);
    assert.equal(r.customer, "Ayşe Demir");
  });

  it("tl ve tutar keyword", () => {
    const r = parseTurkishNote("tutar 680 tl ASA", materials, customers);
    assert.equal(r.revenue, 680);
    assert.equal(r.material, "ASA");
  });

  it("yüksek tutar ve dişli seti başlığı", () => {
    const r = parseTurkishNote(
      "850 gram PETG müşteri adı Ahmet Yılmaz dişli seti 3800 TL alındı tamamlandı",
      materials,
      customers
    );
    assert.equal(r.grams, 850);
    assert.equal(r.revenue, 3800);
    assert.equal(r.customer, "Ahmet Yılmaz");
    assert.equal(r.title, "dişli seti");
    assert.equal(r.status, "completed");
  });

  it("STT hatalı pet c ve Eyüp Mert tam cümle", () => {
    const raw =
      "müşteri adı Eyüp Mert dişli set yapıldı teslim tarihi 28 Ağustos 450 gram@get g Pet c ile basıldı 3600 TL ödendi 4200 TL daha alınacak şu anda tasarımda";
    const r = parseTurkishNote(raw, materials, customers);
    assert.equal(r.customer, "Eyüp Mert");
    assert.equal(r.material, "PETG");
    assert.equal(r.grams, 450);
    assert.equal(r.revenue, 7800);
    assert.equal(r.title, "dişli seti");
    assert.equal(r.status, "in_progress");
    assert.ok(r.deliveryDate?.endsWith("-08-28"));
  });

  it("mapVoice Eyüp Mert STT cümlesi tüm alanları doldurur", () => {
    const raw =
      "müşteri adı Eyüp Mert dişli set yapıldı teslim tarihi 28 Ağustos 450 gram pet c ile basıldı 3600 TL ödendi 4200 TL daha alınacak şu anda tasarımda";
    const r = mapVoiceToFormFields(raw, materials, customers);
    assert.equal(r.customerId, "c4");
    assert.equal(r.materialId, "m1");
    assert.equal(r.gramsUsed, "450");
    assert.equal(r.revenueAmount, "7800");
    assert.equal(r.title, "dişli seti");
    assert.equal(r.status, "in_progress");
    assert.ok(r.matched.includes("Müşteri"));
    assert.ok(r.matched.includes("Malzeme"));
  });

  it("Türkçe binlik ayırıcı, araba parçası, siyah ve PA yanlış eşleşmez", () => {
    const raw =
      "müşteri adı Eyüp Mert araba parçası basılacak teslim tarihi 12 Aralık 3.800 TL ödedi 4.200 TL daha ödeyecek siyah olacak 820 gram basılacak";
    const r = parseTurkishNote(raw, materials, customers);
    assert.equal(r.customer, "Eyüp Mert");
    assert.equal(r.title, "araba parçası");
    assert.equal(r.grams, 820);
    assert.equal(r.revenue, 8000);
    assert.equal(r.color, "Siyah");
    assert.equal(r.material, undefined);
    assert.ok(r.deliveryDate?.endsWith("-12-12"));
    assert.notEqual(r.status, "completed");
  });

  it("süre parse eder — saat ve dakika", () => {
    const r1 = parseTurkishNote("3 saat sürdü PETG baskı", materials, customers);
    assert.equal(r1.durationMinutes, 180);

    const r2 = parseTurkishNote("45 dakika çalıştı", materials, customers);
    assert.equal(r2.durationMinutes, 45);

    const r3 = parseTurkishNote("2.5 saat sürdü", materials, customers);
    assert.equal(r3.durationMinutes, 150);
  });

  it("ödeme durumu ve taksit parse eder", () => {
    const raw =
      "3600 TL ödendi 4200 TL daha alınacak 3 taksit ayda 2000 ödeme tarihi 15 Eylül";
    const r = parseTurkishNote(raw, materials, customers);
    assert.equal(r.amountPaid, 3600);
    assert.equal(r.amountRemaining, 4200);
    assert.equal(r.paymentStatus, "partial");
    assert.equal(r.installmentCount, 3);
    assert.equal(r.installmentAmount, 2000);
    assert.ok(r.paymentDueDate?.endsWith("-09-15"));
  });

  it("referans ve kaynak parse eder", () => {
    const raw =
      "müşteri adı Selin Koç Ahmet'in referansıyla instagramdan geldi";
    const r = parseTurkishNote(raw, materials, customers);
    assert.equal(r.referral, "Ahmet Yılmaz");
    assert.equal(r.customerSource, "Instagram");
  });

  it("tam ödendi durumu", () => {
    const r = parseTurkishNote("5000 TL tam ödendi peşin", materials, customers);
    assert.equal(r.paymentStatus, "paid");
  });
});

describe("parseFaultNote", () => {
  const machines = [
    { name: "Bambu X1C #1" },
    { name: "Prusa MK4" },
  ];
  const faultTypes = [
    { name: "Nozzle tıkanması" },
    { name: "Filament kopması" },
  ];

  it("makine, süre ve arıza tipi çıkarır", () => {
    const r = parseFaultNote(
      "Bambu X1C nozzle tıkanması 2 saat durdu bugün",
      machines,
      faultTypes
    );
    assert.equal(r.machine, "Bambu X1C #1");
    assert.equal(r.faultType, "Nozzle tıkanması");
    assert.equal(r.durationHours, 2);
    assert.ok(r.faultDate);
  });
});

describe("mapVoiceToFormFields", () => {
  it("form id alanlarını doldurur", () => {
    const r = mapVoiceToFormFields(
      "müşteri Mehmet Kaya 180 gram PETG tutar 520 lira tamamlandı parça dişli seti",
      materials,
      customers
    );
    assert.equal(r.customerId, "c3");
    assert.equal(r.materialId, "m1");
    assert.equal(r.gramsUsed, "180");
    assert.equal(r.revenueAmount, "520");
    assert.equal(r.status, "completed");
    assert.ok(r.matched.includes("Müşteri"));
    assert.ok(r.matched.includes("Malzeme"));
    assert.ok(r.matched.includes("Gram"));
    assert.ok(r.matched.includes("Sipariş tutarı"));
  });

  it("Eyüp Mert araba parçası ses cümlesi müşteri ve tutarı doldurur", () => {
    const raw =
      "müşteri adı Eyüp Mert araba parçası basılacak teslim tarihi 12 Aralık 3.800 TL ödedi 4.200 TL daha ödeyecek siyah olacak 820 gram basılacak";
    const mats = [
      ...materials,
      {
        id: "m5",
        name: "ABS",
        material_colors: [{ id: "col-black", color_name: "Siyah" }],
      },
    ];
    const r = mapVoiceToFormFields(raw, mats, customers);
    assert.equal(r.customerId, "c4");
    assert.equal(r.title, "araba parçası");
    assert.equal(r.gramsUsed, "820");
    assert.equal(r.revenueAmount, "8000");
    assert.equal(r.materialId, undefined);
    assert.equal(r.colorName, "Siyah");
    assert.ok(r.matched.includes("Müşteri"));
    assert.ok(!r.matched.some((m) => m.startsWith("Malzeme")));
  });
});

describe("parseProcurementNote", () => {
  const suppliers = [{ name: "FilamentMarket" }, { name: "3D Türkiye" }];
  const mats = [
    {
      id: "m1",
      name: "PETG",
      material_colors: [{ id: "c1", color_name: "Siyah" }],
    },
  ];

  it("tedarikçi malzeme gram ve kanal çıkarır", () => {
    const r = parseProcurementNote(
      "tedarikçi FilamentMarket 1000 gram PETG siyah Trendyol 580 tl",
      mats,
      suppliers
    );
    assert.equal(r.supplier, "FilamentMarket");
    assert.equal(r.material, "PETG");
    assert.equal(r.grams, 1000);
    assert.equal(r.channel, "Trendyol");
  });

  it("mapProcurementVoiceToFormFields alanları doldurur", () => {
    const r = mapProcurementVoiceToFormFields(
      "tedarikçi 3D Türkiye 500 gram PETG Hepsiburada fatura no INV-99",
      mats,
      [{ id: "s2", name: "3D Türkiye" }]
    );
    assert.equal(r.supplierId, "s2");
    assert.equal(r.materialId, "m1");
    assert.equal(r.grams, "500");
    assert.equal(r.channel, "Hepsiburada");
    assert.equal(r.invoiceRef, "INV-99");
    assert.ok(r.matched.includes("Tedarikçi"));
  });
});

describe("parseCatalogNote", () => {
  it("sku ve ürün adı parse eder", () => {
    const r = parseCatalogNote("ürün adı Dişli Seti sku PF-DISLI-01 85 gram PETG", materials);
    assert.equal(r.sku, "PF-DISLI-01");
    assert.ok(r.name?.toLowerCase().includes("dişli"));
    assert.equal(r.grams, 85);
    assert.equal(r.material, "PETG");
  });
});

describe("mapCustomerVoiceToFormFields", () => {
  it("referans müşteriyi id ile eşleştirir", () => {
    const r = mapCustomerVoiceToFormFields(
      "müşteri adı Deniz Yıldız referans Ahmet Yılmaz kaynak Instagram",
      customers
    );
    assert.equal(r.name, "Deniz Yıldız");
    assert.equal(r.referredByCustomerId, "c1");
    assert.equal(r.source, "Instagram");
    assert.ok(r.matched.some((m) => m.includes("Referans")));
  });
});

describe("parseSaleNote", () => {
  const items = [{ sku: "PF-TUTUCU-02", name: "Telefon Tutucu V2" }];

  it("satış müşteri ve kargo bilgisi", () => {
    const r = parseSaleNote(
      "müşteri Ayşe Demir 2 adet PF-TUTUCU-02 290 tl Instagram Yurtiçi takip no YK99887766TR",
      customers,
      items
    );
    assert.equal(r.customer, "Ayşe Demir");
    assert.equal(r.quantity, 2);
    assert.equal(r.unitPrice, 290);
    assert.equal(r.channel, "Instagram");
    assert.ok(r.trackingNumber?.includes("YK"));
  });
});
