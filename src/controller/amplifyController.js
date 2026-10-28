import { isKediriAmplifierEnabled, tokenAllowsClient } from '../utils/amplificationRole.js';
import { getRekapLinkByClient } from '../model/linkReportModel.js';
import { sendConsoleDebug } from '../middleware/debugHandler.js';
import { normalizeClientId } from '../utils/utilsHelper.js';

export async function getAmplifyRekap(req, res) {
  let client_id = req.query.client_id;
  const periode = req.query.periode || 'harian';
  const tanggal = req.query.tanggal;
  const startDate =
    req.query.start_date || req.query.tanggal_mulai;
  const endDate = req.query.end_date || req.query.tanggal_selesai;
  const requestedRole = req.query.role || req.user?.role;
  const requestedScope = req.query.scope;
  const requestedRegionalId = req.query.regional_id || req.user?.regional_id;
  const regionalId = requestedRegionalId
    ? String(requestedRegionalId).trim().toUpperCase()
    : null;
  const roleLower = requestedRole ? String(requestedRole).toLowerCase() : null;
  const scopeLower = requestedScope
    ? String(requestedScope).toLowerCase()
    : null;
  const directorateRoles = [
    'ditbinmas',
    'ditlantas',
    'bidhumas',
    'ditsamapta'
  ];
  const usesStandardPayload = Boolean(requestedScope || req.query.role);

  if (!usesStandardPayload && roleLower === 'ditbinmas' && !isKediriAmplifierEnabled(client_id)) {
    client_id = 'ditbinmas';
  }

  const normalizedClientId = normalizeClientId(client_id);
  if (!normalizedClientId) {
    return res.status(400).json({ success: false, message: 'client_id wajib diisi' });
  }
  client_id = normalizedClientId;
  const switched = isKediriAmplifierEnabled(client_id);
  if (!switched && req.user?.client_ids) {
    const userClientIds = Array.isArray(req.user.client_ids)
      ? req.user.client_ids
      : [req.user.client_ids];
    const idsLower = userClientIds.map((c) => c.toLowerCase());
    if (
      !idsLower.includes(client_id.toLowerCase()) &&
      roleLower !== client_id.toLowerCase()
    ) {
      return res
        .status(403)
        .json({ success: false, message: 'client_id tidak diizinkan' });
    }
  }
  if (
    !switched && req.user?.client_id &&
    req.user.client_id.toLowerCase() !== client_id.toLowerCase() &&
    roleLower !== client_id.toLowerCase()
  ) {
    return res
      .status(403)
      .json({ success: false, message: 'client_id tidak diizinkan' });
  }
  if (switched && !tokenAllowsClient(req.user, client_id)) {
    return res.status(403).json({ success: false, message: 'client_id tidak diizinkan' });
  }
  if (switched && scopeLower && scopeLower !== 'org') {
    return res.status(403).json({ success: false, message: 'scope tidak diizinkan' });
  }
  try {
    let rekapOptions = switched
      ? { regionalId, userClientId: client_id, userRoleFilter: 'amplifier' }
      : { regionalId };
    let roleForQuery = switched ? null : requestedRole;

    if (usesStandardPayload) {
      const resolvedRole = roleLower || null;
      if (!resolvedRole) {
        return res
          .status(400)
          .json({ success: false, message: 'role wajib diisi' });
      }
      const resolvedScope = scopeLower || 'org';
      if (!['org', 'direktorat'].includes(resolvedScope)) {
        return res
          .status(400)
          .json({ success: false, message: 'scope tidak valid' });
      }

      let postClientId = client_id;
      let userClientId = client_id;
      let userRoleFilter = null;
      let includePostRoleFilter = false;
      let matchLinkClientId = true;

      if (resolvedScope === 'direktorat') {
        postClientId = client_id;
        userClientId = null;
        userRoleFilter = resolvedRole;
      } else if (resolvedScope === 'org') {
        if (resolvedRole === 'operator') {
          const tokenClientId = switched ? client_id : req.user?.client_id;
          if (!tokenClientId) {
            return res.status(400).json({
              success: false,
              message: 'client_id pengguna tidak ditemukan'
            });
          }
          postClientId = tokenClientId;
          userClientId = tokenClientId;
          userRoleFilter = switched ? 'amplifier' : 'operator';
        } else if (directorateRoles.includes(resolvedRole)) {
          postClientId = resolvedRole;
          userClientId = req.user?.client_id || client_id;
          userRoleFilter = resolvedRole;
          matchLinkClientId = false;
        }
      }

      if (switched) {
        postClientId = client_id;
        userClientId = client_id;
        userRoleFilter = 'amplifier';
        includePostRoleFilter = false;
        matchLinkClientId = true;
      }
      rekapOptions = {
        postClientId,
        userClientId,
        userRoleFilter,
        includePostRoleFilter,
        matchLinkClientId,
        regionalId
      };
      roleForQuery = resolvedRole;
    }

    sendConsoleDebug({
      tag: 'AMPLIFY',
      msg: `getAmplifyRekap ${client_id} ${periode} ${tanggal || ''} ${startDate || ''} ${endDate || ''} ${roleLower || ''} ${scopeLower || ''} ${regionalId || ''}`
    });
    const data = await getRekapLinkByClient(
      client_id,
      periode,
      tanggal,
      startDate,
      endDate,
      roleForQuery,
      rekapOptions
    );
    const length = Array.isArray(data) ? data.length : 0;
    const chartHeight = Math.max(length * 30, 300);
    res.json({ success: true, data, chartHeight });
  } catch (err) {
    sendConsoleDebug({ tag: 'AMPLIFY', msg: `Error getAmplifyRekap: ${err.message}` });
    const code = err.statusCode || err.response?.status || 500;
    res.status(code).json({ success: false, message: err.message });
  }
}
