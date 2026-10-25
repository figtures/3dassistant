-- PrintFlow: Paddle abonelikleri, plan hakları ve kota kapıları
-- Kiracı = auth.users kaydı. Abonelik satırlarını yalnızca service role (Paddle webhook) yazar.

CREATE TABLE IF NOT EXISTS billing_customers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  paddle_customer_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS billing_customers_updated_at ON billing_customers;
CREATE TRIGGER billing_customers_updated_at
  BEFORE UPDATE ON billing_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  paddle_subscription_id TEXT NOT NULL UNIQUE,
  paddle_customer_id TEXT NOT NULL,
  paddle_price_id TEXT,
  plan_key TEXT NOT NULL CHECK (plan_key IN ('starter', 'pro', 'farm')),
  status TEXT NOT NULL
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'paused')),
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  max_machines INTEGER NOT NULL CHECK (max_machines >= 0),
  cloud_monitoring BOOLEAN NOT NULL DEFAULT false,
  sync_per_tick INTEGER NOT NULL DEFAULT 0 CHECK (sync_per_tick >= 0),
  paddle_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_entitled
  ON subscriptions(status) WHERE status IN ('trialing', 'active', 'past_due');

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Webhook tekrar teslimlerinde aynı olayı iki kez işlememek için
CREATE TABLE IF NOT EXISTS billing_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own billing customer" ON billing_customers;
CREATE POLICY "Users can view own billing customer"
  ON billing_customers FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Etkin plan hakları. Abonelik yoksa veya geçersizse ücretsiz katman.
-- Ücretsiz katman değerleri src/lib/billing/plans.ts içindeki PLANS.free ile aynı tutulmalı.
CREATE OR REPLACE FUNCTION effective_entitlements(p_user UUID)
RETURNS TABLE (plan_key TEXT, max_machines INTEGER, cloud_monitoring BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT s.plan_key, s.max_machines, s.cloud_monitoring
    FROM subscriptions s
    WHERE s.user_id = p_user
      AND s.status IN ('trialing', 'active', 'past_due');
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'free'::TEXT, 2, false;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION effective_entitlements(UUID) FROM PUBLIC;

-- Kota kapıları: istemci doğrudan Supabase'e yazsa bile sunucuda uygulanır.
-- auth.uid() boşsa (service role: seed, cron, webhook) kontrol atlanır.
-- Başka kiracı adına satırda da atlanır: RLS reddeder, kota mesajı o kiracının planını sızdırmaz.
CREATE OR REPLACE FUNCTION enforce_machine_quota()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  ent RECORD;
  current_count INTEGER;
BEGIN
  IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('machine_quota:' || NEW.user_id::TEXT));

  SELECT * INTO ent FROM effective_entitlements(NEW.user_id);
  SELECT COUNT(*) INTO current_count FROM machines WHERE user_id = NEW.user_id;

  IF current_count >= ent.max_machines THEN
    RAISE EXCEPTION 'Planınız en fazla % makineye izin veriyor. Daha fazlası için planınızı yükseltin.', ent.max_machines
      USING ERRCODE = 'P0001', HINT = 'PLAN_MACHINE_LIMIT';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS machines_enforce_quota ON machines;
CREATE TRIGGER machines_enforce_quota
  BEFORE INSERT ON machines
  FOR EACH ROW EXECUTE FUNCTION enforce_machine_quota();

CREATE OR REPLACE FUNCTION enforce_cloud_monitoring()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  ent RECORD;
BEGIN
  IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;

  SELECT * INTO ent FROM effective_entitlements(NEW.user_id);
  IF NOT ent.cloud_monitoring THEN
    RAISE EXCEPTION 'Ücretsiz planda buluttan makine bağlama kilitlidir. Atölye veya Filament Farm planına geçin.'
      USING ERRCODE = 'P0001', HINT = 'PLAN_CLOUD_REQUIRED';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS printer_integration_accounts_enforce_plan ON printer_integration_accounts;
CREATE TRIGGER printer_integration_accounts_enforce_plan
  BEFORE INSERT ON printer_integration_accounts
  FOR EACH ROW EXECUTE FUNCTION enforce_cloud_monitoring();

DROP TRIGGER IF EXISTS machine_cloud_links_enforce_plan ON machine_cloud_links;
CREATE TRIGGER machine_cloud_links_enforce_plan
  BEFORE INSERT ON machine_cloud_links
  FOR EACH ROW EXECUTE FUNCTION enforce_cloud_monitoring();
