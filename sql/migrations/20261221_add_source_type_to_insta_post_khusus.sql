-- Ensure insta_post_khusus has source_type metadata used by manual Instagram khusus upsert.

ALTER TABLE insta_post_khusus
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(20);

UPDATE insta_post_khusus
SET source_type = 'cron_fetch'
WHERE source_type IS NULL OR BTRIM(source_type) = '';

ALTER TABLE insta_post_khusus
  ALTER COLUMN source_type SET DEFAULT 'cron_fetch';

ALTER TABLE insta_post_khusus
  ALTER COLUMN source_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'insta_post_khusus_source_type_check'
  ) THEN
    ALTER TABLE insta_post_khusus
      ADD CONSTRAINT insta_post_khusus_source_type_check
      CHECK (source_type IN ('cron_fetch', 'manual_input'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS insta_post_khusus_client_source_type_created_idx
  ON insta_post_khusus (LOWER(TRIM(client_id)), source_type, created_at);
