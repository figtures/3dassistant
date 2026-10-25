-- Aynı gün + aynı makinede birden fazla iş emri
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.jobs'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) ILIKE '%user_id%'
    AND pg_get_constraintdef(oid) ILIKE '%machine_id%'
    AND pg_get_constraintdef(oid) ILIKE '%job_date%';

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.jobs DROP CONSTRAINT %I', cname);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_user_machine_date
  ON public.jobs(user_id, machine_id, job_date);

COMMENT ON INDEX idx_jobs_user_machine_date IS
  'Aynı gün ve makinede birden fazla iş emrine izin verir';
