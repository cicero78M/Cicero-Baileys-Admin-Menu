#!/usr/bin/env node

import fs from 'node:fs';
import dotenv from 'dotenv';

const target = String(process.env.STATUS_HISTORY_DB_TARGET || '').trim().toLowerCase();
const envPath = process.env.STATUS_HISTORY_ENV_FILE || '../../Cicero_Web_Backend/.env.status-history-test';
if (!['test', 'staging'].includes(target)) throw new Error('Refused: STATUS_HISTORY_DB_TARGET must be test or staging');

const fileEnv = dotenv.parse(fs.readFileSync(envPath));
if (!fileEnv.DB_HOST || !fileEnv.DB_NAME || !fileEnv.DB_USER || !fileEnv.DB_PASS) {
  throw new Error('Refused: test environment must define DB_HOST, DB_NAME, DB_USER, and DB_PASS');
}
if (fileEnv.DB_NAME === 'cicero_db') throw new Error('Refused: cicero_db cannot be used for this isolated test');
for (const [key, value] of Object.entries(fileEnv)) if (process.env[key] === undefined) process.env[key] = value;
process.env.WHATSAPP_USER_STATUS_HISTORY_DUAL_WRITE = 'true';

const { query, close } = await import('../src/repository/db.js');
const { applyWhatsAppStatusChange } = await import('../src/service/whatsappStatusChangeService.js');

const actorId = '99000029';
const targetUserId = '99000020';
const rollbackUserId = '99000021';
const actorWa = '70000029';

const cleanup = async () => {
  await query('DELETE FROM user_status_history WHERE user_id = ANY($1::varchar[])', [[targetUserId, rollbackUserId]]);
  await query('DELETE FROM user_roles WHERE user_id = ANY($1::varchar[])', [[actorId, targetUserId, rollbackUserId]]);
  await query('DELETE FROM "user" WHERE user_id = ANY($1::varchar[])', [[actorId, targetUserId, rollbackUserId]]);
};

try {
  const identity = (await query('SELECT current_database() AS database, pg_is_in_recovery() AS in_recovery')).rows[0];
  if (identity.database === 'cicero_db') throw new Error('Refused: resolved target is cicero_db');
  await cleanup();
  await query(`
    INSERT INTO "user" (user_id, nama, title, divisi, client_id, status, whatsapp)
    VALUES ($1, 'WA TEST ACTOR', 'BRIPKA', 'TEST', 'TEST', TRUE, $2),
           ($3, 'WA STATUS TEST', 'BRIPTU', 'TEST', 'TEST', TRUE, '628000000020'),
           ($4, 'WA ROLLBACK TEST', 'BRIPTU', 'TEST', 'TEST', TRUE, '628000000021')
  `, [actorId, actorWa, targetUserId, rollbackUserId]);
  await query("INSERT INTO roles (role_name) VALUES ('operator') ON CONFLICT (role_name) DO NOTHING");
  await query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, role_id FROM roles WHERE role_name='operator'`, [actorId]);
  await query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, role_id FROM roles WHERE role_name='operator'`, [targetUserId]);

  const deactivated = await applyWhatsAppStatusChange({
    userId: targetUserId, actionType: 'role_remove', roleName: 'operator', chatId: actorWa,
    targetClientId: 'TEST', reasonCode: 'staging_test', reasonText: 'isolated WhatsApp status-history test',
  });
  const successCheck = (await query(`
    SELECT u.status, u.whatsapp,
      (SELECT COUNT(*) FROM user_status_history WHERE user_id=$1) AS history_count,
      (SELECT actor_external_id FROM user_status_history WHERE user_id=$1 ORDER BY applied_at DESC LIMIT 1) AS actor_external_id
    FROM "user" u WHERE u.user_id=$1
  `, [targetUserId])).rows[0];
  if (deactivated.status !== false || successCheck.status !== false || successCheck.whatsapp !== '' ||
      successCheck.history_count !== '1' || successCheck.actor_external_id !== actorWa) {
    throw new Error(`Unexpected WhatsApp success result: ${JSON.stringify(successCheck)}`);
  }

  try {
    await applyWhatsAppStatusChange({
      userId: rollbackUserId, actionType: 'role_remove', roleName: 'missing-role', chatId: actorWa,
      targetClientId: 'TEST', reasonCode: 'staging_test', reasonText: 'intentional rollback test',
    });
    throw new Error('Expected invalid role to fail');
  } catch (error) {
    if (error.message === 'Expected invalid role to fail') throw error;
  }
  const rollbackCheck = (await query(`
    SELECT u.status, u.whatsapp,
      (SELECT COUNT(*) FROM user_status_history WHERE user_id=$1) AS history_count
    FROM "user" u WHERE u.user_id=$1
  `, [rollbackUserId])).rows[0];
  if (rollbackCheck.status !== true || rollbackCheck.whatsapp !== '628000000021' || rollbackCheck.history_count !== '0') {
    throw new Error(`Rollback failed: ${JSON.stringify(rollbackCheck)}`);
  }
  console.log(JSON.stringify({ target, identity, feature_flag: 'ON (isolated process only)', deactivation: { status: successCheck.status, whatsapp: successCheck.whatsapp, history_count: successCheck.history_count }, rollback: { status: rollbackCheck.status, whatsapp_restored: true, history_count: rollbackCheck.history_count } }, null, 2));
} finally {
  await cleanup().catch(() => {});
  await close().catch(() => {});
}
