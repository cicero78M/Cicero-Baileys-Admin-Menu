import { query } from '../repository/db.js';

async function ensureIgExtPostForComment(postId, shortcode = null) {
  if (!postId) return null;

  const existingPost = await query(
    `SELECT post_id
     FROM ig_ext_posts
     WHERE post_id = $1 OR shortcode = $2
     LIMIT 1`,
    [postId, shortcode]
  );

  if (existingPost.rows.length) {
    return existingPost.rows[0].post_id;
  }

  await query(
    `INSERT INTO ig_ext_posts (post_id, shortcode)
     VALUES ($1, $2)
     ON CONFLICT (post_id) DO NOTHING`,
    [postId, shortcode]
  );

  return postId;
}

export async function insertIgPostComments(postId, comments = [], options = {}) {
  if (!postId || !Array.isArray(comments)) return;

  const resolvedPostId = await ensureIgExtPostForComment(postId, options.shortcode || null);
  if (!resolvedPostId) return;

  for (const c of comments) {
    const cid = c?.id || c?.pk;
    if (!cid) continue;
    const userId = c.user_id || c.user?.id || null;
    const text = c.text || null;
    const createdAt = c.created_at || null;
    await query(
      `INSERT INTO ig_post_comments (comment_id, post_id, user_id, text, created_at)
       VALUES ($1,$2,$3,$4,to_timestamp($5))
       ON CONFLICT (comment_id) DO UPDATE
         SET user_id=EXCLUDED.user_id,
             text=EXCLUDED.text,
             created_at=to_timestamp($5)`,
      [cid, resolvedPostId, userId, text, createdAt]
    );
  }
}
