-- Makine telemetri geçmişi (grafik / detay sayfası)

CREATE TABLE IF NOT EXISTS machine_telemetry_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  printer_state TEXT NOT NULL,
  connection_status TEXT NOT NULL DEFAULT 'connected',
  progress_percent REAL,
  job_name TEXT,
  print_time_seconds INTEGER
);

CREATE INDEX IF NOT EXISTS idx_machine_telemetry_machine_time
  ON machine_telemetry_snapshots(machine_id, recorded_at DESC);

ALTER TABLE machine_telemetry_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own telemetry snapshots" ON machine_telemetry_snapshots;
CREATE POLICY "Users view own telemetry snapshots"
  ON machine_telemetry_snapshots FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own telemetry snapshots" ON machine_telemetry_snapshots;
CREATE POLICY "Users insert own telemetry snapshots"
  ON machine_telemetry_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE machine_telemetry_snapshots IS 'Köprü/bulut push ve senkron sonrası örneklenmiş geçmiş';
