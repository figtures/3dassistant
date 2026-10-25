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
