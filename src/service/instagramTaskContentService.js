import {
  getAttendancePostsByClientAndDate,
  getPostsByFilters as getInstaPostsByFilters,
} from "../model/instaPostModel.js";
import {
  getPostsByClientAndDateRange as getManualInstaPostsByDateRange,
} from "../model/instaPostKhususModel.js";
import { getOperationalAttendanceDate } from "../utils/attendanceOperationalDate.js";

function normalizeShortcode(value) {
  return String(value || "").trim();
}

function normalizePostShortcode(post) {
  return normalizeShortcode(post?.shortcode);
}

function sortPostsAscending(posts = []) {
  return [...posts].sort((a, b) => {
    const aTime = new Date(a?.created_at || 0).getTime();
    const bTime = new Date(b?.created_at || 0).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return normalizePostShortcode(a).localeCompare(normalizePostShortcode(b));
  });
}

function mergeUniquePosts(officialPosts = [], manualPosts = []) {
  const mergedMap = new Map();

  for (const post of manualPosts || []) {
    const shortcode = normalizePostShortcode(post);
    if (!shortcode) continue;
    mergedMap.set(shortcode, { ...post, shortcode });
  }

  for (const post of officialPosts || []) {
    const shortcode = normalizePostShortcode(post);
    if (!shortcode) continue;
    mergedMap.set(shortcode, { ...post, shortcode });
  }

  return sortPostsAscending(Array.from(mergedMap.values()));
}

export async function getStandardInstagramTaskPostsToday(clientId) {
  const { operationalDate } = getOperationalAttendanceDate();
  const [officialPosts, manualPosts] = await Promise.all([
    getAttendancePostsByClientAndDate(clientId, operationalDate),
    getManualInstaPostsByDateRange(clientId, {
      startDate: operationalDate,
      endDate: operationalDate,
    }),
  ]);

  return mergeUniquePosts(officialPosts, manualPosts);
}

export async function getStandardInstagramTaskPostsByDate(clientId, dateYmd) {
  const [officialPosts, manualPosts] = await Promise.all([
    getAttendancePostsByClientAndDate(clientId, dateYmd),
    getManualInstaPostsByDateRange(clientId, {
      startDate: dateYmd,
      endDate: dateYmd,
    }),
  ]);

  return mergeUniquePosts(officialPosts, manualPosts);
}

export async function getStandardInstagramTaskShortcodesByRange(
  clientId,
  { startDate = null, endDate = null } = {}
) {
  const [officialPosts, manualPosts] = await Promise.all([
    getInstaPostsByFilters(clientId, {
      startDate: startDate || null,
      endDate: endDate || null,
    }),
    getManualInstaPostsByDateRange(clientId, {
      startDate: startDate || null,
      endDate: endDate || null,
    }),
  ]);

  const mergedPosts = mergeUniquePosts(officialPosts, manualPosts);
  return mergedPosts.map((post) => normalizePostShortcode(post)).filter(Boolean);
}
