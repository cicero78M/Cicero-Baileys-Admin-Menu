import { query } from "../repository/db.js";

const SUPPORTED_PLATFORMS = new Set(["instagram", "tiktok"]);
const TABLE_NAME = "task_post_exclusions";
let ensureTablePromise = null;

function normalizeClientId(clientId) {
  return String(clientId || "").trim().toLowerCase();
}

function normalizePlatform(platform) {
  return String(platform || "").trim().toLowerCase();
}

function normalizeContentId(contentId) {
  return String(contentId || "").trim();
}

async function createTaskPostExclusionsTableIfMissing() {
  await query(
    `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      exclusion_id BIGSERIAL PRIMARY KEY,
      client_id VARCHAR NOT NULL,
      platform VARCHAR(20) NOT NULL CHECK (platform IN ('instagram', 'tiktok')),
      content_id VARCHAR(255) NOT NULL,
      source_link TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (client_id, platform, content_id)
    )`
  );

  await query(
    `CREATE INDEX IF NOT EXISTS idx_task_post_exclusions_client_platform
      ON ${TABLE_NAME} (client_id, platform)`
  );
}

async function ensureTaskPostExclusionsTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = createTaskPostExclusionsTableIfMissing().catch((error) => {
      ensureTablePromise = null;
      throw error;
    });
  }

  await ensureTablePromise;
}

export async function addTaskPostExclusion({ clientId, platform, contentId, sourceLink = null }) {
  await ensureTaskPostExclusionsTable();

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
    `INSERT INTO ${TABLE_NAME} (client_id, platform, content_id, source_link)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (client_id, platform, content_id)
     DO UPDATE SET source_link = COALESCE(EXCLUDED.source_link, ${TABLE_NAME}.source_link),
                   updated_at = NOW()`,
    [normalizedClientId, normalizedPlatform, normalizedContentId, sourceLink]
  );
}

export async function getTaskPostExclusionSet({ clientId, platform }) {
  await ensureTaskPostExclusionsTable();

  const normalizedClientId = normalizeClientId(clientId);
  const normalizedPlatform = normalizePlatform(platform);

  if (!normalizedClientId || !SUPPORTED_PLATFORMS.has(normalizedPlatform)) {
    return new Set();
  }

  const res = await query(
    `SELECT content_id
       FROM ${TABLE_NAME}
      WHERE LOWER(TRIM(client_id)) = $1
        AND LOWER(TRIM(platform)) = $2`,
    [normalizedClientId, normalizedPlatform]
  );

  return new Set(res.rows.map((row) => normalizeContentId(row.content_id)).filter(Boolean));
}
