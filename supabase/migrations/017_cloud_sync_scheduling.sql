-- Bulut senkronu: her tick'te en uzun süredir güncellenmeyen linkler önce çekilir

ALTER TABLE machine_cloud_links
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_machine_cloud_links_sync_queue
  ON machine_cloud_links(last_synced_at NULLS FIRST)
  WHERE enabled = true;
