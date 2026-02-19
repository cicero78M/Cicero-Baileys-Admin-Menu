import { getPostsTodayByClient as getInstaPostsTodayByClient } from "../../model/instaPostModel.js";
import { getPostsTodayByClient as getManualInstaPostsTodayByClient } from "../../model/instaPostKhususModel.js";
import {
  getLikesByShortcode,
  getLatestLikeAuditByWindow,
} from "../../model/instaLikeModel.js";
import {
  getManualPostsTodayByClient as getManualTiktokPostsToday,
  getOfficialPostsTodayByClient as getOfficialTiktokPostsToday,
} from "../../model/tiktokPostModel.js";
import {
  getCommentsByVideoId,
  getLatestCommentAuditByWindow,
} from "../../model/tiktokCommentModel.js";
import { findClientById } from "../../service/clientService.js";
import { handleFetchLikesInstagram } from "../fetchengagement/fetchLikesInstagram.js";
import { handleFetchKomentarTiktokBatch } from "../fetchengagement/fetchCommentTiktok.js";

const DEFAULT_WINDOW_MS = 30 * 60 * 1000;

function formatUploadTime(date) {
  if (!date) return null;
  try {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    const formatted = parsed.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    });
    return formatted.replace(/\./g, ":");
  } catch {
    return null;
  }
}

function normalizeDateInput(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeUsernamesArray(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((val) => {
        if (typeof val === "string") return val;
        if (val && typeof val === "object") {
          if (typeof val.username === "string") return val.username;
          if (typeof val.user === "string") return val.user;
        }
        return null;
      })
      .filter(Boolean);
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? normalizeUsernamesArray(parsed) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeSnapshotWindow(snapshotWindowStart, snapshotWindowEnd) {
  const start = normalizeDateInput(snapshotWindowStart);
  const end = normalizeDateInput(snapshotWindowEnd);
  if (start && !end) {
    const computedEnd = new Date(start.getTime() + DEFAULT_WINDOW_MS);
    return { start, end: computedEnd };
  }
  if (end && !start) {
    const computedStart = new Date(end.getTime() - DEFAULT_WINDOW_MS);
    return { start: computedStart, end };
  }
  if (!start || !end) return null;
  return { start, end };
}

function formatWibTime(date) {
  try {
    const formatted = date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    });
    return formatted.replace(/\./g, ":");
  } catch {
    return null;
  }
}

function formatSnapshotWindowLabel(snapshotWindow) {
  if (!snapshotWindow?.start || !snapshotWindow?.end) return null;
  const startLabel = formatWibTime(snapshotWindow.start);
  const endLabel = formatWibTime(snapshotWindow.end);
  if (!startLabel || !endLabel) return null;
  return `Data rentang ${startLabel}–${endLabel} WIB`;
}

function pickUniqueBy(items, keyExtractor, sourceExtractor) {
  const map = new Map();
  for (const item of items || []) {
    const key = keyExtractor(item);
    if (!key) continue;
    const normalizedKey = String(key).trim();
    if (!normalizedKey) continue;
    const existing = map.get(normalizedKey);
    if (!existing) {
      map.set(normalizedKey, item);
      continue;
    }
    const currentSource = sourceExtractor(item);
    const existingSource = sourceExtractor(existing);
    if (existingSource === "official" && currentSource === "manual") {
      continue;
    }
    if (existingSource === "manual" && currentSource === "official") {
      map.set(normalizedKey, item);
    }
  }
  return Array.from(map.values());
}

async function fetchLikesWithAudit(shortcodes, snapshotWindow) {
  if (!Array.isArray(shortcodes) || shortcodes.length === 0) {
    return { likesList: [], auditUsed: false };
  }
  if (!snapshotWindow) {
    const likesList = await Promise.all(
      shortcodes.map((sc) => getLikesByShortcode(sc).catch(() => []))
    );
    return { likesList: likesList.map(normalizeUsernamesArray), auditUsed: false };
  }
  const auditRows = await getLatestLikeAuditByWindow(
    shortcodes,
    snapshotWindow.start,
    snapshotWindow.end
  );
  const auditMap = new Map(
    auditRows.map((row) => [row.shortcode, normalizeUsernamesArray(row.usernames)])
  );
  const likesList = [];
  for (const sc of shortcodes) {
    if (auditMap.has(sc)) {
      likesList.push(auditMap.get(sc));
      continue;
    }
    const fallback = await getLikesByShortcode(sc).catch(() => []);
    likesList.push(normalizeUsernamesArray(fallback));
  }
  return { likesList, auditUsed: auditMap.size > 0 };
}

async function fetchCommentsWithAudit(posts, snapshotWindow) {
  if (!Array.isArray(posts) || posts.length === 0) {
    return { commentList: [], auditUsed: false };
  }
  const videoIds = posts.map((post) => post.video_id);
  if (!snapshotWindow) {
    const commentList = await Promise.all(
      videoIds.map((vid) =>
        getCommentsByVideoId(vid).catch(() => ({ comments: [] }))
      )
    );
    return {
      commentList: commentList.map((entry) =>
        normalizeUsernamesArray(entry?.comments || [])
      ),
      auditUsed: false,
    };
  }
  const auditRows = await getLatestCommentAuditByWindow(
    videoIds,
    snapshotWindow.start,
    snapshotWindow.end
  );
  const auditMap = new Map(
    auditRows.map((row) => [row.video_id, normalizeUsernamesArray(row.usernames)])
  );
  const commentList = [];
  for (const vid of videoIds) {
    if (auditMap.has(vid)) {
      commentList.push(auditMap.get(vid));
      continue;
    }
    const fallback = await getCommentsByVideoId(vid).catch(() => ({ comments: [] }));
    commentList.push(normalizeUsernamesArray(fallback?.comments || []));
  }
  return { commentList, auditUsed: auditMap.size > 0 };
}

function buildInstaLine(post, index, likesCount, previousIgShortcodes = []) {
  const shortcode = post?.shortcode;
  const suffix = likesCount === 1 ? "like" : "likes";
  const uploadTime = formatUploadTime(post?.created_at);
  const uploadLabel = uploadTime
    ? `(upload ${uploadTime} WIB)`
    : "(upload tidak diketahui)";
  const isNew = !previousIgShortcodes.includes(shortcode);
  const newLabel = isNew ? "[BARU] " : "";
  return `${index + 1}. ${newLabel}https://www.instagram.com/p/${shortcode} ${uploadLabel} : ${likesCount} ${suffix}`;
}

function buildTiktokLine(post, index, commentCount, previousTiktokVideoIds = [], tiktokUsername = "") {
  const link = tiktokUsername
    ? `https://www.tiktok.com/@${tiktokUsername}/video/${post.video_id}`
    : `https://www.tiktok.com/video/${post.video_id}`;
  const uploadTime = formatUploadTime(post?.created_at);
  const uploadLabel = uploadTime
    ? `(upload ${uploadTime} WIB)`
    : "(upload tidak diketahui)";
  const isNew = !previousTiktokVideoIds.includes(post.video_id);
  const newLabel = isNew ? "[BARU] " : "";
  return `${index + 1}. ${newLabel}${link} ${uploadLabel} : ${commentCount} komentar`;
}

export async function generateSosmedTaskMessage(
  clientId = "DITBINMAS",
  options = {}
) {
  if (typeof options === "boolean") {
    options = { skipTiktokFetch: options };
  }
  const {
    skipTiktokFetch = false,
    skipLikesFetch = false,
    previousState = {},
  } = options;
  const snapshotWindow = normalizeSnapshotWindow(
    options.snapshotWindowStart ||
      options.snapshotWindow?.snapshotWindowStart ||
      options.snapshotWindow?.start,
    options.snapshotWindowEnd ||
      options.snapshotWindow?.snapshotWindowEnd ||
      options.snapshotWindow?.end
  );
  const snapshotWindowLabel = formatSnapshotWindowLabel(snapshotWindow);

  const previousIgShortcodes = Array.isArray(previousState.igShortcodes)
    ? previousState.igShortcodes
    : [];
  const previousTiktokVideoIds = Array.isArray(previousState.tiktokVideoIds)
    ? previousState.tiktokVideoIds
    : [];

  let clientName = clientId;
  let tiktokUsername = "";

  try {
    const client = await findClientById(clientId);
    clientName = (client?.nama || clientId).toUpperCase();
    tiktokUsername = (client?.client_tiktok || "").replace(/^@/, "");
  } catch {
    // ignore errors, use defaults
  }

  let officialInstaPosts = [];
  let manualInstaPosts = [];
  try {
    officialInstaPosts = await getInstaPostsTodayByClient(clientId);
    manualInstaPosts = await getManualInstaPostsTodayByClient(clientId);
    if (!skipLikesFetch) {
      await handleFetchLikesInstagram(null, null, clientId, {
        snapshotWindow: snapshotWindow
          ? { start: snapshotWindow.start, end: snapshotWindow.end }
          : undefined,
      });
    }
  } catch {
    officialInstaPosts = [];
    manualInstaPosts = [];
  }

  const dedupedOfficialInstaPosts = pickUniqueBy(
    officialInstaPosts,
    (post) => post?.shortcode,
    () => "official"
  );
  const dedupedManualInstaPosts = pickUniqueBy(
    manualInstaPosts,
    (post) => post?.shortcode,
    () => "manual"
  ).filter(
    (manualPost) =>
      !dedupedOfficialInstaPosts.some(
        (officialPost) => officialPost.shortcode === manualPost.shortcode
      )
  );

  const mergedInstaPosts = [...dedupedOfficialInstaPosts, ...dedupedManualInstaPosts];
  const instaShortcodes = mergedInstaPosts.map((post) => post.shortcode);
  const { likesList: likeResults } = await fetchLikesWithAudit(
    instaShortcodes,
    snapshotWindow
  );

  const likesCountByShortcode = new Map();
  instaShortcodes.forEach((shortcode, idx) => {
    const likes = likeResults[idx];
    likesCountByShortcode.set(shortcode, Array.isArray(likes) ? likes.length : 0);
  });

  const officialIgDetails = dedupedOfficialInstaPosts.map((post, idx) =>
    buildInstaLine(
      post,
      idx,
      likesCountByShortcode.get(post.shortcode) || 0,
      previousIgShortcodes
    )
  );

  const manualIgDetails = dedupedManualInstaPosts.map((post, idx) =>
    buildInstaLine(
      post,
      idx,
      likesCountByShortcode.get(post.shortcode) || 0,
      previousIgShortcodes
    )
  );

  const officialIgTotalLikes = dedupedOfficialInstaPosts.reduce(
    (acc, post) => acc + (likesCountByShortcode.get(post.shortcode) || 0),
    0
  );
  const manualIgTotalLikes = dedupedManualInstaPosts.reduce(
    (acc, post) => acc + (likesCountByShortcode.get(post.shortcode) || 0),
    0
  );

  let officialTiktokPosts = [];
  let manualTiktokPosts = [];
  try {
    officialTiktokPosts = await getOfficialTiktokPostsToday(clientId);
    manualTiktokPosts = await getManualTiktokPostsToday(clientId);
    if (!skipTiktokFetch) {
      await handleFetchKomentarTiktokBatch(null, null, clientId, {
        snapshotWindow: snapshotWindow
          ? { start: snapshotWindow.start, end: snapshotWindow.end }
          : undefined,
      });
    }
  } catch {
    officialTiktokPosts = [];
    manualTiktokPosts = [];
  }

  const dedupedOfficialTiktokPosts = pickUniqueBy(
    officialTiktokPosts,
    (post) => post?.video_id,
    () => "official"
  );
  const dedupedManualTiktokPosts = pickUniqueBy(
    manualTiktokPosts,
    (post) => post?.video_id,
    () => "manual"
  ).filter(
    (manualPost) =>
      !dedupedOfficialTiktokPosts.some(
        (officialPost) => officialPost.video_id === manualPost.video_id
      )
  );

  const mergedTiktokPosts = [...dedupedOfficialTiktokPosts, ...dedupedManualTiktokPosts];
  const { commentList: commentResults } = await fetchCommentsWithAudit(
    mergedTiktokPosts,
    snapshotWindow
  );

  const commentsCountByVideoId = new Map();
  mergedTiktokPosts.forEach((post, idx) => {
    const comments = commentResults[idx] || [];
    commentsCountByVideoId.set(post.video_id, Array.isArray(comments) ? comments.length : 0);
  });

  const officialTiktokDetails = dedupedOfficialTiktokPosts.map((post, idx) =>
    buildTiktokLine(
      post,
      idx,
      commentsCountByVideoId.get(post.video_id) || 0,
      previousTiktokVideoIds,
      tiktokUsername
    )
  );

  const manualTiktokDetails = dedupedManualTiktokPosts.map((post, idx) =>
    buildTiktokLine(
      post,
      idx,
      commentsCountByVideoId.get(post.video_id) || 0,
      previousTiktokVideoIds,
      tiktokUsername
    )
  );

  const officialTiktokTotalComments = dedupedOfficialTiktokPosts.reduce(
    (acc, post) => acc + (commentsCountByVideoId.get(post.video_id) || 0),
    0
  );
  const manualTiktokTotalComments = dedupedManualTiktokPosts.reduce(
    (acc, post) => acc + (commentsCountByVideoId.get(post.video_id) || 0),
    0
  );

  const allIgCount = dedupedOfficialInstaPosts.length + dedupedManualInstaPosts.length;
  const allTiktokCount = dedupedOfficialTiktokPosts.length + dedupedManualTiktokPosts.length;
  const allTotalLikes = officialIgTotalLikes + manualIgTotalLikes;
  const allTotalComments = officialTiktokTotalComments + manualTiktokTotalComments;

  let msg =
    "Mohon Ijin Komandan, Senior, Rekan Operator dan Personil pelaksana Tugas Likes dan komentar Sosial Media " +
    `${clientName}.\n\n` +
    "Tugas Likes dan Komentar Konten Instagram dan Tiktok \n" +
    `${clientName}\n` +
    `Jumlah konten Instagram hari ini (total): ${allIgCount} \n` +
    `Total likes semua konten: ${allTotalLikes} \n` +
    `Jumlah konten Tiktok hari ini (total): ${allTiktokCount} \n` +
    `Total komentar semua konten: ${allTotalComments}\n\n` +
    "Segmen Konten Resmi\n" +
    `- Instagram: ${dedupedOfficialInstaPosts.length} konten | Total likes: ${officialIgTotalLikes}\n` +
    `Rincian Instagram:\n`;

  msg += officialIgDetails.length ? officialIgDetails.join("\n") : "-";
  msg +=
    `\n\n- TikTok: ${dedupedOfficialTiktokPosts.length} konten | Total komentar: ${officialTiktokTotalComments}\n` +
    "Rincian TikTok:\n";
  msg += officialTiktokDetails.length ? officialTiktokDetails.join("\n") : "-";

  msg +=
    "\n\nSegmen Tugas Khusus\n" +
    `- Instagram (manual): ${dedupedManualInstaPosts.length} konten | Total likes: ${manualIgTotalLikes}\n` +
    "Rincian Instagram manual:\n";
  msg += manualIgDetails.length ? manualIgDetails.join("\n") : "-";

  msg +=
    `\n\n- TikTok (manual): ${dedupedManualTiktokPosts.length} konten | Total komentar: ${manualTiktokTotalComments}\n` +
    "Rincian TikTok manual:\n";
  msg += manualTiktokDetails.length ? manualTiktokDetails.join("\n") : "-";

  if (snapshotWindowLabel) {
    msg += `\n\n${snapshotWindowLabel}`;
  }
  msg += "\n\nSilahkan Melaksanakan Likes, Komentar dan Share.";
  return {
    text: msg.trim(),
    igCount: allIgCount,
    tiktokCount: allTiktokCount,
    state: {
      igShortcodes: instaShortcodes,
      tiktokVideoIds: mergedTiktokPosts.map((post) => post.video_id),
    },
  };
}

export default generateSosmedTaskMessage;
