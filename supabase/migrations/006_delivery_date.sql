-- Teslim / termin tarihi ve gecikme hatırlatma takibi
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS delivery_date DATE;

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_overdue_reminder_at TIMESTAMPTZ;

COMMENT ON COLUMN jobs.delivery_date IS 'Müşteriye teslim edilmesi gereken termin tarihi';
COMMENT ON COLUMN jobs.last_overdue_reminder_at IS 'Son gecikme hatırlatma e-postası gönderim zamanı';

CREATE INDEX IF NOT EXISTS idx_jobs_delivery_date ON jobs(delivery_date);

-- Mevcut işlerde teslim tarihi yoksa baskı tarihini varsayılan al
UPDATE jobs SET delivery_date = job_date WHERE delivery_date IS NULL;
