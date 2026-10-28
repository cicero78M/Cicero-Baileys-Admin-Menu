import { findUserById } from '../model/userModel.js';
import { query } from '../repository/db.js';
import { tokenAllowsClient, isKediriAmplifierEnabled } from './amplificationRole.js';

// A person may write only their own report; a client/operator can write only
// for a user in an explicitly claimed tenant. Never trust body client_id.
export async function authorizeReportMutation(req, { special = false, create = false } = {}) {
  const fail = (message) => { const err = new Error(message); err.statusCode = 403; throw err; };
  const id = req.body?.user_id;
  if (!id || !req.user) fail('user_id tidak diizinkan');
  const target = await findUserById(id);
  if (!target || target.status !== true || !target.client_id) fail('user_id tidak diizinkan');
  const role = String(req.user.role || '').toLowerCase();
  if (role === 'user') {
    if (String(req.user.user_id || '') !== String(id)) fail('user_id tidak diizinkan');
  } else if (!tokenAllowsClient(req.user, target.client_id)) fail('client_id tidak diizinkan');
  if (isKediriAmplifierEnabled(target.client_id) && target.amplifier !== true) fail('role amplifier diperlukan');
  const claimedClient = req.body.client_id;
  if (claimedClient && String(claimedClient).trim().toLowerCase() !== String(target.client_id).trim().toLowerCase()) fail('client_id tidak diizinkan');
  // Special creation creates the post after this check. Existing special posts
  // must already belong to this tenant, including across simultaneous requests.
  const shortcode = create ? req.body.shortcode : req.params?.shortcode;
  if (!special || !create) {
    if (!shortcode) fail('shortcode tidak diizinkan');
    const table = special ? 'insta_post_khusus' : 'insta_post';
    const { rows } = await query(`SELECT client_id FROM ${table} WHERE shortcode = $1`, [shortcode]);
    if (!rows.length || String(rows[0].client_id || '').trim().toLowerCase() !== String(target.client_id).trim().toLowerCase()) fail('shortcode tidak diizinkan');
  }
  return target;
}
