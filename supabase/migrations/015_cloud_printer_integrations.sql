-- PrintFlow: bulut yazıcı entegrasyonları (sıfır kurulum MVP)

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

CREATE TRIGGER printer_integration_accounts_updated_at
  BEFORE UPDATE ON printer_integration_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE printer_integration_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own printer integration accounts"
  ON printer_integration_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own printer integration accounts"
  ON printer_integration_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own printer integration accounts"
  ON printer_integration_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own printer integration accounts"
  ON printer_integration_accounts FOR DELETE USING (auth.uid() = user_id);

COMMENT ON COLUMN printer_integration_accounts.api_key IS 'MVP RLS-only; sunucu route okur, istemciye gönderilmez';
COMMENT ON COLUMN printer_integration_accounts.access_token IS 'MVP RLS-only; OAuth tamamlanınca kullanılacak';

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

CREATE TRIGGER machine_cloud_links_updated_at
  BEFORE UPDATE ON machine_cloud_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE machine_cloud_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own machine cloud links"
  ON machine_cloud_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own machine cloud links"
  ON machine_cloud_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own machine cloud links"
  ON machine_cloud_links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own machine cloud links"
  ON machine_cloud_links FOR DELETE USING (auth.uid() = user_id);
