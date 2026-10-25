-- Köprüden push edilen son kamera karesi (makine başına tek satır, uzaktan görüntüleme)

CREATE TABLE IF NOT EXISTS machine_camera_frames (
  machine_id UUID PRIMARY KEY REFERENCES machines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL DEFAULT 'image/jpeg',
  frame_data BYTEA NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_machine_camera_frames_user ON machine_camera_frames(user_id);
CREATE INDEX IF NOT EXISTS idx_machine_camera_frames_captured ON machine_camera_frames(captured_at);

DROP TRIGGER IF EXISTS machine_camera_frames_updated_at ON machine_camera_frames;
CREATE TRIGGER machine_camera_frames_updated_at
  BEFORE UPDATE ON machine_camera_frames
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE machine_camera_frames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own machine camera frames"
  ON machine_camera_frames FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE machine_camera_frames IS 'Köprü JPEG push; tarayıcı LAN yerine ERP API üzerinden okur';
