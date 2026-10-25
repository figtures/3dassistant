-- PrintFlow feature expansion: duration, payments, customer source/referral, faults

-- Job duration (timelog)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

-- Job payment tracking
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid'
  CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'upcoming'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS amount_remaining DECIMAL(10,2) DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_due_date DATE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS installment_count INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS installment_amount DECIMAL(10,2);

CREATE INDEX IF NOT EXISTS idx_jobs_payment_status ON jobs(payment_status);
CREATE INDEX IF NOT EXISTS idx_jobs_payment_due_date ON jobs(payment_due_date);

-- Customer source & referral
ALTER TABLE customers ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referred_by_customer_id UUID
  REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_source ON customers(source);

-- Fault types (customizable per user)
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

-- Machine faults / breakdowns
CREATE TABLE IF NOT EXISTS faults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  fault_type_id UUID REFERENCES fault_types(id) ON DELETE SET NULL,
  fault_type_name TEXT,
  duration_hours DECIMAL(6,2) DEFAULT 0,
  description TEXT,
  fault_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faults_user ON faults(user_id);
CREATE INDEX IF NOT EXISTS idx_faults_machine ON faults(machine_id);
CREATE INDEX IF NOT EXISTS idx_faults_date ON faults(fault_date);

CREATE TRIGGER fault_types_updated_at
  BEFORE UPDATE ON fault_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER faults_updated_at
  BEFORE UPDATE ON faults
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE fault_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE faults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fault types" ON fault_types
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own fault types" ON fault_types
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own fault types" ON fault_types
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own fault types" ON fault_types
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own faults" ON faults
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own faults" ON faults
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own faults" ON faults
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own faults" ON faults
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON COLUMN jobs.duration_minutes IS 'İş süresi (dakika)';
COMMENT ON COLUMN jobs.payment_status IS 'Ödeme durumu: unpaid, partial, paid, upcoming';
COMMENT ON COLUMN customers.source IS 'Müşteri kaynağı (Instagram, tavsiye vb.)';
COMMENT ON COLUMN customers.referral IS 'Yönlendiren kişi veya not';
