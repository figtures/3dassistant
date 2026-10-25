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
