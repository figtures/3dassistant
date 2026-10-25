/**
 * Dev mock data seed — dev.busraaktas@gmail.com
 * Usage: node scripts/seed-dev.mjs
 * Requires .env.local with Supabase URL + anon key
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const DEV_EMAIL = "dev.busraaktas@gmail.com";
const DEV_PASSWORD = "DevPrintFlow123!";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function ensureUser() {
  let { data: signIn, error } = await supabase.auth.signInWithPassword({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
  });

  if (!error && signIn.user) {
    console.log("✓ Giriş yapıldı:", DEV_EMAIL);
    return signIn.user;
  }

  const { data: signUp, error: signUpErr } = await supabase.auth.signUp({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
    options: {
      data: { full_name: "Büşra Aktas", company_name: "PrintFlow Demo Studio" },
    },
  });

  if (signUpErr) throw new Error(`Kayıt hatası: ${signUpErr.message}`);
  console.log("✓ Hesap oluşturuldu:", DEV_EMAIL);
  return signUp.user;
}

async function clearData(userId) {
  const { data: jobs } = await supabase.from("jobs").select("id").eq("user_id", userId);
  const jobIds = jobs?.map((j) => j.id) ?? [];
  if (jobIds.length) {
    await supabase.from("job_notes").delete().in("job_id", jobIds);
    await supabase.from("job_files").delete().in("job_id", jobIds);
  }
  const { data: catalogItems } = await supabase
    .from("catalog_items")
    .select("id")
    .eq("user_id", userId);
  const catalogIds = catalogItems?.map((c) => c.id) ?? [];
  if (catalogIds.length) {
    await supabase.from("catalog_files").delete().in("item_id", catalogIds);
    await supabase.from("catalog_events").delete().in("item_id", catalogIds);
    await supabase.from("catalog_inventory").delete().in("item_id", catalogIds);
    await supabase.from("sales").delete().eq("user_id", userId);
    await supabase.from("catalog_item_jobs").delete().in("catalog_item_id", catalogIds);
    await supabase.from("catalog_items").delete().eq("user_id", userId);
  } else {
    await supabase.from("sales").delete().eq("user_id", userId);
  }
  await supabase.from("material_purchases").delete().eq("user_id", userId);
  await supabase.from("suppliers").delete().eq("user_id", userId);
  await supabase.from("jobs").delete().eq("user_id", userId);
  await supabase.from("faults").delete().eq("user_id", userId);
  await supabase.from("fault_types").delete().eq("user_id", userId);
  await supabase.from("customers").delete().eq("user_id", userId);
  await supabase.from("machines").delete().eq("user_id", userId);
  await supabase.from("materials").delete().eq("user_id", userId);
}

async function seed() {
  const user = await ensureUser();
  if (!user) throw new Error("Kullanıcı alınamadı");
  const uid = user.id;

  console.log("→ Mevcut veriler temizleniyor...");
  await clearData(uid);

  const COLOR_HEX = {
    Beyaz: "#f5f5f5",
    Siyah: "#1a1a1a",
    Kırmızı: "#dc2626",
    Antrasit: "#374151",
    Şeffaf: "#e5e7eb",
    Natural: "#d4a574",
    Gri: "#6b7280",
    Altın: "#ca8a04",
    Gümüş: "#9ca3af",
  };

  const materialDefs = [
    {
      name: "PLA",
      brand: "Bambu Lab",
      price_per_kg: 420,
      colors: [
        { color_name: "Beyaz", stock_grams: 1500 },
        { color_name: "Siyah", stock_grams: 1000 },
      ],
    },
    {
      name: "PETG",
      brand: "Polymaker",
      price_per_kg: 580,
      colors: [
        { color_name: "Siyah", stock_grams: 900 },
        { color_name: "Beyaz", stock_grams: 900 },
      ],
    },
    {
      name: "ASA",
      brand: "Fillamentum",
      price_per_kg: 720,
      colors: [{ color_name: "Antrasit", stock_grams: 1200 }],
    },
    {
      name: "ABS",
      brand: "eSun",
      price_per_kg: 490,
      colors: [
        { color_name: "Kırmızı", stock_grams: 500 },
        { color_name: "Siyah", stock_grams: 400 },
      ],
    },
    {
      name: "TPU",
      brand: "NinjaFlex",
      price_per_kg: 890,
      colors: [{ color_name: "Şeffaf", stock_grams: 600 }],
    },
    {
      name: "Nylon",
      brand: "Taulman",
      price_per_kg: 950,
      colors: [{ color_name: "Natural", stock_grams: 450 }],
    },
    {
      name: "PC",
      brand: "Polymaker",
      price_per_kg: 1100,
      colors: [{ color_name: "Gri", stock_grams: 350 }],
    },
    {
      name: "Silk PLA",
      brand: "Eryone",
      price_per_kg: 550,
      colors: [
        { color_name: "Altın", stock_grams: 500 },
        { color_name: "Gümüş", stock_grams: 300 },
      ],
    },
  ];

  const mats = [];
  for (const def of materialDefs) {
    const totalStock = def.colors.reduce((s, c) => s + c.stock_grams, 0);
    const { data: mat, error: insertErr } = await supabase
      .from("materials")
      .insert({
        user_id: uid,
        name: def.name,
        brand: def.brand,
        color: null,
        price_per_kg: def.price_per_kg,
        stock_grams: totalStock,
      })
      .select("id, name")
      .single();
    if (insertErr) throw insertErr;

    const colorRows = def.colors.map((c, i) => ({
      material_id: mat.id,
      user_id: uid,
      color_name: c.color_name,
      hex_code: COLOR_HEX[c.color_name] ?? null,
      stock_grams: c.stock_grams,
      sort_order: i,
    }));
    const { error: colorErr } = await supabase.from("material_colors").insert(colorRows);
    if (colorErr) throw colorErr;

    const { data: insertedColors } = await supabase
      .from("material_colors")
      .select("id, color_name")
      .eq("material_id", mat.id);

    mats.push({ ...mat, colors: insertedColors ?? [] });
  }
  console.log(`✓ ${mats.length} malzeme eklendi`);

  const machines = [
    { name: "Bambu X1C #1", model: "Bambu Lab X1 Carbon", status: "active", sort_order: 0 },
    { name: "Prusa MK4", model: "Prusa MK4", status: "active", sort_order: 1 },
    { name: "Creality K1 Max", model: "Creality K1 Max", status: "active", sort_order: 2 },
    { name: "Voron 2.4", model: "Voron 2.4 R2", status: "maintenance", sort_order: 3 },
    { name: "Ender 3 S1 Pro", model: "Creality Ender 3 S1 Pro", status: "active", sort_order: 4 },
  ].map((m) => ({ ...m, user_id: uid }));

  const { data: macs, error: macErr } = await supabase.from("machines").insert(machines).select();
  if (macErr) throw macErr;
  console.log(`✓ ${macs.length} makine eklendi`);

  const customers = [
    ["Ahmet Yılmaz", "ahmet@techparts.com", "05321234567", "TechParts Ltd.", "VIP müşteri", "Tavsiye", "Ahmet Yılmaz"],
    ["Ayşe Demir", "ayse@design.co", "05339876543", "Design Co.", null, "Instagram", null],
    ["Mehmet Kaya", "mehmet@auto3d.tr", "05441112233", "Auto3D Prototip", "Otomotiv parçaları", "Google", null],
    ["Zeynep Arslan", "zeynep@arch.studio", "05552223344", "Arch Studio", "Mimari maketler", "Tavsiye", "Selin Koç"],
    ["Can Öztürk", "can@medtech.io", "05363334455", "MedTech", "Medikal prototip", "LinkedIn", null],
    ["Elif Şahin", "elif@jewelry.com", "05424445566", "Elif Jewelry", "Kuyumcu kalıpları", "Instagram", null],
    ["Burak Aydın", "burak@drone.tr", "05375556677", "DroneTR", "Drone parçaları", "Tavsiye", "Ahmet Yılmaz"],
    ["Selin Koç", "selin@edu.tr", "05426667788", "İTÜ Robotik", "Akademik proje", "Web sitesi", null],
    ["Emre Çelik", "emre@game.dev", "05387778899", "Indie Game Dev", null, "Google", null],
    ["Deniz Yıldız", "deniz@marine.co", "05448889900", "Marine Co.", "Denizcilik", "Tavsiye", null],
    ["Fatma Güneş", "fatma@craft.art", "05359990011", "Craft Art", "Sanat eserleri", "Instagram", null],
    ["Hakan Polat", "hakan@industry.tr", "05421001122", "Polat Sanayi", "Endüstriyel yedek parça", "Google", null],
    ["Merve Ak", "merve@startup.io", "05332112233", "StartupXYZ", "MVP prototipler", "LinkedIn", null],
    ["Oğuz Tan", "oguz@rc.hobby", "05443223344", null, "RC hobi", "Tavsiye", "Burak Aydın"],
    ["Pınar Er", "pinar@cosmetic.co", "05354334455", "Cosmetic Co.", "Kozmetik ambalaj", "Instagram", null],
    ["Eyüp Mert", "eyup.mert@demo.tr", "05321112233", "Mert Prototip", "Demo sesli giriş müşterisi", "Tavsiye", "Ahmet Yılmaz"],
  ].map(([name, email, phone, company, notes, source, referral]) => ({
    user_id: uid, name, email, phone, company, notes, source, referral,
  }));

  const { data: custs, error: custErr } = await supabase.from("customers").insert(customers).select();
  if (custErr) throw custErr;

  const custByName = new Map(custs.map((c) => [c.name, c.id]));
  for (const c of custs) {
    if (!c.referral) continue;
    const referrerId = custByName.get(c.referral);
    if (referrerId) {
      await supabase
        .from("customers")
        .update({ referred_by_customer_id: referrerId })
        .eq("id", c.id);
      c.referred_by_customer_id = referrerId;
    }
  }
  console.log(`✓ ${custs.length} müşteri eklendi`);

  const mat = (name) => mats.find((m) => m.name === name || m.name.startsWith(name));
  const matColor = (matIndex, colorIndex = 0) => {
    const m = mats[matIndex % mats.length];
    return m.colors[colorIndex % m.colors.length]?.id ?? null;
  };
  const mac = (i) => macs[i % macs.length];
  const cust = (i) => custs[i % custs.length];

  function dateOffset(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  const colors = {
    completed: "#22c55e",
    in_progress: "#3b82f6",
    pending: "#f59e0b",
    cancelled: "#ef4444",
  };

  const usedSlots = new Set();
  const jobs = [];

  function addJob(entry) {
    const key = `${entry.machine_id}_${entry.job_date}`;
    if (usedSlots.has(key)) return;
    usedSlots.add(key);
    jobs.push(entry);
  }

  function addExtraJob(entry) {
    jobs.push(entry);
  }

  // ── Teslim uyarıları: geciken / bugün / yarın ──
  const deliveryScenarios = [
    { title: "Acil Dişli Seti", jobOff: -8, delOff: -3, status: "in_progress", mac: 0, cust: 0, grams: 220, revenue: 890 },
    { title: "Drone Kol V3", jobOff: -6, delOff: -2, status: "pending", mac: 1, cust: 1, grams: 180, revenue: 720 },
    { title: "Prototip Kapak", jobOff: -5, delOff: -1, status: "in_progress", mac: 2, cust: 2, grams: 140, revenue: 560 },
    { title: "Telefon Tutucu Pro", jobOff: -2, delOff: 0, status: "in_progress", mac: 3, cust: 3, grams: 95, revenue: 420 },
    { title: "Mimari Maket A", jobOff: -1, delOff: 0, status: "pending", mac: 4, cust: 4, grams: 310, revenue: 1150 },
    { title: "Medikal Klips", jobOff: -3, delOff: 1, status: "pending", mac: 0, cust: 5, grams: 65, revenue: 380 },
    { title: "Sensor Muhafazası", jobOff: -2, delOff: 1, status: "in_progress", mac: 1, cust: 6, grams: 120, revenue: 540 },
    { title: "Kolye Kalıbı", jobOff: -1, delOff: 1, status: "pending", mac: 2, cust: 7, grams: 45, revenue: 290 },
    { title: "Endüstriyel Flanş", jobOff: -4, delOff: 5, status: "pending", mac: 3, cust: 8, grams: 200, revenue: 680 },
    { title: "RC Gövde Parçası", jobOff: -3, delOff: 7, status: "in_progress", mac: 4, cust: 9, grams: 175, revenue: 610 },
  ];

  function enrichJob(entry, index = 0) {
    const revenue = entry.revenue_amount ?? 0;
    const paymentPattern = index % 4;
    let payment = { payment_status: "unpaid", amount_paid: 0, amount_remaining: revenue };
    if (paymentPattern === 0 && revenue > 0) {
      payment = { payment_status: "paid", amount_paid: revenue, amount_remaining: 0 };
    } else if (paymentPattern === 1 && revenue > 0) {
      const paid = Math.round(revenue * 0.45);
      payment = {
        payment_status: "partial",
        amount_paid: paid,
        amount_remaining: revenue - paid,
        payment_due_date: dateOffset(14),
        installment_count: 3,
        installment_amount: Math.round((revenue - paid) / 3),
      };
    } else if (paymentPattern === 2 && revenue > 0) {
      payment = {
        payment_status: "upcoming",
        amount_paid: 0,
        amount_remaining: revenue,
        payment_due_date: dateOffset(7),
      };
    }
    const duration =
      entry.status === "completed"
        ? 60 + (index % 8) * 45
        : entry.status === "in_progress"
          ? 30 + (index % 5) * 20
          : null;
    return {
      ...entry,
      ...payment,
      duration_minutes: duration,
    };
  }

  for (const s of deliveryScenarios) {
    addJob(
      enrichJob({
        user_id: uid,
        machine_id: mac(s.mac).id,
        customer_id: cust(s.cust).id,
        material_id: mats[s.mac % mats.length].id,
        material_color_id: matColor(s.mac, s.mac % 2),
        job_date: dateOffset(s.jobOff),
        delivery_date: dateOffset(s.delOff),
        title: s.title,
        description: "Teslim takvimi demo kaydı",
        grams_used: s.grams,
        revenue_amount: s.revenue,
        status: s.status,
        cell_color: colors[s.status],
      }, s.mac)
    );
  }

  // ── Geçmiş tamamlanan işler ──
  const titles = ["Dişli Seti", "Telefon Tutucu", "Bracket V2", "Klips Seti", "Flanş"];
  for (let i = 10; i < 35; i++) {
    const status = i % 7 === 0 ? "cancelled" : "completed";
    addJob(
      enrichJob({
        user_id: uid,
        machine_id: mac(i).id,
        customer_id: cust(i).id,
        material_id: mats[i % mats.length].id,
        material_color_id: matColor(i, i % 2),
        job_date: dateOffset(-i),
        delivery_date: dateOffset(-i + 2),
        title: titles[i % titles.length],
        description: "Demo sipariş kaydı",
        grams_used: 80 + (i * 17) % 350,
        revenue_amount: 350 + (i * 83) % 1500,
        status,
        cell_color: colors[status],
      }, i)
    );
  }

  // ── Gelecek planlı işler ──
  for (let f = 2; f <= 6; f++) {
    addJob(
      enrichJob({
        user_id: uid,
        machine_id: mac(f + 2).id,
        customer_id: cust(f + 2).id,
        material_id: mat("PLA").id,
        material_color_id: mat("PLA").colors[0]?.id ?? null,
        job_date: dateOffset(f),
        delivery_date: dateOffset(f + 3),
        title: `Gelecek Sipariş #${f}`,
        description: "Demo sipariş kaydı",
        grams_used: 100 + f * 40,
        revenue_amount: 400 + f * 200,
        status: "pending",
        cell_color: colors.pending,
      }, f)
    );
  }

  // ── Son 14 gün: dashboard grafikleri için yoğun tamamlanan işler ──
  const weeklyTitles = [
    "Vida Seti",
    "Kasa Parçası",
    "Hobi Figür",
    "Yedek Parça",
    "Prototip V2",
    "Kalıp Testi",
  ];
  for (let day = -13; day <= -1; day++) {
    const jobsThisDay = day % 3 === 0 ? 3 : 2;
    for (let slot = 0; slot < jobsThisDay; slot++) {
      const idx = Math.abs(day) * 3 + slot;
      addExtraJob(
        enrichJob(
          {
            user_id: uid,
            machine_id: mac(slot + 1).id,
            customer_id: cust(idx).id,
            material_id: mats[idx % mats.length].id,
            material_color_id: matColor(idx, slot),
            job_date: dateOffset(day),
            delivery_date: dateOffset(day + 2),
            title: `${weeklyTitles[idx % weeklyTitles.length]} — ${slot + 1}`,
            description: "Haftalık grafik demo kaydı",
            grams_used: 70 + (idx * 11) % 280,
            revenue_amount: 280 + (idx * 47) % 920,
            status: "completed",
            cell_color: colors.completed,
          },
          idx
        )
      );
    }
  }

  // ── Aynı gün + makinede birden fazla iş ──
  addExtraJob(
    enrichJob({
      user_id: uid,
      machine_id: mac(0).id,
      customer_id: cust(10).id,
      material_id: mat("PETG").id,
      material_color_id: mat("PETG").colors[1]?.id ?? mat("PETG").colors[0]?.id ?? null,
      job_date: dateOffset(0),
      delivery_date: dateOffset(2),
      title: "İkinci Baskı — Kapak",
      description: "Aynı gün aynı makinede ikinci iş",
      grams_used: 88,
      revenue_amount: 340,
      status: "pending",
      cell_color: colors.pending,
    }, 20)
  );
  addExtraJob(
    enrichJob({
      user_id: uid,
      machine_id: mac(0).id,
      customer_id: cust(11).id,
      material_id: mat("PLA").id,
      material_color_id: mat("PLA").colors[1]?.id ?? mat("PLA").colors[0]?.id ?? null,
      job_date: dateOffset(0),
      delivery_date: dateOffset(1),
      title: "Üçüncü Baskı — Klips",
      description: "Aynı gün aynı makinede üçüncü iş",
      grams_used: 42,
      revenue_amount: 190,
      status: "in_progress",
      cell_color: colors.in_progress,
    }, 21)
  );

  const { data: insertedJobs, error: jobErr } = await supabase.from("jobs").insert(jobs).select("id");
  if (jobErr) {
    if (jobErr.message.includes("material_color")) {
      throw new Error(
        "material_colors tablosu yok — önce supabase/run-dev-setup.sql veya 007_material_colors.sql çalıştırın"
      );
    }
    if (jobErr.message.includes("jobs_user_id_machine_id_job_date") || jobErr.message.includes("duplicate key")) {
      throw new Error(
        "Aynı gün+makine unique kısıtı duruyor — supabase/run-dev-setup.sql veya 008_multiple_jobs_per_cell.sql uygulayın"
      );
    }
    if (jobErr.message.includes("delivery_date")) {
      throw new Error(
        "delivery_date kolonu yok — önce supabase/run-dev-setup.sql veya 006_delivery_date.sql çalıştırın"
      );
    }
    if (jobErr.message.includes("payment_status") || jobErr.message.includes("duration_minutes")) {
      throw new Error(
        "Ödeme/süre kolonları yok — önce supabase/run-dev-setup.sql veya 009_printflow_features.sql çalıştırın"
      );
    }
    throw jobErr;
  }
  console.log(`✓ ${insertedJobs.length} iş emri eklendi`);
  console.log(`  → Teslim uyarıları: ${deliveryScenarios.length} aktif demo iş`);

  const faultTypeNames = [
    "Nozzle tıkanması",
    "Filament kırılması",
    "Elektronik arıza",
    "Kalibrasyon",
    "Mekanik arıza",
  ];
  const { data: faultTypes, error: ftErr } = await supabase
    .from("fault_types")
    .insert(
      faultTypeNames.map((name, i) => ({
        user_id: uid,
        name,
        sort_order: i,
      }))
    )
    .select();
  if (ftErr) {
    if (ftErr.message.includes("fault_types")) {
      throw new Error(
        "fault_types tablosu yok — önce supabase/run-dev-setup.sql çalıştırın"
      );
    }
    throw ftErr;
  }
  console.log(`✓ ${faultTypes.length} arıza tipi eklendi`);

  const faultRows = [
    { mac: 0, type: 0, hours: 2.5, days: -5, status: "resolved", desc: "Nozzle değişimi" },
    { mac: 1, type: 1, hours: 1, days: -3, status: "resolved", desc: "Filament sıkışması" },
    { mac: 2, type: 2, hours: 4, days: -1, status: "in_progress", desc: "Termistör hatası" },
    { mac: 3, type: 3, hours: 0.5, days: 0, status: "open", desc: "Z ekseni kalibrasyon" },
    { mac: 0, type: 4, hours: 3, days: -10, status: "resolved", desc: "X ekseni kayış" },
  ];
  const { error: faultErr } = await supabase.from("faults").insert(
    faultRows.map((f) => ({
      user_id: uid,
      machine_id: mac(f.mac).id,
      fault_type_id: faultTypes[f.type].id,
      fault_type_name: faultTypes[f.type].name,
      duration_hours: f.hours,
      fault_date: dateOffset(f.days),
      status: f.status,
      description: f.desc,
    }))
  );
  if (faultErr) throw faultErr;
  console.log(`✓ ${faultRows.length} arıza kaydı eklendi`);

  const notes = insertedJobs.slice(0, 12).map((j, i) => ({
    job_id: j.id,
    content: [
      "150 gram PETG kullanıldı, müşteri memnun",
      "Detaylı post-processing gerekli",
      "PLA ile basıldı, kalite kontrol OK",
      "Acil teslimat — öncelikli",
    ][i % 4],
    is_voice: i % 3 === 0,
  }));

  await supabase.from("job_notes").insert(notes);
  console.log(`✓ ${notes.length} not eklendi`);

  const supplierDefs = [
    { name: "FilamentMarket", contact_email: "siparis@filamentmarket.tr", website: "https://filamentmarket.tr" },
    { name: "3D Türkiye", contact_phone: "0850 123 45 67", website: "https://3dturkiye.com" },
    { name: "Bambu Resmi", contact_email: "store@bambulab.com" },
  ];
  const { data: suppliers, error: supErr } = await supabase
    .from("suppliers")
    .insert(supplierDefs.map((s) => ({ ...s, user_id: uid })))
    .select();
  if (supErr) {
    if (supErr.message.includes("suppliers")) {
      throw new Error("suppliers tablosu yok — 010_procurement.sql veya run-dev-setup.sql uygulayın");
    }
    throw supErr;
  }
  console.log(`✓ ${suppliers.length} tedarikçi eklendi`);

  const pla = mat("PLA");
  const petg = mat("PETG");
  const purchaseRows = [
    {
      supplier_id: suppliers[0].id,
      material_id: pla.id,
      material_color_id: pla.colors[0]?.id,
      grams: 2000,
      unit_price: 420,
      total: 840,
      purchase_date: dateOffset(-12),
      channel: "Trendyol",
      invoice_ref: "FM-2026-0142",
      notes: "PLA beyaz stok yenileme",
    },
    {
      supplier_id: suppliers[1].id,
      material_id: petg.id,
      material_color_id: petg.colors[0]?.id,
      grams: 1000,
      unit_price: 580,
      total: 580,
      purchase_date: dateOffset(-5),
      channel: "Hepsiburada",
      invoice_ref: "3DT-8891",
    },
    {
      supplier_id: suppliers[2].id,
      material_id: mat("ASA").id,
      material_color_id: mat("ASA").colors[0]?.id,
      grams: 750,
      unit_price: 720,
      total: 540,
      purchase_date: dateOffset(-2),
      channel: "Direkt",
    },
  ].map((p) => ({ ...p, user_id: uid }));

  const { error: purErr } = await supabase.from("material_purchases").insert(purchaseRows);
  if (purErr) throw purErr;
  console.log(`✓ ${purchaseRows.length} malzeme alımı eklendi (stok tetikleyici)`);

  const catalogDefs = [
    {
      sku: "PF-DISLI-01",
      name: "Dişli Seti Pro",
      description: "12 dişli + mil — PETG önerilir",
      default_material_id: petg.id,
      default_grams: 85,
      tags: ["otomotiv", "hobi"],
      stock: 8,
    },
    {
      sku: "PF-TUTUCU-02",
      name: "Telefon Tutucu V2",
      description: "Masaüstü stand",
      default_material_id: pla.id,
      default_grams: 42,
      tags: ["aksesuar"],
      stock: 2,
    },
    {
      sku: "PF-MAKET-03",
      name: "Mimari Maket Parçası A",
      description: "Beyaz PLA maket elemanı",
      default_material_id: pla.id,
      default_grams: 120,
      tags: ["mimari", "pla"],
      stock: 5,
    },
  ];

  for (const def of catalogDefs) {
    const { data: catItem, error: catErr } = await supabase
      .from("catalog_items")
      .insert({
        user_id: uid,
        sku: def.sku,
        name: def.name,
        description: def.description,
        default_material_id: def.default_material_id,
        default_grams: def.default_grams,
        tags: def.tags,
      })
      .select("id")
      .single();
    if (catErr) {
      if (catErr.message.includes("catalog_items")) {
        throw new Error("catalog tabloları yok — 011/012 migration veya run-dev-setup.sql");
      }
      throw catErr;
    }
    await supabase.from("catalog_inventory").upsert(
      {
        user_id: uid,
        item_id: catItem.id,
        quantity_on_hand: def.stock,
        quantity_reserved: 0,
      },
      { onConflict: "user_id,item_id" }
    );
  }
  console.log(`✓ ${catalogDefs.length} katalog ürünü eklendi`);

  const { data: catalogItems } = await supabase
    .from("catalog_items")
    .select("id, sku, name")
    .eq("user_id", uid);
  const tutucu = catalogItems?.find((c) => c.sku === "PF-TUTUCU-02");
  const disli = catalogItems?.find((c) => c.sku === "PF-DISLI-01");
  if (tutucu && custs[1]) {
    const { data: sale1, error: s1Err } = await supabase
      .from("sales")
      .insert({
        user_id: uid,
        item_id: tutucu.id,
        customer_id: custs[1].id,
        channel: "Instagram",
        platform: "DM",
        unit_price: 290,
        quantity: 1,
        sold_at: new Date(dateOffset(-3)).toISOString(),
      })
      .select("id")
      .single();
    if (!s1Err && sale1) {
      await supabase.from("shipments").insert({
        user_id: uid,
        sale_id: sale1.id,
        carrier: "Yurtiçi Kargo",
        tracking_number: "YK123456789TR",
        status: "delivered",
        shipped_at: new Date(dateOffset(-2)).toISOString(),
        delivered_at: new Date(dateOffset(-1)).toISOString(),
      });
    }
  }
  if (disli && custs[0]) {
    await supabase.from("sales").insert({
      user_id: uid,
      item_id: disli.id,
      customer_id: custs[0].id,
      channel: "Web sitesi",
      unit_price: 450,
      quantity: 2,
      sold_at: new Date(dateOffset(-1)).toISOString(),
    });
  }
  console.log("✓ Örnek satış ve kargo kayıtları eklendi");

  const { data: completedForCatalog } = await supabase
    .from("jobs")
    .select("id")
    .eq("user_id", uid)
    .eq("status", "completed")
    .order("job_date", { ascending: false })
    .limit(3);
  const linkRows = [];
  if (tutucu && completedForCatalog?.[0]) {
    linkRows.push({
      user_id: uid,
      catalog_item_id: tutucu.id,
      job_id: completedForCatalog[0].id,
    });
  }
  if (disli && completedForCatalog?.[1]) {
    linkRows.push({
      user_id: uid,
      catalog_item_id: disli.id,
      job_id: completedForCatalog[1].id,
    });
  }
  if (linkRows.length) {
    const { error: linkErr } = await supabase.from("catalog_item_jobs").insert(linkRows);
    if (linkErr && !linkErr.message.includes("catalog_item_jobs")) throw linkErr;
    else if (!linkErr) console.log(`✓ ${linkRows.length} katalog–iş bağlantısı eklendi`);
  }

  const totalRevenue = jobs.reduce((s, j) => s + j.revenue_amount, 0);
  console.log("\n════════════════════════════════════");
  console.log("  SEED TAMAMLANDI");
  console.log(`  E-posta : ${DEV_EMAIL}`);
  console.log(`  Şifre   : ${DEV_PASSWORD}`);
  console.log(`  Toplam kazanç (mock): ₺${totalRevenue.toLocaleString("tr-TR")}`);
  console.log("════════════════════════════════════");
  console.log("\n⚠ Supabase CLI push başarısız olursa SQL Editor'de çalıştırın:");
  console.log("  supabase/run-dev-setup.sql");
  console.log("\n⚠ E-posta doğrulama için:");
  console.log(`  UPDATE auth.users SET email_confirmed_at = NOW() WHERE email = '${DEV_EMAIL}';`);
}

seed().catch((e) => {
  console.error("Seed hatası:", e.message);
  process.exit(1);
});
