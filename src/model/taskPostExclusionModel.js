import { query } from "../repository/db.js";

const SUPPORTED_PLATFORMS = new Set(["instagram", "tiktok"]);

function normalizeClientId(clientId) {
  return String(clientId || "").trim().toLowerCase();
}

function normalizePlatform(platform) {
  return String(platform || "").trim().toLowerCase();
}

function normalizeContentId(contentId) {
  return String(contentId || "").trim();
}

export async function addTaskPostExclusion({ clientId, platform, contentId, sourceLink = null }) {
  const normalizedClientId = normalizeClientId(clientId);
  const normalizedPlatform = normalizePlatform(platform);
  const normalizedContentId = normalizeContentId(contentId);

  if (!normalizedClientId) {
    throw new Error("Client ID tidak valid.");
  }
  if (!SUPPORTED_PLATFORMS.has(normalizedPlatform)) {
    throw new Error("Platform tidak didukung untuk penghapusan post tugas.");
  }
  if (!normalizedContentId) {
    throw new Error("ID konten tidak valid.");
  }

  await query(
    `INSERT INTO task_post_exclusions (client_id, platform, content_id, source_link)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (client_id, platform, content_id)
     DO UPDATE SET source_link = COALESCE(EXCLUDED.source_link, task_post_exclusions.source_link),
                   updated_at = NOW()`,
    [normalizedClientId, normalizedPlatform, normalizedContentId, sourceLink]
  );
}

export async function getTaskPostExclusionSet({ clientId, platform }) {
  const normalizedClientId = normalizeClientId(clientId);
  const normalizedPlatform = normalizePlatform(platform);

  if (!normalizedClientId || !SUPPORTED_PLATFORMS.has(normalizedPlatform)) {
    return new Set();
  }

  const res = await query(
    `SELECT content_id
       FROM task_post_exclusions
      WHERE LOWER(TRIM(client_id)) = $1
        AND LOWER(TRIM(platform)) = $2`,
    [normalizedClientId, normalizedPlatform]
  );

  return new Set(res.rows.map((row) => normalizeContentId(row.content_id)).filter(Boolean));
}

