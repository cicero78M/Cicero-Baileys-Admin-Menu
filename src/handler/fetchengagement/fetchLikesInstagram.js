// src/handler/fetchengagement/fetchLikesInstagram.js

import { query } from "../../db/index.js";
import { sendDebug } from "../../middleware/debugHandler.js";
import { fetchAllInstagramLikes } from "../../service/instagramApi.js";
import { getAllExceptionUsers } from "../../model/userModel.js";
import { saveLikeSnapshotAudit } from "../../model/instaLikeModel.js";

const SNAPSHOT_INTERVAL_MS = 30 * 60 * 1000;

function getJakartaDateString(date = new Date()) {
  return date.toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
  });
}

function normalizeDateInput(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveSnapshotWindow(windowOverrides = {}) {
  const now = new Date();
  const snapshotWindowEnd =
    normalizeDateInput(windowOverrides.snapshotWindowEnd || windowOverrides.end) || now;
  const defaultStart = new Date(snapshotWindowEnd.getTime() - SNAPSHOT_INTERVAL_MS);
  const snapshotWindowStart =
    normalizeDateInput(windowOverrides.snapshotWindowStart || windowOverrides.start) || defaultStart;
  const capturedAt =
    normalizeDateInput(windowOverrides.capturedAt) ||
    normalizeDateInput(windowOverrides.captured_at) ||
    now;
  return { snapshotWindowStart, snapshotWindowEnd, capturedAt };
}

function normalizeUsername(username) {
  return (username || "")
    .toString()
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
}

function normalizeSourceType(sourceType) {
  const normalized = (sourceType || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");

  if (normalized === "manual_input" || normalized === "manual_fetch") {
    return "manual_input";
  }

  return normalized || "cron_fetch";
}

function normalizePostSourceTypeExpression() {
  return "REPLACE(REPLACE(COALESCE(LOWER(TRIM(source_type)), 'cron_fetch'), ' ', '_'), '-', '_')";
}

async function getInstagramLikesFetchDiagnostics(clientId, filterDate, sourceType) {
  const sourceTypeExpression = normalizePostSourceTypeExpression();

  const [{ rows: sourceTypeRows }, { rows: todayRangeRows }, { rows: recentDateRows }] =
    await Promise.all([
      query(
        `SELECT ${sourceTypeExpression} AS normalized_source_type,
                COUNT(*)::int AS total
         FROM insta_post
         WHERE client_id = $1
         GROUP BY 1
         ORDER BY total DESC, normalized_source_type ASC`,
        [clientId]
      ),
      query(
        `SELECT MIN(created_at) AS min_created_at,
                MAX(created_at) AS max_created_at,
                COUNT(*)::int AS total_today
         FROM insta_post
         WHERE client_id = $1
           AND (created_at AT TIME ZONE 'Asia/Jakarta')::date = $2::date`,
        [clientId, filterDate]
      ),
      query(
        `SELECT (created_at AT TIME ZONE 'Asia/Jakarta')::date AS jakarta_date,
                COUNT(*)::int AS total
         FROM insta_post
         WHERE client_id = $1
           AND created_at >= NOW() - INTERVAL '7 day'
         GROUP BY 1
         ORDER BY jakarta_date DESC`,
        [clientId]
      ),
    ]);

  const sourceTypeCounts = sourceTypeRows.reduce((acc, row) => {
    acc[row.normalized_source_type || "cron_fetch"] = row.total;
    return acc;
  }, {});

  const todayRange = todayRangeRows[0] || {};
  const totalToday = Number(todayRange.total_today || 0);
  const totalPosts = Object.values(sourceTypeCounts).reduce((sum, count) => sum + Number(count || 0), 0);
  const expectedSourceTypeCount = Number(sourceTypeCounts[sourceType] || 0);

  let diagnosis = "data memang belum masuk";
  if (totalToday > 0 && sourceType === "manual_input" && expectedSourceTypeCount === 0) {
    diagnosis = "data ada hari ini, tetapi source_type tidak cocok (manual_input/manual_fetch tidak ditemukan)";
  } else if (totalToday === 0 && totalPosts > 0) {
    diagnosis = "data ada, tetapi jatuh di hari lain (indikasi mismatch hari/timezone)";
  }

  return {
    filterDate,
    sourceType,
    diagnosis,
    sourceTypeCounts,
    todayRange: {
      totalToday,
      minCreatedAt: todayRange.min_created_at || null,
      maxCreatedAt: todayRange.max_created_at || null,
    },
    recentJakartaDays: recentDateRows,
  };
}

// Ambil likes lama (existing) dari database dan kembalikan sebagai array string
async function getExistingLikes(shortcode) {
  const res = await query(
    "SELECT likes FROM insta_like WHERE shortcode = $1",
    [shortcode]
  );
  if (!res.rows.length) return [];
  const val = res.rows[0].likes;
  if (!val) return [];
  if (Array.isArray(val)) return val.map(normalizeUsername);
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(normalizeUsername);
      return [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Ambil likes dari Instagram, upsert ke DB insta_like
 * @param {string} shortcode
 * @param {string|null} client_id
 */
async function fetchAndStoreLikes(shortcode, client_id = null, snapshotWindow = {}) {
  const allLikes = await fetchAllInstagramLikes(shortcode);
  const uniqueLikes = [...new Set(allLikes.map(normalizeUsername))];
  const exceptionUsers = await getAllExceptionUsers();
  const exceptionUsernames = exceptionUsers
    .map((u) => normalizeUsername(u.insta))
    .filter(Boolean);

  for (const uname of exceptionUsernames) {
    if (!uniqueLikes.includes(uname)) {
      uniqueLikes.push(uname);
    }
  }
  const existingLikes = await getExistingLikes(shortcode);
  const mergedSet = new Set([...existingLikes, ...uniqueLikes]);
  const mergedLikes = [...mergedSet];
  sendDebug({
    tag: "IG LIKES FINAL",
    msg: `Shortcode ${shortcode} FINAL jumlah unique: ${mergedLikes.length}`,
    client_id: client_id || shortcode,
  });

  // Simpan ke database (upsert), gabungkan dengan data lama
  await query(
    `INSERT INTO insta_like (shortcode, likes, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (shortcode) DO UPDATE
     SET likes = EXCLUDED.likes, updated_at = NOW()`,
    [shortcode, JSON.stringify(mergedLikes)]
  );

  sendDebug({
    tag: "IG FETCH",
    msg: `[DB] Sukses upsert likes IG: ${shortcode} | Total likes disimpan: ${mergedLikes.length}`,
    client_id: client_id || shortcode,
  });

  const { snapshotWindowStart, snapshotWindowEnd, capturedAt } =
    resolveSnapshotWindow(snapshotWindow);
  try {
    await saveLikeSnapshotAudit({
      shortcode,
      usernames: mergedLikes,
      snapshotWindowStart,
      snapshotWindowEnd,
      capturedAt,
    });
    sendDebug({
      tag: "IG FETCH",
      msg: `[DB] Audit likes IG tersimpan untuk ${shortcode} (${snapshotWindowStart.toISOString()} - ${snapshotWindowEnd.toISOString()})`,
      client_id: client_id || shortcode,
    });
  } catch (auditErr) {
    sendDebug({
      tag: "IG FETCH AUDIT ERROR",
      msg: `Gagal menyimpan audit likes IG ${shortcode}: ${(auditErr && auditErr.message) || String(auditErr)}`,
      client_id: client_id || shortcode,
    });
  }
}

/**
 * Handler fetch likes Instagram untuk 1 client
 * Akan fetch semua post IG milik client hari ini,
 * lalu untuk setiap post akan fetch likes dan simpan ke DB (upsert).
 * @param {*} waClient - instance WhatsApp client (untuk progress)
 * @param {*} chatId - WhatsApp chatId (untuk notifikasi)
 * @param {*} client_id - client yang ingin di-fetch likes-nya
 */
export async function handleFetchLikesInstagram(waClient, chatId, client_id, options = {}) {
  try {
    const normalizedShortcodes = Array.isArray(options.shortcodes)
      ? [...new Set(options.shortcodes.map((item) => String(item || "").trim()).filter(Boolean))]
      : [];

    const sourceType = normalizeSourceType(options.sourceType);
    let rows = [];
    if (normalizedShortcodes.length) {
      rows = normalizedShortcodes.map((shortcode) => ({ shortcode }));
    } else {
      // Ambil semua post IG milik client hari ini
      const todayJakarta = getJakartaDateString();
      const filterManualOnly = sourceType === "manual_input";
      const { rows: fetchedRows } = await query(
        `SELECT shortcode
         FROM insta_post
         WHERE client_id = $1
           AND (created_at AT TIME ZONE 'Asia/Jakarta')::date = $2::date
           AND (
             $3::boolean = false OR
             REPLACE(REPLACE(COALESCE(LOWER(TRIM(source_type)), 'cron_fetch'), ' ', '_'), '-', '_') IN ('manual_input', 'manual_fetch')
           )`,
        [client_id, todayJakarta, filterManualOnly]
      );
      rows = fetchedRows;
    }

    if (!rows.length) {
      if (!normalizedShortcodes.length) {
        try {
          const todayJakarta = getJakartaDateString();
          const diagnostics = await getInstagramLikesFetchDiagnostics(
            client_id,
            todayJakarta,
            sourceType
          );
          sendDebug({
            tag: "IG FETCH LIKES DIAGNOSTIC",
            msg: `No rows untuk client ${client_id}. filter_date=${diagnostics.filterDate}, source_type=${diagnostics.sourceType}, diagnosis=${diagnostics.diagnosis}`,
            client_id,
          });
          sendDebug({
            tag: "IG FETCH LIKES DIAGNOSTIC",
            msg: `Agregat source_type client ${client_id}: ${JSON.stringify(diagnostics.sourceTypeCounts)}`,
            client_id,
          });
          sendDebug({
            tag: "IG FETCH LIKES DIAGNOSTIC",
            msg: `Rentang created_at hari berjalan: min=${diagnostics.todayRange.minCreatedAt || "null"}, max=${diagnostics.todayRange.maxCreatedAt || "null"}, total=${diagnostics.todayRange.totalToday}`,
            client_id,
          });
          sendDebug({
            tag: "IG FETCH LIKES DIAGNOSTIC",
            msg: `Distribusi tanggal Jakarta 7 hari terakhir: ${JSON.stringify(diagnostics.recentJakartaDays)}`,
            client_id,
          });
        } catch (diagnosticError) {
          sendDebug({
            tag: "IG FETCH LIKES DIAGNOSTIC ERROR",
            msg: `Gagal mengambil diagnostik no-rows: ${(diagnosticError && diagnosticError.message) || String(diagnosticError)}`,
            client_id,
          });
        }
      }

      if (waClient && chatId) {
        const emptyLabel = sourceType === "manual_input" ? "manual hari ini" : "hari ini";
        await waClient.sendMessage(
          chatId,
          `Tidak ada konten IG ${emptyLabel} untuk client ${client_id}.`
        );
      }
      return;
    }

    const snapshotWindow = resolveSnapshotWindow({
      snapshotWindowStart:
        options.snapshotWindowStart ||
        options.snapshotWindow?.snapshotWindowStart ||
        options.snapshotWindow?.start,
      snapshotWindowEnd:
        options.snapshotWindowEnd ||
        options.snapshotWindow?.snapshotWindowEnd ||
        options.snapshotWindow?.end,
      capturedAt: options.capturedAt || options.snapshotWindow?.capturedAt,
    });

    let sukses = 0, gagal = 0;
    for (const r of rows) {
      try {
        await fetchAndStoreLikes(r.shortcode, client_id, snapshotWindow);
        sukses++;
      } catch (err) {
        sendDebug({
          tag: "IG FETCH LIKES ERROR",
          // Hanya log message/error string, jangan objek error utuh!
          msg: `Gagal fetch likes untuk shortcode: ${r.shortcode}, error: ${(err && err.message) || String(err)}`,
          client_id,
        });
        gagal++;
      }
    }

    if (waClient && chatId) {
      await waClient.sendMessage(
        chatId,
        `✅ Selesai fetch likes IG client ${client_id}. Berhasil: ${sukses}, Gagal: ${gagal}`
      );
    }
  } catch (err) {
    if (waClient && chatId) {
      await waClient.sendMessage(
        chatId,
        `❌ Error utama fetch likes IG: ${(err && err.message) || String(err)}`
      );
    }
    sendDebug({
      tag: "IG FETCH LIKES ERROR",
      msg: (err && err.message) || String(err),
      client_id,
    });
  }
}
