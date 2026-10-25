-- Sipariş geliri / müşteriden alınan tutar
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS revenue_amount DECIMAL(10,2) DEFAULT 0;

COMMENT ON COLUMN jobs.revenue_amount IS 'Müşteriden alınan sipariş tutarı (TRY)';
