-- Müşteri destek bildirimleri ve köprü tanılama paketleri

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

CREATE POLICY "Users view own bridge support bundles"
  ON bridge_support_bundles FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users view own support reports"
  ON support_reports FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own support reports"
  ON support_reports FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE support_reports IS 'Müşteri sorun bildirimleri; tanılama JSON içerir (gizli veriler redakte)';
COMMENT ON TABLE bridge_support_bundles IS 'Köprü support komutu ile yüklenen tanılama paketi (max ~256KB)';
