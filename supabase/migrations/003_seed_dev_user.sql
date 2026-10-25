-- Auto confirm dev user + comprehensive mock data
-- Email: dev.busraaktas@gmail.com

DO $$
DECLARE
  v_user_id UUID;
  -- Materials
  m_pla UUID; m_petg UUID; m_asa UUID; m_abs UUID; m_tpu UUID; m_nylon UUID; m_pc UUID; m_silk UUID;
  -- Machines
  mac1 UUID; mac2 UUID; mac3 UUID; mac4 UUID; mac5 UUID;
  -- Customers
  c1 UUID; c2 UUID; c3 UUID; c4 UUID; c5 UUID; c6 UUID; c7 UUID; c8 UUID;
  c9 UUID; c10 UUID; c11 UUID; c12 UUID; c13 UUID; c14 UUID; c15 UUID;
  -- Job temp
  j_id UUID;
  d DATE;
  i INT;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'dev.busraaktas@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User dev.busraaktas@gmail.com not found — run: npm run seed:dev';
    RETURN;
  END IF;

  -- Auto confirm email
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
  WHERE id = v_user_id;

  UPDATE profiles
  SET full_name = COALESCE(full_name, 'Büşra Aktas'),
      company_name = COALESCE(company_name, 'PrintFlow Demo Studio'),
      email = 'dev.busraaktas@gmail.com'
  WHERE id = v_user_id;

  -- Clear existing data for clean seed
  DELETE FROM job_notes WHERE job_id IN (SELECT id FROM jobs WHERE user_id = v_user_id);
  DELETE FROM job_files WHERE job_id IN (SELECT id FROM jobs WHERE user_id = v_user_id);
  DELETE FROM jobs WHERE user_id = v_user_id;
  DELETE FROM customers WHERE user_id = v_user_id;
  DELETE FROM machines WHERE user_id = v_user_id;
  DELETE FROM materials WHERE user_id = v_user_id;

  -- MATERIALS
  INSERT INTO materials (id, user_id, name, brand, color, price_per_kg, stock_grams) VALUES
    (gen_random_uuid(), v_user_id, 'PLA', 'Bambu Lab', 'Beyaz', 420.00, 2500) RETURNING id INTO m_pla;
  INSERT INTO materials (id, user_id, name, brand, color, price_per_kg, stock_grams) VALUES
    (gen_random_uuid(), v_user_id, 'PETG', 'Polymaker', 'Siyah', 580.00, 1800) RETURNING id INTO m_petg;
  INSERT INTO materials (id, user_id, name, brand, color, price_per_kg, stock_grams) VALUES
    (gen_random_uuid(), v_user_id, 'ASA', 'Fillamentum', 'Antrasit', 720.00, 1200) RETURNING id INTO m_asa;
  INSERT INTO materials (id, user_id, name, brand, color, price_per_kg, stock_grams) VALUES
    (gen_random_uuid(), v_user_id, 'ABS', 'eSun', 'Kırmızı', 490.00, 900) RETURNING id INTO m_abs;
  INSERT INTO materials (id, user_id, name, brand, color, price_per_kg, stock_grams) VALUES
    (gen_random_uuid(), v_user_id, 'TPU', 'NinjaFlex', 'Şeffaf', 890.00, 600) RETURNING id INTO m_tpu;
  INSERT INTO materials (id, user_id, name, brand, color, price_per_kg, stock_grams) VALUES
    (gen_random_uuid(), v_user_id, 'Nylon', 'Taulman', 'Natural', 950.00, 450) RETURNING id INTO m_nylon;
  INSERT INTO materials (id, user_id, name, brand, color, price_per_kg, stock_grams) VALUES
    (gen_random_uuid(), v_user_id, 'PC', 'Polymaker', 'Gri', 1100.00, 350) RETURNING id INTO m_pc;
  INSERT INTO materials (id, user_id, name, brand, color, price_per_kg, stock_grams) VALUES
    (gen_random_uuid(), v_user_id, 'Silk PLA', 'Eryone', 'Altın', 550.00, 800) RETURNING id INTO m_silk;

  -- MACHINES
  INSERT INTO machines (id, user_id, name, model, status, sort_order) VALUES
    (gen_random_uuid(), v_user_id, 'Bambu X1C #1', 'Bambu Lab X1 Carbon', 'active', 0) RETURNING id INTO mac1;
  INSERT INTO machines (id, user_id, name, model, status, sort_order) VALUES
    (gen_random_uuid(), v_user_id, 'Prusa MK4', 'Prusa MK4', 'active', 1) RETURNING id INTO mac2;
  INSERT INTO machines (id, user_id, name, model, status, sort_order) VALUES
    (gen_random_uuid(), v_user_id, 'Creality K1 Max', 'Creality K1 Max', 'active', 2) RETURNING id INTO mac3;
  INSERT INTO machines (id, user_id, name, model, status, sort_order) VALUES
    (gen_random_uuid(), v_user_id, 'Voron 2.4', 'Voron 2.4 R2', 'maintenance', 3) RETURNING id INTO mac4;
  INSERT INTO machines (id, user_id, name, model, status, sort_order) VALUES
    (gen_random_uuid(), v_user_id, 'Ender 3 S1 Pro', 'Creality Ender 3 S1 Pro', 'active', 4) RETURNING id INTO mac5;

  -- CUSTOMERS
  INSERT INTO customers (id, user_id, name, email, phone, company, notes) VALUES
    (gen_random_uuid(), v_user_id, 'Ahmet Yılmaz', 'ahmet@techparts.com', '05321234567', 'TechParts Ltd.', 'VIP müşteri, hızlı teslimat') RETURNING id INTO c1;
  INSERT INTO customers (id, user_id, name, email, phone, company, notes) VALUES
    (gen_random_uuid(), v_user_id, 'Ayşe Demir', 'ayse@design.co', '05339876543', 'Design Co.', NULL) RETURNING id INTO c2;
  INSERT INTO customers (id, user_id, name, email, phone, company, notes) VALUES
    (gen_random_uuid(), v_user_id, 'Mehmet Kaya', 'mehmet@auto3d.tr', '05441112233', 'Auto3D Prototip', 'Otomotiv parçaları') RETURNING id INTO c3;
  INSERT INTO customers (id, user_id, name, email, phone, company, notes) VALUES
    (gen_random_uuid(), v_user_id, 'Zeynep Arslan', 'zeynep@arch.studio', '05552223344', 'Arch Studio', 'Mimari maketler') RETURNING id INTO c4;
  INSERT INTO customers (id, user_id, name, email, phone, company, notes) VALUES
    (gen_random_uuid(), v_user_id, 'Can Öztürk', 'can@medtech.io', '05363334455', 'MedTech', 'Medikal prototip') RETURNING id INTO c5;
  INSERT INTO customers (id, user_id, name, email, phone, company, notes) VALUES
    (gen_random_uuid(), v_user_id, 'Elif Şahin', 'elif@jewelry.com', '05424445566', 'Elif Jewelry', 'Kuyumcu kalıpları') RETURNING id INTO c6;
  INSERT INTO customers (id, user_id, name, email, phone, company, notes) VALUES
    (gen_random_uuid(), v_user_id, 'Burak Aydın', 'burak@drone.tr', '05375556677', 'DroneTR', 'Drone parçaları') RETURNING id INTO c7;
  INSERT INTO customers (id, user_id, name, email, phone, company, notes) VALUES
    (gen_random_uuid(), v_user_id, 'Selin Koç', 'selin@edu.tr', '05426667788', 'İTÜ Robotik', 'Akademik proje') RETURNING id INTO c8;
  INSERT INTO customers (id, user_id, name, email, phone, company, notes) VALUES
    (gen_random_uuid(), v_user_id, 'Emre Çelik', 'emre@game.dev', '05387778899', 'Indie Game Dev', NULL) RETURNING id INTO c9;
  INSERT INTO customers (id, user_id, name, email, phone, company, notes) VALUES
    (gen_random_uuid(), v_user_id, 'Deniz Yıldız', 'deniz@marine.co', '05448889900', 'Marine Co.', 'Denizcilik parçaları') RETURNING id INTO c10;
  INSERT INTO customers (id, user_id, name, email, phone, company, notes) VALUES
    (gen_random_uuid(), v_user_id, 'Fatma Güneş', 'fatma@craft.art', '05359990011', 'Craft Art', 'Sanat eserleri') RETURNING id INTO c11;
  INSERT INTO customers (id, user_id, name, email, phone, company, notes) VALUES
    (gen_random_uuid(), v_user_id, 'Hakan Polat', 'hakan@industry.tr', '05421001122', 'Polat Sanayi', 'Endüstriyel yedek parça') RETURNING id INTO c12;
  INSERT INTO customers (id, user_id, name, email, phone, company, notes) VALUES
    (gen_random_uuid(), v_user_id, 'Merve Ak', 'merve@startup.io', '05332112233', 'StartupXYZ', 'MVP prototipler') RETURNING id INTO c13;
  INSERT INTO customers (id, user_id, name, email, phone, company, notes) VALUES
    (gen_random_uuid(), v_user_id, 'Oğuz Tan', 'oguz@rc.hobby', '05443223344', NULL, 'RC hobi') RETURNING id INTO c14;
  INSERT INTO customers (id, user_id, name, email, phone, company, notes) VALUES
    (gen_random_uuid(), v_user_id, 'Pınar Er', 'pinar@cosmetic.co', '05354334455', 'Cosmetic Co.', 'Kozmetik ambalaj prototipi') RETURNING id INTO c15;

  -- JOBS: last 30 days, distributed across machines
  FOR i IN 0..29 LOOP
    d := CURRENT_DATE - i;

    -- Machine 1 - almost daily
    IF i % 1 = 0 AND i < 28 THEN
      INSERT INTO jobs (user_id, machine_id, customer_id, material_id, job_date, title, description, grams_used, revenue_amount, status, cell_color)
      VALUES (
        v_user_id, mac1,
        (ARRAY[c1,c2,c3,c5,c7,c9,c13])[1 + (i % 7)],
        (ARRAY[m_petg,m_pla,m_asa,m_abs])[1 + (i % 4)],
        d,
        (ARRAY['Dişli Seti','Telefon Tutucu','Prototip Kapak','Bracket V2','Sensor Muhafazası','Drone Kol','Klips Seti'])[1 + (i % 7)],
        'Müşteri siparişi - öncelikli',
        80 + (i * 7) % 200,
        350 + (i * 47) % 800,
        CASE WHEN i > 2 THEN 'completed' WHEN i = 0 THEN 'in_progress' ELSE 'completed' END,
        CASE WHEN i = 0 THEN '#3b82f6' WHEN i > 2 THEN '#22c55e' ELSE '#22c55e' END
      ) RETURNING id INTO j_id;
      INSERT INTO job_notes (job_id, content, is_voice) VALUES
        (j_id, '150 gram PETG kullanıldı, müşteri memnun', i % 3 = 0);
    END IF;

    -- Machine 2 - every other day
    IF i % 2 = 0 THEN
      INSERT INTO jobs (user_id, machine_id, customer_id, material_id, job_date, title, grams_used, revenue_amount, status, cell_color)
      VALUES (
        v_user_id, mac2,
        (ARRAY[c4,c6,c8,c10,c12])[1 + (i % 5)],
        (ARRAY[m_pla,m_silk,m_nylon,m_pc])[1 + (i % 4)],
        d,
        (ARRAY['Mimari Maket Kat 1','Kolye Kalıbı','Robot Parçası','Pervane','Flanş'])[1 + (i % 5)],
        120 + (i * 11) % 300,
        500 + (i * 61) % 1200,
        CASE WHEN i = 1 THEN 'pending' WHEN i = 0 THEN 'in_progress' ELSE 'completed' END,
        CASE WHEN i <= 1 THEN '#f59e0b' ELSE '#22c55e' END
      ) RETURNING id INTO j_id;
      INSERT INTO job_notes (job_id, content, is_voice) VALUES (j_id, 'Detaylı post-processing gerekli', false);
    END IF;

    -- Machine 3 - every 3 days
    IF i % 3 = 0 THEN
      INSERT INTO jobs (user_id, machine_id, customer_id, material_id, job_date, title, grams_used, revenue_amount, status, cell_color)
      VALUES (
        v_user_id, mac3,
        (ARRAY[c3,c11,c14,c15])[1 + (i % 4)],
        (ARRAY[m_asa,m_abs,m_tpu])[1 + (i % 3)],
        d,
        (ARRAY['Otomotiv Klipsi','Heykel Prototip','RC Gövde','Şişe Kapak Prototip'])[1 + (i % 4)],
        200 + (i * 13) % 400,
        800 + (i * 73) % 2000,
        CASE WHEN i = 3 THEN 'cancelled' ELSE 'completed' END,
        CASE WHEN i = 3 THEN '#ef4444' ELSE '#22c55e' END
      ) RETURNING id INTO j_id;
    END IF;

    -- Machine 5 - weekly-ish
    IF i % 4 = 0 THEN
      INSERT INTO jobs (user_id, machine_id, customer_id, material_id, job_date, title, grams_used, revenue_amount, status, cell_color)
      VALUES (
        v_user_id, mac5,
        (ARRAY[c2,c9,c14])[1 + (i % 3)],
        m_pla, d,
        (ARRAY['Figürin Set','Oyun Token','Mini araç'])[1 + (i % 3)],
        45 + (i * 5) % 100,
        150 + (i * 29) % 400,
        'completed', '#22c55e'
      ) RETURNING id INTO j_id;
      INSERT INTO job_notes (job_id, content, is_voice, parsed_data) VALUES
        (j_id, 'PLA ile basıldı, 65 gram', true, '{"material":"PLA","grams":65}'::jsonb);
    END IF;
  END LOOP;

  -- Extra pending jobs (future dates, no conflict)
  INSERT INTO jobs (user_id, machine_id, customer_id, material_id, job_date, title, grams_used, revenue_amount, status, cell_color)
  VALUES
    (v_user_id, mac2, c4, m_pla, CURRENT_DATE + 1, 'Maket Kat 2', 280, 950, 'pending', '#f59e0b'),
    (v_user_id, mac3, c5, m_asa, CURRENT_DATE + 1, 'Medikal Klips V3', 120, 680, 'pending', '#f59e0b'),
    (v_user_id, mac5, c13, m_pla, CURRENT_DATE + 2, 'Startup MVP Parça A', 55, 220, 'pending', '#f59e0b'),
    (v_user_id, mac4, c12, m_pc, CURRENT_DATE + 3, 'Endüstriyel Flanş V2', 340, 1800, 'pending', '#f59e0b');

  RAISE NOTICE 'Seed complete for user % (dev.busraaktas@gmail.com)', v_user_id;
END $$;
