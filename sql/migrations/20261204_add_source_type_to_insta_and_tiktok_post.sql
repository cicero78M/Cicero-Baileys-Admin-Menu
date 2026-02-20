-- Align source typing with Cicero-Cronjob-Fetch for manual vs cron ingestion.

ALTER TABLE insta_post
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(20);

UPDATE insta_post
SET source_type = 'cron_fetch'
WHERE source_type IS NULL OR BTRIM(source_type) = '';

ALTER TABLE insta_post
  ALTER COLUMN source_type SET DEFAULT 'cron_fetch';

ALTER TABLE insta_post
  ALTER COLUMN source_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'insta_post_source_type_check'
  ) THEN
    ALTER TABLE insta_post
      ADD CONSTRAINT insta_post_source_type_check
      CHECK (source_type IN ('cron_fetch', 'manual_input'));
  END IF;
END;
$$;

ALTER TABLE tiktok_post
  ADD COLUMN IF NOT EXISTS source_type TEXT;

UPDATE tiktok_post
SET source_type = CASE
  WHEN LOWER(COALESCE(BTRIM(source), 'official')) = 'manual' THEN 'manual_input'
  ELSE 'cron_fetch'
END
WHERE source_type IS NULL OR BTRIM(source_type) = '';

ALTER TABLE tiktok_post
  ALTER COLUMN source_type SET DEFAULT 'cron_fetch';

ALTER TABLE tiktok_post
  ALTER COLUMN source_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tiktok_post_source_type_check'
  ) THEN
    ALTER TABLE tiktok_post
      ADD CONSTRAINT tiktok_post_source_type_check
      CHECK (source_type IN ('cron_fetch', 'manual_input'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS insta_post_client_source_type_created_idx
  ON insta_post (LOWER(TRIM(client_id)), source_type, created_at);

CREATE INDEX IF NOT EXISTS tiktok_post_client_source_type_created_idx
  ON tiktok_post (LOWER(TRIM(client_id)), source_type, created_at);
