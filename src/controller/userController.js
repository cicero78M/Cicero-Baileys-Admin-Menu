import { tokenAllowsClient } from '../utils/amplificationRole.js';
import * as userModel from '../model/userModel.js';
import { getUserDirectoryUsers, UserDirectoryError } from '../service/userDirectoryService.js';
import { sendSuccess } from '../utils/response.js';
import { normalizeWhatsappNumber } from '../utils/waHelper.js';

export const getAllUsers = async (req, res, next) => {
  try {
    const users = await userModel.getAllUsers();
    sendSuccess(res, users);
  } catch (err) {
    next(err);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await userModel.findUserById(req.params.id);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};

function hasAmplifierInput(data) {
  return Object.prototype.hasOwnProperty.call(data || {}, 'amplifier') ||
    (Array.isArray(data?.roles) && data.roles.some((role) => typeof role === 'string' && role.toLowerCase() === 'amplifier'));
}

function canManageKediri(req) {
  return String(req.user?.role || '').toLowerCase() === 'operator' && tokenAllowsClient(req.user, 'KEDIRI');
}

function forbidden(res) {
  return res.status(403).json({ success: false, message: 'client_id tidak diizinkan' });
}

export const createUser = async (req, res, next) => {
  try {
    const role = req.user?.role?.toLowerCase();
    const adminClientId = req.user?.client_id;
    const data = { ...req.body };
    if (hasAmplifierInput(data)) {
      if (!canManageKediri(req) || String(data.client_id || '').trim().toUpperCase() !== 'KEDIRI') return forbidden(res);
      const rolesRequested = Array.isArray(data.roles) ? data.roles : [];
      if (rolesRequested.some((r) => typeof r !== 'string' || !['amplifier', 'operator'].includes(r.toLowerCase()))) {
        return res.status(400).json({ success: false, message: 'role tidak valid' });
      }
      if ('amplifier' in data && typeof data.amplifier !== 'boolean') {
        return res.status(400).json({ success: false, message: 'amplifier harus boolean' });
      }
      if (data.amplifier === false || ('operator' in data && typeof data.operator !== 'boolean') ||
          ['ditbinmas', 'ditlantas', 'bidhumas', 'ditsamapta', 'ditintelkam'].some((r) => r in data)) {
        return res.status(400).json({ success: false, message: 'role tidak valid' });
      }
      const existing = await userModel.findUserById(data.user_id);
      if (existing) {
        if (String(existing.client_id || '').trim().toUpperCase() !== 'KEDIRI') return forbidden(res);
        const wantsOperator = data.operator === true || rolesRequested.some((r) => r.toLowerCase() === 'operator');
        if (wantsOperator && existing.operator !== true) {
          return res.status(400).json({ success: false, message: 'Tambahkan operator secara terpisah' });
        }
        await userModel.setKediriAmplifierRole(existing.user_id, 'KEDIRI', true);
        return sendSuccess(res, await userModel.findUserById(existing.user_id));
      }
      delete data.roles;
      data.amplifier = true;
      if (rolesRequested.some((r) => r.toLowerCase() === 'operator')) data.operator = true;
      const user = await userModel.createUser(data);
      return sendSuccess(res, user, 201);
    }
    if (String(data.client_id || '').trim().toUpperCase() === 'KEDIRI' && !canManageKediri(req)) return forbidden(res);
    let roles = [];
    const defaultRoleFlags = {
      ditbinmas: false,
      ditlantas: false,
      bidhumas: false,
      ditsamapta: false,
      ditintelkam: false,
      operator: false,
    };

    const getReactivationRoles = () => {
      if (role === 'operator') return { ...defaultRoleFlags, operator: true };
      if (role === 'ditbinmas') return { ...defaultRoleFlags, ditbinmas: true };
      if (role === 'ditlantas') return { ...defaultRoleFlags, ditlantas: true };
      if (role === 'bidhumas') return { ...defaultRoleFlags, bidhumas: true };
      if (role === 'ditsamapta')
        return { ...defaultRoleFlags, ditsamapta: true };
      if (role === 'ditintelkam')
        return { ...defaultRoleFlags, ditintelkam: true };
      return {};
    };

    const syncExistingUserClientId = async (existingUserId, existingClientId) => {
      if (!data.client_id) return;

      const incomingClientId = data.client_id.toUpperCase();
      const currentClientId = existingClientId?.toUpperCase();

      if (incomingClientId !== currentClientId) {
        // Creation/reactivation is not an authorized cross-client transfer path.
        if (incomingClientId === 'KEDIRI' || currentClientId === 'KEDIRI') {
          const err = new Error('client_id tidak diizinkan');
          err.statusCode = 403;
          throw err;
        }
        await userModel.updateUserField(existingUserId, 'client_id', incomingClientId);
      }
    };

    if (
      role === 'ditbinmas' ||
      role === 'ditlantas' ||
      role === 'bidhumas' ||
      role === 'ditsamapta' ||
      role === 'ditintelkam'
    ) {
      if (adminClientId) data.client_id = adminClientId;
      if (role === 'ditbinmas') data.ditbinmas = true;
      if (role === 'ditlantas') data.ditlantas = true;
      if (role === 'bidhumas') data.bidhumas = true;
      if (role === 'ditsamapta') data.ditsamapta = true;
      if (role === 'ditintelkam') data.ditintelkam = true;
    }

    if (role === 'operator') {
      roles = Array.isArray(data.roles)
        ? data.roles.map((r) => r.toLowerCase())
        : [];
      delete data.roles;

      if (roles.length === 0) roles.push('operator');

      for (const r of roles) {
        data[r] = true;
      }

      if (roles.includes('operator')) {
        if (!roles.includes('ditbinmas') && data.ditbinmas === undefined)
          data.ditbinmas = false;
        if (!roles.includes('ditlantas') && data.ditlantas === undefined)
          data.ditlantas = false;
        if (!roles.includes('bidhumas') && data.bidhumas === undefined)
          data.bidhumas = false;
        if (!roles.includes('ditsamapta') && data.ditsamapta === undefined)
          data.ditsamapta = false;
        if (!roles.includes('ditintelkam') && data.ditintelkam === undefined)
          data.ditintelkam = false;
      }

      const existing = await userModel.findUserById(data.user_id);
      if (existing) {
        if (String(existing.client_id || '').trim().toUpperCase() === 'KEDIRI' && !canManageKediri(req)) return forbidden(res);
        await syncExistingUserClientId(existing.user_id, existing.client_id);

        if (existing.status === false) {
          await userModel.updateUser(existing.user_id, {
            status: true,
            ...getReactivationRoles(),
          });
        } else {
          for (const r of roles) {
            await userModel.updateUserField(existing.user_id, r, true);
          }
        }

        const refreshed = await userModel.findUserById(existing.user_id);
        sendSuccess(res, refreshed);
        return;
      }

      const user = await userModel.createUser(data);
      sendSuccess(res, user, 201);
      return;
    }

    const existing = await userModel.findUserById(data.user_id);
    if (existing) {
      await syncExistingUserClientId(existing.user_id, existing.client_id);

      if (existing.status === false) {
        await userModel.updateUser(existing.user_id, {
          status: true,
          ...getReactivationRoles(),
        });
      } else {
        const rolesToAdd = [];
        if (
          role === 'ditbinmas' ||
          role === 'ditlantas' ||
          role === 'bidhumas' ||
          role === 'ditsamapta' ||
          role === 'ditintelkam'
        ) {
          rolesToAdd.push(role);
        }

        for (const r of rolesToAdd) {
          await userModel.updateUserField(existing.user_id, r, true);
        }
      }

      const refreshed = await userModel.findUserById(existing.user_id);
      sendSuccess(res, refreshed);
      return;
    }

    const user = await userModel.createUser(data);
    sendSuccess(res, user, 201);
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    if (hasAmplifierInput(req.body)) {
      if (!canManageKediri(req)) return forbidden(res);
      if (typeof req.body.amplifier !== 'boolean' || Object.keys(req.body).some((key) => key !== 'amplifier')) {
        return res.status(400).json({ success: false, message: 'amplifier harus boolean dan dikirim terpisah' });
      }
      const existing = await userModel.findUserById(req.params.id);
      if (!existing || String(existing.client_id || '').trim().toUpperCase() !== 'KEDIRI') return forbidden(res);
      await userModel.setKediriAmplifierRole(existing.user_id, 'KEDIRI', req.body.amplifier);
      return sendSuccess(res, await userModel.findUserById(existing.user_id));
    }
    const existing = await userModel.findUserById(req.params.id);
    const existingKediri = String(existing?.client_id || '').trim().toUpperCase() === 'KEDIRI';
    const requestedKediri = String(req.body?.client_id || '').trim().toUpperCase() === 'KEDIRI';
    if ((existingKediri || requestedKediri) && !canManageKediri(req)) return forbidden(res);
    if ((existingKediri || requestedKediri) && (('client_id' in req.body &&
        String(req.body.client_id || '').trim().toUpperCase() !== String(existing?.client_id || '').trim().toUpperCase()) ||
        ('user_id' in req.body && String(req.body.user_id) !== String(req.params.id)))) {
      return res.status(403).json({ success: false, message: 'Pemindahan user tidak diizinkan' });
    }
    const user = await userModel.updateUser(req.params.id, req.body);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};

export const updateWaNotificationPreference = async (req, res, next) => {
  try {
    const { whatsapp, opt_in, wa_notification_opt_in } = req.body;
    const userId = req.params.id;

    if (!whatsapp) {
      return res
        .status(400)
        .json({ success: false, message: 'whatsapp wajib diisi' });
    }

    const normalizedRequestWa = normalizeWhatsappNumber(String(whatsapp));
    let normalizedPreference;
    if (typeof opt_in === 'boolean') {
      normalizedPreference = opt_in;
    } else if (typeof wa_notification_opt_in === 'boolean') {
      normalizedPreference = wa_notification_opt_in;
    } else {
      const raw = String(opt_in ?? wa_notification_opt_in ?? '').toLowerCase();
      if (['true', '1', 'on', 'ya', 'yes'].includes(raw)) {
        normalizedPreference = true;
      } else if (['false', '0', 'off', 'tidak', 'no'].includes(raw)) {
        normalizedPreference = false;
      }
    }

    if (typeof normalizedPreference !== 'boolean') {
      return res
        .status(400)
        .json({ success: false, message: 'opt_in harus bernilai boolean' });
    }

    const existing = await userModel.findUserById(userId);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: 'user tidak ditemukan' });
    }
    if (!existing.whatsapp) {
      return res.status(400).json({
        success: false,
        message: 'user belum memiliki nomor WhatsApp yang terdaftar',
      });
    }

    const normalizedStoredWa = normalizeWhatsappNumber(
      String(existing.whatsapp)
    );
    if (normalizedStoredWa !== normalizedRequestWa) {
      return res.status(400).json({
        success: false,
        message: 'nomor WhatsApp tidak sesuai dengan data user',
      });
    }

    const updated = await userModel.updateUser(userId, {
      wa_notification_opt_in: normalizedPreference,
    });
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
};

export const updateUserRoles = async (req, res, next) => {
  try {
    if (hasAmplifierInput(req.body)) {
      return res.status(400).json({ success: false, message: 'Ubah amplifier secara terpisah' });
    }
    const roles = Array.isArray(req.body.roles)
      ? req.body.roles.map((r) => r.toLowerCase())
      : [];
    const allowed = ['ditbinmas', 'ditlantas', 'bidhumas', 'ditsamapta', 'ditintelkam', 'operator'];
    const existing = await userModel.findUserById(req.params.id);
    if (String(existing?.client_id || '').trim().toUpperCase() === 'KEDIRI') {
      if (!canManageKediri(req)) return forbidden(res);
      if (existing.operator === true && !roles.includes('operator')) {
        return res.status(400).json({ success: false, message: 'Hapus operator secara eksplisit dan terpisah' });
      }
    }
    const data = {};
    for (const r of allowed) {
      data[r] = roles.includes(r);
    }
    const user = await userModel.updateUser(req.params.id, data);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};

export const updateUserRoleIds = async (req, res, next) => {
  try {
    const { old_user_id, new_user_id } = req.body;
    await userModel.updateUserRolesUserId(old_user_id, new_user_id);
    sendSuccess(res, { old_user_id, new_user_id });
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const rawRole = req.query?.role ?? req.body?.role;
    const role =
      typeof rawRole === 'string' && rawRole.trim() ? rawRole.trim().toLowerCase() : null;
    const user = await userModel.deactivateRoleOrUser(req.params.id, role);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
};

// --- Query DB: User by client_id (aktif)
export const getUsersByClient = async (req, res, next) => {
  try {
    const role = req.user?.role?.toLowerCase();
    const tokenClientId = req.user?.client_id;
    const tokenClientIds = Array.isArray(req.user?.client_ids)
      ? req.user.client_ids
      : req.user?.client_id
        ? [req.user.client_id]
        : [];
    let clientId = req.params.client_id;
    if (role === 'operator') {
      const normalizedTokenClientIds = tokenClientIds.map((clientIdValue) =>
        String(clientIdValue).toLowerCase()
      );
      const normalizedRequestedId = String(clientId).toLowerCase();
      const matchedIndex = normalizedTokenClientIds.indexOf(
        normalizedRequestedId
      );

      if (matchedIndex === -1) {
        return res.status(403).json({
          success: false,
          message: 'client_id tidak diizinkan',
        });
      }

      clientId = tokenClientIds[matchedIndex];
    }
    if (
      ['ditbinmas', 'ditlantas', 'bidhumas', 'ditsamapta', 'ditintelkam'].includes(role) &&
      tokenClientId
    ) {
      clientId = tokenClientId;
    }
    const users = await userModel.getUsersByClient(clientId, role);
    sendSuccess(res, users);
  } catch (err) {
    next(err);
  }
};

// --- Query DB: User by client_id (full, semua status)
export const getUsersByClientFull = async (req, res, next) => {
  try {
    const role = req.user?.role?.toLowerCase();
    const tokenClientId = req.user?.client_id;
    const tokenClientIds = Array.isArray(req.user?.client_ids)
      ? req.user.client_ids
      : req.user?.client_id
        ? [req.user.client_id]
        : [];
    let clientId = req.params.client_id;
    if (role === 'operator') {
      const normalizedTokenClientIds = tokenClientIds.map((clientIdValue) =>
        String(clientIdValue).toLowerCase()
      );
      const normalizedRequestedId = String(clientId).toLowerCase();
      const matchedIndex = normalizedTokenClientIds.indexOf(
        normalizedRequestedId
      );

      if (matchedIndex === -1) {
        return res.status(403).json({
          success: false,
          message: 'client_id tidak diizinkan',
        });
      }

      clientId = tokenClientIds[matchedIndex];
    }
    if (
      ['ditbinmas', 'ditlantas', 'bidhumas', 'ditsamapta', 'ditintelkam'].includes(role) &&
      tokenClientId
    ) {
      clientId = tokenClientId;
    }
    const users = await userModel.getUsersByClientFull(clientId, role);
    sendSuccess(res, users);
  } catch (err) {
    next(err);
  }
};

// --- API: Ambil daftar user untuk User Directory, hanya dari client tertentu ---
export const getUserList = async (req, res, next) => {
  try {
    const role = req.user?.role?.toLowerCase();
    const clientId = req.query.client_id;
    const tokenClientId = req.user?.client_id;
    const tokenClientIds = Array.isArray(req.user?.client_ids)
      ? req.user.client_ids
      : tokenClientId
        ? [tokenClientId]
        : [];
    const requestedRole = req.query.role
      ? String(req.query.role).toLowerCase()
      : role;
    const requestedScope = req.query.scope
      ? String(req.query.scope).toLowerCase()
      : 'org';
    const regionalId = req.query.regional_id
      ? String(req.query.regional_id).trim().toUpperCase()
      : null;

    const { users } = await getUserDirectoryUsers({
      requesterRole: role,
      tokenClientId,
      tokenClientIds,
      clientId,
      role: requestedRole,
      scope: requestedScope,
      regionalId,
    });
    sendSuccess(res, users);
  } catch (err) {
    if (err instanceof UserDirectoryError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};
