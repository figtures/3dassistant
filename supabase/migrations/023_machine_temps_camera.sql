-- Sıcaklık ve kamera URL (canlı detay + SSE)

ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS bed_temp_c REAL,
  ADD COLUMN IF NOT EXISTS nozzle_temp_c REAL,
  ADD COLUMN IF NOT EXISTS chamber_temp_c REAL,
  ADD COLUMN IF NOT EXISTS camera_stream_url TEXT;

ALTER TABLE machine_telemetry_snapshots
  ADD COLUMN IF NOT EXISTS bed_temp_c REAL,
  ADD COLUMN IF NOT EXISTS nozzle_temp_c REAL,
  ADD COLUMN IF NOT EXISTS chamber_temp_c REAL;

COMMENT ON COLUMN machines.camera_stream_url IS 'MJPEG/HTTP snapshot veya LAN kamera URL (köprü push)';
