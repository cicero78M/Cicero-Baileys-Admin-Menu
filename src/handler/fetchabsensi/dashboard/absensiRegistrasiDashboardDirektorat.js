import { query } from "../../../db/index.js";
import { hariIndo } from "../../../utils/constants.js";
import { getGreeting } from "../../../utils/utilsHelper.js";

const ROLE_BY_DIREKTORAT_CLIENT = {
  DITBINMAS: "ditbinmas",
  DITLANTAS: "ditlantas",
  BIDHUMAS: "bidhumas",
  DITSAMAPTA: "ditsamapta",
  DITINTELKAM: "ditintelkam",
};

function normalizeDirectorateId(clientId) {
  return String(clientId || "").trim().toUpperCase() || "DITBINMAS";
}

function resolveRoleByDirectorate(clientId) {
  const normalizedDirectorateId = normalizeDirectorateId(clientId);
  const mappedRole = ROLE_BY_DIREKTORAT_CLIENT[normalizedDirectorateId];

  if (!mappedRole) {
    throw new Error(
      `Role mapping untuk client Direktorat "${normalizedDirectorateId}" belum terdaftar. ` +
        "Silakan tambahkan mapping Direktorat→role pada ROLE_BY_DIREKTORAT_CLIENT."
    );
  }

  return mappedRole;
}

async function ensureRoleExists(roleName, directorateId) {
  const { rows } = await query(
    `SELECT role_id
     FROM roles
     WHERE LOWER(role_name) = LOWER($1)
     LIMIT 1`,
    [roleName]
  );

  if (!rows.length) {
    throw new Error(
      `Role "${roleName}" untuk client Direktorat "${directorateId}" tidak ditemukan pada tabel roles. ` +
        "Konfigurasi role belum sinkron antara mapping aplikasi dan database."
    );
  }
}

function ensureDirectorateMetadata(directorateMetadata, directorateId) {
  if (!directorateMetadata) {
    throw new Error(
      `Client Direktorat "${directorateId}" tidak ditemukan pada tabel clients.`
    );
  }

  const resolvedClientId = String(directorateMetadata.client_id || "")
    .trim()
    .toUpperCase();
  const resolvedClientType = String(directorateMetadata.client_type || "")
    .trim()
    .toLowerCase();

  if (resolvedClientId !== directorateId) {
    throw new Error(
      `Data client_id tidak sinkron. Direktorat terpilih "${directorateId}" tetapi metadata mengarah ke "${resolvedClientId || '-'}".`
    );
  }

  if (resolvedClientType !== "direktorat") {
    throw new Error(
      `Client "${directorateId}" bukan tipe direktorat (client_type saat ini: "${resolvedClientType || '-'}").`
    );
  }
}

/**
 * Rekap registrasi user dashboard + absensi web untuk menu 1️⃣1️⃣ (dirrequest).
 *
 * Mapping resmi Direktorat→role:
 * - DITBINMAS → ditbinmas
 * - DITLANTAS → ditlantas
 * - BIDHUMAS → bidhumas
 * - DITSAMAPTA → ditsamapta
 * - DITINTELKAM → ditintelkam
 */
export async function absensiRegistrasiDashboardDirektorat(clientId = "DITBINMAS") {
  const directorateId = normalizeDirectorateId(clientId);
  const roleName = resolveRoleByDirectorate(directorateId);
  const roleLabel = "Direktorat";

  await ensureRoleExists(roleName, directorateId);

  const now = new Date();
  const hari = hariIndo[now.getDay()];
  const tanggal = now.toLocaleDateString("id-ID");
  const jam = now.toLocaleTimeString("id-ID", { hour12: false });
  const salam = getGreeting();

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const { rows: directorateRows } = await query(
    `SELECT client_id, nama, client_type, regional_id, client_level
     FROM clients
     WHERE UPPER(client_id) = $1
     LIMIT 1`,
    [directorateId]
  );
  const directorateMetadata = directorateRows[0] || null;
  ensureDirectorateMetadata(directorateMetadata, directorateId);

  const selectedDirektorat = {
    client_id: directorateId,
    nama: directorateMetadata.nama || directorateId,
    client_type: directorateMetadata.client_type,
  };

  const { rows: directorateDashboardRows } = await query(
    `SELECT COUNT(DISTINCT du.dashboard_user_id) AS dashboard_user
     FROM dashboard_user du
     JOIN roles r ON du.role_id = r.role_id
     JOIN dashboard_user_clients duc ON du.dashboard_user_id = duc.dashboard_user_id
     JOIN clients c ON UPPER(c.client_id) = UPPER(duc.client_id)
     WHERE LOWER(r.role_name) = LOWER($1)
       AND du.status = true
       AND LOWER(TRIM(c.client_type)) = 'direktorat'
       AND UPPER(duc.client_id) = $2`,
    [roleName, directorateId]
  );

  const { rows: directorateLoginRows } = await query(
    `SELECT COUNT(DISTINCT du.dashboard_user_id) AS operator
     FROM dashboard_user du
     JOIN roles r ON du.role_id = r.role_id
     JOIN dashboard_user_clients duc ON du.dashboard_user_id = duc.dashboard_user_id
     JOIN clients c ON UPPER(c.client_id) = UPPER(duc.client_id)
     JOIN login_log ll ON ll.actor_id = du.dashboard_user_id::TEXT
     WHERE LOWER(r.role_name) = LOWER($1)
       AND du.status = true
       AND LOWER(TRIM(c.client_type)) = 'direktorat'
       AND UPPER(duc.client_id) = $2
       AND ll.login_source = 'web'
       AND ll.logged_at >= $3`,
    [roleName, directorateId, startOfToday]
  );

  const directorateName = selectedDirektorat.nama || directorateId;
  const directorateDashboardCount = Number(directorateDashboardRows[0]?.dashboard_user || 0);
  const directorateAttendanceCount = Number(directorateLoginRows[0]?.operator || 0);

  let msg = `${salam}\n\n`;
  msg += `Mohon Ijin Komandan,\n\n`;
  msg += `📋 Rekap Registrasi User dashboard Cicero ${directorateName.toUpperCase()} :\n`;
  msg += `${hari}, ${tanggal}\n`;
  msg += `Jam: ${jam}\n\n`;
  msg += `Role filter: ${roleName.toUpperCase()}\n\n`;
  msg += `Validasi Direktorat: client_id=${directorateId}, client_type=${String(
    selectedDirektorat.client_type || ""
  ).toLowerCase()}, role=${roleName.toUpperCase()}\n\n`;
  msg += "Absensi Registrasi User Direktorat :\n\n";
  msg += `${directorateName.toUpperCase()} : ${directorateDashboardCount} ${roleLabel} (${directorateAttendanceCount} absensi web)\n\n`;
  msg +=
    "Catatan: Rekap ini hanya menghitung user dashboard dengan client_id yang sama dengan Direktorat terpilih dan client_type=direktorat.";

  return msg.trim();
}

export { absensiRegistrasiDashboardDirektorat as absensiRegistrasiDashboardDitbinmas };
