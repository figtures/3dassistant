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
