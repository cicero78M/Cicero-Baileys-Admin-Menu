import { findClientById, findAllClientsByType } from "./clientService.js";
import { getClientsByRole, getUsersByDirektorat } from "../model/userModel.js";
import { getShortcodesTodayByClient } from "../model/instaPostModel.js";
import { getPostsTodayByClient } from "../model/tiktokPostModel.js";
import { getLikesSets, normalizeUsername as normalizeInstagramUsername } from "../utils/likesHelper.js";
import { getCommentsByVideoId } from "../model/tiktokCommentModel.js";
import { extractUsernamesFromComments, normalizeUsername as normalizeTiktokUsername } from "../handler/fetchabsensi/tiktok/absensiKomentarTiktok.js";
import { filterAttendanceUsers } from "../utils/utilsHelper.js";
import { getOperationalAttendanceDate, formatOperationalDateLabel } from "../utils/attendanceOperationalDate.js";
import { formatJakartaDisplayDate, formatJakartaDisplayTime } from "../utils/dateJakarta.js";

/**
 * Collect Instagram jajaran attendance data
 * Groups by client/polres with detailed stats
 */
export async function collectInstagramJajaranAttendance(clientId, roleFlag = null) {
  const { hari, tanggal, jam, operationalDate } = getOperationalAttendanceDate();
  const tanggalOperasionalLabel = formatOperationalDateLabel(operationalDate);

  const normalizedClientId = String(clientId || "").toUpperCase();
  const expectedDirektoratRole = normalizedClientId.toLowerCase();
  const normalizedRoleFlag = String(roleFlag || "").toLowerCase();

  // Get client info
  const client = await findClientById(normalizedClientId);
  const clientName = client?.nama || normalizedClientId;
  const clientType = client?.client_type?.toLowerCase();

  // Validate client is direktorat
  if (clientType !== "direktorat") {
    throw new Error(
      `❌ Absensi Instagram Jajaran hanya tersedia untuk client bertipe Direktorat. (${clientName})`
    );
  }

  let personilScopeRole = expectedDirektoratRole;
  if (normalizedRoleFlag) {
    if (normalizedRoleFlag === expectedDirektoratRole) {
      personilScopeRole = normalizedRoleFlag;
    } else {
      console.warn("[JAJARAN_ATTENDANCE] roleFlag mismatch for direktorat scope", {
        event: "jajaran_attendance_roleflag_mismatch",
        selectedClientId: normalizedClientId,
        expectedRole: expectedDirektoratRole,
        providedRoleFlag: normalizedRoleFlag,
        fallbackRole: expectedDirektoratRole,
        source: "collectInstagramJajaranAttendance",
      });
    }
  }

  // Get Instagram posts for today
  let shortcodes;
  try {
    shortcodes = await getShortcodesTodayByClient(normalizedClientId);
  } catch (error) {
    console.error("Error fetching Instagram posts:", error);
    throw new Error("Gagal mengambil data konten Instagram.");
  }

  if (!shortcodes.length) {
    throw new Error(
      `Tidak ada konten untuk tanggal operasional ${tanggalOperasionalLabel} pada akun Official Instagram ${clientName}.`
    );
  }

  const kontenLinks = shortcodes.map((sc) => `https://www.instagram.com/p/${sc}`);
  const totalKonten = shortcodes.length;

  // Get likes data
  let likesSets;
  try {
    likesSets = await getLikesSets(shortcodes);
  } catch (error) {
    console.error("Error fetching likes:", error);
    throw new Error("Gagal mengambil data likes Instagram.");
  }

  // Get all polres IDs under this direktorat
  const polresIds = await getClientsByRole(personilScopeRole);
  
  // Get all ORG clients for completeness
  const allOrgClients = (await findAllClientsByType("org")) || [];
  const allOrgClientIds = allOrgClients.map((c) => c.client_id.toUpperCase());

  // Merge polresIds with allOrgClientIds to ensure we have all clients
  const seen = new Set();
  const allClientIds = [];
  
  // Add direktorat client first
  seen.add(normalizedClientId);
  allClientIds.push(normalizedClientId);
  
  // Add polres from role
  polresIds.forEach((id) => {
    const upper = id.toUpperCase();
    if (!seen.has(upper)) {
      seen.add(upper);
      allClientIds.push(upper);
    }
  });
  
  // Add all ORG clients
  allOrgClientIds.forEach((id) => {
    if (!seen.has(id)) {
      seen.add(id);
      allClientIds.push(id);
    }
  });

  // Get all users
  const allUsers = await getUsersByDirektorat(personilScopeRole, allClientIds);
  
  // Group users by client
  const usersByClient = {};
  allUsers.forEach((u) => {
    if (u.status !== true) return;
    const cid = (u.client_id || "").toUpperCase();
    if (!usersByClient[cid]) usersByClient[cid] = [];
    usersByClient[cid].push(u);
  });

  // Build report entries for each client
  const reportEntries = [];
  
  for (const cid of allClientIds) {
    const cidClient = await findClientById(cid);
    const cidClientName = cidClient?.nama || cid;
    const cidClientType = cidClient?.client_type?.toLowerCase();
    
    const allUsersForClient = usersByClient[cid] || [];
    const users = filterAttendanceUsers(allUsersForClient, cidClientType);
    
    if (users.length === 0 && cid !== normalizedClientId) {
      // Skip empty clients except for the main direktorat client
      continue;
    }
    
    const totalPersonil = users.length;
    const sudahInputUsername = users.filter((u) => u.insta && u.insta.trim() !== "").length;
    const belumInputUsername = totalPersonil - sudahInputUsername;
    
    // Calculate execution stats
    let sudahMelaksanakan = 0;
    let melaksanakanKurangLengkap = 0;
    users.forEach((u) => {
      if (!u.insta || u.insta.trim() === "") return;
      
      const uname = normalizeInstagramUsername(u.insta);
      let count = 0;
      likesSets.forEach((set) => {
        if (set.has(uname)) count += 1;
      });
      
      // Calculate execution percentage
      const percentage = totalKonten ? (count / totalKonten) * 100 : 0;
      if (percentage >= 50) {
        sudahMelaksanakan += 1;
      } else if (percentage > 0) {
        melaksanakanKurangLengkap += 1;
      }
    });
    
    const belumMelaksanakan = sudahInputUsername - sudahMelaksanakan - melaksanakanKurangLengkap;
    const persenPelaksanaan = totalPersonil > 0 ? (sudahMelaksanakan / totalPersonil) * 100 : 0;
    
    reportEntries.push({
      clientId: cid,
      clientName: cidClientName,
      clientType: cidClientType,
      totalPersonil,
      sudahInputUsername,
      belumInputUsername,
      sudahMelaksanakan,
      melaksanakanKurangLengkap,
      belumMelaksanakan,
      persenPelaksanaan,
    });
  }

  // Sort entries according to requirements:
  // 1. Direktorat client first
  // 2. Then group by user count: >1000, 500-1000, <500
  // 3. Within each group, sort by execution percentage (highest first)
  reportEntries.sort((a, b) => {
    // Direktorat type always first
    if (a.clientType === "direktorat" && b.clientType !== "direktorat") return -1;
    if (b.clientType === "direktorat" && a.clientType !== "direktorat") return 1;
    
    // Group by user count
    const getGroup = (total) => {
      if (total > 1000) return 3;
      if (total >= 500) return 2;
      return 1;
    };
    
    const aGroup = getGroup(a.totalPersonil);
    const bGroup = getGroup(b.totalPersonil);
    
    if (aGroup !== bGroup) return bGroup - aGroup; // Higher group first
    
    // Within same group, sort by percentage (descending)
    if (Math.abs(a.persenPelaksanaan - b.persenPelaksanaan) > 0.01) {
      return b.persenPelaksanaan - a.persenPelaksanaan;
    }
    
    // Finally, sort by name
    return a.clientName.localeCompare(b.clientName, "id-ID");
  });

  return {
    clientName,
    hari,
    tanggal,
    jam,
    totalKonten,
    kontenLinks,
    reportEntries,
  };
}

/**
 * Collect TikTok jajaran attendance data
 * Groups by client/polres with detailed stats
 *
 * Catatan timezone: gunakan util dateJakarta agar tanggal/jam report konsisten WIB
 * untuk kebutuhan troubleshooting lintas environment server.
 */
export async function collectTiktokJajaranAttendance(clientId, roleFlag = null) {
  const now = new Date();
  const { hari } = getOperationalAttendanceDate(now);
  const tanggal = formatJakartaDisplayDate(now);
  const jam = formatJakartaDisplayTime(now);

  const roleName = (roleFlag || clientId || "").toLowerCase();
  const normalizedClientId = String(clientId || "").toUpperCase();

  // Get client info
  const client = await findClientById(normalizedClientId);
  const clientName = client?.nama || normalizedClientId;
  const clientType = client?.client_type?.toLowerCase();

  // Validate client is direktorat
  if (clientType !== "direktorat") {
    throw new Error(
      `❌ Absensi TikTok Jajaran hanya tersedia untuk client bertipe Direktorat. (${clientName})`
    );
  }

  // Get TikTok posts for today
  let posts;
  try {
    posts = await getPostsTodayByClient(roleName);
  } catch (error) {
    console.error("Error fetching TikTok posts:", error);
    throw new Error("Gagal mengambil data konten TikTok.");
  }

  if (!posts.length) {
    throw new Error(
      `Tidak ada konten pada akun Official TikTok ${clientName} untuk periode hari ini (WIB).`
    );
  }

  const videoIds = posts.map((p) => p.video_id);
  const kontenLinks = posts.map((p) => p.link || `https://www.tiktok.com/@username/video/${p.video_id}`);
  const totalKonten = videoIds.length;

  // Get comments data
  const commentSets = [];
  for (const vid of videoIds) {
    try {
      const { comments } = await getCommentsByVideoId(vid);
      commentSets.push(new Set(extractUsernamesFromComments(comments)));
    } catch (error) {
      console.error(`Error fetching comments for video ${vid}:`, error);
      commentSets.push(new Set());
    }
  }

  // Get all polres IDs under this direktorat
  const polresIds = await getClientsByRole(roleName);
  
  // Get all ORG clients for completeness
  const allOrgClients = (await findAllClientsByType("org")) || [];
  const allOrgClientIds = allOrgClients.map((c) => c.client_id.toUpperCase());

  // Merge polresIds with allOrgClientIds to ensure we have all clients
  const seen = new Set();
  const allClientIds = [];
  
  // Add direktorat client first
  seen.add(normalizedClientId);
  allClientIds.push(normalizedClientId);
  
  // Add polres from role
  polresIds.forEach((id) => {
    const upper = id.toUpperCase();
    if (!seen.has(upper)) {
      seen.add(upper);
      allClientIds.push(upper);
    }
  });
  
  // Add all ORG clients
  allOrgClientIds.forEach((id) => {
    if (!seen.has(id)) {
      seen.add(id);
      allClientIds.push(id);
    }
  });

  // Get all users
  const allUsers = await getUsersByDirektorat(roleName, allClientIds);
  
  // Group users by client
  const usersByClient = {};
  allUsers.forEach((u) => {
    if (u.status !== true) return;
    const cid = (u.client_id || "").toUpperCase();
    if (!usersByClient[cid]) usersByClient[cid] = [];
    usersByClient[cid].push(u);
  });

  // Build report entries for each client
  const reportEntries = [];
  
  for (const cid of allClientIds) {
    const cidClient = await findClientById(cid);
    const cidClientName = cidClient?.nama || cid;
    const cidClientType = cidClient?.client_type?.toLowerCase();
    
    const allUsersForClient = usersByClient[cid] || [];
    const users = filterAttendanceUsers(allUsersForClient, cidClientType);
    
    if (users.length === 0 && cid !== normalizedClientId) {
      // Skip empty clients except for the main direktorat client
      continue;
    }
    
    const totalPersonil = users.length;
    const sudahInputUsername = users.filter((u) => u.tiktok && u.tiktok.trim() !== "").length;
    const belumInputUsername = totalPersonil - sudahInputUsername;
    
    // Calculate execution stats
    let sudahMelaksanakan = 0;
    let melaksanakanKurangLengkap = 0;
    users.forEach((u) => {
      if (!u.tiktok || u.tiktok.trim() === "") return;
      
      const uname = normalizeTiktokUsername(u.tiktok);
      let count = 0;
      commentSets.forEach((set) => {
        if (set.has(uname)) count += 1;
      });
      
      // Calculate execution percentage
      const percentage = totalKonten ? (count / totalKonten) * 100 : 0;
      if (percentage >= 50) {
        sudahMelaksanakan += 1;
      } else if (percentage > 0) {
        melaksanakanKurangLengkap += 1;
      }
    });
    
    const belumMelaksanakan = sudahInputUsername - sudahMelaksanakan - melaksanakanKurangLengkap;
    const persenPelaksanaan = totalPersonil > 0 ? (sudahMelaksanakan / totalPersonil) * 100 : 0;
    
    reportEntries.push({
      clientId: cid,
      clientName: cidClientName,
      clientType: cidClientType,
      totalPersonil,
      sudahInputUsername,
      belumInputUsername,
      sudahMelaksanakan,
      melaksanakanKurangLengkap,
      belumMelaksanakan,
      persenPelaksanaan,
    });
  }

  // Sort entries according to requirements:
  // 1. Direktorat client first
  // 2. Then group by user count: >1000, 500-1000, <500
  // 3. Within each group, sort by execution percentage (highest first)
  reportEntries.sort((a, b) => {
    // Direktorat type always first
    if (a.clientType === "direktorat" && b.clientType !== "direktorat") return -1;
    if (b.clientType === "direktorat" && a.clientType !== "direktorat") return 1;
    
    // Group by user count
    const getGroup = (total) => {
      if (total > 1000) return 3;
      if (total >= 500) return 2;
      return 1;
    };
    
    const aGroup = getGroup(a.totalPersonil);
    const bGroup = getGroup(b.totalPersonil);
    
    if (aGroup !== bGroup) return bGroup - aGroup; // Higher group first
    
    // Within same group, sort by percentage (descending)
    if (Math.abs(a.persenPelaksanaan - b.persenPelaksanaan) > 0.01) {
      return b.persenPelaksanaan - a.persenPelaksanaan;
    }
    
    // Finally, sort by name
    return a.clientName.localeCompare(b.clientName, "id-ID");
  });

  return {
    clientName,
    hari,
    tanggal,
    jam,
    totalKonten,
    kontenLinks,
    reportEntries,
  };
}

/**
 * Format Instagram jajaran attendance report.
 * Catatan: narasi periode report dikunci ke "hari ini (WIB)".
 */
export function formatInstagramJajaranReport(data) {
  const { clientName, hari, tanggal, jam, totalKonten, kontenLinks, reportEntries } = data;
  
  // Calculate totals
  const totals = {
    totalPersonil: 0,
    sudahInputUsername: 0,
    belumInputUsername: 0,
    sudahMelaksanakan: 0,
    melaksanakanKurangLengkap: 0,
    belumMelaksanakan: 0,
  };
  
  reportEntries.forEach((entry) => {
    totals.totalPersonil += entry.totalPersonil;
    totals.sudahInputUsername += entry.sudahInputUsername;
    totals.belumInputUsername += entry.belumInputUsername;
    totals.sudahMelaksanakan += entry.sudahMelaksanakan;
    totals.melaksanakanKurangLengkap += entry.melaksanakanKurangLengkap;
    totals.belumMelaksanakan += entry.belumMelaksanakan;
  });
  
  const totalPersenPelaksanaan = totals.totalPersonil > 0 
    ? (totals.sudahMelaksanakan / totals.totalPersonil) * 100 
    : 0;
  
  // Build report
  const header = [
    "Mohon ijin Komandan,\n",
    "📋 *Rekap Absensi Likes Instagram Jajaran*",
    `*${clientName}*`,
    `${hari}, ${tanggal}`,
    `Jam: ${jam} WIB`,
    `Periode: hari ini (WIB)\n`,
    `*Jumlah Konten:* ${totalKonten}`,
    "*Daftar Link Konten:*",
    kontenLinks.join("\n"),
    "",
    `*Jumlah Total Personil:* ${totals.totalPersonil} pers`,
    `*Sudah Input Username Instagram:* ${totals.sudahInputUsername} pers`,
    `*Belum Input Username Instagram:* ${totals.belumInputUsername} pers`,
    `*Melaksanakan Lengkap:* ${totals.sudahMelaksanakan} pers`,
    `*Melaksanakan Kurang Lengkap:* ${totals.melaksanakanKurangLengkap} pers`,
    `*Belum Melaksanakan:* ${totals.belumMelaksanakan} pers`,
    `*Persentase Pelaksanaan:* ${totalPersenPelaksanaan.toFixed(2)}%\n`,
    "*Detail per Satker:*\n",
  ].join("\n");
  
  const details = reportEntries.map((entry, idx) => {
    return [
      `${idx + 1}. *${entry.clientName}*`,
      `   Jumlah Personil: ${entry.totalPersonil} pers`,
      `   Sudah Input Username: ${entry.sudahInputUsername} pers`,
      `   Belum Input Username: ${entry.belumInputUsername} pers`,
      `   Melaksanakan Lengkap: ${entry.sudahMelaksanakan} pers`,
      `   Melaksanakan Kurang Lengkap: ${entry.melaksanakanKurangLengkap} pers`,
      `   Belum Melaksanakan: ${entry.belumMelaksanakan} pers`,
      `   Persentase: ${entry.persenPelaksanaan.toFixed(2)}%`,
    ].join("\n");
  });
  
  return header + details.join("\n\n");
}

/**
 * Format TikTok jajaran attendance report.
 * Catatan: narasi periode report dikunci ke "hari ini (WIB)".
 */
export function formatTiktokJajaranReport(data) {
  const { clientName, hari, tanggal, jam, totalKonten, kontenLinks, reportEntries } = data;
  
  // Calculate totals
  const totals = {
    totalPersonil: 0,
    sudahInputUsername: 0,
    belumInputUsername: 0,
    sudahMelaksanakan: 0,
    melaksanakanKurangLengkap: 0,
    belumMelaksanakan: 0,
  };
  
  reportEntries.forEach((entry) => {
    totals.totalPersonil += entry.totalPersonil;
    totals.sudahInputUsername += entry.sudahInputUsername;
    totals.belumInputUsername += entry.belumInputUsername;
    totals.sudahMelaksanakan += entry.sudahMelaksanakan;
    totals.melaksanakanKurangLengkap += entry.melaksanakanKurangLengkap;
    totals.belumMelaksanakan += entry.belumMelaksanakan;
  });
  
  const totalPersenPelaksanaan = totals.totalPersonil > 0 
    ? (totals.sudahMelaksanakan / totals.totalPersonil) * 100 
    : 0;
  
  // Build report
  const header = [
    "Mohon ijin Komandan,\n",
    "📋 *Rekap Absensi Komentar TikTok Jajaran*",
    `*${clientName}*`,
    `${hari}, ${tanggal}`,
    `Jam: ${jam} WIB`,
    `Periode: hari ini (WIB)\n`,
    `*Jumlah Konten:* ${totalKonten}`,
    "*Daftar Link Konten:*",
    kontenLinks.join("\n"),
    "",
    `*Jumlah Total Personil:* ${totals.totalPersonil} pers`,
    `*Sudah Input Username TikTok:* ${totals.sudahInputUsername} pers`,
    `*Belum Input Username TikTok:* ${totals.belumInputUsername} pers`,
    `*Melaksanakan Lengkap:* ${totals.sudahMelaksanakan} pers`,
    `*Melaksanakan Kurang Lengkap:* ${totals.melaksanakanKurangLengkap} pers`,
    `*Belum Melaksanakan:* ${totals.belumMelaksanakan} pers`,
    `*Persentase Pelaksanaan:* ${totalPersenPelaksanaan.toFixed(2)}%\n`,
    "*Detail per Satker:*\n",
  ].join("\n");
  
  const details = reportEntries.map((entry, idx) => {
    return [
      `${idx + 1}. *${entry.clientName}*`,
      `   Jumlah Personil: ${entry.totalPersonil} pers`,
      `   Sudah Input Username: ${entry.sudahInputUsername} pers`,
      `   Belum Input Username: ${entry.belumInputUsername} pers`,
      `   Melaksanakan Lengkap: ${entry.sudahMelaksanakan} pers`,
      `   Melaksanakan Kurang Lengkap: ${entry.melaksanakanKurangLengkap} pers`,
      `   Belum Melaksanakan: ${entry.belumMelaksanakan} pers`,
      `   Persentase: ${entry.persenPelaksanaan.toFixed(2)}%`,
    ].join("\n");
  });
  
  return header + details.join("\n\n");
}
