-- ═══════════════════════════════════════════════════════════════
-- PrintFlow — Dev Setup (Supabase SQL Editor'de çalıştırın)
-- Proje: xcxbvsciostxueblyfbj
-- Email: dev.busraaktas@gmail.com
-- ═══════════════════════════════════════════════════════════════
--
-- CLI push başarısız olursa bu dosyayı Supabase Dashboard → SQL Editor'de
-- tek seferde çalıştırın, ardından: npm run seed:dev
--
-- İlgili migration dosyaları:
--   007_material_colors.sql
--   008_multiple_jobs_per_cell.sql
--   009_printflow_features.sql
--   010_procurement.sql
--   011_catalog.sql
--   012_inventory_sales.sql
--   013_job_stock_and_purchase.sql
--   014_machine_monitoring.sql
--   015_cloud_printer_integrations.sql
--   016_subscriptions.sql
--   017_cloud_sync_scheduling.sql

-- 1) Profile trigger düzeltmesi (kayıt hatasını giderir)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, company_name)
  VALUES (
    NEW.id, NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'company_name'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    company_name = COALESCE(EXCLUDED.company_name, profiles.company_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) revenue_amount kolonu (yoksa ekle)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS revenue_amount DECIMAL(10,2) DEFAULT 0;

-- 2b) Teslim tarihi + gecikme hatırlatma
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS delivery_date DATE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_overdue_reminder_at TIMESTAMPTZ;
UPDATE jobs SET delivery_date = job_date WHERE delivery_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_delivery_date ON jobs(delivery_date);

-- 2c) Malzeme renk varyantları (007)
CREATE TABLE IF NOT EXISTS material_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  color_name TEXT NOT NULL,
  hex_code TEXT,
  stock_grams INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(material_id, color_name)
);

CREATE INDEX IF NOT EXISTS idx_material_colors_material ON material_colors(material_id);
CREATE INDEX IF NOT EXISTS idx_material_colors_user ON material_colors(user_id);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS material_color_id UUID REFERENCES material_colors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_material_color ON jobs(material_color_id);

-- Mevcut malzemelerden renk taşı
INSERT INTO material_colors (material_id, user_id, color_name, stock_grams, sort_order)
SELECT m.id, m.user_id, m.color, m.stock_grams, 0
FROM materials m
WHERE m.color IS NOT NULL AND m.color <> ''
  AND NOT EXISTS (SELECT 1 FROM material_colors mc WHERE mc.material_id = m.id);

INSERT INTO material_colors (material_id, user_id, color_name, stock_grams, sort_order)
SELECT m.id, m.user_id, 'Varsayılan', m.stock_grams, 0
FROM materials m
WHERE (m.color IS NULL OR m.color = '')
  AND NOT EXISTS (SELECT 1 FROM material_colors mc WHERE mc.material_id = m.id);

UPDATE jobs j
SET material_color_id = (
  SELECT mc.id FROM material_colors mc
  WHERE mc.material_id = j.material_id
  ORDER BY mc.sort_order, mc.created_at
  LIMIT 1
)
WHERE j.material_id IS NOT NULL AND j.material_color_id IS NULL;

DROP TRIGGER IF EXISTS material_colors_updated_at ON material_colors;
CREATE TRIGGER material_colors_updated_at
  BEFORE UPDATE ON material_colors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE material_colors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own material colors" ON material_colors;
DROP POLICY IF EXISTS "Users can insert own material colors" ON material_colors;
DROP POLICY IF EXISTS "Users can update own material colors" ON material_colors;
DROP POLICY IF EXISTS "Users can delete own material colors" ON material_colors;

CREATE POLICY "Users can view own material colors" ON material_colors
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own material colors" ON material_colors
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own material colors" ON material_colors
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own material colors" ON material_colors
  FOR DELETE USING (auth.uid() = user_id);

-- 2d) Aynı gün + makinede birden fazla iş emri (008)
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.jobs'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) ILIKE '%user_id%'
    AND pg_get_constraintdef(oid) ILIKE '%machine_id%'
    AND pg_get_constraintdef(oid) ILIKE '%job_date%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.jobs DROP CONSTRAINT %I', cname);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_jobs_user_machine_date ON public.jobs(user_id, machine_id, job_date);

-- 2e) Yeni özellikler (009) — süre, ödeme, müşteri kaynağı, arızalar
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_payment_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_payment_status_check
  CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'upcoming'));

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS amount_remaining DECIMAL(10,2) DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_due_date DATE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS installment_count INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS installment_amount DECIMAL(10,2);

CREATE INDEX IF NOT EXISTS idx_jobs_payment_status ON jobs(payment_status);
CREATE INDEX IF NOT EXISTS idx_jobs_payment_due_date ON jobs(payment_due_date);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referred_by_customer_id UUID
  REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_source ON customers(source);

CREATE TABLE IF NOT EXISTS fault_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_fault_types_user ON fault_types(user_id);

CREATE TABLE IF NOT EXISTS faults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  fault_type_id UUID REFERENCES fault_types(id) ON DELETE SET NULL,
  fault_type_name TEXT,
  duration_hours DECIMAL(6,2) DEFAULT 0,
  description TEXT,
  fault_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE faults DROP CONSTRAINT IF EXISTS faults_status_check;
ALTER TABLE faults ADD CONSTRAINT faults_status_check
  CHECK (status IN ('open', 'in_progress', 'resolved'));

CREATE INDEX IF NOT EXISTS idx_faults_user ON faults(user_id);
CREATE INDEX IF NOT EXISTS idx_faults_machine ON faults(machine_id);
CREATE INDEX IF NOT EXISTS idx_faults_date ON faults(fault_date);

DROP TRIGGER IF EXISTS fault_types_updated_at ON fault_types;
CREATE TRIGGER fault_types_updated_at
  BEFORE UPDATE ON fault_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS faults_updated_at ON faults;
CREATE TRIGGER faults_updated_at
  BEFORE UPDATE ON faults
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE fault_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE faults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own fault types" ON fault_types;
DROP POLICY IF EXISTS "Users can insert own fault types" ON fault_types;
DROP POLICY IF EXISTS "Users can update own fault types" ON fault_types;
DROP POLICY IF EXISTS "Users can delete own fault types" ON fault_types;

CREATE POLICY "Users can view own fault types" ON fault_types
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own fault types" ON fault_types
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own fault types" ON fault_types
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own fault types" ON fault_types
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own faults" ON faults;
DROP POLICY IF EXISTS "Users can insert own faults" ON faults;
DROP POLICY IF EXISTS "Users can update own faults" ON faults;
DROP POLICY IF EXISTS "Users can delete own faults" ON faults;

CREATE POLICY "Users can view own faults" ON faults
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own faults" ON faults
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own faults" ON faults
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own faults" ON faults
  FOR DELETE USING (auth.uid() = user_id);


-- 2f) 010_procurement.sql
-- Phase A: Procurement (Tedarik)

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_user ON suppliers(user_id);

CREATE TABLE IF NOT EXISTS material_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  material_color_id UUID REFERENCES material_colors(id) ON DELETE SET NULL,
  grams INTEGER NOT NULL DEFAULT 0 CHECK (grams >= 0),
  unit_price DECIMAL(12,4) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  channel TEXT,
  order_url TEXT,
  invoice_ref TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_material_purchases_user ON material_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_material_purchases_date ON material_purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_material_purchases_material ON material_purchases(material_id);

CREATE TRIGGER suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER material_purchases_updated_at
  BEFORE UPDATE ON material_purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Stok: satın alma kaydında renk seçiliyse gram ekle
CREATE OR REPLACE FUNCTION apply_purchase_stock_delta()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.material_color_id IS NOT NULL AND NEW.grams > 0 THEN
      UPDATE material_colors
      SET stock_grams = stock_grams + NEW.grams
      WHERE id = NEW.material_color_id AND user_id = NEW.user_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.material_color_id IS NOT NULL AND OLD.grams > 0 THEN
      UPDATE material_colors
      SET stock_grams = GREATEST(0, stock_grams - OLD.grams)
      WHERE id = OLD.material_color_id AND user_id = OLD.user_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.material_color_id IS NOT NULL AND OLD.grams > 0 THEN
      UPDATE material_colors
      SET stock_grams = GREATEST(0, stock_grams - OLD.grams)
      WHERE id = OLD.material_color_id AND user_id = OLD.user_id;
    END IF;
    IF NEW.material_color_id IS NOT NULL AND NEW.grams > 0 THEN
      UPDATE material_colors
      SET stock_grams = stock_grams + NEW.grams
      WHERE id = NEW.material_color_id AND user_id = NEW.user_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS material_purchases_stock ON material_purchases;
CREATE TRIGGER material_purchases_stock
  AFTER INSERT OR UPDATE OR DELETE ON material_purchases
  FOR EACH ROW EXECUTE FUNCTION apply_purchase_stock_delta();

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own suppliers" ON suppliers
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own suppliers" ON suppliers
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own suppliers" ON suppliers
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own suppliers" ON suppliers
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own purchases" ON material_purchases
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own purchases" ON material_purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own purchases" ON material_purchases
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own purchases" ON material_purchases
  FOR DELETE USING (auth.uid() = user_id);

-- 2g) 011_catalog.sql
-- Phase B: Catalog + file vault

CREATE TABLE IF NOT EXISTS catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  default_material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  default_grams INTEGER,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_catalog_items_user ON catalog_items(user_id);

CREATE TABLE IF NOT EXISTS catalog_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL CHECK (file_type IN ('stl', '3mf', 'image', 'zip', 'other')),
  path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_size BIGINT,
  checksum TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_files_item ON catalog_files(item_id);

CREATE TABLE IF NOT EXISTS catalog_item_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  catalog_item_id UUID NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(catalog_item_id, job_id)
);

CREATE TRIGGER catalog_items_updated_at
  BEFORE UPDATE ON catalog_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_item_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own catalog items" ON catalog_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own catalog items" ON catalog_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own catalog items" ON catalog_items
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own catalog items" ON catalog_items
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own catalog files" ON catalog_files
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own catalog files" ON catalog_files
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own catalog files" ON catalog_files
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own catalog item jobs" ON catalog_item_jobs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own catalog item jobs" ON catalog_item_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own catalog item jobs" ON catalog_item_jobs
  FOR DELETE USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('catalog-files', 'catalog-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own catalog files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'catalog-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own catalog files storage"
ON storage.objects FOR SELECT
USING (bucket_id = 'catalog-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own catalog files storage"
ON storage.objects FOR DELETE
USING (bucket_id = 'catalog-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 2h) 012_inventory_sales.sql
-- Phase C: Inventory, sales, fulfillment, events

CREATE TABLE IF NOT EXISTS catalog_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  quantity_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  quantity_reserved INTEGER NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_inventory_item ON catalog_inventory(item_id);

CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  channel TEXT,
  platform TEXT,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  sold_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON sales(sold_at);

CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  carrier TEXT,
  tracking_number TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'shipped', 'in_transit', 'delivered', 'returned')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_sale ON shipments(sale_id);

CREATE TABLE IF NOT EXISTS catalog_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_events_item ON catalog_events(item_id);
CREATE INDEX IF NOT EXISTS idx_catalog_events_created ON catalog_events(created_at);

CREATE TRIGGER catalog_inventory_updated_at
  BEFORE UPDATE ON catalog_inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER shipments_updated_at
  BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION ensure_catalog_inventory_row()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO catalog_inventory (user_id, item_id, quantity_on_hand, quantity_reserved)
  VALUES (NEW.user_id, NEW.id, 0, 0)
  ON CONFLICT (user_id, item_id) DO NOTHING;
  INSERT INTO catalog_events (user_id, item_id, event_type, payload)
  VALUES (NEW.user_id, NEW.id, 'item_created', jsonb_build_object('sku', NEW.sku, 'name', NEW.name));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS catalog_items_inventory ON catalog_items;
CREATE TRIGGER catalog_items_inventory
  AFTER INSERT ON catalog_items
  FOR EACH ROW EXECUTE FUNCTION ensure_catalog_inventory_row();

CREATE OR REPLACE FUNCTION apply_sale_inventory_delta()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO catalog_inventory (user_id, item_id, quantity_on_hand, quantity_reserved)
    VALUES (NEW.user_id, NEW.item_id, 0, 0)
    ON CONFLICT (user_id, item_id) DO NOTHING;

    UPDATE catalog_inventory
    SET quantity_on_hand = GREATEST(0, quantity_on_hand - NEW.quantity)
    WHERE user_id = NEW.user_id AND item_id = NEW.item_id;

    INSERT INTO catalog_events (user_id, item_id, event_type, payload)
    VALUES (
      NEW.user_id, NEW.item_id, 'sale',
      jsonb_build_object('sale_id', NEW.id, 'quantity', NEW.quantity, 'unit_price', NEW.unit_price)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE catalog_inventory
    SET quantity_on_hand = quantity_on_hand + OLD.quantity
    WHERE user_id = OLD.user_id AND item_id = OLD.item_id;

    INSERT INTO catalog_events (user_id, item_id, event_type, payload)
    VALUES (
      OLD.user_id, OLD.item_id, 'sale_reversed',
      jsonb_build_object('quantity', OLD.quantity)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS sales_inventory ON sales;
CREATE TRIGGER sales_inventory
  AFTER INSERT OR DELETE ON sales
  FOR EACH ROW EXECUTE FUNCTION apply_sale_inventory_delta();

ALTER TABLE catalog_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own catalog inventory" ON catalog_inventory
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own catalog inventory" ON catalog_inventory
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own catalog inventory" ON catalog_inventory
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own sales" ON sales
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sales" ON sales
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own sales" ON sales
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own shipments" ON shipments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own shipments" ON shipments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own shipments" ON shipments
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own shipments" ON shipments
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own catalog events" ON catalog_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own catalog events" ON catalog_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2i) 013_job_stock_and_purchase.sql
-- Job completion stock deduction + purchase without color updates material total

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION sync_material_total_stock(material_uuid UUID, owner_uuid UUID)
RETURNS void AS $$
BEGIN
  IF material_uuid IS NULL THEN
    RETURN;
  END IF;
  UPDATE materials m
  SET stock_grams = COALESCE((
    SELECT SUM(mc.stock_grams)::INTEGER
    FROM material_colors mc
    WHERE mc.material_id = material_uuid AND mc.user_id = owner_uuid
  ), 0)
  WHERE m.id = material_uuid AND m.user_id = owner_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION apply_purchase_stock_delta()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.material_color_id IS NOT NULL AND NEW.grams > 0 THEN
      UPDATE material_colors
      SET stock_grams = stock_grams + NEW.grams
      WHERE id = NEW.material_color_id AND user_id = NEW.user_id;
      PERFORM sync_material_total_stock(NEW.material_id, NEW.user_id);
    ELSIF NEW.material_color_id IS NULL AND NEW.grams > 0 THEN
      UPDATE materials
      SET stock_grams = stock_grams + NEW.grams
      WHERE id = NEW.material_id AND user_id = NEW.user_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.material_color_id IS NOT NULL AND OLD.grams > 0 THEN
      UPDATE material_colors
      SET stock_grams = GREATEST(0, stock_grams - OLD.grams)
      WHERE id = OLD.material_color_id AND user_id = OLD.user_id;
      PERFORM sync_material_total_stock(OLD.material_id, OLD.user_id);
    ELSIF OLD.material_color_id IS NULL AND OLD.grams > 0 THEN
      UPDATE materials
      SET stock_grams = GREATEST(0, stock_grams - OLD.grams)
      WHERE id = OLD.material_id AND user_id = OLD.user_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.material_color_id IS NOT NULL AND OLD.grams > 0 THEN
      UPDATE material_colors
      SET stock_grams = GREATEST(0, stock_grams - OLD.grams)
      WHERE id = OLD.material_color_id AND user_id = OLD.user_id;
    END IF;
    IF OLD.material_color_id IS NULL AND OLD.grams > 0 THEN
      UPDATE materials
      SET stock_grams = GREATEST(0, stock_grams - OLD.grams)
      WHERE id = OLD.material_id AND user_id = OLD.user_id;
    END IF;
    IF NEW.material_color_id IS NOT NULL AND NEW.grams > 0 THEN
      UPDATE material_colors
      SET stock_grams = stock_grams + NEW.grams
      WHERE id = NEW.material_color_id AND user_id = NEW.user_id;
      PERFORM sync_material_total_stock(NEW.material_id, NEW.user_id);
    ELSIF NEW.material_color_id IS NULL AND NEW.grams > 0 THEN
      UPDATE materials
      SET stock_grams = stock_grams + NEW.grams
      WHERE id = NEW.material_id AND user_id = NEW.user_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION jobs_apply_stock_change()
RETURNS TRIGGER AS $$
DECLARE
  grams INT;
BEGIN
  grams := COALESCE(NEW.grams_used, 0);

  IF TG_OP = 'UPDATE' AND OLD.stock_deducted AND NEW.status IS DISTINCT FROM 'completed' THEN
    IF OLD.material_color_id IS NOT NULL AND COALESCE(OLD.grams_used, 0) > 0 THEN
      UPDATE material_colors
      SET stock_grams = stock_grams + OLD.grams_used
      WHERE id = OLD.material_color_id AND user_id = OLD.user_id;
      PERFORM sync_material_total_stock(OLD.material_id, OLD.user_id);
    END IF;
    NEW.stock_deducted := false;
  END IF;

  IF NEW.status = 'completed' AND NOT NEW.stock_deducted
     AND NEW.material_color_id IS NOT NULL AND grams > 0 THEN
    UPDATE material_colors
    SET stock_grams = GREATEST(0, stock_grams - grams)
    WHERE id = NEW.material_color_id AND user_id = NEW.user_id;
    PERFORM sync_material_total_stock(NEW.material_id, NEW.user_id);
    NEW.stock_deducted := true;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.stock_deducted AND NEW.stock_deducted THEN
    IF OLD.material_color_id IS DISTINCT FROM NEW.material_color_id
       OR COALESCE(OLD.grams_used, 0) IS DISTINCT FROM COALESCE(NEW.grams_used, 0) THEN
      IF OLD.material_color_id IS NOT NULL AND COALESCE(OLD.grams_used, 0) > 0 THEN
        UPDATE material_colors
        SET stock_grams = stock_grams + OLD.grams_used
        WHERE id = OLD.material_color_id AND user_id = OLD.user_id;
      END IF;
      IF NEW.material_color_id IS NOT NULL AND grams > 0 THEN
        UPDATE material_colors
        SET stock_grams = GREATEST(0, stock_grams - grams)
        WHERE id = NEW.material_color_id AND user_id = NEW.user_id;
      ELSE
        NEW.stock_deducted := false;
      END IF;
      PERFORM sync_material_total_stock(NEW.material_id, NEW.user_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS jobs_stock_on_change ON jobs;
CREATE TRIGGER jobs_stock_on_change
  BEFORE INSERT OR UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION jobs_apply_stock_change();

-- 2j) 014_machine_monitoring.sql
-- PrintFlow: makine bağlantıları ve canlı telemetri (OctoPrint MVP)

ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS connection_status TEXT DEFAULT 'never'
    CHECK (connection_status IN ('connected', 'disconnected', 'error', 'never')),
  ADD COLUMN IF NOT EXISTS printer_state TEXT DEFAULT 'unknown'
    CHECK (printer_state IN ('printing', 'paused', 'idle', 'error', 'offline', 'unknown')),
  ADD COLUMN IF NOT EXISTS job_name TEXT,
  ADD COLUMN IF NOT EXISTS progress_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS print_time_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS telemetry_raw JSONB,
  ADD COLUMN IF NOT EXISTS telemetry_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN machines.connection_status IS 'Son başarılı iletişim durumu';
COMMENT ON COLUMN machines.printer_state IS 'Yazıcı operasyonel durumu (adapter normalize)';

CREATE TABLE IF NOT EXISTS machine_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL UNIQUE REFERENCES machines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  adapter_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (adapter_type IN ('octoprint', 'moonraker', 'manual')),
  base_url TEXT,
  api_key TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_test_ok BOOLEAN,
  last_test_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_machine_connections_user ON machine_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_machine_connections_enabled ON machine_connections(enabled) WHERE enabled = true;

DROP TRIGGER IF EXISTS machine_connections_updated_at ON machine_connections;
CREATE TRIGGER machine_connections_updated_at
  BEFORE UPDATE ON machine_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE machine_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own machine connections" ON machine_connections;
CREATE POLICY "Users can view own machine connections"
  ON machine_connections FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own machine connections" ON machine_connections;
CREATE POLICY "Users can insert own machine connections"
  ON machine_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own machine connections" ON machine_connections;
CREATE POLICY "Users can update own machine connections"
  ON machine_connections FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own machine connections" ON machine_connections;
CREATE POLICY "Users can delete own machine connections"
  ON machine_connections FOR DELETE USING (auth.uid() = user_id);

COMMENT ON COLUMN machine_connections.api_key IS 'MVP RLS-only; production için şifreleme planlandı';

-- 2k) 015_cloud_printer_integrations.sql
CREATE TABLE IF NOT EXISTS printer_integration_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor TEXT NOT NULL CHECK (vendor IN ('bambu', 'prusa', 'creality')),
  display_name TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  api_key TEXT,
  token_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'error', 'disconnected')),
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_printer_integration_accounts_user
  ON printer_integration_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_printer_integration_accounts_vendor
  ON printer_integration_accounts(user_id, vendor);

DROP TRIGGER IF EXISTS printer_integration_accounts_updated_at ON printer_integration_accounts;
CREATE TRIGGER printer_integration_accounts_updated_at
  BEFORE UPDATE ON printer_integration_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE printer_integration_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own printer integration accounts" ON printer_integration_accounts;
CREATE POLICY "Users can view own printer integration accounts"
  ON printer_integration_accounts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own printer integration accounts" ON printer_integration_accounts;
CREATE POLICY "Users can insert own printer integration accounts"
  ON printer_integration_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own printer integration accounts" ON printer_integration_accounts;
CREATE POLICY "Users can update own printer integration accounts"
  ON printer_integration_accounts FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own printer integration accounts" ON printer_integration_accounts;
CREATE POLICY "Users can delete own printer integration accounts"
  ON printer_integration_accounts FOR DELETE USING (auth.uid() = user_id);

COMMENT ON COLUMN printer_integration_accounts.api_key IS 'MVP RLS-only; sunucu route okur, istemciye gönderilmez';

CREATE TABLE IF NOT EXISTS machine_cloud_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL UNIQUE REFERENCES machines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_account_id UUID NOT NULL
    REFERENCES printer_integration_accounts(id) ON DELETE CASCADE,
  external_device_id TEXT NOT NULL,
  external_device_name TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (integration_account_id, external_device_id)
);

CREATE INDEX IF NOT EXISTS idx_machine_cloud_links_user ON machine_cloud_links(user_id);
CREATE INDEX IF NOT EXISTS idx_machine_cloud_links_account ON machine_cloud_links(integration_account_id);
CREATE INDEX IF NOT EXISTS idx_machine_cloud_links_enabled ON machine_cloud_links(enabled) WHERE enabled = true;

DROP TRIGGER IF EXISTS machine_cloud_links_updated_at ON machine_cloud_links;
CREATE TRIGGER machine_cloud_links_updated_at
  BEFORE UPDATE ON machine_cloud_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE machine_cloud_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own machine cloud links" ON machine_cloud_links;
CREATE POLICY "Users can view own machine cloud links"
  ON machine_cloud_links FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own machine cloud links" ON machine_cloud_links;
CREATE POLICY "Users can insert own machine cloud links"
  ON machine_cloud_links FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own machine cloud links" ON machine_cloud_links;
CREATE POLICY "Users can update own machine cloud links"
  ON machine_cloud_links FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own machine cloud links" ON machine_cloud_links;
CREATE POLICY "Users can delete own machine cloud links"
  ON machine_cloud_links FOR DELETE USING (auth.uid() = user_id);

-- 2l) 016_subscriptions.sql — Paddle abonelikleri ve kota kapıları
CREATE TABLE IF NOT EXISTS billing_customers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  paddle_customer_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS billing_customers_updated_at ON billing_customers;
CREATE TRIGGER billing_customers_updated_at
  BEFORE UPDATE ON billing_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  paddle_subscription_id TEXT NOT NULL UNIQUE,
  paddle_customer_id TEXT NOT NULL,
  paddle_price_id TEXT,
  plan_key TEXT NOT NULL CHECK (plan_key IN ('starter', 'pro', 'farm')),
  status TEXT NOT NULL
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'paused')),
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  max_machines INTEGER NOT NULL CHECK (max_machines >= 0),
  cloud_monitoring BOOLEAN NOT NULL DEFAULT false,
  sync_per_tick INTEGER NOT NULL DEFAULT 0 CHECK (sync_per_tick >= 0),
  paddle_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_entitled
  ON subscriptions(status) WHERE status IN ('trialing', 'active', 'past_due');

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own billing customer" ON billing_customers;
CREATE POLICY "Users can view own billing customer"
  ON billing_customers FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION effective_entitlements(p_user UUID)
RETURNS TABLE (plan_key TEXT, max_machines INTEGER, cloud_monitoring BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT s.plan_key, s.max_machines, s.cloud_monitoring
    FROM subscriptions s
    WHERE s.user_id = p_user
      AND s.status IN ('trialing', 'active', 'past_due');
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'free'::TEXT, 2, false;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION effective_entitlements(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION enforce_machine_quota()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  ent RECORD;
  current_count INTEGER;
BEGIN
  IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('machine_quota:' || NEW.user_id::TEXT));

  SELECT * INTO ent FROM effective_entitlements(NEW.user_id);
  SELECT COUNT(*) INTO current_count FROM machines WHERE user_id = NEW.user_id;

  IF current_count >= ent.max_machines THEN
    RAISE EXCEPTION 'Planınız en fazla % makineye izin veriyor. Daha fazlası için planınızı yükseltin.', ent.max_machines
      USING ERRCODE = 'P0001', HINT = 'PLAN_MACHINE_LIMIT';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS machines_enforce_quota ON machines;
CREATE TRIGGER machines_enforce_quota
  BEFORE INSERT ON machines
  FOR EACH ROW EXECUTE FUNCTION enforce_machine_quota();

CREATE OR REPLACE FUNCTION enforce_cloud_monitoring()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  ent RECORD;
BEGIN
  IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  SELECT * INTO ent FROM effective_entitlements(NEW.user_id);
  IF NOT ent.cloud_monitoring THEN
    RAISE EXCEPTION 'Ücretsiz planda buluttan makine bağlama kilitlidir. Atölye veya Filament Farm planına geçin.'
      USING ERRCODE = 'P0001', HINT = 'PLAN_CLOUD_REQUIRED';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS printer_integration_accounts_enforce_plan ON printer_integration_accounts;
CREATE TRIGGER printer_integration_accounts_enforce_plan
  BEFORE INSERT ON printer_integration_accounts
  FOR EACH ROW EXECUTE FUNCTION enforce_cloud_monitoring();

DROP TRIGGER IF EXISTS machine_cloud_links_enforce_plan ON machine_cloud_links;
CREATE TRIGGER machine_cloud_links_enforce_plan
  BEFORE INSERT ON machine_cloud_links
  FOR EACH ROW EXECUTE FUNCTION enforce_cloud_monitoring();

-- 2m) 017_cloud_sync_scheduling.sql
ALTER TABLE machine_cloud_links
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_machine_cloud_links_sync_queue
  ON machine_cloud_links(last_synced_at NULLS FIRST)
  WHERE enabled = true;

-- 2n) 019_workshop_bridge.sql

CREATE TABLE IF NOT EXISTS workshop_bridges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Atölye köprüsü',
  token_hash TEXT NOT NULL UNIQUE,
  last_seen_at TIMESTAMPTZ,
  agent_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workshop_bridges_user ON workshop_bridges(user_id);

DROP TRIGGER IF EXISTS workshop_bridges_updated_at ON workshop_bridges;
CREATE TRIGGER workshop_bridges_updated_at
  BEFORE UPDATE ON workshop_bridges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS bridge_pairing_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  bridge_id UUID REFERENCES workshop_bridges(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bridge_pairing_codes_user ON bridge_pairing_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_bridge_pairing_codes_hash ON bridge_pairing_codes(code_hash);

CREATE TABLE IF NOT EXISTS bridge_machine_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bridge_id UUID NOT NULL REFERENCES workshop_bridges(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL UNIQUE REFERENCES machines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor TEXT NOT NULL DEFAULT 'bambu' CHECK (vendor IN ('bambu')),
  device_serial TEXT NOT NULL,
  lan_host TEXT,
  device_label TEXT,
  last_push_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bridge_bindings_bridge ON bridge_machine_bindings(bridge_id);
CREATE INDEX IF NOT EXISTS idx_bridge_bindings_user ON bridge_machine_bindings(user_id);

DROP TRIGGER IF EXISTS bridge_machine_bindings_updated_at ON bridge_machine_bindings;
CREATE TRIGGER bridge_machine_bindings_updated_at
  BEFORE UPDATE ON bridge_machine_bindings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE workshop_bridges ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_pairing_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_machine_bindings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own workshop bridges" ON workshop_bridges;
CREATE POLICY "Users view own workshop bridges"
  ON workshop_bridges FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users delete own workshop bridges" ON workshop_bridges;
CREATE POLICY "Users delete own workshop bridges"
  ON workshop_bridges FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own bridge bindings" ON bridge_machine_bindings;
CREATE POLICY "Users view own bridge bindings"
  ON bridge_machine_bindings FOR SELECT USING (auth.uid() = user_id);

-- 2o) 020_bridge_creality_vendor.sql
ALTER TABLE bridge_machine_bindings
  DROP CONSTRAINT IF EXISTS bridge_machine_bindings_vendor_check;
ALTER TABLE bridge_machine_bindings
  DROP CONSTRAINT IF EXISTS bridge_machine_bindings_vendor_check1;
ALTER TABLE bridge_machine_bindings
  ADD CONSTRAINT bridge_machine_bindings_vendor_check
  CHECK (vendor IN ('bambu', 'creality'));

-- 2p) 021_bridge_vendors_extended.sql
ALTER TABLE bridge_machine_bindings
  DROP CONSTRAINT IF EXISTS bridge_machine_bindings_vendor_check;
ALTER TABLE bridge_machine_bindings
  ADD CONSTRAINT bridge_machine_bindings_vendor_check
  CHECK (vendor IN (
    'bambu', 'creality', 'anycubic', 'elegoo', 'flashforge', 'snapmaker'
  ));

-- 2q) 022_machine_telemetry_history.sql
CREATE TABLE IF NOT EXISTS machine_telemetry_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  printer_state TEXT NOT NULL,
  connection_status TEXT NOT NULL DEFAULT 'connected',
  progress_percent REAL,
  job_name TEXT,
  print_time_seconds INTEGER
);
CREATE INDEX IF NOT EXISTS idx_machine_telemetry_machine_time
  ON machine_telemetry_snapshots(machine_id, recorded_at DESC);
ALTER TABLE machine_telemetry_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own telemetry snapshots" ON machine_telemetry_snapshots;
CREATE POLICY "Users view own telemetry snapshots"
  ON machine_telemetry_snapshots FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own telemetry snapshots" ON machine_telemetry_snapshots;
CREATE POLICY "Users insert own telemetry snapshots"
  ON machine_telemetry_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2r) 023_machine_temps_camera.sql
ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS bed_temp_c REAL,
  ADD COLUMN IF NOT EXISTS nozzle_temp_c REAL,
  ADD COLUMN IF NOT EXISTS chamber_temp_c REAL,
  ADD COLUMN IF NOT EXISTS camera_stream_url TEXT;
ALTER TABLE machine_telemetry_snapshots
  ADD COLUMN IF NOT EXISTS bed_temp_c REAL,
  ADD COLUMN IF NOT EXISTS nozzle_temp_c REAL,
  ADD COLUMN IF NOT EXISTS chamber_temp_c REAL;

-- 2s) 024_machine_camera_frames.sql
CREATE TABLE IF NOT EXISTS machine_camera_frames (
  machine_id UUID PRIMARY KEY REFERENCES machines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL DEFAULT 'image/jpeg',
  frame_data BYTEA NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_machine_camera_frames_user ON machine_camera_frames(user_id);
ALTER TABLE machine_camera_frames ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own machine camera frames" ON machine_camera_frames;
CREATE POLICY "Users view own machine camera frames"
  ON machine_camera_frames FOR SELECT USING (auth.uid() = user_id);

-- 2t) 025_bridge_vendors_discovery.sql
ALTER TABLE bridge_machine_bindings
  DROP CONSTRAINT IF EXISTS bridge_machine_bindings_vendor_check;
ALTER TABLE bridge_machine_bindings
  ADD CONSTRAINT bridge_machine_bindings_vendor_check
  CHECK (vendor IN (
    'bambu', 'creality', 'anycubic', 'elegoo', 'flashforge', 'snapmaker',
    'klipper', 'octoprint', 'prusalink'
  ));
CREATE INDEX IF NOT EXISTS idx_bridge_bindings_user_vendor_serial
  ON bridge_machine_bindings(user_id, vendor, device_serial);

-- 2u) 026_support_reports.sql
CREATE TABLE IF NOT EXISTS bridge_support_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_code TEXT NOT NULL UNIQUE,
  bridge_id UUID NOT NULL REFERENCES workshop_bridges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bridge_support_bundles_user_created
  ON bridge_support_bundles(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bridge_support_bundles_code ON bridge_support_bundles(bundle_code);

CREATE TABLE IF NOT EXISTS support_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('bridge', 'billing', 'order', 'other')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,
  machine_id UUID REFERENCES machines(id) ON DELETE SET NULL,
  bridge_bundle_id UUID REFERENCES bridge_support_bundles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_reports_user_created
  ON support_reports(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_reports_ticket ON support_reports(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_reports_status ON support_reports(status, created_at DESC);
DROP TRIGGER IF EXISTS support_reports_updated_at ON support_reports;
CREATE TRIGGER support_reports_updated_at
  BEFORE UPDATE ON support_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
ALTER TABLE bridge_support_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own bridge support bundles" ON bridge_support_bundles;
CREATE POLICY "Users view own bridge support bundles"
  ON bridge_support_bundles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users view own support reports" ON support_reports;
CREATE POLICY "Users view own support reports"
  ON support_reports FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own support reports" ON support_reports;
CREATE POLICY "Users insert own support reports"
  ON support_reports FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2v) 027_support_enhancements.sql
ALTER TABLE support_reports DROP CONSTRAINT IF EXISTS support_reports_status_check;
ALTER TABLE support_reports
  ADD CONSTRAINT support_reports_status_check
  CHECK (status IN ('open', 'in_progress', 'resolved'));
ALTER TABLE support_reports
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
DROP POLICY IF EXISTS "Users update own support reports" ON support_reports;
CREATE POLICY "Users update own support reports"
  ON support_reports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS support_report_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES support_reports(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('customer', 'staff')),
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_email TEXT,
  body TEXT NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 8000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_report_messages_report
  ON support_report_messages(report_id, created_at ASC);
ALTER TABLE support_report_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view messages on own reports" ON support_report_messages;
CREATE POLICY "Users view messages on own reports"
  ON support_report_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM support_reports r WHERE r.id = report_id AND r.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users insert customer messages on own reports" ON support_report_messages;
CREATE POLICY "Users insert customer messages on own reports"
  ON support_report_messages FOR INSERT
  WITH CHECK (
    author_type = 'customer' AND author_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM support_reports r WHERE r.id = report_id AND r.user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS client_error_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  route TEXT,
  message TEXT NOT NULL,
  stack TEXT,
  fingerprint TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'client' CHECK (source IN ('client', 'server')),
  count INTEGER NOT NULL DEFAULT 1 CHECK (count >= 1),
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sample_digest TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_error_events_user_fp
  ON client_error_events (user_id, fingerprint, source) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_error_events_anon_fp
  ON client_error_events (fingerprint, source) WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_client_error_events_last_seen ON client_error_events (last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_client_error_events_fingerprint ON client_error_events (fingerprint);
ALTER TABLE client_error_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users insert own client errors" ON client_error_events;
CREATE POLICY "Users insert own client errors"
  ON client_error_events FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
DROP POLICY IF EXISTS "Users view own client errors" ON client_error_events;
CREATE POLICY "Users view own client errors"
  ON client_error_events FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());
DROP POLICY IF EXISTS "Users update own client errors" ON client_error_events;
CREATE POLICY "Users update own client errors"
  ON client_error_events FOR UPDATE
  USING (user_id = auth.uid());

INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', false)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Users upload own support attachments" ON storage.objects;
CREATE POLICY "Users upload own support attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'support-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users read own support attachments" ON storage.objects;
CREATE POLICY "Users read own support attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'support-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Users delete own support attachments" ON storage.objects;
CREATE POLICY "Users delete own support attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'support-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 2w) 028_low_stock_threshold.sql
ALTER TABLE material_colors
  ADD COLUMN IF NOT EXISTS low_stock_grams INTEGER;

COMMENT ON COLUMN material_colors.low_stock_grams IS
  'Düşük stok uyarı eşiği (gram). NULL ise uygulama varsayılan 500 g kullanır.';

-- 2x) 029_workspaces.sql
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;

CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ui_version TEXT CHECK (ui_version IN ('v1', 'v2'))
);

COMMENT ON TABLE public.workspaces IS
  'Kiracı çalışma alanı; sahip kullanıcının id''si ile aynı uuid (P3-01 backfill).';

CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'operator', 'accountant', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members (user_id);

CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  email CITEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'operator', 'accountant', 'viewer')),
  token_hash TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace ON public.workspace_invites (workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_email ON public.workspace_invites (email);

CREATE OR REPLACE FUNCTION public.is_workspace_member(ws UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = ws
      AND wm.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.workspace_role(ws UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT wm.role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = ws
    AND wm.user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(ws UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.workspace_role(ws) IN ('owner', 'admin'), false);
$$;

GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.workspace_role(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(UUID) TO authenticated, anon;

INSERT INTO public.workspaces (id, name)
SELECT
  p.id,
  COALESCE(
    NULLIF(TRIM(p.company_name), ''),
    NULLIF(TRIM(p.full_name), ''),
    'Atölyem'
  )
FROM public.profiles p
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT p.id, p.id, 'owner'
FROM public.profiles p
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO public.workspaces (id, name)
SELECT
  u.id,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'company_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
    'Atölyem'
  )
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = u.id)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT u.id, u.id, 'owner'
FROM auth.users u
WHERE EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = u.id)
  AND NOT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = u.id
      AND wm.user_id = u.id
  )
ON CONFLICT (workspace_id, user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws_name TEXT;
BEGIN
  ws_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'company_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    'Atölyem'
  );

  INSERT INTO public.profiles (id, email, full_name, company_name)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'company_name'), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    company_name = COALESCE(EXCLUDED.company_name, public.profiles.company_name);

  INSERT INTO public.workspaces (id, name)
  VALUES (NEW.id, ws_name)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view workspace" ON public.workspaces;
CREATE POLICY "Workspace members can view workspace"
  ON public.workspaces
  FOR SELECT
  USING (public.is_workspace_member(id));

DROP POLICY IF EXISTS "Workspace admins can update workspace" ON public.workspaces;
CREATE POLICY "Workspace admins can update workspace"
  ON public.workspaces
  FOR UPDATE
  USING (public.is_workspace_admin(id))
  WITH CHECK (public.is_workspace_admin(id));

DROP POLICY IF EXISTS "Workspace members can view members" ON public.workspace_members;
CREATE POLICY "Workspace members can view members"
  ON public.workspace_members
  FOR SELECT
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace admins can insert members" ON public.workspace_members;
CREATE POLICY "Workspace admins can insert members"
  ON public.workspace_members
  FOR INSERT
  WITH CHECK (public.is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS "Workspace admins can update members" ON public.workspace_members;
CREATE POLICY "Workspace admins can update members"
  ON public.workspace_members
  FOR UPDATE
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS "Workspace admins can delete members" ON public.workspace_members;
CREATE POLICY "Workspace admins can delete members"
  ON public.workspace_members
  FOR DELETE
  USING (public.is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS "Workspace members can view invites" ON public.workspace_invites;
CREATE POLICY "Workspace members can view invites"
  ON public.workspace_invites
  FOR SELECT
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace admins can insert invites" ON public.workspace_invites;
CREATE POLICY "Workspace admins can insert invites"
  ON public.workspace_invites
  FOR INSERT
  WITH CHECK (public.is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS "Workspace admins can update invites" ON public.workspace_invites;
CREATE POLICY "Workspace admins can update invites"
  ON public.workspace_invites
  FOR UPDATE
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS "Workspace admins can delete invites" ON public.workspace_invites;
CREATE POLICY "Workspace admins can delete invites"
  ON public.workspace_invites
  FOR DELETE
  USING (public.is_workspace_admin(workspace_id));

-- 2y) 030_rls_workspace_members.sql
-- P3-02: Kiracı RLS — auth.uid() = user_id → is_workspace_member(user_id)
-- Bağımlılık: 029_workspaces (is_workspace_member, workspace_members backfill)
--
-- Karar tablosu (istisnalar):
-- | Tablo / alan | Karar |
-- | client_error_events | Kişisel telemetri; politikalar auth.uid() ile kalır (üye paylaşımı yok). |
-- | billing_customers, subscriptions | user_id = çalışma alanı id; SELECT → is_workspace_member (03-ux §4). UI kısıtı P3-05. |
-- | support_reports, support_report_messages | SELECT/UPDATE → is_workspace_admin(user_id); INSERT talep → is_workspace_member(user_id). |
-- | profiles | user_id yok (id = kullanıcı); dokunulmadı. |
-- | billing_webhook_events | Kullanıcı politikası yok (service role). |
-- | bridge_pairing_codes | Kullanıcı politikası yok (service role API). |
--
-- Storage klasör adı = workspace id (eski user_id); job-files, catalog-files, support-attachments.

-- materials
drop policy if exists "Users can view own materials" on public.materials;
create policy "Users can view own materials" on public.materials for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own materials" on public.materials;
create policy "Users can insert own materials" on public.materials for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own materials" on public.materials;
create policy "Users can update own materials" on public.materials for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own materials" on public.materials;
create policy "Users can delete own materials" on public.materials for delete using (public.is_workspace_member(user_id));

-- machines
drop policy if exists "Users can view own machines" on public.machines;
create policy "Users can view own machines" on public.machines for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own machines" on public.machines;
create policy "Users can insert own machines" on public.machines for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own machines" on public.machines;
create policy "Users can update own machines" on public.machines for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own machines" on public.machines;
create policy "Users can delete own machines" on public.machines for delete using (public.is_workspace_member(user_id));

-- customers
drop policy if exists "Users can view own customers" on public.customers;
create policy "Users can view own customers" on public.customers for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own customers" on public.customers;
create policy "Users can insert own customers" on public.customers for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own customers" on public.customers;
create policy "Users can update own customers" on public.customers for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own customers" on public.customers;
create policy "Users can delete own customers" on public.customers for delete using (public.is_workspace_member(user_id));

-- jobs
drop policy if exists "Users can view own jobs" on public.jobs;
create policy "Users can view own jobs" on public.jobs for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own jobs" on public.jobs;
create policy "Users can insert own jobs" on public.jobs for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own jobs" on public.jobs;
create policy "Users can update own jobs" on public.jobs for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own jobs" on public.jobs;
create policy "Users can delete own jobs" on public.jobs for delete using (public.is_workspace_member(user_id));

-- material_colors
drop policy if exists "Users can view own material colors" on public.material_colors;
create policy "Users can view own material colors" on public.material_colors for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own material colors" on public.material_colors;
create policy "Users can insert own material colors" on public.material_colors for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own material colors" on public.material_colors;
create policy "Users can update own material colors" on public.material_colors for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own material colors" on public.material_colors;
create policy "Users can delete own material colors" on public.material_colors for delete using (public.is_workspace_member(user_id));

-- fault_types
drop policy if exists "Users can view own fault types" on public.fault_types;
create policy "Users can view own fault types" on public.fault_types for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own fault types" on public.fault_types;
create policy "Users can insert own fault types" on public.fault_types for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own fault types" on public.fault_types;
create policy "Users can update own fault types" on public.fault_types for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own fault types" on public.fault_types;
create policy "Users can delete own fault types" on public.fault_types for delete using (public.is_workspace_member(user_id));

-- faults
drop policy if exists "Users can view own faults" on public.faults;
create policy "Users can view own faults" on public.faults for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own faults" on public.faults;
create policy "Users can insert own faults" on public.faults for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own faults" on public.faults;
create policy "Users can update own faults" on public.faults for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own faults" on public.faults;
create policy "Users can delete own faults" on public.faults for delete using (public.is_workspace_member(user_id));

-- suppliers
drop policy if exists "Users can view own suppliers" on public.suppliers;
create policy "Users can view own suppliers" on public.suppliers for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own suppliers" on public.suppliers;
create policy "Users can insert own suppliers" on public.suppliers for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own suppliers" on public.suppliers;
create policy "Users can update own suppliers" on public.suppliers for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own suppliers" on public.suppliers;
create policy "Users can delete own suppliers" on public.suppliers for delete using (public.is_workspace_member(user_id));

-- material_purchases
drop policy if exists "Users can view own purchases" on public.material_purchases;
create policy "Users can view own purchases" on public.material_purchases for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own purchases" on public.material_purchases;
create policy "Users can insert own purchases" on public.material_purchases for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own purchases" on public.material_purchases;
create policy "Users can update own purchases" on public.material_purchases for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own purchases" on public.material_purchases;
create policy "Users can delete own purchases" on public.material_purchases for delete using (public.is_workspace_member(user_id));

-- catalog_items
drop policy if exists "Users can view own catalog items" on public.catalog_items;
create policy "Users can view own catalog items" on public.catalog_items for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own catalog items" on public.catalog_items;
create policy "Users can insert own catalog items" on public.catalog_items for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own catalog items" on public.catalog_items;
create policy "Users can update own catalog items" on public.catalog_items for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own catalog items" on public.catalog_items;
create policy "Users can delete own catalog items" on public.catalog_items for delete using (public.is_workspace_member(user_id));

-- catalog_files
drop policy if exists "Users can view own catalog files" on public.catalog_files;
create policy "Users can view own catalog files" on public.catalog_files for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own catalog files" on public.catalog_files;
create policy "Users can delete own catalog files" on public.catalog_files for delete using (public.is_workspace_member(user_id));

-- catalog_item_jobs
drop policy if exists "Users can view own catalog item jobs" on public.catalog_item_jobs;
create policy "Users can view own catalog item jobs" on public.catalog_item_jobs for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own catalog item jobs" on public.catalog_item_jobs;
create policy "Users can delete own catalog item jobs" on public.catalog_item_jobs for delete using (public.is_workspace_member(user_id));

-- catalog_inventory
drop policy if exists "Users can view own catalog inventory" on public.catalog_inventory;
create policy "Users can view own catalog inventory" on public.catalog_inventory for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own catalog inventory" on public.catalog_inventory;
create policy "Users can insert own catalog inventory" on public.catalog_inventory for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own catalog inventory" on public.catalog_inventory;
create policy "Users can update own catalog inventory" on public.catalog_inventory for update using (public.is_workspace_member(user_id));

-- sales
drop policy if exists "Users can view own sales" on public.sales;
create policy "Users can view own sales" on public.sales for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own sales" on public.sales;
create policy "Users can insert own sales" on public.sales for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own sales" on public.sales;
create policy "Users can delete own sales" on public.sales for delete using (public.is_workspace_member(user_id));

-- shipments
drop policy if exists "Users can view own shipments" on public.shipments;
create policy "Users can view own shipments" on public.shipments for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own shipments" on public.shipments;
create policy "Users can insert own shipments" on public.shipments for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own shipments" on public.shipments;
create policy "Users can update own shipments" on public.shipments for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own shipments" on public.shipments;
create policy "Users can delete own shipments" on public.shipments for delete using (public.is_workspace_member(user_id));

-- catalog_events
drop policy if exists "Users can view own catalog events" on public.catalog_events;
create policy "Users can view own catalog events" on public.catalog_events for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own catalog events" on public.catalog_events;
create policy "Users can insert own catalog events" on public.catalog_events for insert with check (public.is_workspace_member(user_id));

-- machine_connections
drop policy if exists "Users can view own machine connections" on public.machine_connections;
create policy "Users can view own machine connections" on public.machine_connections for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own machine connections" on public.machine_connections;
create policy "Users can insert own machine connections" on public.machine_connections for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own machine connections" on public.machine_connections;
create policy "Users can update own machine connections" on public.machine_connections for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own machine connections" on public.machine_connections;
create policy "Users can delete own machine connections" on public.machine_connections for delete using (public.is_workspace_member(user_id));

-- printer_integration_accounts
drop policy if exists "Users can view own printer integration accounts" on public.printer_integration_accounts;
create policy "Users can view own printer integration accounts" on public.printer_integration_accounts for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own printer integration accounts" on public.printer_integration_accounts;
create policy "Users can insert own printer integration accounts" on public.printer_integration_accounts for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own printer integration accounts" on public.printer_integration_accounts;
create policy "Users can update own printer integration accounts" on public.printer_integration_accounts for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own printer integration accounts" on public.printer_integration_accounts;
create policy "Users can delete own printer integration accounts" on public.printer_integration_accounts for delete using (public.is_workspace_member(user_id));

-- machine_cloud_links
drop policy if exists "Users can view own machine cloud links" on public.machine_cloud_links;
create policy "Users can view own machine cloud links" on public.machine_cloud_links for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own machine cloud links" on public.machine_cloud_links;
create policy "Users can insert own machine cloud links" on public.machine_cloud_links for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can update own machine cloud links" on public.machine_cloud_links;
create policy "Users can update own machine cloud links" on public.machine_cloud_links for update using (public.is_workspace_member(user_id));
drop policy if exists "Users can delete own machine cloud links" on public.machine_cloud_links;
create policy "Users can delete own machine cloud links" on public.machine_cloud_links for delete using (public.is_workspace_member(user_id));

-- workshop_bridges
drop policy if exists "Users view own workshop bridges" on public.workshop_bridges;
create policy "Users view own workshop bridges" on public.workshop_bridges for select using (public.is_workspace_member(user_id));
drop policy if exists "Users delete own workshop bridges" on public.workshop_bridges;
create policy "Users delete own workshop bridges" on public.workshop_bridges for delete using (public.is_workspace_member(user_id));

-- bridge_machine_bindings
drop policy if exists "Users view own bridge bindings" on public.bridge_machine_bindings;
create policy "Users view own bridge bindings" on public.bridge_machine_bindings for select using (public.is_workspace_member(user_id));

-- machine_telemetry_snapshots
drop policy if exists "Users view own telemetry snapshots" on public.machine_telemetry_snapshots;
create policy "Users view own telemetry snapshots" on public.machine_telemetry_snapshots for select using (public.is_workspace_member(user_id));
drop policy if exists "Users insert own telemetry snapshots" on public.machine_telemetry_snapshots;
create policy "Users insert own telemetry snapshots" on public.machine_telemetry_snapshots for insert with check (public.is_workspace_member(user_id));

-- machine_camera_frames
drop policy if exists "Users view own machine camera frames" on public.machine_camera_frames;
create policy "Users view own machine camera frames" on public.machine_camera_frames for select using (public.is_workspace_member(user_id));

-- bridge_support_bundles
drop policy if exists "Users view own bridge support bundles" on public.bridge_support_bundles;
create policy "Users view own bridge support bundles" on public.bridge_support_bundles for select using (public.is_workspace_member(user_id));



-- catalog_files / catalog_item_jobs (insert politikaları)
drop policy if exists "Users can insert own catalog files" on public.catalog_files;
create policy "Users can insert own catalog files" on public.catalog_files
  for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users can insert own catalog item jobs" on public.catalog_item_jobs;
create policy "Users can insert own catalog item jobs" on public.catalog_item_jobs
  for insert with check (public.is_workspace_member(user_id));

-- job_notes / job_files (jobs.user_id = workspace id)
drop policy if exists "Users can view own job notes" on public.job_notes;
create policy "Users can view own job notes" on public.job_notes for select
  using (exists (
    select 1 from public.jobs j
    where j.id = job_notes.job_id and public.is_workspace_member(j.user_id)
  ));
drop policy if exists "Users can insert own job notes" on public.job_notes;
create policy "Users can insert own job notes" on public.job_notes for insert
  with check (exists (
    select 1 from public.jobs j
    where j.id = job_notes.job_id and public.is_workspace_member(j.user_id)
  ));
drop policy if exists "Users can delete own job notes" on public.job_notes;
create policy "Users can delete own job notes" on public.job_notes for delete
  using (exists (
    select 1 from public.jobs j
    where j.id = job_notes.job_id and public.is_workspace_member(j.user_id)
  ));

drop policy if exists "Users can view own job files" on public.job_files;
create policy "Users can view own job files" on public.job_files for select
  using (exists (
    select 1 from public.jobs j
    where j.id = job_files.job_id and public.is_workspace_member(j.user_id)
  ));
drop policy if exists "Users can insert own job files" on public.job_files;
create policy "Users can insert own job files" on public.job_files for insert
  with check (exists (
    select 1 from public.jobs j
    where j.id = job_files.job_id and public.is_workspace_member(j.user_id)
  ));
drop policy if exists "Users can delete own job files" on public.job_files;
create policy "Users can delete own job files" on public.job_files for delete
  using (exists (
    select 1 from public.jobs j
    where j.id = job_files.job_id and public.is_workspace_member(j.user_id)
  ));

-- billing (salt okunur)
drop policy if exists "Users can view own billing customer" on public.billing_customers;
create policy "Users can view own billing customer" on public.billing_customers
  for select using (public.is_workspace_member(user_id));
drop policy if exists "Users can view own subscription" on public.subscriptions;
create policy "Users can view own subscription" on public.subscriptions
  for select using (public.is_workspace_member(user_id));

-- destek
drop policy if exists "Users view own support reports" on public.support_reports;
create policy "Users view own support reports" on public.support_reports
  for select using (public.is_workspace_admin(user_id));
drop policy if exists "Users insert own support reports" on public.support_reports;
create policy "Users insert own support reports" on public.support_reports
  for insert with check (public.is_workspace_member(user_id));
drop policy if exists "Users update own support reports" on public.support_reports;
create policy "Users update own support reports" on public.support_reports
  for update using (public.is_workspace_admin(user_id));

drop policy if exists "Users view messages on own reports" on public.support_report_messages;
create policy "Users view messages on own reports" on public.support_report_messages
  for select using (exists (
    select 1 from public.support_reports r
    where r.id = report_id and public.is_workspace_admin(r.user_id)
  ));
drop policy if exists "Users insert customer messages on own reports" on public.support_report_messages;
create policy "Users insert customer messages on own reports" on public.support_report_messages
  for insert with check (
    author_type = 'customer'
    and author_user_id = auth.uid()
    and exists (
      select 1 from public.support_reports r
      where r.id = report_id and public.is_workspace_member(r.user_id)
    )
  );

-- storage (workspace klasörü)
drop policy if exists "Users can upload own job files" on storage.objects;
create policy "Users can upload own job files" on storage.objects for insert
  with check (
    bucket_id = 'job-files'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );
drop policy if exists "Users can view own job files storage" on storage.objects;
create policy "Users can view own job files storage" on storage.objects for select
  using (
    bucket_id = 'job-files'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );
drop policy if exists "Users can delete own job files storage" on storage.objects;
create policy "Users can delete own job files storage" on storage.objects for delete
  using (
    bucket_id = 'job-files'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "Users can upload own catalog files" on storage.objects;
create policy "Users can upload own catalog files" on storage.objects for insert
  with check (
    bucket_id = 'catalog-files'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );
drop policy if exists "Users can view own catalog files storage" on storage.objects;
create policy "Users can view own catalog files storage" on storage.objects for select
  using (
    bucket_id = 'catalog-files'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );
drop policy if exists "Users can delete own catalog files storage" on storage.objects;
create policy "Users can delete own catalog files storage" on storage.objects for delete
  using (
    bucket_id = 'catalog-files'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "Users upload own support attachments" on storage.objects;
create policy "Users upload own support attachments" on storage.objects for insert
  with check (
    bucket_id = 'support-attachments'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );
drop policy if exists "Users read own support attachments" on storage.objects;
create policy "Users read own support attachments" on storage.objects for select
  using (
    bucket_id = 'support-attachments'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );
drop policy if exists "Users delete own support attachments" on storage.objects;
create policy "Users delete own support attachments" on storage.objects for delete
  using (
    bucket_id = 'support-attachments'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

-- 2z) 031_audit_events.sql
-- P3-06: Denetim kaydı — audit_events + satır değişikliği trigger'ları

create table if not exists public.audit_events (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('insert', 'update', 'delete')),
  entity text not null,
  entity_id uuid,
  diff jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_workspace_created_idx
  on public.audit_events (workspace_id, created_at desc);

comment on table public.audit_events is 'Çalışma alanı denetim günlüğü; yalnızca trigger yazar.';

alter table public.audit_events enable row level security;

drop policy if exists "Workspace admins can read audit events" on public.audit_events;
create policy "Workspace admins can read audit events"
  on public.audit_events
  for select
  using (public.is_workspace_admin(workspace_id));

grant select on public.audit_events to authenticated;
grant usage, select on sequence public.audit_events_id_seq to authenticated;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  ent_id uuid;
  diff jsonb := null;
  skip_cols text[] := array['created_at', 'updated_at'];
  sensitive_cols text[] := array[
    'api_key',
    'access_token',
    'refresh_token',
    'token_hash',
    'token_expires_at'
  ];
  old_j jsonb;
  new_j jsonb;
begin
  if tg_table_name = 'workspace_members' then
    ws_id := coalesce(new.workspace_id, old.workspace_id);
    ent_id := coalesce(new.user_id, old.user_id);
  else
    ws_id := coalesce(new.user_id, old.user_id);
    ent_id := coalesce(new.id, old.id);
  end if;

  if ws_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new_j := to_jsonb(new);
    select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
      into diff
      from jsonb_each(new_j)
     where key <> all (skip_cols)
       and key <> all (sensitive_cols);

    insert into public.audit_events (workspace_id, actor_id, action, entity, entity_id, diff)
    values (ws_id, auth.uid(), 'insert', tg_table_name, ent_id, diff);
    return new;

  elsif tg_op = 'UPDATE' then
    old_j := to_jsonb(old);
    new_j := to_jsonb(new);
    select coalesce(
      jsonb_object_agg(
        n.key,
        jsonb_build_object('old', old_j -> n.key, 'new', n.value)
      ),
      '{}'::jsonb
    )
      into diff
      from jsonb_each(new_j) n
     where (old_j -> n.key) is distinct from n.value
       and n.key <> all (skip_cols)
       and n.key <> all (sensitive_cols);

    if diff = '{}'::jsonb then
      return new;
    end if;

    insert into public.audit_events (workspace_id, actor_id, action, entity, entity_id, diff)
    values (ws_id, auth.uid(), 'update', tg_table_name, ent_id, diff);
    return new;

  elsif tg_op = 'DELETE' then
    old_j := to_jsonb(old);
    select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
      into diff
      from jsonb_each(old_j)
     where key <> all (skip_cols)
       and key <> all (sensitive_cols);

    insert into public.audit_events (workspace_id, actor_id, action, entity, entity_id, diff)
    values (ws_id, auth.uid(), 'delete', tg_table_name, ent_id, diff);
    return old;
  end if;

  return null;
end;
$$;

comment on function public.audit_row_change() is 'Denetlenen tablolardaki DML → audit_events (hassas kolonlar hariç).';

drop trigger if exists audit_row_change on public.jobs;
create trigger audit_row_change
  after insert or update or delete on public.jobs
  for each row execute function public.audit_row_change();

drop trigger if exists audit_row_change on public.machines;
create trigger audit_row_change
  after insert or update or delete on public.machines
  for each row execute function public.audit_row_change();

drop trigger if exists audit_row_change on public.materials;
create trigger audit_row_change
  after insert or update or delete on public.materials
  for each row execute function public.audit_row_change();

drop trigger if exists audit_row_change on public.material_colors;
create trigger audit_row_change
  after insert or update or delete on public.material_colors
  for each row execute function public.audit_row_change();

drop trigger if exists audit_row_change on public.customers;
create trigger audit_row_change
  after insert or update or delete on public.customers
  for each row execute function public.audit_row_change();

drop trigger if exists audit_row_change on public.faults;
create trigger audit_row_change
  after insert or update or delete on public.faults
  for each row execute function public.audit_row_change();

drop trigger if exists audit_row_change on public.material_purchases;
create trigger audit_row_change
  after insert or update or delete on public.material_purchases
  for each row execute function public.audit_row_change();

drop trigger if exists audit_row_change on public.catalog_items;
create trigger audit_row_change
  after insert or update or delete on public.catalog_items
  for each row execute function public.audit_row_change();

drop trigger if exists audit_row_change on public.workspace_members;
create trigger audit_row_change
  after insert or update or delete on public.workspace_members
  for each row execute function public.audit_row_change();

-- 2aa) 032_notifications.sql
-- P3-07: Bildirim merkezi — notifications, tercihler, üretim trigger'ları

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (
    kind in ('machine', 'order', 'stock', 'payment', 'team', 'system')
  ),
  title text not null,
  body text,
  href text,
  seen_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_workspace_created_idx
  on public.notifications (user_id, workspace_id, created_at desc);

create index if not exists notifications_user_unseen_idx
  on public.notifications (user_id, workspace_id)
  where seen_at is null;

comment on table public.notifications is 'Kullanıcı bildirimleri (çalışma alanı kapsamlı).';

create table if not exists public.notification_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (
    kind in ('machine', 'order', 'stock', 'payment', 'team', 'system')
  ),
  in_app boolean not null default true,
  email boolean not null default false,
  primary key (user_id, kind)
);

comment on table public.notification_preferences is 'Bildirim kanal tercihleri (kullanıcı × tür).';

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;

drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications"
  on public.notifications
  for select
  using (
    user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  );

drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications"
  on public.notifications
  for update
  using (
    user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  )
  with check (user_id = auth.uid());

drop policy if exists "Users manage own notification preferences" on public.notification_preferences;
create policy "Users manage own notification preferences"
  on public.notification_preferences
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, update on public.notifications to authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;

create or replace function public.notification_pref_enabled(
  p_user_id uuid,
  p_kind text,
  p_channel text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pref record;
  default_in_app boolean := true;
  default_email boolean := false;
begin
  if p_kind in ('payment', 'team') then
    default_email := true;
  end if;

  select in_app, email
    into pref
    from public.notification_preferences np
   where np.user_id = p_user_id
     and np.kind = p_kind;

  if not found then
    if p_channel = 'in_app' then
      return default_in_app;
    elsif p_channel = 'email' then
      return default_email;
    end if;
    return false;
  end if;

  if p_channel = 'in_app' then
    return coalesce(pref.in_app, default_in_app);
  elsif p_channel = 'email' then
    return coalesce(pref.email, default_email);
  end if;

  return false;
end;
$$;

create or replace function public.notify_workspace_members(
  p_workspace_id uuid,
  p_kind text,
  p_title text,
  p_body text default null,
  p_href text default null,
  p_exclude_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  member record;
  dedupe_since timestamptz := now() - interval '6 hours';
begin
  for member in
    select wm.user_id
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and (p_exclude_user_id is null or wm.user_id <> p_exclude_user_id)
  loop
    if not public.notification_pref_enabled(member.user_id, p_kind, 'in_app') then
      continue;
    end if;

    if p_href is not null and exists (
      select 1
      from public.notifications n
      where n.user_id = member.user_id
        and n.workspace_id = p_workspace_id
        and n.kind = p_kind
        and n.href = p_href
        and n.created_at >= dedupe_since
    ) then
      continue;
    end if;

    insert into public.notifications (
      workspace_id,
      user_id,
      kind,
      title,
      body,
      href
    ) values (
      p_workspace_id,
      member.user_id,
      p_kind,
      p_title,
      p_body,
      p_href
    );
  end loop;
end;
$$;

create or replace function public.notify_machine_error()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and coalesce(old.printer_state, '') <> 'error'
     and new.printer_state = 'error' then
    perform public.notify_workspace_members(
      new.user_id,
      'machine',
      format('Makine hatası: %s', coalesce(new.name, 'Makine')),
      coalesce(new.error_message, 'Yazıcı hata durumuna geçti.'),
      format('/machines/%s', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_machine_error on public.machines;
create trigger notify_machine_error
  after update of printer_state on public.machines
  for each row
  execute function public.notify_machine_error();

create or replace function public.material_color_low_stock_threshold(p_row public.material_colors)
returns integer
language sql
stable
as $$
  select coalesce(p_row.low_stock_grams, 500);
$$;

create or replace function public.notify_material_low_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  threshold integer;
  was_low boolean;
  is_low boolean;
  mat_name text;
begin
  threshold := public.material_color_low_stock_threshold(new);
  was_low := coalesce(old.stock_grams, 0) < threshold;
  is_low := coalesce(new.stock_grams, 0) < threshold;

  if not is_low or was_low then
    return new;
  end if;

  select m.name into mat_name
  from public.materials m
  where m.id = new.material_id;

  perform public.notify_workspace_members(
    new.user_id,
    'stock',
    format('Düşük stok: %s — %s', coalesce(mat_name, 'Malzeme'), coalesce(new.color_name, 'Renk')),
    format('Stok %s g (eşik %s g).', coalesce(new.stock_grams, 0), threshold),
    '/materials'
  );

  return new;
end;
$$;

drop trigger if exists notify_material_low_stock on public.material_colors;
create trigger notify_material_low_stock
  after update of stock_grams, low_stock_grams on public.material_colors
  for each row
  execute function public.notify_material_low_stock();

create or replace function public.notify_invite_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  accepter_email text;
begin
  if tg_op = 'UPDATE'
     and old.accepted_at is null
     and new.accepted_at is not null then
    select p.email into accepter_email
    from public.profiles p
    where lower(p.email) = lower(new.email::text)
    limit 1;

    perform public.notify_workspace_members(
      new.workspace_id,
      'team',
      'Davet kabul edildi',
      format('%s çalışma alanına %s rolüyle katıldı.', coalesce(accepter_email, new.email::text), new.role),
      '/settings/team'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_invite_accepted on public.workspace_invites;
create trigger notify_invite_accepted
  after update of accepted_at on public.workspace_invites
  for each row
  execute function public.notify_invite_accepted();

-- 3) Auto confirm
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email = 'dev.busraaktas@gmail.com';

-- 4) Mock data
-- Kullanıcı kayıtlı olmalı — önce /register ile kayıt olun
-- Ardından: npm run seed:dev

SELECT
  CASE WHEN EXISTS (SELECT 1 FROM auth.users WHERE email = 'dev.busraaktas@gmail.com')
    THEN '✓ Kullanıcı bulundu — npm run seed:dev çalıştırın'
    ELSE '✗ Önce /register ile dev.busraaktas@gmail.com kaydı yapın, sonra npm run seed:dev'
  END AS durum;
