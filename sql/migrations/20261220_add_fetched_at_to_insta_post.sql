ALTER TABLE insta_post
ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ;

UPDATE insta_post
SET fetched_at = COALESCE((created_at AT TIME ZONE 'UTC'), NOW())
WHERE fetched_at IS NULL;

ALTER TABLE insta_post
ALTER COLUMN fetched_at SET DEFAULT NOW();

ALTER TABLE insta_post
ALTER COLUMN fetched_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_insta_post_client_fetched_at
  ON insta_post (LOWER(TRIM(client_id)), fetched_at);

CREATE INDEX IF NOT EXISTS idx_insta_post_fetched_at
  ON insta_post (fetched_at);
