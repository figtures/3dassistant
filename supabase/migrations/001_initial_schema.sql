-- 3D Management System - Initial Schema
-- Run this in Supabase SQL Editor or via CLI

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  company_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Materials (PETG, ASA, PLA, etc.)
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  color TEXT,
  price_per_kg DECIMAL(10,2) DEFAULT 0,
  stock_grams INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3D Printers / Machines
CREATE TABLE IF NOT EXISTS machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'offline')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs (grid cells - date x machine)
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  job_date DATE NOT NULL,
  title TEXT,
  description TEXT,
  grams_used INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  cell_color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, machine_id, job_date)
);

-- Job Notes (multiple notes per job)
CREATE TABLE IF NOT EXISTS job_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_voice BOOLEAN DEFAULT FALSE,
  parsed_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job Files (STL, images, etc.)
CREATE TABLE IF NOT EXISTS job_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('stl', 'image', 'other')),
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_materials_user ON materials(user_id);
CREATE INDEX IF NOT EXISTS idx_machines_user ON machines(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_user ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_date ON jobs(job_date);
CREATE INDEX IF NOT EXISTS idx_jobs_machine ON jobs(machine_id);
CREATE INDEX IF NOT EXISTS idx_job_notes_job ON job_notes(job_id);
CREATE INDEX IF NOT EXISTS idx_job_files_job ON job_files(job_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER materials_updated_at BEFORE UPDATE ON materials FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER machines_updated_at BEFORE UPDATE ON machines FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_files ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Materials policies
CREATE POLICY "Users can view own materials" ON materials FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own materials" ON materials FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own materials" ON materials FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own materials" ON materials FOR DELETE USING (auth.uid() = user_id);

-- Machines policies
CREATE POLICY "Users can view own machines" ON machines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own machines" ON machines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own machines" ON machines FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own machines" ON machines FOR DELETE USING (auth.uid() = user_id);

-- Customers policies
CREATE POLICY "Users can view own customers" ON customers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own customers" ON customers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own customers" ON customers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own customers" ON customers FOR DELETE USING (auth.uid() = user_id);

-- Jobs policies
CREATE POLICY "Users can view own jobs" ON jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own jobs" ON jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own jobs" ON jobs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own jobs" ON jobs FOR DELETE USING (auth.uid() = user_id);

-- Job notes policies (via job ownership)
CREATE POLICY "Users can view own job notes" ON job_notes FOR SELECT
  USING (EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_notes.job_id AND jobs.user_id = auth.uid()));
CREATE POLICY "Users can insert own job notes" ON job_notes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_notes.job_id AND jobs.user_id = auth.uid()));
CREATE POLICY "Users can delete own job notes" ON job_notes FOR DELETE
  USING (EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_notes.job_id AND jobs.user_id = auth.uid()));

-- Job files policies (via job ownership)
CREATE POLICY "Users can view own job files" ON job_files FOR SELECT
  USING (EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_files.job_id AND jobs.user_id = auth.uid()));
CREATE POLICY "Users can insert own job files" ON job_files FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_files.job_id AND jobs.user_id = auth.uid()));
CREATE POLICY "Users can delete own job files" ON job_files FOR DELETE
  USING (EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_files.job_id AND jobs.user_id = auth.uid()));

-- Storage bucket for job files
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-files', 'job-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own job files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'job-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own job files storage"
ON storage.objects FOR SELECT
USING (bucket_id = 'job-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own job files storage"
ON storage.objects FOR DELETE
USING (bucket_id = 'job-files' AND auth.uid()::text = (storage.foldername(name))[1]);
