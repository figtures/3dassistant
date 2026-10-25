-- Atölye köprüsü: LAN MQTT okuyucu atölyede çalışır, telemetri PrintFlow bulutuna push edilir.

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

CREATE POLICY "Users view own workshop bridges"
  ON workshop_bridges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users delete own workshop bridges"
  ON workshop_bridges FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users view own bridge bindings"
  ON bridge_machine_bindings FOR SELECT USING (auth.uid() = user_id);

-- Ekleme/güncelleme yalnızca sunucu (service role) — köprü eşleştirme API

COMMENT ON TABLE workshop_bridges IS 'Atölyede çalışan PrintFlow köprü ajanı; token_hash ile doğrulanır';
COMMENT ON TABLE bridge_machine_bindings IS 'Köprünün ERP makinesi ile yazıcı seri eşlemesi; LAN şifreleri köprüde kalır';
