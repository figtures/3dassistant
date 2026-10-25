-- PrintFlow: makine bağlantıları ve canlı telemetri (OctoPrint MVP)

-- Telemetri alanları machines üzerinde (tek sorgu ile liste)
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

-- Bağlantı kimlik bilgileri (MVP: api_key düz metin, yalnızca RLS ile korunur)
-- TODO(prod): pgcrypto veya Supabase Vault ile api_key_encrypted; istemciye asla gönderilmez
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

CREATE TRIGGER machine_connections_updated_at
  BEFORE UPDATE ON machine_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE machine_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own machine connections"
  ON machine_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own machine connections"
  ON machine_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own machine connections"
  ON machine_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own machine connections"
  ON machine_connections FOR DELETE USING (auth.uid() = user_id);

-- İstemci tarafında api_key seçilmemeli; sunucu route'ları okur
COMMENT ON COLUMN machine_connections.api_key IS 'MVP RLS-only; production için şifreleme planlandı';

-- İsteğe bağlı: seed sonrası bir makineyi manuel modda işaretlemek için:
-- INSERT INTO machine_connections (machine_id, user_id, adapter_type, enabled)
-- SELECT id, user_id, 'manual', true FROM machines WHERE name = 'Voron 2.4' LIMIT 1
-- ON CONFLICT (machine_id) DO NOTHING;
