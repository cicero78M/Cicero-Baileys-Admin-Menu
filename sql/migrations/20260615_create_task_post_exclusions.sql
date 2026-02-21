CREATE TABLE IF NOT EXISTS task_post_exclusions (
  exclusion_id BIGSERIAL PRIMARY KEY,
  client_id VARCHAR NOT NULL,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('instagram', 'tiktok')),
  content_id VARCHAR(255) NOT NULL,
  source_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, platform, content_id)
);

CREATE INDEX IF NOT EXISTS idx_task_post_exclusions_client_platform
  ON task_post_exclusions (client_id, platform);
