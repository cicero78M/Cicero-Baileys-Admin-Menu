-- Add source marker for TikTok posts so manual input can be segmented from official fetch.
ALTER TABLE tiktok_post
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'official';

UPDATE tiktok_post
SET source = 'official'
WHERE source IS NULL OR BTRIM(source) = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tiktok_post_source_allowed'
  ) THEN
    ALTER TABLE tiktok_post
      ADD CONSTRAINT tiktok_post_source_allowed
      CHECK (LOWER(source) IN ('official', 'manual'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS tiktok_post_client_source_created_idx
  ON tiktok_post (LOWER(TRIM(client_id)), LOWER(TRIM(source)), created_at);
