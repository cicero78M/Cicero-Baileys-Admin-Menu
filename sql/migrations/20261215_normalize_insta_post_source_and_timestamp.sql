BEGIN;

-- 1) Canonicalize source_type values so new/old manual labels do not mix.
UPDATE insta_post
SET source_type = 'manual_input'
WHERE REPLACE(REPLACE(LOWER(TRIM(source_type)), ' ', '_'), '-', '_') = 'manual_fetch';

UPDATE insta_post_khusus
SET source_type = 'manual_input'
WHERE REPLACE(REPLACE(LOWER(TRIM(source_type)), ' ', '_'), '-', '_') = 'manual_fetch';

-- 2) Backfill legacy manual created_at records that were previously written in
--    Jakarta offset (+07:00) into TIMESTAMP (without timezone) and effectively
--    shifted to UTC wall-clock.
--
--    Heuristic used:
--    - only manual rows (manual_input/manual_fetch family),
--    - original_created_at is present,
--    - created_at is at least 6 hours earlier than original_created_at,
--      which indicates likely offset stripping on write.
WITH candidate_insta_post AS (
  SELECT shortcode
  FROM insta_post
  WHERE REPLACE(REPLACE(LOWER(TRIM(source_type)), ' ', '_'), '-', '_') IN ('manual_input', 'manual_fetch')
    AND original_created_at IS NOT NULL
    AND created_at IS NOT NULL
    AND created_at <= (original_created_at AT TIME ZONE 'UTC') - INTERVAL '6 hours'
)
UPDATE insta_post p
SET created_at = p.created_at + INTERVAL '7 hours'
FROM candidate_insta_post c
WHERE p.shortcode = c.shortcode;

WITH candidate_insta_post_khusus AS (
  SELECT shortcode
  FROM insta_post_khusus
  WHERE REPLACE(REPLACE(LOWER(TRIM(source_type)), ' ', '_'), '-', '_') IN ('manual_input', 'manual_fetch')
    AND original_created_at IS NOT NULL
    AND created_at IS NOT NULL
    AND created_at <= (original_created_at AT TIME ZONE 'UTC') - INTERVAL '6 hours'
)
UPDATE insta_post_khusus p
SET created_at = p.created_at + INTERVAL '7 hours'
FROM candidate_insta_post_khusus c
WHERE p.shortcode = c.shortcode;

COMMIT;

-- Validation helper (run manually after migration if needed):
-- SELECT shortcode,
--        created_at,
--        (((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta')::date) AS created_date_wib,
--        source_type
-- FROM insta_post
-- WHERE REPLACE(REPLACE(LOWER(TRIM(source_type)), ' ', '_'), '-', '_') = 'manual_input'
-- ORDER BY created_at DESC
-- LIMIT 100;
