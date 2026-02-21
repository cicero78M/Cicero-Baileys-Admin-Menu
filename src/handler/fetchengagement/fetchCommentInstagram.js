import pLimit from 'p-limit';
import { query } from '../../db/index.js';
import { sendDebug } from '../../middleware/debugHandler.js';
import { fetchAllInstagramComments } from '../../service/instagramApi.js';
import { insertIgPostComments } from '../../model/igPostCommentModel.js';
import { upsertIgUser } from '../../model/instaPostExtendedModel.js';
import * as clientService from '../../service/clientService.js';
import {
  getInstagramCreatedAtJakartaDateSql,
  getNormalizedInstagramSourceTypeSql,
} from '../../utils/instagramCreatedAtSql.js';

const limit = pLimit(3);

function normalizeUsername(username) {
  return (username || '')
    .toString()
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
}

function extractCommentUsername(comment) {
  return (
    comment?.user?.username ||
    comment?.username ||
    comment?.owner?.username ||
    null
  );
}

async function getExistingLikes(shortcode) {
  const res = await query('SELECT likes FROM insta_like WHERE shortcode = $1', [shortcode]);
  if (!res.rows.length) return [];
  const val = res.rows[0].likes;
  if (!val) return [];
  if (Array.isArray(val)) return val.map(normalizeUsername).filter(Boolean);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(normalizeUsername).filter(Boolean);
      return [];
    } catch {
      return [];
    }
  }
  return [];
}

async function upsertLikesByShortcode(shortcode, likes) {
  await query(
    `INSERT INTO insta_like (shortcode, likes, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (shortcode) DO UPDATE
     SET likes = EXCLUDED.likes, updated_at = NOW()`,
    [shortcode, JSON.stringify(likes)]
  );
}

function getJakartaDateString(date = new Date()) {
  return date.toLocaleDateString('en-CA', {
    timeZone: 'Asia/Jakarta',
  });
}

function normalizeSourceType(sourceType) {
  const normalized = (sourceType || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');

  if (normalized === 'manual_input' || normalized === 'manual_fetch') {
    return 'manual_input';
  }

  return normalized || 'cron_fetch';
}

export async function handleFetchKomentarInstagram(
  waClient = null,
  chatId = null,
  client_id = null,
  options = {}
) {
  try {
    const clientName = client_id ? (await clientService.findClientById(client_id))?.nama || '' : '';
    const todayJakarta = getJakartaDateString();
    const sourceType = normalizeSourceType(options.sourceType);
    const filterManualOnly = sourceType === 'manual_input';

    const { rows } = await query(
      `SELECT shortcode
       FROM insta_post
       WHERE client_id = $1
         AND ${getInstagramCreatedAtJakartaDateSql('created_at')} = $2::date
         AND (
           $3::boolean = false OR
           ${getNormalizedInstagramSourceTypeSql('source_type')} IN ('manual_input', 'manual_fetch')
         )`,
      [client_id, todayJakarta, filterManualOnly]
    );

    const shortcodes = rows.map((r) => r.shortcode);
    if (!shortcodes.length) {
      if (waClient && chatId) {
        const emptyLabel = filterManualOnly ? 'manual hari ini' : 'hari ini';
        await waClient.sendMessage(
          chatId,
          `Tidak ada konten IG ${emptyLabel} untuk client ${clientName || client_id}.`
        );
      }
      sendDebug({ tag: 'IG COMMENT', msg: `Tidak ada post IG client ${client_id} pada filter aktif.`, client_id, clientName });
      return;
    }

    let sukses = 0;
    let gagal = 0;
    for (const sc of shortcodes) {
      await limit(async () => {
        try {
          const comments = await fetchAllInstagramComments(sc, options.maxPage || 10, {
            pageDelayMs: options.commentsPageDelayMs,
            onPageLog: (info) => {
              sendDebug({
                tag: 'IG COMMENT PAGE',
                msg: `shortcode ${sc} | stage ${info.stage} | page ${info.page || '-'} | fetched ${info.fetched || 0} | total ${info.totalAfterMerge || info.total || 0}`,
                client_id,
                clientName,
              });
            },
          });
          for (const c of comments) {
            if (c.user) await upsertIgUser(c.user);
          }

          const commentUsernames = comments
            .map(extractCommentUsername)
            .map(normalizeUsername)
            .filter(Boolean);
          const existingLikes = await getExistingLikes(sc);
          const mergedLikes = [...new Set([...existingLikes, ...commentUsernames])];
          await upsertLikesByShortcode(sc, mergedLikes);

          await insertIgPostComments(sc, comments);
          sukses++;
          sendDebug({
            tag: 'IG COMMENT',
            msg: `Shortcode ${sc} berhasil simpan komentar (${comments.length})`,
            client_id,
            clientName,
          });
          sendDebug({
            tag: 'IG COMMENT LIKE UPSERT',
            msg: `Shortcode ${sc} upsert insta_like dari komentar (${mergedLikes.length} username unik)`,
            client_id,
            clientName,
          });
        } catch (err) {
          gagal++;
          sendDebug({
            tag: 'IG COMMENT ERROR',
            msg: `Gagal shortcode ${sc}: ${(err && err.message) || String(err)}`,
            client_id,
            clientName,
          });
        }
      });
    }

    if (waClient && chatId) {
      await waClient.sendMessage(
        chatId,
        `✅ Selesai fetch komentar IG client ${clientName || client_id}. Berhasil: ${sukses}, Gagal: ${gagal}`
      );
    }
  } catch (err) {
    const clientName = client_id ? (await clientService.findClientById(client_id))?.nama || '' : '';
    if (waClient && chatId) {
      await waClient.sendMessage(
        chatId,
        `❌ Error utama fetch komentar IG: ${(err && err.message) || String(err)}`
      );
    }
    sendDebug({ tag: 'IG COMMENT ERROR', msg: (err && err.message) || String(err), client_id, clientName });
  }
}
