import dotenv from 'dotenv';
import { withTransaction } from '../repository/db.js';

dotenv.config();

export function isWhatsAppStatusHistoryEnabled() {
  return process.env.WHATSAPP_USER_STATUS_HISTORY_DUAL_WRITE === 'true';
}

function normalizeWaId(value) {
  return String(value || '').replace(/\D/g, '');
}

function requireActorField(value, field) {
  if (value === null || value === undefined || String(value).trim() === '') {
    throw new Error(
      'Penonaktifan WhatsApp ditolak. Lengkapi nama, pangkat, dan NRP pada Profil Dashboard serta pastikan NRP tertaut ke nomor WhatsApp operator.'
    );
  }
  return value;
}

async function resolveActor(db, chatId) {
  const waId = normalizeWaId(chatId);
  const result = await db.query(
    `SELECT u.user_id, u.nama, u.title, u.client_id, u.status,
            COALESCE(array_agg(DISTINCT r.role_name) FILTER (WHERE r.role_name IS NOT NULL), '{}') AS roles
       FROM "user" u
       LEFT JOIN user_roles ur ON ur.user_id = u.user_id
       LEFT JOIN roles r ON r.role_id = ur.role_id
      WHERE regexp_replace(COALESCE(u.whatsapp, ''), '[^0-9]', '', 'g') = $1
      GROUP BY u.user_id
      LIMIT 1`,
    [waId],
  );
  const row = result.rows[0];
  if (!row || row.status !== true) {
    throw new Error(
      'Penonaktifan WhatsApp ditolak. Nomor WhatsApp operator belum tertaut ke profil Dashboard aktif.'
    );
  }

  const roles = (row.roles || []).map((role) => String(role).toLowerCase());
  if (!roles.some((role) => ['operator', 'admin', 'superadmin', 'super_admin'].includes(role))) {
    throw new Error('Penonaktifan WhatsApp ditolak. Nomor ini bukan actor operator yang terverifikasi.');
  }

  requireActorField(row.nama, 'nama');
  requireActorField(row.title, 'pangkat');
  requireActorField(row.user_id, 'NRP');
  requireActorField(row.client_id, 'client');

  return {
    userId: row.user_id,
    externalId: waId,
    name: row.nama,
    title: row.title,
    role: roles.find((role) => ['operator', 'admin', 'superadmin', 'super_admin'].includes(role)),
    clientId: row.client_id,
  };
}

export async function applyWhatsAppStatusChange({
  userId,
  actionType,
  roleName = null,
  chatId,
  targetClientId,
  reasonCode = 'whatsapp_operator',
  reasonText = 'Perubahan status melalui menu operator WhatsApp',
}) {
  return withTransaction(async (db) => {
    const actor = await resolveActor(db, chatId);
    const targetResult = await db.query(
      `SELECT user_id, nama, title, divisi, client_id, status, whatsapp
         FROM "user" WHERE user_id=$1 FOR UPDATE`,
      [userId],
    );
    const target = targetResult.rows[0];
    if (!target) throw new Error('User target tidak ditemukan.');
    if (targetClientId && String(target.client_id).toLowerCase() !== String(targetClientId).toLowerCase()) {
      throw new Error('User target berada di luar client actor WhatsApp.');
    }
    if (String(target.client_id).toLowerCase() !== String(actor.clientId).toLowerCase()) {
      throw new Error('User target berada di luar client actor WhatsApp.');
    }

    const rolesResult = await db.query(
      `SELECT r.role_name FROM user_roles ur
         JOIN roles r ON r.role_id=ur.role_id
        WHERE ur.user_id=$1 ORDER BY r.role_name`,
      [userId],
    );
    const currentRoles = rolesResult.rows.map((row) => row.role_name).filter(Boolean);
    const normalizedRole = typeof roleName === 'string' && roleName.trim()
      ? roleName.trim().toLowerCase()
      : null;

    if (normalizedRole) {
      const selected = currentRoles.find((role) => role.toLowerCase() === normalizedRole);
      if (!selected) throw new Error(`Role ${roleName} tidak ditemukan untuk user.`);
      await db.query(
        'DELETE FROM user_roles WHERE user_id=$1 AND role_id=(SELECT role_id FROM roles WHERE LOWER(role_name)=LOWER($2))',
        [userId, roleName],
      );
    }

    const remainingRoles = normalizedRole
      ? currentRoles.filter((role) => role.toLowerCase() !== normalizedRole)
      : currentRoles;
    const oldStatus = target.status === true;
    const newStatus = actionType === 'activate'
      ? true
      : (!normalizedRole || remainingRoles.length === 0 ? false : oldStatus);

    await db.query('UPDATE "user" SET status=$2, updated_at=NOW() WHERE user_id=$1', [userId, newStatus]);
    if (!newStatus) {
      await db.query('UPDATE "user" SET whatsapp=\'\', updated_at=NOW() WHERE user_id=$1', [userId]);
    }

    await db.query(
      `INSERT INTO user_status_history (
        user_id, target_client_id, old_status, new_status, action_type,
        reason_code, reason_text, target_name_snapshot, target_title_snapshot,
        target_divisi_snapshot, removed_role, remaining_roles, source_channel,
        actor_user_id, actor_external_id, actor_name_snapshot, actor_title_snapshot,
        actor_role_snapshot, actor_client_id, actor_resolution_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        userId, target.client_id, oldStatus, newStatus, actionType,
        reasonCode, reasonText, target.nama, target.title, target.divisi,
        roleName, JSON.stringify(remainingRoles), 'whatsapp_operator',
        actor.userId, actor.externalId, actor.name, actor.title,
        actor.role, actor.clientId, 'resolved',
      ],
    );

    return { ...target, status: newStatus, remainingRoles };
  });
}
