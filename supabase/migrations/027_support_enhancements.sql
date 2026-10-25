-- Destek: ekler, mesajlaşma, durumlar, istemci hata telemetrisi, storage

-- support_reports: ekler + genişletilmiş durum
ALTER TABLE support_reports DROP CONSTRAINT IF EXISTS support_reports_status_check;
ALTER TABLE support_reports
  ADD CONSTRAINT support_reports_status_check
  CHECK (status IN ('open', 'in_progress', 'resolved'));

ALTER TABLE support_reports
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN support_reports.attachments IS 'Storage yolları: [{path, name, contentType, sizeBytes}]';

CREATE POLICY "Users update own support reports"
  ON support_reports FOR UPDATE
  USING (auth.uid() = user_id);

-- Müşteri / destek mesajları
CREATE TABLE IF NOT EXISTS support_report_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES support_reports(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('customer', 'staff')),
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_email TEXT,
  body TEXT NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 8000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_report_messages_report
  ON support_report_messages(report_id, created_at ASC);

ALTER TABLE support_report_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view messages on own reports"
  ON support_report_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_reports r
      WHERE r.id = report_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Users insert customer messages on own reports"
  ON support_report_messages FOR INSERT
  WITH CHECK (
    author_type = 'customer'
    AND author_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM support_reports r
      WHERE r.id = report_id AND r.user_id = auth.uid()
    )
  );

-- İstemci / sunucu hata telemetrisi (Sentry benzeri, yerleşik)
CREATE TABLE IF NOT EXISTS client_error_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  route TEXT,
  message TEXT NOT NULL,
  stack TEXT,
  fingerprint TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'client' CHECK (source IN ('client', 'server')),
  count INTEGER NOT NULL DEFAULT 1 CHECK (count >= 1),
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sample_digest TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_error_events_user_fp
  ON client_error_events (user_id, fingerprint, source)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_error_events_anon_fp
  ON client_error_events (fingerprint, source)
  WHERE user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_client_error_events_last_seen
  ON client_error_events (last_seen DESC);

CREATE INDEX IF NOT EXISTS idx_client_error_events_fingerprint
  ON client_error_events (fingerprint);

ALTER TABLE client_error_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own client errors"
  ON client_error_events FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users view own client errors"
  ON client_error_events FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users update own client errors"
  ON client_error_events FOR UPDATE
  USING (user_id = auth.uid());

-- support-attachments: yol {user_id}/{report_or_temp_id}/dosya
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own support attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'support-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users read own support attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'support-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users delete own support attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'support-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
