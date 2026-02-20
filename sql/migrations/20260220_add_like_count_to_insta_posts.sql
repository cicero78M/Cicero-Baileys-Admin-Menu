-- Add like_count column for Instagram post tables used by dirrequest manual input.
ALTER TABLE IF EXISTS insta_post_khusus
  ADD COLUMN IF NOT EXISTS like_count INT DEFAULT 0;

ALTER TABLE IF EXISTS insta_post
  ADD COLUMN IF NOT EXISTS like_count INT DEFAULT 0;

-- Hardening for rows inserted before the default existed.
UPDATE insta_post_khusus
SET like_count = 0
WHERE like_count IS NULL;

UPDATE insta_post
SET like_count = 0
WHERE like_count IS NULL;
