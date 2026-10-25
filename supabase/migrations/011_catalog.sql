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
