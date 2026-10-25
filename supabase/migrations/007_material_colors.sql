-- Malzeme renk varyantları (1 malzeme → çoklu renk)
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

-- Mevcut materials.color → material_colors
INSERT INTO material_colors (material_id, user_id, color_name, stock_grams, sort_order)
SELECT m.id, m.user_id, m.color, m.stock_grams, 0
FROM materials m
WHERE m.color IS NOT NULL AND m.color <> ''
  AND NOT EXISTS (
    SELECT 1 FROM material_colors mc WHERE mc.material_id = m.id
  );

-- Renksiz malzemelere varsayılan renk
INSERT INTO material_colors (material_id, user_id, color_name, stock_grams, sort_order)
SELECT m.id, m.user_id, 'Varsayılan', m.stock_grams, 0
FROM materials m
WHERE (m.color IS NULL OR m.color = '')
  AND NOT EXISTS (
    SELECT 1 FROM material_colors mc WHERE mc.material_id = m.id
  );

-- İş emirlerinde material_color_id doldur (material_id eşleşen ilk renk)
UPDATE jobs j
SET material_color_id = (
  SELECT mc.id FROM material_colors mc
  WHERE mc.material_id = j.material_id
  ORDER BY mc.sort_order, mc.created_at
  LIMIT 1
)
WHERE j.material_id IS NOT NULL AND j.material_color_id IS NULL;

CREATE TRIGGER material_colors_updated_at
  BEFORE UPDATE ON material_colors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE material_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own material colors" ON material_colors
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own material colors" ON material_colors
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own material colors" ON material_colors
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own material colors" ON material_colors
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE material_colors IS 'Malzeme renk varyantları — stok renk bazında';
COMMENT ON COLUMN jobs.material_color_id IS 'Kullanılan malzeme rengi';
