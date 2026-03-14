import { getUsersSocialByClient, getClientsByRole, getUsersByDirektorat } from "../../model/userModel.js";
import {
  deletePostByShortcode,
  getShortcodesTodayByClient,
  getPostsTodayByClient as getInstaPostsTodayByClient,
} from "../../model/instaPostModel.js";
import {
  deletePostByVideoId,
  getVideoIdsTodayByClient,
  getPostsTodayByClient as getTiktokPostsTodayByClient,
  getPostsByClientAndDateRange as getTiktokPostsByDateRange,
} from "../../model/tiktokPostModel.js";
import { getLikeUsernamesByShortcode } from "../../model/instaLikeModel.js";
import { getRekapLikesByClient } from "../../model/instaLikeModel.js";
import { getCommentsByVideoId, getRekapKomentarByClient } from "../../model/tiktokCommentModel.js";
import {
  absensiLikes,
  lapharDitbinmas,
  absensiLikesDitbinmasReport,
  collectLikesRecap,
  absensiLikesDitbinmasSimple as absensiLikesDitbinmasSimpleReport,
} from "../fetchabsensi/insta/absensiLikesInsta.js";
import {
  lapharTiktokDitbinmas,
  collectKomentarRecap,
  absensiKomentarDitbinmasReport,
  absensiKomentar,
  absensiKomentarDitbinmasSimple as absensiKomentarDitbinmasSimpleReport,
  extractUsernamesFromComments,
} from "../fetchabsensi/tiktok/absensiKomentarTiktok.js";
import { absensiRegistrasiDashboardDirektorat } from "../fetchabsensi/dashboard/absensiRegistrasiDashboardDirektorat.js";
import { findClientById, findAllClientsByType } from "../../service/clientService.js";
import {
  getGreeting,
  filterUsersBySatikDivision,
  sortDivisionKeys,
  formatNama,
  filterAttendanceUsers,
} from "../../utils/utilsHelper.js";
import { sendWAFile, safeSendMessage, sendWithClientFallback } from "../../utils/waHelper.js";
import { writeFile, mkdir, readFile, unlink, stat } from "fs/promises";
import { join, basename } from "path";
import {
  saveLikesRecapExcel,
  saveLikesRecapPerContentExcel,
} from "../../service/likesRecapExcelService.js";
import {
  saveCommentRecapExcel,
  saveCommentRecapPerContentExcel,
} from "../../service/commentRecapExcelService.js";
import { saveWeeklyLikesRecapExcel } from "../../service/weeklyLikesRecapExcelService.js";
import { saveWeeklyCommentRecapExcel } from "../../service/weeklyCommentRecapExcelService.js";
import { generateWeeklyInstagramHighLowReport } from "../../service/weeklyInstagramHighLowService.js";
import { generateWeeklyTiktokHighLowReport } from "../../service/weeklyTiktokHighLowService.js";
import { saveMonthlyLikesRecapExcel } from "../../service/monthlyLikesRecapExcelService.js";
import { saveSatkerUpdateMatrixExcel } from "../../service/satkerUpdateMatrixService.js";
import { saveEngagementRankingExcel } from "../../service/engagementRankingExcelService.js";
import { generateKasatkerReport } from "../../service/kasatkerReportService.js";
import { generateKasatkerAttendanceSummary } from "../../service/kasatkerAttendanceService.js";
import { generateKasatBinmasLikesRecap } from "../../service/kasatBinmasLikesRecapService.js";
import { sendKasatBinmasLikesRecapExcel } from "../../service/kasatBinmasLikesRecapExcelService.js";
import { sendKasatBinmasTiktokCommentRecapExcel } from "../../service/kasatBinmasTiktokCommentRecapExcelService.js";
import {
  generateKasatBinmasTiktokCommentRecap,
  resolveBaseDate,
} from "../../service/kasatBinmasTiktokCommentRecapService.js";
import { hariIndo } from "../../utils/constants.js";
import { fetchInstagramInfo } from "../../service/instaRapidService.js";
import {
  buildSatbinmasOfficialInstagramRecap,
  buildSatbinmasOfficialTiktokRecap,
  buildSatbinmasOfficialInstagramDbRecap,
  buildSatbinmasOfficialTiktokDbRecap,
} from "../../service/satbinmasOfficialReportService.js";
import { syncSatbinmasOfficialTiktokSecUidForOrgClients } from "../../service/satbinmasOfficialTiktokService.js";
import { generateInstagramAllDataRecap } from "../../service/instagramAllDataRecapService.js";
import { generateTiktokAllDataRecap } from "../../service/tiktokAllDataRecapService.js";
import {
  collectInstagramJajaranAttendance,
  collectTiktokJajaranAttendance,
  formatInstagramJajaranReport,
  formatTiktokJajaranReport,
} from "../../service/jajaranAttendanceService.js";
import {
  getStandardInstagramTaskPostsByDate,
  getStandardInstagramTaskPostsToday,
  getStandardInstagramTaskShortcodesByRange,
} from "../../service/instagramTaskContentService.js";
import { appendSubmenuBackInstruction } from "./menuPromptHelpers.js";
import { fetchSinglePostKhusus } from "../fetchpost/instaFetchPost.js";
import { fetchAndStoreSingleTiktokPost } from "../fetchpost/tiktokFetchPost.js";
import { extractInstagramShortcode } from "../../utils/utilsHelper.js";
import { extractVideoId } from "../../utils/tiktokHelper.js";
import { getOperationalAttendanceDate } from "../../utils/attendanceOperationalDate.js";
import {
  addTaskPostExclusion,
  getTaskPostExclusionSet,
} from "../../model/taskPostExclusionModel.js";
import { query } from "../../db/index.js";

const dirRequestGroup = "120363419830216549@g.us";
const DITBINMAS_CLIENT_ID = "DITBINMAS";

const isGroupChatId = (value) => String(value || "").trim().endsWith("@g.us");

const sendMenuMessage = async (waClient, chatId, message, options = {}) => {
  const {
    fallbackClients,
    fallbackContext,
    reportClient,
    ...sendOptions
  } = options || {};
  if (Array.isArray(fallbackClients) && fallbackClients.length) {
    return sendWithClientFallback({
      chatId,
      message,
      clients: fallbackClients,
      sendOptions,
      reportClient: reportClient || waClient,
      reportContext: fallbackContext,
    });
  }
  if (isGroupChatId(chatId)) {
    return safeSendMessage(waClient, chatId, message, sendOptions);
  }
  if (!sendOptions || Object.keys(sendOptions).length === 0) {
    return waClient.sendMessage(chatId, message);
  }
  return waClient.sendMessage(chatId, message, sendOptions);
};

const isDitbinmas = (value) =>
  String(value || "")
    .trim()
    .toUpperCase() === DITBINMAS_CLIENT_ID;

const ENGAGEMENT_RECAP_PERIOD_MAP = {
  "1": {
    period: "selected_month",
    label: "pilihan bulan",
    description: "Pilihan bulan (format YYYY-MM)",
  },
  "2": {
    period: "this_week",
    label: "minggu ini",
    description: "Minggu ini (Senin - hari ini)",
  },
  "3": {
    period: "last_week",
    label: "minggu sebelumnya",
    description: "Minggu sebelumnya (Senin - Minggu)",
  },
  "4": {
    period: "today",
    label: "hari ini",
    description: "Hari ini",
  },
  "5": {
    period: "selected_date",
    label: "pilihan tanggal",
    description: "Pilihan tanggal (format YYYY-MM-DD)",
  },
};

const KASATKER_REPORT_PERIOD_MAP = {
  "1": {
    period: "today",
    label: "hari ini",
    description: "Laporan harian (periode hari ini)",
  },
  "2": {
    period: "this_week",
    label: "minggu ini",
    description: "Laporan mingguan (periode minggu ini)",
  },
  "3": {
    period: "this_month",
    label: "bulan ini",
    description: "Laporan bulanan (periode bulan ini)",
  },
  "4": {
    period: "all_time",
    label: "semua periode",
    description: "Laporan semua periode (seluruh data)",
  },
};

const EXECUTIVE_SUMMARY_PERIOD_MAP = {
  "1": {
    period: "selected_month",
    description: "Pilihan bulan (format YYYY-MM)",
  },
  "2": {
    period: "this_week",
    description: "Minggu ini (Senin - hari ini)",
  },
  "3": {
    period: "last_week",
    description: "Minggu sebelumnya (Senin - Minggu)",
  },
  "4": {
    period: "today",
    description: "Hari ini",
  },
  "5": {
    period: "selected_date",
    description: "Pilihan tanggal (format YYYY-MM-DD)",
  },
};

const DIGIT_EMOJI = {
  "0": "0️⃣",
  "1": "1️⃣",
  "2": "2️⃣",
  "3": "3️⃣",
  "4": "4️⃣",
  "5": "5️⃣",
  "6": "6️⃣",
  "7": "7️⃣",
  "8": "8️⃣",
  "9": "9️⃣",
};

const CHAKRANARAYANA_MENU_GROUPS = {
  direktorat: ["2", "3", "6", "9", "28", "20", "22", "46", "53", "54"],
  jajaran: ["1", "48", "49", "55", "56"],
};

const CHAKRANARAYANA_MENU_LABELS = {
  "1": "Rekap Kelengkapan data Personil Satker",
  "2": "Executive Summary Narative CICERO",
  "3": "Rekap data personil",
  "6": "Absensi Instagram Direktorat/Bidang Simple",
  "9": "Absensi Tiktok Direktorat/Bidang Simple",
  "28": "Rekap like Instagram (Excel)",
  "20": "Rekap komentar TikTok (Excel)",
  "22": "Rekap ranking engagement jajaran",
  "46": "Input post manual (IG/TikTok)",
  "47": "Input TikTok post manual",
  "48": "Absensi Instagram Jajaran",
  "49": "Absensi TikTok Jajaran",
  "55": "Rekap Instagram Jajaran Perpost",
  "56": "Rekap TikTok Jajaran Perpost",
  "53": "Hapus post tugas (auto IG/TikTok)",
  "54": "Ambil pesan list tugas IG & TikTok",
};

const PERPOST_DATE_MENU_TEXT = appendSubmenuBackInstruction(
  "Silakan pilih sumber tanggal rekap perpost:\n" +
    "1️⃣ Hari ini (WIB)\n" +
    "2️⃣ Pilih tanggal (format YYYY-MM-DD)\n\n" +
    "Balas angka pilihan atau ketik *batal* untuk kembali."
);

const JAKARTA_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const getJakartaYmd = (value = new Date()) => JAKARTA_DATE_FORMATTER.format(value);

const isValidYmd = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());

const isValidYm = (value) => /^\d{4}-\d{2}$/.test(String(value || "").trim());

const getJakartaDayDateLabel = () => {
  const now = new Date();
  const hari = hariIndo[now.getDay()] || now.toLocaleDateString("id-ID", { weekday: "long" });
  const tanggal = now.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return `${hari}, ${tanggal}`;
};

const getChakranarayanaMenuText = (groupKey, groupLabel, menuCodesOverride = null) => {
  const menuCodes = Array.isArray(menuCodesOverride)
    ? menuCodesOverride
    : CHAKRANARAYANA_MENU_GROUPS[groupKey] || [];
  const orderedMenuCodes = [...menuCodes];

  const list = orderedMenuCodes
    .map((menuCode, idx) => {
      const localNumber = String(idx + 1);
      const localLabel = DIGIT_EMOJI[localNumber] || `${localNumber}.`;
      const menuLabel = CHAKRANARAYANA_MENU_LABELS[menuCode] || `Menu ${menuCode}`;
      return `${localLabel} ${menuLabel}`;
    })
    .join("\n");

  return (
    `*Menu Chakranarayana - ${groupLabel}*\n` +
    "Nomor menu sudah diurutkan ulang khusus menu ini:\n" +
    `${list}\n\n` +
    "Balas angka urut untuk menjalankan menu, atau ketik batal untuk kembali."
  );
};

const getChakranarayanaActiveMenuText = (session) => {
  const selectedGroup = session.chakranarayanaSelectedGroup;
  if (!selectedGroup) {
    return null;
  }

  const groupLabel =
    selectedGroup === "direktorat"
      ? "Direktorat"
      : selectedGroup === "jajaran"
        ? "Jajaran"
        : selectedGroup;

  return getChakranarayanaMenuText(selectedGroup, groupLabel, session.chakranarayanaMenuMap);
};

const resolveChakranarayanaMenuCodes = async (session, selectedGroup) => {
  const baseMenuCodes = CHAKRANARAYANA_MENU_GROUPS[selectedGroup] || [];
  if (selectedGroup !== "direktorat") {
    return baseMenuCodes;
  }

  const selectedClientId = String(
    session?.selectedClientId || session?.dir_client_id || session?.clientNameId || ""
  )
    .trim()
    .toUpperCase();

  if (!selectedClientId) {
    return baseMenuCodes.filter((menuCode) => menuCode !== "22");
  }

  const selectedClient = await findClientById(selectedClientId);
  if (!isSatikEnabledClient(selectedClient)) {
    return baseMenuCodes.filter((menuCode) => menuCode !== "22");
  }

  return baseMenuCodes;
};

const ENGAGEMENT_RECAP_MENU_TEXT =
  "Silakan pilih periode rekap ranking engagement jajaran:\n" +
  Object.entries(ENGAGEMENT_RECAP_PERIOD_MAP)
    .map(([key, option]) => `${DIGIT_EMOJI[key] || key} ${option.description}`)
    .join("\n") +
  "\n\nBalas angka pilihan atau ketik batal untuk kembali.\n" +
  "Ketik back untuk kembali ke menu sebelumnya.";

const ENGAGEMENT_RECAP_MONTH_PROMPT =
  "Masukkan bulan rekap ranking engagement dengan format YYYY-MM\n" +
  "Contoh: 2026-01\n\n" +
  "Ketik batal untuk kembali ke pilihan periode.\n" +
  "Ketik back untuk kembali ke menu sebelumnya.";

const ENGAGEMENT_RECAP_DATE_PROMPT =
  "Masukkan tanggal rekap ranking engagement dengan format YYYY-MM-DD\n" +
  "Contoh: 2026-01-31\n\n" +
  "Ketik batal untuk kembali ke pilihan periode.\n" +
  "Ketik back untuk kembali ke menu sebelumnya.";

const CHAKRANARAYANA_DIRECTORATE_RECAP_PERIOD_MENU_TEXT =
  "Silakan pilih periode rekap ..............\n" +
  "1️⃣ Pilihan bulan (format YYYY-MM)\n" +
  "2️⃣ Minggu ini (Senin - hari ini)\n" +
  "3️⃣ Minggu sebelumnya (Senin - Minggu)\n" +
  "4️⃣ Hari ini\n" +
  "5️⃣ Pilihan tanggal (format YYYY-MM-DD)\n\n" +
  "Balas angka pilihan atau ketik batal untuk kembali.\n" +
  "Ketik back untuk kembali ke menu sebelumnya.";

const CHAKRANARAYANA_DIRECTORATE_RECAP_MONTH_PROMPT =
  "Masukkan bulan rekap dengan format YYYY-MM\n" +
  "Contoh: 2026-01\n\n" +
  "Ketik batal untuk kembali ke pilihan periode.\n" +
  "Ketik back untuk kembali ke menu sebelumnya.";

const CHAKRANARAYANA_DIRECTORATE_RECAP_DATE_PROMPT =
  "Masukkan tanggal rekap dengan format YYYY-MM-DD\n" +
  "Contoh: 2026-01-31\n\n" +
  "Ketik batal untuk kembali ke pilihan periode.\n" +
  "Ketik back untuk kembali ke menu sebelumnya.";

const CHAKRANARAYANA_DIRECTORATE_INSTAGRAM_SIMPLE_MENU_TEXT =
  "Silakan pilih jenis laporan Absensi Instagram Direktorat/Bidang Simple:\n" +
  "1️⃣ Absensi All\n" +
  "2️⃣ Absensi Lengkap\n" +
  "3️⃣ list kurang dan belum\n\n" +
  "Balas angka pilihan atau ketik batal untuk kembali.\n" +
  "Ketik back untuk kembali ke menu sebelumnya.";

const CHAKRANARAYANA_DIRECTORATE_INSTAGRAM_SIMPLE_ACTION_MAP = {
  "1": "all",
  "2": "lengkap",
  "3": "kurang_belum",
};

const KASATKER_REPORT_MENU_TEXT = appendSubmenuBackInstruction(
  "Silakan pilih periode Laporan Kasatker:\n" +
    Object.entries(KASATKER_REPORT_PERIOD_MAP)
      .map(([key, option]) => `${DIGIT_EMOJI[key] || key} ${option.description}`)
      .join("\n") +
    "\n\nBalas angka pilihan atau ketik *batal* untuk kembali."
);

const EXECUTIVE_SUMMARY_MENU_TEXT =
  "Silakan pilih periode Executive Summary:\n" +
  Object.entries(EXECUTIVE_SUMMARY_PERIOD_MAP)
    .map(([key, option]) => `${DIGIT_EMOJI[key] || key} ${option.description}`)
    .join("\n") +
  "\n\nBalas angka pilihan atau ketik batal untuk kembali.\n" +
  "Ketik back untuk kembali ke menu sebelumnya.";

const EXECUTIVE_SUMMARY_MONTH_PROMPT = appendSubmenuBackInstruction(
  "Masukkan bulan laporan Executive Summary dengan format *YYYY-MM*\n" +
    "Contoh: *2026-01*\n\n" +
    "Ketik *batal* untuk kembali ke pilihan periode."
);

const EXECUTIVE_SUMMARY_DATE_PROMPT = appendSubmenuBackInstruction(
  "Masukkan tanggal laporan Executive Summary dengan format *YYYY-MM-DD*\n" +
    "Contoh: *2026-01-31*\n\n" +
    "Ketik *batal* untuk kembali ke pilihan periode."
);

const KASAT_BINMAS_LIKES_PERIOD_MAP = {
  "1": {
    period: "daily",
    description: "Rekap absensi likes harian (hari ini)",
  },
  "2": {
    period: "weekly",
    description: "Rekap absensi likes mingguan (Senin - Minggu)",
  },
  "3": {
    period: "monthly",
    description: "Rekap absensi likes bulanan",
  },
};

const KASAT_BINMAS_LIKES_MENU_TEXT = appendSubmenuBackInstruction(
  "Silakan pilih rekap Absensi Likes Kasat Binmas:\n" +
    Object.entries(KASAT_BINMAS_LIKES_PERIOD_MAP)
      .map(([key, option]) => `${DIGIT_EMOJI[key] || key} ${option.description}`)
      .join("\n") +
    "\n\nBalas angka pilihan atau ketik *batal* untuk kembali."
);

const KASAT_BINMAS_LIKES_EXCEL_MENU_TEXT = appendSubmenuBackInstruction(
  "Silakan pilih rekap Likes Instagram Kasat Binmas (Excel):\n" +
    Object.entries(KASAT_BINMAS_LIKES_PERIOD_MAP)
      .map(([key, option]) => `${DIGIT_EMOJI[key] || key} ${option.description}`)
      .join("\n") +
    "\n\nBalas angka pilihan atau ketik *batal* untuk kembali."
);

const KASAT_BINMAS_TIKTOK_COMMENT_PERIOD_MAP = {
  "1": {
    period: "daily",
    description: "Rekap absensi komentar harian (hari ini)",
  },
  "2": {
    period: "weekly",
    description: "Rekap absensi komentar mingguan (Senin - Minggu)",
  },
  "3": {
    period: "monthly",
    description: "Rekap absensi komentar bulanan",
  },
};

const KASAT_BINMAS_TIKTOK_COMMENT_MENU_TEXT = appendSubmenuBackInstruction(
  "Silakan pilih rekap Absensi Komentar TikTok Kasat Binmas:\n" +
    Object.entries(KASAT_BINMAS_TIKTOK_COMMENT_PERIOD_MAP)
      .map(([key, option]) => `${DIGIT_EMOJI[key] || key} ${option.description}`)
      .join("\n") +
    "\n\nBalas angka pilihan atau ketik *batal* untuk kembali."
);

const KASAT_BINMAS_TIKTOK_COMMENT_EXCEL_MENU_TEXT = appendSubmenuBackInstruction(
  "Silakan pilih rekap Komentar TikTok Kasat Binmas (Excel):\n" +
    Object.entries(KASAT_BINMAS_TIKTOK_COMMENT_PERIOD_MAP)
      .map(([key, option]) => `${DIGIT_EMOJI[key] || key} ${option.description}`)
      .join("\n") +
    "\n\nBalas angka pilihan atau ketik *batal* untuk kembali."
);

const DIRREQUEST_INPUT_IG_MANUAL_PROMPT = appendSubmenuBackInstruction(
  "Kirim link Instagram post yang ingin diinput manual.\n\n" +
    "Contoh: https://www.instagram.com/p/XXXXXXXXXXX/\n" +
    "Ketik *batal* untuk kembali ke menu utama."
);

const DIRREQUEST_INPUT_TIKTOK_MANUAL_PROMPT = appendSubmenuBackInstruction(
  "Kirim link, shortlink, atau video ID TikTok yang ingin diinput manual.\n\n" +
    "Contoh link: https://www.tiktok.com/@username/video/1234567890123456789\n" +
    "Contoh shortlink: https://vt.tiktok.com/ZSxxxxxxx/\n" +
    "Ketik *batal* untuk kembali ke menu utama."
);

const DIRREQUEST_INPUT_POST_MANUAL_PROMPT = appendSubmenuBackInstruction(
  "Kirim link post Instagram/TikTok untuk input manual.\n\n" +
    "Boleh kirim *multi link* sekaligus dalam satu pesan (campur narasi juga boleh).\n" +
    "Sistem akan otomatis mendeteksi platform dari link yang dikirim.\n" +
    "Link/narasi yang tidak relevan akan diabaikan.\n" +
    "- Instagram: https://www.instagram.com/p/XXXXXXXXXXX/\n" +
    "- TikTok: https://www.tiktok.com/@username/video/1234567890123456789\n" +
    "- TikTok shortlink: https://vt.tiktok.com/ZSxxxxxxx/\n" +
    "Ketik *batal* untuk kembali ke menu utama."
);

const cleanDetectedUrl = (url) => String(url || "").replace(/[),.;!?]+$/g, "");

const extractManualPostTargets = (text) => {
  const rawText = String(text || "");
  const urlMatches = rawText.match(/https?:\/\/[^\s<>"']+/gi) || [];

  const instagramLinks = [];
  const tiktokInputs = [];
  const seenInstagram = new Set();
  const seenTiktok = new Set();
  let ignoredUrlCount = 0;

  for (const candidate of urlMatches) {
    const url = cleanDetectedUrl(candidate);
    const dedupeKey = url.toLowerCase();
    if (/instagram\.com\/(p|reel|tv)\//i.test(url)) {
      if (!seenInstagram.has(dedupeKey)) {
        seenInstagram.add(dedupeKey);
        instagramLinks.push(url);
      }
      continue;
    }

    if (/(?:tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com)\//i.test(url)) {
      if (!seenTiktok.has(dedupeKey)) {
        seenTiktok.add(dedupeKey);
        tiktokInputs.push(url);
      }
      continue;
    }

    ignoredUrlCount += 1;
  }

  return {
    instagramLinks,
    tiktokInputs,
    ignoredUrlCount,
  };
};

const DIRREQUEST_DELETE_TASK_POST_PROMPT = appendSubmenuBackInstruction(
  "Kirim link post tugas yang ingin dihapus dari daftar tugas harian.\n\n" +
    "Sistem akan otomatis mendeteksi apakah link Instagram atau TikTok.\n" +
    "Contoh IG: https://www.instagram.com/p/XXXXXXXXXXX/\n" +
    "Contoh TikTok: https://www.tiktok.com/@username/video/1234567890123456789\n\n" +
    "Catatan: penghapusan ini hanya menghapus *post tugas* dari daftar tugas, tanpa menghapus data likes Instagram dan komentar TikTok yang sudah tersimpan."
);

const DIRREQUEST_FETCH_IG_MANUAL_LIKES_TEXT =
  "⏳ Memulai fetch likes Instagram untuk konten manual hari ini...";

const DIRREQUEST_FETCH_IG_MANUAL_COMMENTS_TEXT =
  "⏳ Memulai fetch komentar Instagram untuk konten manual hari ini...";

const DIRREQUEST_FETCH_TIKTOK_MANUAL_COMMENTS_TEXT =
  "⏳ Memulai fetch komentar TikTok untuk konten manual hari ini...";

const formatManualPostDate = (value) => {
  if (!value) return "-";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
};

const sanitizeManualCaption = (caption) => {
  const text = String(caption || "").replace(/\s+/g, " ").trim();
  if (!text) return "-";
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
};

const SATBINMAS_OFFICIAL_RECAP_PERIOD_MAP = {
  "1": {
    period: "daily",
    description: "Rekap harian (hari ini)",
  },
  "2": {
    period: "weekly",
    description: "Rekap mingguan (Senin - Minggu)",
  },
  "3": {
    period: "monthly",
    description: "Rekap bulanan (1 s/d akhir bulan)",
  },
};

const SATBINMAS_OFFICIAL_INSTAGRAM_RECAP_MENU_TEXT = appendSubmenuBackInstruction(
  "Silakan pilih rekap Instagram Satbinmas Official:\n" +
    Object.entries(SATBINMAS_OFFICIAL_RECAP_PERIOD_MAP)
      .map(([key, option]) => `${DIGIT_EMOJI[key] || key} ${option.description}`)
      .join("\n") +
    "\n\nBalas angka pilihan atau ketik *batal* untuk kembali."
);

const SATBINMAS_OFFICIAL_TIKTOK_RECAP_MENU_TEXT = appendSubmenuBackInstruction(
  "Silakan pilih rekap TikTok Satbinmas Official:\n" +
    Object.entries(SATBINMAS_OFFICIAL_RECAP_PERIOD_MAP)
      .map(([key, option]) => `${DIGIT_EMOJI[key] || key} ${option.description}`)
      .join("\n") +
    "\n\nBalas angka pilihan atau ketik *batal* untuk kembali."
);

const REKAP_PERSONIL_CATEGORY_MAP = {
  "1": {
    category: "all",
    description: "Semua (All personnel data)",
  },
  "2": {
    category: "complete",
    description: "Lengkap (Both Instagram and TikTok filled)",
  },
  "3": {
    category: "incomplete",
    description: "Kurang (Missing either Instagram or TikTok)",
  },
  "4": {
    category: "not_yet",
    description: "Belum (Missing both Instagram and TikTok)",
  },
};

const REKAP_PERSONIL_MENU_TEXT = appendSubmenuBackInstruction(
  "Silakan pilih kategori rekap data personil:\n" +
    Object.entries(REKAP_PERSONIL_CATEGORY_MAP)
      .map(([key, option]) => `${DIGIT_EMOJI[key] || key} ${option.description}`)
      .join("\n") +
    "\n\nBalas angka pilihan atau ketik *batal* untuk kembali."
);

const SATBINMAS_OFFICIAL_METADATA_PROMPT = (clientId) =>
  "🔎 *Monitoring Satbinmas Official*\n" +
  "Masukkan username Instagram Satbinmas Official yang ingin dicek. " +
  "Secara default akan memakai Client ID aktif (" +
  `${clientId || DITBINMAS_CLIENT_ID}).\n` +
  "Format balasan: `username` atau `CLIENT_ID username`.\n" +
  "Contoh: `satbinmas_official` atau `MKS01 satbinmas_official`.\n\n" +
  "Balas *batal* untuk kembali ke menu.";

const SATBINMAS_OFFICIAL_TIKTOK_SECUID_PROMPT = () =>
  "🎯 *Sinkronisasi secUid TikTok Satbinmas Official*\n" +
  "Bot akan mengambil seluruh username TikTok Satbinmas Official dari tabel `satbinmas_official_accounts` " +
  "untuk semua client bertipe ORG, lalu menyinkronkan secUid lewat RapidAPI TikTok secara berurutan.\n" +
  "Tidak perlu mengirim username atau Client ID tambahan. Balas *batal* untuk kembali ke menu.";

const SATBINMAS_OFFICIAL_MEDIA_PROMPT =
  "📸 *Ambil Konten Harian Satbinmas Official*\n" +
  "Bot otomatis mengambil seluruh akun Instagram Satbinmas Official aktif " +
  "untuk seluruh client bertipe ORG secara berurutan dengan jeda agar tetap mematuhi TOS RapidAPI.\n" +
  "Tidak perlu mengirim username atau Client ID tambahan. Balas *batal* untuk kembali.";

const SATBINMAS_OFFICIAL_TIKTOK_MEDIA_PROMPT =
  "🎵 *Ambil Konten Harian TikTok Satbinmas Official*\n" +
  "Bot otomatis mengambil seluruh akun TikTok Satbinmas Official aktif " +
  "untuk semua client bertipe ORG secara berurutan dengan jeda aman agar tidak melanggar rate limit RapidAPI.\n" +
  "Tidak perlu mengirim username atau Client ID tambahan. Balas *batal* untuk kembali.";

const pangkatOrder = [
  "KOMISARIS BESAR POLISI",
  "AKBP",
  "KOMPOL",
  "AKP",
  "IPTU",
  "IPDA",
  "AIPTU",
  "AIPDA",
  "BRIPKA",
  "BRIGADIR",
  "BRIPTU",
  "BRIPDA",
];
const rankIdx = (t) => {
  const i = pangkatOrder.indexOf((t || "").toUpperCase());
  return i === -1 ? pangkatOrder.length : i;
};

const formatYmdToIndoLong = (ymd) => {
  if (!isValidYmd(ymd)) return ymd;
  const [year, month, day] = String(ymd).split("-").map((v) => Number(v));
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  return date.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const normalizeSocialUsername = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/\s+/g, "");

const uniq = (items) => [...new Set(items.filter(Boolean))];

const isSatikEnabledClient = (client) => client?.switch_satik === true;

const isSatIntelkamDivision = (division) => {
  const normalized = String(division || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
  return (
    normalized.includes("sat intelkam") ||
    normalized.includes("satintelkam") ||
    normalized === "sat intel" ||
    normalized === "satintel"
  );
};

const filterExecutiveSummaryOrgSatikUsers = async (users = [], options = {}) => {
  const {
    clientId = null,
    roleFlag = null,
    menuName = null,
    chakranarayanaSelectedGroup = null,
  } = options || {};
  const normalizedTargetClientId = String(clientId || "").trim().toUpperCase();
  const normalizedRole = String(roleFlag || normalizedTargetClientId)
    .trim()
    .toLowerCase();

  const allUsers = await getUsersByDirektorat(normalizedRole);
  const usersByClient = {};
  (allUsers || []).forEach((user) => {
    if (!user || user.status !== true) return;
    const cid = String(user.client_id || "").toUpperCase();
    if (!cid) return;
    if (!usersByClient[cid]) usersByClient[cid] = [];
    usersByClient[cid].push(user);
  });
  const clientCache = new Map();
  const resolveClient = async (clientId) => {
    const normalizedId = String(clientId || "").trim().toUpperCase();
    if (!normalizedId) return null;
    if (!clientCache.has(normalizedId)) {
      clientCache.set(normalizedId, await findClientById(normalizedId));
    }
    return clientCache.get(normalizedId);
  };

  const usersByScope = [];
  for (const [cidRaw, rawUsers] of Object.entries(usersByClient || {})) {
    const cidUpper = String(cidRaw || "").toUpperCase();
    if (!cidUpper) continue;

    const info = await resolveClient(cidUpper);
    const clientType = String(info?.client_type || "").toLowerCase();

    if (clientType === "direktorat" && cidUpper !== normalizedTargetClientId) {
      continue;
    }

    if (clientType === "org") {
      usersByScope.push(
        ...filterUsersBySatikDivision(rawUsers, true, "include_only")
      );
      continue;
    }

    usersByScope.push(...rawUsers);
  }

  const beforeFilterCount = users.length;
  const selectedUsers = usersByScope;
  const selectedScope = "chakranarayana_menu5_user_flow";

  console.info("[ExecutiveSummary] User filtering scope", {
    stage: "applyChakranarayanaDirektoratSatikFilter",
    menuName,
    chakranarayanaSelectedGroup,
    clientId,
    roleFlag,
    beforeFilterCount,
    afterScopeCount: selectedUsers.length,
    selectedScope,
  });

  return {
    users: selectedUsers,
    selectedScope,
    counts: {
      beforeFilter: beforeFilterCount,
      afterStrictFilter: selectedUsers.length,
      afterFallback: selectedUsers.length,
    },
  };
};

const formatCaptionPreview = (caption) => {
  const normalized = sanitizeManualCaption(caption);
  if (!normalized || normalized === "-") {
    return "(tanpa caption)";
  }
  return normalized;
};

const enrichInstagramPerpostOption = async (post, index) => {
  const shortcode = post?.shortcode;
  const likesByFetcher = shortcode
    ? (await getLikeUsernamesByShortcode(shortcode)).length
    : 0;
  const likeCount = Number(post?.like_count || 0);
  const commentCount = Number(post?.comment_count || 0);

  return {
    index,
    shortcode,
    videoId: null,
    link: post?.link || `https://www.instagram.com/p/${shortcode}`,
    likeCount,
    commentCount,
    likesByFetcher,
    commentsByFetcher: null,
    captionPreview: formatCaptionPreview(post?.caption),
  };
};

const enrichTiktokPerpostOption = async (post, index) => {
  const videoId = post?.video_id;
  const { comments } = videoId ? await getCommentsByVideoId(videoId) : { comments: [] };
  const commentsByFetcher = Array.isArray(comments) ? comments.length : 0;
  const likeCount = Number(post?.like_count || 0);
  const commentCount = Number(post?.comment_count || 0);

  return {
    index,
    shortcode: null,
    videoId,
    link: post?.link || `https://www.tiktok.com/@username/video/${videoId}`,
    likeCount,
    commentCount,
    likesByFetcher: null,
    commentsByFetcher,
    captionPreview: formatCaptionPreview(post?.caption),
  };
};

const buildPolresMapForDirektorat = async (clientId, roleFlag = null, options = {}) => {
  const normalizedClientId = String(clientId || "").toUpperCase();
  const expectedRole = normalizedClientId.toLowerCase();
  const providedRole = String(roleFlag || "").trim().toLowerCase();
  const roleName = providedRole && providedRole === expectedRole ? providedRole : expectedRole;
  const polresIds = await getClientsByRole(roleName);
  const selectedDirektorat = await findClientById(normalizedClientId);
  const applyChakranarayanaJajaranSatikFilter =
    options?.menuName === "chakranarayana" &&
    options?.chakranarayanaSelectedGroup === "jajaran" &&
    isSatikEnabledClient(selectedDirektorat);

  const mergedIds = uniq([normalizedClientId, ...polresIds.map((id) => String(id || "").toUpperCase())]);
  const users = await getUsersByDirektorat(roleName, mergedIds);
  const usernameToClient = new Map();
  const expectedByClient = new Map();
  const userStatsByClient = new Map();
  const usersByClient = new Map();

  users.forEach((user) => {
    if (user?.status !== true) return;
    const cid = String(user?.client_id || "").toUpperCase();
    if (!usersByClient.has(cid)) usersByClient.set(cid, []);
    usersByClient.get(cid).push(user);
  });

  for (const cid of mergedIds) {
    const client = await findClientById(cid);
    const clientType = client?.client_type?.toLowerCase();
    const filteredUsers = filterAttendanceUsers(usersByClient.get(cid) || [], clientType, isSatikEnabledClient(client)).filter((user) => {
      if (!applyChakranarayanaJajaranSatikFilter) {
        return true;
      }
      if (String(cid || "").toUpperCase() === normalizedClientId) {
        return true;
      }
      return isSatIntelkamDivision(user?.divisi);
    });
    let instagramFilled = 0;
    let tiktokFilled = 0;

    expectedByClient.set(cid, {
      instagram: 0,
      tiktok: 0,
    });

    filteredUsers.forEach((u) => {
      const ig = normalizeSocialUsername(u?.insta);
      const tt = normalizeSocialUsername(u?.tiktok);
      if (ig) {
        usernameToClient.set(`ig:${ig}`, cid);
        expectedByClient.get(cid).instagram += 1;
        instagramFilled += 1;
      }
      if (tt) {
        usernameToClient.set(`tt:${tt}`, cid);
        expectedByClient.get(cid).tiktok += 1;
        tiktokFilled += 1;
      }
    });

    userStatsByClient.set(cid, {
      totalUsers: filteredUsers.length,
      instagramFilled,
      instagramMissing: Math.max(filteredUsers.length - instagramFilled, 0),
      tiktokFilled,
      tiktokMissing: Math.max(filteredUsers.length - tiktokFilled, 0),
    });
  }

  return { mergedIds, usernameToClient, expectedByClient, userStatsByClient };
};

async function formatRekapUserData(clientId, roleFlag = null, options = {}) {
  const directorateRoles = ["ditbinmas", "ditlantas", "bidhumas"];
  const client = await findClientById(clientId);
  const normalizedRoleFlag = roleFlag?.toLowerCase();
  const clientType = client?.client_type?.toLowerCase();
  const normalizedClientId = clientId?.toLowerCase();
  const isDirectorateClient =
    clientType === "direktorat" || directorateRoles.includes(normalizedClientId);

  const filterRole = isDirectorateClient
    ? normalizedClientId
    : directorateRoles.includes(normalizedRoleFlag)
    ? normalizedRoleFlag
    : null;
  const users = await getUsersSocialByClient(clientId, filterRole);
  const isChakranarayanaJajaranView =
    options?.menuName === "chakranarayana" &&
    options?.chakranarayanaSelectedGroup === "jajaran";
  const salam = getGreeting();
  const now = new Date();
  const hari = now.toLocaleDateString("id-ID", { weekday: "long" });
  const tanggal = now.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const jam = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const isDirektoratView =
    clientType === "direktorat" ||
    directorateRoles.includes(normalizedClientId) ||
    directorateRoles.includes(roleFlag?.toLowerCase());
  if (isDirektoratView) {
    const groups = {};

    const roleName = (filterRole || clientId).toLowerCase();
    const polresIds = (await getClientsByRole(roleName)) || [];
    const clientIdLower = clientId.toLowerCase();

    // Fetch all ORG clients (active + inactive)
    const allOrgClients = (await findAllClientsByType("org")) || [];
    const allOrgClientIds = allOrgClients.map((c) => c.client_id.toLowerCase());
    const applyChakranarayanaJajaranSatikFilter =
      isChakranarayanaJajaranView && isSatikEnabledClient(client);

    const scopedUsers = users.filter((user) => {
      if (!applyChakranarayanaJajaranSatikFilter) {
        return true;
      }

      const rowClientId = String(user?.client_id || "").toLowerCase();
      if (rowClientId === clientIdLower) {
        return true;
      }

      return isSatIntelkamDivision(user?.divisi);
    });

    scopedUsers.forEach((u) => {
      const cid = (u.client_id || "").toLowerCase();
      if (!groups[cid]) groups[cid] = { total: 0, insta: 0, tiktok: 0, complete: 0 };
      groups[cid].total++;
      if (u.insta) groups[cid].insta++;
      if (u.tiktok) groups[cid].tiktok++;
      if (u.insta && u.tiktok) groups[cid].complete++;
    });

    const seen = new Set();
    const allIds = [];
    const addId = (id) => {
      const lower = (id || '').toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        allIds.push(lower);
      }
    };

    addId(clientIdLower);
    polresIds.forEach((id) => addId(id));
    allOrgClientIds.forEach((id) => addId(id));
    Object.keys(groups).forEach((id) => addId(id));

    const entries = await Promise.all(
      allIds.map(async (cid) => {
        const stat =
          groups[cid] || { total: 0, insta: 0, tiktok: 0, complete: 0 };
        const c = await findClientById(cid);
        const name = (c?.nama || cid).toUpperCase();
        const type = c?.client_type?.toLowerCase() || null;
        return { cid, name, stat, type };
      })
    );

    const filteredEntries = entries.filter((entry) => {
      if (entry.type === "direktorat") {
        return entry.cid === clientIdLower;
      }
      if (entry.type === "org") {
        return true; // Include all ORG type clients (not limited to those from getClientsByRole)
      }
      return false;
    });

    const withData = filteredEntries.filter(
      (e) => e.cid === clientIdLower || e.stat.total > 0
    );
    const noData = filteredEntries.filter(
      (e) => e.stat.total === 0 && e.cid !== clientIdLower
    );

    const compareEntries = (a, b) => {
      if (a.cid === clientIdLower) return -1;
      if (b.cid === clientIdLower) return 1;

      const aOrg = a.type === "org";
      const bOrg = b.type === "org";
      if (aOrg !== bOrg) return aOrg ? -1 : 1;

      if (a.stat.complete !== b.stat.complete)
        return b.stat.complete - a.stat.complete;
      if (a.stat.total !== b.stat.total) return b.stat.total - a.stat.total;
      return a.name.localeCompare(b.name);
    };

    const compareNoData = (a, b) => {
      if (a.cid === clientIdLower) return -1;
      if (b.cid === clientIdLower) return 1;

      const aOrg = a.type === "org";
      const bOrg = b.type === "org";
      if (aOrg !== bOrg) return aOrg ? -1 : 1;
      return a.name.localeCompare(b.name);
    };

    withData.sort(compareEntries);
    noData.sort(compareNoData);

    const withDataLines = withData.map(
      (e, idx) =>
        `${idx + 1}. ${e.name}\n\n` +
        `Jumlah Total Personil : ${e.stat.total}\n` +
        `Jumlah Total Personil Sudah Mengisi Instagram : ${e.stat.insta}\n` +
        `Jumlah Total Personil Sudah Mengisi Tiktok : ${e.stat.tiktok}\n` +
        `Jumlah Total Personil Belum Mengisi Instagram : ${e.stat.total - e.stat.insta}\n` +
        `Jumlah Total Personil Belum Mengisi Tiktok : ${e.stat.total - e.stat.tiktok}`
    );
    const noDataLines = noData.map((e, idx) => `${idx + 1}. ${e.name}`);

    const totals = filteredEntries.reduce(
      (acc, e) => {
        acc.total += e.stat.total;
        acc.insta += e.stat.insta;
        acc.tiktok += e.stat.tiktok;
        acc.complete += e.stat.complete;
        return acc;
      },
      { total: 0, insta: 0, tiktok: 0, complete: 0 }
    );

    const header =
      `${salam},\n\n` +
      `Mohon ijin Komandan, melaporkan absensi update data personil ${
        (client?.nama || clientId).toUpperCase()
      } pada hari ${hari}, ${tanggal}, pukul ${jam} WIB, sebagai berikut:`;

    const sections = [
      `Jumlah Total Personil : ${totals.total}\n` +
        `Jumlah Total Personil Sudah Mengisi Instagram : ${totals.insta}\n` +
        `Jumlah Total Personil Sudah Mengisi Tiktok : ${totals.tiktok}\n` +
        `Jumlah Total Personil Belum Mengisi Instagram : ${totals.total - totals.insta}\n` +
        `Jumlah Total Personil Belum Mengisi Tiktok : ${totals.total - totals.tiktok}`,
    ];
    if (withDataLines.length)
      sections.push(`Sudah Input Data:\n\n${withDataLines.join("\n\n")}`);
    if (noDataLines.length)
      sections.push(`Client Belum Input Data:\n${noDataLines.join("\n")}`);
    const body = `\n\n${sections.join("\n\n")}`;

    return `${header}${body}`.trim();
  }

  const complete = {};
  const incomplete = {};
  users.forEach((u) => {
    const div = u.divisi || "-";
    if (u.insta && u.tiktok) {
      if (!complete[div]) complete[div] = [];
      complete[div].push(u);
    } else {
      const missing = [];
      if (!u.insta) missing.push("Instagram kosong");
      if (!u.tiktok) missing.push("TikTok kosong");
      if (!incomplete[div]) incomplete[div] = [];
      incomplete[div].push({ ...u, missing: missing.join(", ") });
    }
  });

  if (clientType === "org") {
    const completeLines = sortDivisionKeys(Object.keys(complete)).map((d) => {
      const list = complete[d]
        .sort((a, b) => rankIdx(a.title) - rankIdx(b.title) || formatNama(a).localeCompare(formatNama(b)))
        .map((u) => formatNama(u))
        .join("\n\n");
      return `${d.toUpperCase()} (${complete[d].length})\n\n${list}`;
    });
    const incompleteLines = sortDivisionKeys(Object.keys(incomplete)).map((d) => {
      const list = incomplete[d]
        .sort((a, b) => rankIdx(a.title) - rankIdx(b.title) || formatNama(a).localeCompare(formatNama(b)))
        .map((u) => `${formatNama(u)}, ${u.missing}`)
        .join("\n\n");
      return `${d.toUpperCase()} (${incomplete[d].length})\n\n${list}`;
    });
    const sections = [];
    if (completeLines.length) sections.push(`Sudah Lengkap :\n\n${completeLines.join("\n\n")}`);
    if (incompleteLines.length) sections.push(`Belum Lengkap:\n\n${incompleteLines.join("\n\n")}`);
    const body = sections.join("\n\n");
    return (
      `${salam},\n\n` +
      `Mohon ijin Komandan, melaporkan absensi update data personil ${
        (client?.nama || clientId).toUpperCase()
      } pada hari ${hari}, ${tanggal}, pukul ${jam} WIB, sebagai berikut:\n\n` +
      body
    ).trim();
  }

  const completeLines = sortDivisionKeys(Object.keys(complete)).map((d) => {
    const list = complete[d]
      .sort((a, b) => rankIdx(a.title) - rankIdx(b.title) || formatNama(a).localeCompare(formatNama(b)))
      .map((u) => formatNama(u))
      .join("\n\n");
    return `${d}, Sudah lengkap: (${complete[d].length})\n\n${list}`;
  });
  const incompleteLines = sortDivisionKeys(Object.keys(incomplete)).map((d) => {
    const list = incomplete[d]
      .sort((a, b) => rankIdx(a.title) - rankIdx(b.title) || formatNama(a).localeCompare(formatNama(b)))
      .map((u) => `${formatNama(u)}, ${u.missing}`)
      .join("\n\n");
    return `${d}, Belum lengkap: (${incomplete[d].length})\n\n${list}`;
  });

  const body = [...completeLines, ...incompleteLines].filter(Boolean).join("\n\n");

  return (
    `${salam},\n\n` +
    `Mohon ijin Komandan, melaporkan absensi update data personil ${
      (client?.nama || clientId).toUpperCase()
    } pada hari ${hari}, ${tanggal}, pukul ${jam} WIB, sebagai berikut:\n\n` +
    body
  ).trim();
}

const topRankingDependencies = {
  getRekapLikesByClient,
  getRekapKomentarByClient,
};

const topPersonnelRankingDependencies = topRankingDependencies;
const topPolresRankingDependencies = topRankingDependencies;

async function formatTopPersonnelRanking(clientId, roleFlag = null) {
  const [likesData, commentData] = await Promise.all([
    topPersonnelRankingDependencies.getRekapLikesByClient(
      clientId,
      "semua",
      undefined,
      undefined,
      undefined,
      roleFlag
    ),
    topPersonnelRankingDependencies.getRekapKomentarByClient(
      clientId,
      "semua",
      undefined,
      undefined,
      undefined,
      roleFlag
    ),
  ]);

  const likeRows = Array.isArray(likesData?.rows) ? likesData.rows : [];
  const commentRows = Array.isArray(commentData) ? commentData : [];

  const combined = new Map();
  const ensureEntry = (row) => {
    const fallbackKey = `${(row.client_id || "").toLowerCase()}::${(row.username || "").toLowerCase()}`;
    const key = row.user_id || fallbackKey;
    if (!combined.has(key)) {
      combined.set(key, {
        user_id: row.user_id || "-",
        title: row.title || "-",
        nama: row.nama || "-",
        client_name: row.client_name || row.client_id || "-",
        jumlah_like: 0,
        jumlah_komentar: 0,
      });
    }
    return combined.get(key);
  };

  likeRows.forEach((row) => {
    const entry = ensureEntry(row);
    entry.jumlah_like = (entry.jumlah_like || 0) + parseInt(row.jumlah_like ?? 0, 10);
  });

  commentRows.forEach((row) => {
    const entry = ensureEntry(row);
    entry.jumlah_komentar =
      (entry.jumlah_komentar || 0) + parseInt(row.jumlah_komentar ?? 0, 10);
  });

  const ranked = Array.from(combined.values())
    .map((entry) => ({
      ...entry,
      total: (entry.jumlah_like || 0) + (entry.jumlah_komentar || 0),
    }))
    .filter((entry) => entry.total > 0)
    .sort((a, b) => {
      if (b.total !== a.total) {
        return b.total - a.total;
      }
      const nameA = formatNama(a) || `${a.nama}`;
      const nameB = formatNama(b) || `${b.nama}`;
      return nameA.localeCompare(nameB);
    });

  if (!ranked.length) {
    return "Tidak ada data ranking like/komentar personel.";
  }

  const lines = ranked.map((entry, index) => {
    const totalFormatted = Number(entry.total).toLocaleString("id-ID");
    return (
      `${index + 1}. Nama: ${entry.nama}` +
      `\n   Pangkat: ${entry.title}` +
      `\n   NRP: ${entry.user_id}` +
      `\n   Kesatuan: ${entry.client_name}` +
      `\n   Total Like/Komentar: ${totalFormatted}`
    );
  });

  return (
    "📊 *Top Ranking Like & Komentar Personel*\n" +
    "Periode: semua\n\n" +
    lines.join("\n\n")
  );
}

async function formatTopPolresRanking(clientId, roleFlag = null) {
  const [likesData, commentData] = await Promise.all([
    topPolresRankingDependencies.getRekapLikesByClient(
      clientId,
      "semua",
      undefined,
      undefined,
      undefined,
      roleFlag
    ),
    topPolresRankingDependencies.getRekapKomentarByClient(
      clientId,
      "semua",
      undefined,
      undefined,
      undefined,
      roleFlag
    ),
  ]);

  const likeRows = Array.isArray(likesData?.rows) ? likesData.rows : [];
  const commentRows = Array.isArray(commentData) ? commentData : [];

  const combined = new Map();
  const ensureEntry = (row) => {
    const rawKey = String(row.client_id || row.client_name || "-")
      .trim()
      .toLowerCase();
    const key = rawKey || "-";
    if (!combined.has(key)) {
      combined.set(key, {
        client_id: row.client_id || "-",
        client_name: String(row.client_name || row.client_id || "-")
          .trim()
          .toUpperCase(),
        jumlah_like: 0,
        jumlah_komentar: 0,
      });
    }
    const entry = combined.get(key);
    if (row.client_id && entry.client_id === "-") {
      entry.client_id = row.client_id;
    }
    if (row.client_name && entry.client_name === "-") {
      entry.client_name = String(row.client_name).trim().toUpperCase();
    }
    return entry;
  };

  likeRows.forEach((row) => {
    const entry = ensureEntry(row);
    entry.jumlah_like =
      (entry.jumlah_like || 0) + parseInt(row.jumlah_like ?? 0, 10);
  });

  commentRows.forEach((row) => {
    const entry = ensureEntry(row);
    entry.jumlah_komentar =
      (entry.jumlah_komentar || 0) + parseInt(row.jumlah_komentar ?? 0, 10);
  });

  const ranked = Array.from(combined.values())
    .map((entry) => ({
      ...entry,
      total: (entry.jumlah_like || 0) + (entry.jumlah_komentar || 0),
    }))
    .filter((entry) => entry.total > 0)
    .sort((a, b) => {
      if (b.total !== a.total) {
        return b.total - a.total;
      }
      const nameA = String(a.client_name || a.client_id || "");
      const nameB = String(b.client_name || b.client_id || "");
      return nameA.localeCompare(nameB);
    });

  if (!ranked.length) {
    return "Tidak ada data ranking like/komentar polres.";
  }

  const lines = ranked.map((entry, index) => {
    const totalFormatted = Number(entry.total).toLocaleString("id-ID");
    const likeFormatted = Number(entry.jumlah_like || 0).toLocaleString("id-ID");
    const commentFormatted = Number(entry.jumlah_komentar || 0).toLocaleString(
      "id-ID"
    );
    return (
      `${index + 1}. Kesatuan: ${entry.client_name}` +
      `\n   Total Like/Komentar: ${totalFormatted}` +
      `\n   Like: ${likeFormatted} | Komentar: ${commentFormatted}`
    );
  });

  return (
    "📊 *Top Ranking Like & Komentar Polres*\n" +
    "Periode: semua\n\n" +
    lines.join("\n\n")
  );
}

async function absensiLikesDitbinmas(clientId) {
  return await absensiLikesDitbinmasReport(clientId);
}
async function absensiLikesDitbinmasSimple(clientId, opts = {}) {
  return await absensiLikesDitbinmasSimpleReport(clientId, opts);
}
async function absensiKomentarTiktok(clientId, roleFlag) {
  return await absensiKomentar(clientId, { roleFlag });
}
async function absensiKomentarDitbinmasSimple(clientId) {
  return await absensiKomentarDitbinmasSimpleReport(clientId);
}
async function absensiKomentarDitbinmas(clientId) {
  return await absensiKomentarDitbinmasReport(clientId);
}

function buildChakranarayanaMenu5ScopeOptions(clientId, context = {}) {
  const applyScope =
    context?.menuName === "chakranarayana" &&
    context?.chakranarayanaSelectedGroup === "direktorat";

  if (!applyScope) {
    return {};
  }

  return {
    userScope: "chakranarayana_menu5_user_flow",
    targetClientId: String(clientId || "").trim().toUpperCase(),
  };
}

/**
 * Format rekap data personil based on category
 * Categories: all, complete, incomplete, not_yet
 */
async function formatRekapDataPersonil(clientId, category = "all") {
  const targetClientId = String(clientId || DITBINMAS_CLIENT_ID).toUpperCase();
  const [client, allUsers] = await Promise.all([
    findClientById(targetClientId),
    getUsersSocialByClient(targetClientId, targetClientId.toLowerCase()),
  ]);

  const clientName = client?.nama || targetClientId;
  const clientType = client?.client_type?.toLowerCase();

  if (clientType && clientType !== "direktorat") {
    return (
      "❌ Rekap data personil hanya tersedia untuk client bertipe " +
      `Direktorat. (${clientName})`
    );
  }

  // Filter out sat intelkam users from attendance.
  // Untuk client bertipe direktorat, menu ini wajib murni client_id terpilih
  // (bukan berdasarkan role lintas client ORG).
  const normalizedTargetClientId = targetClientId.toLowerCase();
  const users = filterAttendanceUsers(allUsers, clientType, isSatikEnabledClient(client)).filter(
    (user) =>
      String(user.client_id || "").trim().toLowerCase() === normalizedTargetClientId &&
      user.status === true
  );

  const salam = getGreeting();
  const now = new Date();
  const hari = now.toLocaleDateString("id-ID", { weekday: "long" });
  const tanggal = now.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const jam = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Categorize users
  const complete = {};
  const incomplete = {};
  const notYet = {};
  const all = {};

  users.forEach((u) => {
    const div = u.divisi || "-";
    const hasInsta = !!u.insta;
    const hasTiktok = !!u.tiktok;

    // All category
    if (!all[div]) all[div] = [];
    all[div].push(u);

    // Complete category (both filled)
    if (hasInsta && hasTiktok) {
      if (!complete[div]) complete[div] = [];
      complete[div].push(u);
    }
    // Not yet category (both empty)
    else if (!hasInsta && !hasTiktok) {
      if (!notYet[div]) notYet[div] = [];
      const missing = "Instagram dan TikTok kosong";
      notYet[div].push({ ...u, missing });
    }
    // Incomplete category (one filled, one empty)
    else {
      if (!incomplete[div]) incomplete[div] = [];
      const missing = [];
      if (!hasInsta) missing.push("Instagram kosong");
      if (!hasTiktok) missing.push("TikTok kosong");
      incomplete[div].push({ ...u, missing: missing.join(", ") });
    }
  });

  let categoryData;
  let categoryLabel;
  let showMissing = false;

  switch (category) {
    case "complete":
      categoryData = complete;
      categoryLabel = "LENGKAP (Sudah mengisi Instagram dan TikTok)";
      break;
    case "incomplete":
      categoryData = incomplete;
      categoryLabel = "KURANG (Belum lengkap, ada yang kosong)";
      showMissing = true;
      break;
    case "not_yet":
      categoryData = notYet;
      categoryLabel = "BELUM (Belum mengisi Instagram dan TikTok)";
      showMissing = true;
      break;
    case "all":
    default:
      categoryData = all;
      categoryLabel = "SEMUA";
      break;
  }

  const buildUserLine = (u, withMissing = false) => {
    const name = formatNama(u);
    const socialMedia = [];
    if (u.insta) socialMedia.push(`IG: @${u.insta}`);
    if (u.tiktok) socialMedia.push(`TikTok: @${u.tiktok}`);
    const socialMediaInfo = socialMedia.length > 0 ? ` (${socialMedia.join(", ")})` : "";
    if (withMissing && u.missing) {
      return `${name}${socialMediaInfo}, ${u.missing}`;
    }
    return `${name}${socialMediaInfo}`;
  };

  const sortUsers = (list = []) =>
    [...list].sort(
      (a, b) =>
        rankIdx(a.title) - rankIdx(b.title) ||
        formatNama(a).localeCompare(formatNama(b))
    );

  let lines = [];

  if (category === "all") {
    const divisionMap = {};
    users.forEach((u) => {
      const div = u.divisi || "-";
      if (!divisionMap[div]) {
        divisionMap[div] = { complete: [], incomplete: [], notYet: [] };
      }
      const hasInsta = !!u.insta;
      const hasTiktok = !!u.tiktok;
      if (hasInsta && hasTiktok) {
        divisionMap[div].complete.push(u);
      } else if (!hasInsta && !hasTiktok) {
        divisionMap[div].notYet.push({ ...u, missing: "Instagram dan TikTok kosong" });
      } else {
        const missing = [];
        if (!hasInsta) missing.push("Instagram kosong");
        if (!hasTiktok) missing.push("TikTok kosong");
        divisionMap[div].incomplete.push({ ...u, missing: missing.join(", ") });
      }
    });

    lines = sortDivisionKeys(Object.keys(divisionMap)).map((div) => {
      const section = divisionMap[div];
      const completeList = sortUsers(section.complete).map((u) => `- ${buildUserLine(u)}`);
      const incompleteList = sortUsers(section.incomplete).map((u) => `- ${buildUserLine(u, true)}`);
      const notYetList = sortUsers(section.notYet).map((u) => `- ${buildUserLine(u, true)}`);

      return [
        `*${div.toUpperCase()}* (${section.complete.length + section.incomplete.length + section.notYet.length})`,
        `✅ Sudah (${section.complete.length})`,
        completeList.length ? completeList.join("\n") : "- Tidak ada",
        `⚠️ Kurang (${section.incomplete.length})`,
        incompleteList.length ? incompleteList.join("\n") : "- Tidak ada",
        `❌ Belum (${section.notYet.length})`,
        notYetList.length ? notYetList.join("\n") : "- Tidak ada",
      ].join("\n");
    });
  } else {
    lines = sortDivisionKeys(Object.keys(categoryData)).map((div) => {
      const userList = sortUsers(categoryData[div])
        .map((u) => buildUserLine(u, showMissing))
        .join("\n");
      return `*${div.toUpperCase()}* (${categoryData[div].length})\n${userList}`;
    });
  }

  if (!lines.length) {
    return `${salam},\n\nTidak ada data personil kategori ${categoryLabel} untuk ${clientName.toUpperCase()}.`;
  }

  // Calculate totals for header
  const totalUsers = users.length;
  const totalComplete = Object.values(complete).reduce((sum, arr) => sum + arr.length, 0);
  const totalIncomplete = Object.values(incomplete).reduce((sum, arr) => sum + arr.length, 0);
  const totalNotYet = Object.values(notYet).reduce((sum, arr) => sum + arr.length, 0);

  const body = lines.join("\n\n");
  const header =
    `${salam},\n\n` +
    `Mohon ijin Komandan, melaporkan *progres update data personil* ${clientName.toUpperCase()} kategori *${categoryLabel}* pada hari ${hari}, ${tanggal}, pukul ${jam} WIB.\n\n` +
    `📊 *Ringkasan Progres Update Username Instagram/TikTok:*\n` +
    `• Total User: ${totalUsers}\n` +
    `• Username lengkap: ${totalComplete}\n` +
    `• Username kurang lengkap: ${totalIncomplete}\n` +
    `• Belum update username: ${totalNotYet}\n\n` +
    `Berikut detail personil per divisi:\n\n`;

  return (header + body).trim();
}

async function formatRekapBelumLengkapDirektorat(clientId) {
  const targetClientId = String(clientId || DITBINMAS_CLIENT_ID).toUpperCase();
  const [client, users] = await Promise.all([
    findClientById(targetClientId),
    getUsersSocialByClient(targetClientId, targetClientId.toLowerCase()),
  ]);

  const clientName = client?.nama || targetClientId;
  const clientType = client?.client_type?.toLowerCase();

  if (clientType && clientType !== "direktorat") {
    return (
      "❌ Rekap data belum lengkap hanya tersedia untuk client bertipe " +
      `Direktorat. (${clientName})`
    );
  }

  const targetUsers =
    clientType === "direktorat"
      ? users
      : users.filter((u) => (u.client_id || "").toUpperCase() === targetClientId);

  const salam = getGreeting();
  const now = new Date();
  const hari = now.toLocaleDateString("id-ID", { weekday: "long" });
  const tanggal = now.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const jam = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const incomplete = {};
  targetUsers.forEach((u) => {
    if (u.insta && u.tiktok) return;
    const div = u.divisi || "-";
    const missing = [];
    if (!u.insta) missing.push("Instagram kosong");
    if (!u.tiktok) missing.push("TikTok kosong");
    if (!incomplete[div]) incomplete[div] = [];
    incomplete[div].push({ ...u, missing: missing.join(", ") });
  });
  const lines = sortDivisionKeys(Object.keys(incomplete)).map((d) => {
    const list = incomplete[d]
      .sort(
        (a, b) =>
          rankIdx(a.title) - rankIdx(b.title) ||
          formatNama(a).localeCompare(formatNama(b))
      )
      .map((u) => `${formatNama(u)}, ${u.missing}`)
      .join("\n\n");
    return `*${d.toUpperCase()}* (${incomplete[d].length})\n\n${list}`;
  });
  if (!lines.length) {
    return null;
  }
  const body = lines.join("\n\n");
  return (
    `${salam},\n\n` +
    `Mohon ijin Komandan, melaporkan personil ${clientName.toUpperCase()} yang belum melengkapi data Instagram/TikTok pada hari ${hari}, ${tanggal}, pukul ${jam} WIB, sebagai berikut:\n\n` +
    body
  ).trim();
}

const getPreviousWeekWindow = (referenceDate = new Date()) => {
  const now = new Date(referenceDate);
  const jakartaNowText = now.toLocaleString("en-US", {
    timeZone: "Asia/Jakarta",
    hour12: false,
  });
  const jakartaNow = new Date(jakartaNowText);
  const day = jakartaNow.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const thisWeekMonday = new Date(jakartaNow);
  thisWeekMonday.setHours(0, 0, 0, 0);
  thisWeekMonday.setDate(jakartaNow.getDate() + mondayOffset);

  const lastWeekMonday = new Date(thisWeekMonday);
  lastWeekMonday.setDate(thisWeekMonday.getDate() - 7);

  const lastWeekSunday = new Date(lastWeekMonday);
  lastWeekSunday.setDate(lastWeekMonday.getDate() + 6);

  return {
    startYmd: getJakartaYmd(lastWeekMonday),
    endYmd: getJakartaYmd(lastWeekSunday),
  };
};


const getCurrentWeekWindow = (referenceDate = new Date()) => {
  const now = new Date(referenceDate);
  const jakartaNowText = now.toLocaleString("en-US", {
    timeZone: "Asia/Jakarta",
    hour12: false,
  });
  const jakartaNow = new Date(jakartaNowText);
  const day = jakartaNow.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const thisWeekMonday = new Date(jakartaNow);
  thisWeekMonday.setHours(0, 0, 0, 0);
  thisWeekMonday.setDate(jakartaNow.getDate() + mondayOffset);

  return {
    startYmd: getJakartaYmd(thisWeekMonday),
    endYmd: getJakartaYmd(jakartaNow),
  };
};

const resolveChakranarayanaRecapWindow = (period, rawValue = null, referenceDate = new Date()) => {
  if (period === "last_week") {
    return {
      ...getPreviousWeekWindow(referenceDate),
      periodLabel: "minggu sebelumnya (Senin - Minggu)",
      periodKey: "last_week",
    };
  }

  if (period === "this_week") {
    return {
      ...getCurrentWeekWindow(referenceDate),
      periodLabel: "minggu ini (Senin - hari ini)",
      periodKey: "this_week",
    };
  }

  if (period === "today") {
    const todayYmd = getJakartaYmd(referenceDate);
    return {
      startYmd: todayYmd,
      endYmd: todayYmd,
      periodLabel: `hari ini (${todayYmd})`,
      periodKey: "today",
    };
  }

  if (period === "selected_date") {
    const normalizedDate = String(rawValue || "").trim();
    if (!isValidYmd(normalizedDate)) {
      throw new Error("❌ Format tanggal tidak valid. Gunakan format YYYY-MM-DD.");
    }

    return {
      startYmd: normalizedDate,
      endYmd: normalizedDate,
      periodLabel: `pilihan tanggal (${normalizedDate})`,
      periodKey: "selected_date",
    };
  }

  if (period === "selected_month") {
    const normalizedMonth = String(rawValue || "").trim();
    if (!isValidYm(normalizedMonth)) {
      throw new Error("❌ Format bulan tidak valid. Gunakan format YYYY-MM.");
    }

    const [yearText, monthText] = normalizedMonth.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error("❌ Bulan tidak valid. Gunakan rentang bulan 01 sampai 12.");
    }

    const startYmd = `${yearText}-${monthText}-01`;
    const endDate = new Date(Date.UTC(year, month, 0, 0, 0, 0));
    const endYmd = getJakartaYmd(endDate);

    return {
      startYmd,
      endYmd,
      periodLabel: `pilihan bulan (${normalizedMonth})`,
      periodKey: "selected_month",
    };
  }

  throw new Error("❌ Periode rekap tidak dikenali.");
};

const getExecutiveSummaryWindow = (period, rawValue = null, referenceDate = new Date()) => {
  if (period === "last_week") {
    return {
      ...getPreviousWeekWindow(referenceDate),
      periodText: "Minggu Lalu (Senin–Minggu)",
    };
  }

  if (period === "this_week") {
    return {
      ...getCurrentWeekWindow(referenceDate),
      periodText: "Minggu Ini (Senin–Hari Ini)",
    };
  }

  if (period === "today") {
    const todayYmd = getJakartaYmd(referenceDate);
    return {
      startYmd: todayYmd,
      endYmd: todayYmd,
      periodText: "Hari Ini",
    };
  }

  if (period === "selected_date") {
    const normalizedDate = String(rawValue || "").trim();
    if (!isValidYmd(normalizedDate)) {
      throw new Error("❌ Format tanggal tidak valid. Gunakan format YYYY-MM-DD.");
    }

    return {
      startYmd: normalizedDate,
      endYmd: normalizedDate,
      periodText: `Tanggal ${formatYmdToIndoLong(normalizedDate)}`,
    };
  }

  if (period === "selected_month") {
    const normalizedMonth = String(rawValue || "").trim();
    if (!isValidYm(normalizedMonth)) {
      throw new Error("❌ Format bulan tidak valid. Gunakan format YYYY-MM.");
    }

    const [yearText, monthText] = normalizedMonth.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error("❌ Bulan tidak valid. Gunakan rentang bulan 01 sampai 12.");
    }

    const startYmd = `${yearText}-${monthText}-01`;
    const endDate = new Date(Date.UTC(year, month, 0, 0, 0, 0));
    const endYmd = getJakartaYmd(endDate);

    return {
      startYmd,
      endYmd,
      periodText: `Bulan ${endDate.toLocaleDateString("id-ID", {
        timeZone: "Asia/Jakarta",
        month: "long",
        year: "numeric",
      })}`,
    };
  }

  throw new Error("❌ Periode Executive Summary tidak dikenali.");
};

const getExecutiveSummaryTrendLabel = (currentRate, previousRate) => {
  const diff = currentRate - previousRate;
  if (diff >= 5) return "MENINGKAT";
  if (diff <= -5) return "PERLU PEMBINAAN";
  return "STABIL";
};

async function getEngagementHourlyActivity(clientId, roleFlag, startDate, endDate, trackedInstaUsernames = [], trackedTiktokUsernames = []) {
  const params = [startDate, endDate];
  const roleFilter = String(roleFlag || "").trim().toLowerCase();
  const fallbackClientFilter = String(clientId || "").trim().toLowerCase();
  const scopeFilter = roleFilter || fallbackClientFilter;
  params.push(scopeFilter);
  params.push(trackedInstaUsernames);
  params.push(trackedTiktokUsernames);

  const { rows } = await query(
    `
    WITH date_bounds AS (
      SELECT
        ($1::date::timestamp AT TIME ZONE 'Asia/Jakarta') AS start_at,
        (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Jakarta') AS end_at
    ),
    ig_task_shortcodes AS (
      SELECT DISTINCT ip.shortcode
      FROM insta_post ip
      LEFT JOIN insta_post_roles ipr ON ipr.shortcode = ip.shortcode
      WHERE (ip.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN $1::date AND $2::date
        AND (
          LOWER(TRIM(ip.client_id)) = LOWER($3)
          OR LOWER(TRIM(ipr.role_name)) = LOWER($3)
        )
    ),
    tt_task_video_ids AS (
      SELECT DISTINCT tp.video_id
      FROM tiktok_post tp
      LEFT JOIN tiktok_post_roles tpr ON tpr.video_id = tp.video_id
      WHERE (tp.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN $1::date AND $2::date
        AND (
          LOWER(TRIM(tp.client_id)) = LOWER($3)
          OR LOWER(TRIM(tpr.role_name)) = LOWER($3)
        )
    ),
    ig_in_range AS (
      SELECT
        ila.shortcode,
        lower(replace(trim(COALESCE(elem->>'username', trim(both '"' FROM elem::text))), '@', '')) AS username,
        ila.snapshot_window_end
      FROM insta_like_audit ila
      JOIN ig_task_shortcodes tasks ON tasks.shortcode = ila.shortcode
      JOIN date_bounds db ON TRUE
      JOIN LATERAL jsonb_array_elements(COALESCE(ila.usernames, '[]'::jsonb)) elem ON TRUE
      WHERE ila.snapshot_window_end >= db.start_at
        AND ila.snapshot_window_end < db.end_at
        AND lower(replace(trim(COALESCE(elem->>'username', trim(both '"' FROM elem::text))), '@', '')) <> ''
        AND (COALESCE(array_length($4::text[], 1), 0) = 0
          OR lower(replace(trim(COALESCE(elem->>'username', trim(both '"' FROM elem::text))), '@', '')) = ANY($4::text[]))
    ),
    ig_before_range_snapshot AS (
      SELECT DISTINCT ON (ila.shortcode)
        ila.shortcode,
        ila.usernames
      FROM insta_like_audit ila
      JOIN ig_task_shortcodes tasks ON tasks.shortcode = ila.shortcode
      JOIN date_bounds db ON TRUE
      WHERE ila.snapshot_window_end < db.start_at
      ORDER BY ila.shortcode, ila.snapshot_window_end DESC, ila.captured_at DESC
    ),
    ig_before_range AS (
      SELECT
        base.shortcode,
        lower(replace(trim(COALESCE(elem->>'username', trim(both '"' FROM elem::text))), '@', '')) AS username
      FROM ig_before_range_snapshot base
      JOIN LATERAL jsonb_array_elements(COALESCE(base.usernames, '[]'::jsonb)) elem ON TRUE
      WHERE lower(replace(trim(COALESCE(elem->>'username', trim(both '"' FROM elem::text))), '@', '')) <> ''
    ),
    ig_first_events AS (
      SELECT
        r.shortcode,
        r.username,
        MIN(r.snapshot_window_end) AS event_time
      FROM ig_in_range r
      LEFT JOIN ig_before_range b
        ON b.shortcode = r.shortcode
       AND b.username = r.username
      WHERE b.username IS NULL
      GROUP BY r.shortcode, r.username
    ),
    ig_activity AS (
      SELECT
        LPAD(EXTRACT(HOUR FROM (event_time AT TIME ZONE 'Asia/Jakarta'))::text, 2, '0') || ':00' AS hour_label,
        COUNT(*)::int AS total_events
      FROM ig_first_events
      GROUP BY 1
    ),
    tt_in_range AS (
      SELECT
        tca.video_id,
        lower(replace(trim(COALESCE(elem->>'username', trim(both '"' FROM elem::text), elem::text)), '@', '')) AS username,
        tca.snapshot_window_end
      FROM tiktok_comment_audit tca
      JOIN tt_task_video_ids tasks ON tasks.video_id = tca.video_id
      JOIN date_bounds db ON TRUE
      JOIN LATERAL jsonb_array_elements(COALESCE(tca.usernames, '[]'::jsonb)) elem ON TRUE
      WHERE tca.snapshot_window_end >= db.start_at
        AND tca.snapshot_window_end < db.end_at
        AND lower(replace(trim(COALESCE(elem->>'username', trim(both '"' FROM elem::text), elem::text)), '@', '')) <> ''
        AND (COALESCE(array_length($5::text[], 1), 0) = 0
          OR lower(replace(trim(COALESCE(elem->>'username', trim(both '"' FROM elem::text), elem::text)), '@', '')) = ANY($5::text[]))
    ),
    tt_before_range_snapshot AS (
      SELECT DISTINCT ON (tca.video_id)
        tca.video_id,
        tca.usernames
      FROM tiktok_comment_audit tca
      JOIN tt_task_video_ids tasks ON tasks.video_id = tca.video_id
      JOIN date_bounds db ON TRUE
      WHERE tca.snapshot_window_end < db.start_at
      ORDER BY tca.video_id, tca.snapshot_window_end DESC, tca.captured_at DESC
    ),
    tt_before_range AS (
      SELECT
        base.video_id,
        lower(replace(trim(COALESCE(elem->>'username', trim(both '"' FROM elem::text), elem::text)), '@', '')) AS username
      FROM tt_before_range_snapshot base
      JOIN LATERAL jsonb_array_elements(COALESCE(base.usernames, '[]'::jsonb)) elem ON TRUE
      WHERE lower(replace(trim(COALESCE(elem->>'username', trim(both '"' FROM elem::text), elem::text)), '@', '')) <> ''
    ),
    tt_first_events AS (
      SELECT
        r.video_id,
        r.username,
        MIN(r.snapshot_window_end) AS event_time
      FROM tt_in_range r
      LEFT JOIN tt_before_range b
        ON b.video_id = r.video_id
       AND b.username = r.username
      WHERE b.username IS NULL
      GROUP BY r.video_id, r.username
    ),
    tt_activity AS (
      SELECT
        LPAD(EXTRACT(HOUR FROM (event_time AT TIME ZONE 'Asia/Jakarta'))::text, 2, '0') || ':00' AS hour_label,
        COUNT(*)::int AS total_events
      FROM tt_first_events
      GROUP BY 1
    ),
    merged AS (
      SELECT hour_label, total_events FROM ig_activity
      UNION ALL
      SELECT hour_label, total_events FROM tt_activity
    )
    SELECT hour_label, SUM(total_events)::int AS total_events
    FROM merged
    GROUP BY hour_label
    ORDER BY hour_label ASC
    `,
    params
  );

  return rows.map((row) => ({
    hourLabel: row.hour_label,
    totalEvents: Number(row.total_events || 0),
  }));
}

async function getExecutiveSummaryActivityByUsername(clientId, roleFlag, startDate, endDate, trackedInstaUsernames = [], trackedTiktokUsernames = []) {
  const roleFilter = String(roleFlag || "").trim().toLowerCase();
  const fallbackClientFilter = String(clientId || "").trim().toLowerCase();
  const scopeFilter = roleFilter || fallbackClientFilter;
  const params = [startDate, endDate, scopeFilter, trackedInstaUsernames, trackedTiktokUsernames];

  const { rows } = await query(
    `
    WITH ig_task_shortcodes AS (
      SELECT DISTINCT ip.shortcode
      FROM insta_post ip
      LEFT JOIN insta_post_roles ipr ON ipr.shortcode = ip.shortcode
      WHERE (ip.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN $1::date AND $2::date
        AND (
          LOWER(TRIM(ip.client_id)) = LOWER($3)
          OR LOWER(TRIM(ipr.role_name)) = LOWER($3)
        )
    ),
    tt_task_video_ids AS (
      SELECT DISTINCT tp.video_id
      FROM tiktok_post tp
      LEFT JOIN tiktok_post_roles tpr ON tpr.video_id = tp.video_id
      WHERE (tp.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN $1::date AND $2::date
        AND (
          LOWER(TRIM(tp.client_id)) = LOWER($3)
          OR LOWER(TRIM(tpr.role_name)) = LOWER($3)
        )
    ),
    ig_activity AS (
      SELECT
        lower(replace(trim(COALESCE(elem->>'username', trim(both '"' FROM elem::text))), '@', '')) AS username,
        COUNT(DISTINCT il.shortcode || ':' || lower(replace(trim(COALESCE(elem->>'username', trim(both '"' FROM elem::text))), '@', '')))::int AS activity_count
      FROM insta_like il
      JOIN ig_task_shortcodes tasks ON tasks.shortcode = il.shortcode
      JOIN LATERAL jsonb_array_elements(COALESCE(il.likes, '[]'::jsonb)) elem ON TRUE
      WHERE lower(replace(trim(COALESCE(elem->>'username', trim(both '"' FROM elem::text))), '@', '')) <> ''
        AND (COALESCE(array_length($4::text[], 1), 0) = 0
          OR lower(replace(trim(COALESCE(elem->>'username', trim(both '"' FROM elem::text))), '@', '')) = ANY($4::text[]))
      GROUP BY 1
    ),
    tt_activity AS (
      SELECT
        lower(replace(trim(commenter.raw_username), '@', '')) AS username,
        COUNT(DISTINCT tc.video_id || ':' || lower(replace(trim(commenter.raw_username), '@', '')))::int AS activity_count
      FROM tiktok_comment tc
      JOIN tt_task_video_ids tasks ON tasks.video_id = tc.video_id
      JOIN LATERAL jsonb_array_elements_text(COALESCE(tc.comments, '[]'::jsonb)) AS commenter(raw_username) ON TRUE
      WHERE lower(replace(trim(commenter.raw_username), '@', '')) <> ''
        AND (COALESCE(array_length($5::text[], 1), 0) = 0
          OR lower(replace(trim(commenter.raw_username), '@', '')) = ANY($5::text[]))
      GROUP BY 1
    )
    SELECT 'instagram'::text AS platform, username, activity_count FROM ig_activity
    UNION ALL
    SELECT 'tiktok'::text AS platform, username, activity_count FROM tt_activity
    `,
    params
  );

  return rows.map((row) => ({
    platform: String(row.platform || "").toLowerCase(),
    username: String(row.username || "").toLowerCase(),
    activityCount: Number(row.activity_count || 0),
  }));
}

async function getExecutiveSummaryActivityTotals(clientId, roleFlag, startDate, endDate, trackedInstaUsernames = [], trackedTiktokUsernames = []) {
  const roleFilter = String(roleFlag || "").trim().toLowerCase();
  const fallbackClientFilter = String(clientId || "").trim().toLowerCase();
  const scopeFilter = roleFilter || fallbackClientFilter;
  const params = [startDate, endDate, scopeFilter, trackedInstaUsernames, trackedTiktokUsernames];

  const { rows } = await query(
    `
    WITH ig_task_shortcodes AS (
      SELECT DISTINCT ip.shortcode
      FROM insta_post ip
      LEFT JOIN insta_post_roles ipr ON ipr.shortcode = ip.shortcode
      WHERE (ip.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN $1::date AND $2::date
        AND (
          LOWER(TRIM(ip.client_id)) = LOWER($3)
          OR LOWER(TRIM(ipr.role_name)) = LOWER($3)
        )
    ),
    tt_task_video_ids AS (
      SELECT DISTINCT tp.video_id
      FROM tiktok_post tp
      LEFT JOIN tiktok_post_roles tpr ON tpr.video_id = tp.video_id
      WHERE (tp.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN $1::date AND $2::date
        AND (
          LOWER(TRIM(tp.client_id)) = LOWER($3)
          OR LOWER(TRIM(tpr.role_name)) = LOWER($3)
        )
    ),
    ig_real_likes AS (
      SELECT DISTINCT
        il.shortcode,
        lower(replace(trim(COALESCE(elem->>'username', trim(both '"' FROM elem::text))), '@', '')) AS username
      FROM insta_like il
      JOIN ig_task_shortcodes tasks ON tasks.shortcode = il.shortcode
      JOIN LATERAL jsonb_array_elements(COALESCE(il.likes, '[]'::jsonb)) elem ON TRUE
      WHERE lower(replace(trim(COALESCE(elem->>'username', trim(both '"' FROM elem::text))), '@', '')) <> ''
        AND (COALESCE(array_length($4::text[], 1), 0) = 0
          OR lower(replace(trim(COALESCE(elem->>'username', trim(both '"' FROM elem::text))), '@', '')) = ANY($4::text[]))
    ),
    tt_real_comments AS (
      SELECT DISTINCT
        tc.video_id,
        lower(replace(trim(commenter.raw_username), '@', '')) AS username
      FROM tiktok_comment tc
      JOIN tt_task_video_ids tasks ON tasks.video_id = tc.video_id
      JOIN LATERAL jsonb_array_elements_text(COALESCE(tc.comments, '[]'::jsonb)) AS commenter(raw_username) ON TRUE
      WHERE lower(replace(trim(commenter.raw_username), '@', '')) <> ''
        AND (COALESCE(array_length($5::text[], 1), 0) = 0
          OR lower(replace(trim(commenter.raw_username), '@', '')) = ANY($5::text[]))
    )
    SELECT
      (SELECT COUNT(*)::int FROM ig_task_shortcodes) AS total_post_instagram,
      (SELECT COUNT(*)::int FROM tt_task_video_ids) AS total_post_tiktok,
      (SELECT COUNT(*)::int FROM ig_real_likes WHERE username <> '') AS total_likes,
      (SELECT COUNT(*)::int FROM tt_real_comments WHERE username <> '') AS total_komentar
    `,
    params
  );

  return {
    totalPostInstagram: Number(rows[0]?.total_post_instagram || 0),
    totalPostTiktok: Number(rows[0]?.total_post_tiktok || 0),
    totalLikes: Number(rows[0]?.total_likes || 0),
    totalKomentar: Number(rows[0]?.total_komentar || 0),
  };
}

async function formatExecutiveSummary(clientId, roleFlag = null, options = {}) {
  const targetClientId = String(clientId || DITBINMAS_CLIENT_ID).toUpperCase();
  const effectiveRole = String(roleFlag || targetClientId).trim().toLowerCase();
  const { period = "last_week", value = null } = options || {};
  const { startYmd, endYmd, periodText } = getExecutiveSummaryWindow(period, value);
  const menuMode = [options?.menuName, options?.chakranarayanaSelectedGroup]
    .filter(Boolean)
    .join(":") || "default";
  const client = await findClientById(targetClientId);
  const applyChakranarayanaDirektoratSatikFilter =
    options?.menuName === "chakranarayana" &&
    options?.chakranarayanaSelectedGroup === "direktorat" &&
    isSatikEnabledClient(client);

  const allUsers = await getUsersSocialByClient(targetClientId, effectiveRole);
  const filteringResult = applyChakranarayanaDirektoratSatikFilter
    ? await filterExecutiveSummaryOrgSatikUsers(allUsers, {
      clientId: targetClientId,
      roleFlag: effectiveRole,
      menuName: options?.menuName,
      chakranarayanaSelectedGroup: options?.chakranarayanaSelectedGroup,
    })
    : {
      users: allUsers,
      selectedScope: "all_users_default",
      counts: {
        beforeFilter: allUsers.length,
        afterStrictFilter: allUsers.length,
        afterFallback: allUsers.length,
      },
    };
  const users = filteringResult.users;
  const userScopeLabelMap = {
    chakranarayana_menu5_user_flow: "Flow menu 5 (scope direktorat + SATIK include_only)",
    all_users_default: "Default (tanpa filter SATIK khusus)",
  };
  const userScopeLabel = userScopeLabelMap[filteringResult.selectedScope] || filteringResult.selectedScope;
  const totalPersonil = users.length;
  const userFilterContextPayload = {
    targetClientId,
    effectiveRole,
    menuMode,
    period,
    periodText,
    startYmd,
    endYmd,
    selectedScope: filteringResult.selectedScope,
    counts: {
      beforeFilter: Number(filteringResult?.counts?.beforeFilter || 0),
      afterStrictFilter: Number(filteringResult?.counts?.afterStrictFilter || 0),
      afterFallback: Number(filteringResult?.counts?.afterFallback || 0),
    },
  };
  if (!users.length) {
    console.warn("[ExecutiveSummary] Data personil kosong setelah proses filter", userFilterContextPayload);
  }
  const totalUsernameUpdated = users.filter((u) => u?.insta || u?.tiktok).length;
  const totalInstagramUpdated = users.filter((u) => u?.insta).length;
  const totalTiktokUpdated = users.filter((u) => u?.tiktok).length;
  const totalBelumUpdate = users.filter((u) => !u?.insta && !u?.tiktok).length;
  const totalKurangLengkap = users.filter((u) => (u?.insta && !u?.tiktok) || (!u?.insta && u?.tiktok)).length;
  const persentaseUpdated = totalPersonil
    ? ((totalUsernameUpdated / totalPersonil) * 100).toFixed(1)
    : "0.0";

  const trackedInstaUsernames = [...new Set(
    users
      .map((u) => String(u?.insta || "").trim().replace(/^@+/, "").toLowerCase())
      .filter(Boolean)
  )];
  const trackedTiktokUsernames = [...new Set(
    users
      .map((u) => String(u?.tiktok || "").trim().replace(/^@+/, "").toLowerCase())
      .filter(Boolean)
  )];


  const previousWeekStart = new Date(`${startYmd}T00:00:00+07:00`);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const previousWeekEnd = new Date(`${endYmd}T00:00:00+07:00`);
  previousWeekEnd.setDate(previousWeekEnd.getDate() - 7);
  const previousStartYmd = getJakartaYmd(previousWeekStart);
  const previousEndYmd = getJakartaYmd(previousWeekEnd);

  const [currentTotals, previousTotals, hourlyActivity, activityByUsername] = await Promise.all([
    getExecutiveSummaryActivityTotals(targetClientId, effectiveRole, startYmd, endYmd, trackedInstaUsernames, trackedTiktokUsernames),
    getExecutiveSummaryActivityTotals(
      targetClientId,
      effectiveRole,
      previousStartYmd,
      previousEndYmd,
      trackedInstaUsernames,
      trackedTiktokUsernames
    ),
    getEngagementHourlyActivity(targetClientId, effectiveRole, startYmd, endYmd, trackedInstaUsernames, trackedTiktokUsernames),
    getExecutiveSummaryActivityByUsername(targetClientId, effectiveRole, startYmd, endYmd, trackedInstaUsernames, trackedTiktokUsernames),
  ]);

  const totalPostInstagram = currentTotals.totalPostInstagram;
  const totalPostTiktok = currentTotals.totalPostTiktok;
  const totalLikes = currentTotals.totalLikes;
  const totalKomentar = currentTotals.totalKomentar;

  const totalPosts = totalPostInstagram + totalPostTiktok;
  const totalParticipation = totalLikes + totalKomentar;
  const avgParticipationPerPost = totalPosts ? totalParticipation / totalPosts : 0;
  const avgPartisipasi = totalPersonil
    ? ((avgParticipationPerPost / totalPersonil) * 100).toFixed(1)
    : "0.0";

  const prevLikes = previousTotals.totalLikes;
  const prevKomentar = previousTotals.totalKomentar;
  const prevTotalPosts = previousTotals.totalPostInstagram + previousTotals.totalPostTiktok;
  const prevTotalParticipation = prevLikes + prevKomentar;
  const currentRate = totalPersonil
    ? ((avgParticipationPerPost / totalPersonil) * 100)
    : 0;
  const previousRate = totalPersonil
    ? (((prevTotalPosts ? prevTotalParticipation / prevTotalPosts : 0) / totalPersonil) * 100)
    : 0;
  const trendLabel = getExecutiveSummaryTrendLabel(currentRate, previousRate);

  const hourlyActivityMap = new Map(
    Array.from({ length: 24 }, (_, hour) => [hour, 0])
  );
  hourlyActivity.forEach((item) => {
    const hourNumber = Number(String(item.hourLabel || "").split(":")[0]);
    if (!Number.isFinite(hourNumber)) return;
    if (hourNumber < 0 || hourNumber > 23) return;
    hourlyActivityMap.set(hourNumber, Number(item.totalEvents || 0));
  });

  const normalizedHourlyActivity = Array.from({ length: 24 }, (_, hour) => ({
    hourNumber: hour,
    hourLabel: `${String(hour).padStart(2, "0")}:00`,
    totalEvents: Number(hourlyActivityMap.get(hour) || 0),
  }));

  const sortedHours = [...normalizedHourlyActivity].sort((a, b) => b.totalEvents - a.totalEvents || a.hourNumber - b.hourNumber);
  const dominantHours = sortedHours
    .filter((item) => item.totalEvents > 0)
    .slice(0, 2)
    .map((item) => `${item.hourLabel} (${item.totalEvents})`);
  const lowestHour = sortedHours.length
    ? sortedHours[sortedHours.length - 1]
    : { hourLabel: "-", totalEvents: 0 };
  const hourlyActivityLines = normalizedHourlyActivity
    .filter((item) => item.totalEvents > 0)
    .map((item) => {
      const startHour = item.hourNumber;
      const endHour = (startHour + 1) % 24;
      return `• ${String(startHour).padStart(2, "0")}.00-${String(endHour).padStart(2, "0")}.00 WIB: ${item.totalEvents} aktivitas`;
    });

  const activityCounter = {
    instagram: new Map(),
    tiktok: new Map(),
  };
  activityByUsername.forEach((row) => {
    if (!row.username || !activityCounter[row.platform]) return;
    activityCounter[row.platform].set(row.username, Number(row.activityCount || 0));
  });

  const polresMap = new Map();
  users.forEach((user) => {
    const polresId = String(user?.client_id || targetClientId).toUpperCase();
    if (!polresMap.has(polresId)) {
      polresMap.set(polresId, {
        polresId,
        totalPersonil: 0,
        totalUpdated: 0,
        totalPelaksanaan: 0,
      });
    }
    const entry = polresMap.get(polresId);
    entry.totalPersonil += 1;

    const insta = String(user?.insta || "").trim().replace(/^@+/, "").toLowerCase();
    const tiktok = String(user?.tiktok || "").trim().replace(/^@+/, "").toLowerCase();
    if (insta || tiktok) entry.totalUpdated += 1;
    if (insta) entry.totalPelaksanaan += Number(activityCounter.instagram.get(insta) || 0);
    if (tiktok) entry.totalPelaksanaan += Number(activityCounter.tiktok.get(tiktok) || 0);
  });

  const topPolresByPelaksanaan = [...polresMap.values()]
    .sort((a, b) => b.totalPelaksanaan - a.totalPelaksanaan || b.totalUpdated - a.totalUpdated)
    .slice(0, 5);

  const bottomPolresByUpdate = [...polresMap.values()]
    .map((item) => ({
      ...item,
      updateRate: item.totalPersonil ? (item.totalUpdated / item.totalPersonil) * 100 : 0,
    }))
    .sort((a, b) => a.updateRate - b.updateRate || a.totalUpdated - b.totalUpdated || b.totalPelaksanaan - a.totalPelaksanaan)
    .slice(0, 10);

  const topPolresLines = topPolresByPelaksanaan.map((item, index) => {
    const updateRate = item.totalPersonil
      ? ((item.totalUpdated / item.totalPersonil) * 100).toFixed(1)
      : "0.0";
    return `• ${index + 1}. ${item.polresId}: ${item.totalPelaksanaan.toLocaleString("id-ID")} pelaksanaan (update ${item.totalUpdated}/${item.totalPersonil} personil - ${updateRate}%)`;
  });

  const bottomPolresLines = bottomPolresByUpdate.map((item, index) => {
    const updateRate = item.totalPersonil
      ? ((item.totalUpdated / item.totalPersonil) * 100).toFixed(1)
      : "0.0";
    return `• ${index + 1}. ${item.polresId}: update ${item.totalUpdated}/${item.totalPersonil} personil (${updateRate}%) | ${item.totalPelaksanaan.toLocaleString("id-ID")} pelaksanaan`;
  });

  const periodLabel = `${formatYmdToIndoLong(startYmd)} s.d. ${formatYmdToIndoLong(endYmd)}`;
  const clientName = (client?.nama || targetClientId).toUpperCase();
  const emptyPersonnelWarningLines = !users.length
    ? [
      "⚠️ *Data personil kosong setelah proses filter*",
      "• Diagnostik konteks:",
      `  - targetClientId: *${targetClientId}*`,
      `  - effectiveRole: *${effectiveRole || "-"}*`,
      `  - mode menu: *${menuMode}*`,
      `  - periode: *${periodText}* (${periodLabel} WIB)`,
      "• Rekomendasi: validasi kembali mapping role/client/divisi agar cakupan user tidak tereliminasi seluruhnya.",
      "",
    ]
    : [];

  return [
    "*EXECUTIVE SUMMARY*",
    ...emptyPersonnelWarningLines,
    `*Implementasi Sistem CICERO – ${periodText}*`,
    `*Satuan:* ${clientName}`,
    `*Periode:* ${periodLabel} (WIB)`,
    `*Scope user summary:* ${userScopeLabel} | before filter ${Number(filteringResult?.counts?.beforeFilter || 0).toLocaleString("id-ID")}, after strict ${Number(filteringResult?.counts?.afterStrictFilter || 0).toLocaleString("id-ID")}, after fallback ${Number(filteringResult?.counts?.afterFallback || 0).toLocaleString("id-ID")}.`,
    "",
    "Dalam rangka optimalisasi penguatan citra institusi melalui engagement digital terstruktur, Sistem CICERO telah mengimplementasikan mekanisme pengelolaan personil, distribusi tugas, serta monitoring pelaksanaan likes dan komentar secara terukur.",
    "",
    "1️⃣ *Skala Personil Terdata*",
    `• Total personil terinput: *${totalPersonil.toLocaleString("id-ID")}* personil.`,
    `• Personil dengan username Instagram terupdate: *${totalInstagramUpdated.toLocaleString("id-ID")}* personil.`,
    `• Personil dengan username TikTok terupdate: *${totalTiktokUpdated.toLocaleString("id-ID")}* personil.`,
    `• Total personil dengan minimal 1 username terupdate: *${totalUsernameUpdated.toLocaleString("id-ID")}* personil (*${persentaseUpdated}%*).`,
    `• Personil yang masih perlu validasi/update username: *${(totalBelumUpdate + totalKurangLengkap).toLocaleString("id-ID")}* personil (Belum update: ${totalBelumUpdate.toLocaleString("id-ID")}, Kurang lengkap: ${totalKurangLengkap.toLocaleString("id-ID")}).`,
    "",
    "2️⃣ *Aktivitas Upload Konten*",
    `• Total post Instagram terunggah: *${Number(totalPostInstagram || 0).toLocaleString("id-ID")}* post.`,
    `• Total post TikTok terunggah: *${Number(totalPostTiktok || 0).toLocaleString("id-ID")}* post.`,
    "",
    "3️⃣ *Pelaksanaan Likes & Komentar*",
    `• Total likes Instagram tercatat: *${totalLikes.toLocaleString("id-ID")}* aktivitas (dari *${Number(totalPostInstagram || 0).toLocaleString("id-ID")}* post konten/tugas).`,
    `• Total komentar TikTok tercatat: *${totalKomentar.toLocaleString("id-ID")}* aktivitas (dari *${Number(totalPostTiktok || 0).toLocaleString("id-ID")}* post konten/tugas).`,
    `• Rata-rata partisipasi terhadap personil terdata: *${avgPartisipasi}%*.`,
    `• Tren kepatuhan dibanding minggu sebelumnya: *${trendLabel}* (minggu ini ${currentRate.toFixed(1)}% vs sebelumnya ${previousRate.toFixed(1)}%).`,
    "",
    "4️⃣ *Pola Waktu Pelaksanaan*",
    `• Periode pola waktu: *${periodLabel} (WIB)*.`,
    dominantHours.length
      ? `• Jam aktivitas dominan: *${dominantHours.join("; ")}*.`
      : "• Jam aktivitas dominan: *belum ada aktivitas terekam*.",
    `• Jam aktivitas terendah: *${lowestHour.hourLabel} (${lowestHour.totalEvents})*.`,
    "• Peta waktu pelaksanaan likes IG dan komentar TikTok:",
    ...(hourlyActivityLines.length ? hourlyActivityLines : ["• Data waktu belum tersedia."]),
    "",
    "5️⃣ *Top 5 Polres dengan Pelaksanaan Tertinggi*",
    ...(topPolresLines.length ? topPolresLines : ["• Data pelaksanaan per Polres belum tersedia."]),
    "",
    "6️⃣ *Top 10 Polres dengan Update Data Terendah*",
    ...(bottomPolresLines.length ? bottomPolresLines : ["• Data update personil per Polres belum tersedia."]),
    "",
    "7️⃣ *Kesimpulan Strategis*",
    "• Struktur data personil telah terbentuk dan dapat dipantau secara terukur.",
    "• Aktivitas engagement mingguan sudah termonitor dari sisi output konten dan pelaksanaan tugas.",
    "• Data pola waktu dapat digunakan sebagai dasar reminder terjadwal untuk jam partisipasi rendah.",
    "• Rekomendasi: lanjutkan validasi username, penguatan reminder jam rendah, dan monitoring kepatuhan per satuan kerja.",
  ].join("\n");
}


async function formatRekapAllSosmed(
  igNarrative,
  ttNarrative,
  clientName = "DIREKTORAT BINMAS",
  clientId = DITBINMAS_CLIENT_ID,
  options = {}
) {
  const { igRankingData = null, ttRankingData = null } = options || {};
  const now = new Date();
  const hari = hariIndo[now.getDay()];
  const tanggal = now.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const todayKey = now.toDateString();

  const normalizeText = (text) => (text || "").replace(/\r\n/g, "\n");
  const parseNumber = (value) => {
    if (!value) return null;
    const normalized = value.replace(/\./g, "").replace(/,/g, ".");
    const num = Number.parseFloat(normalized);
    return Number.isNaN(num) ? null : num;
  };
  const cleanContentLine = (line) =>
    line ? line.replace(/^\d+\.\s*/, "").trim() : null;

  const indentParagraphs = (paragraphs) =>
    paragraphs
      .map((paragraph) => (paragraph || "").trim())
      .filter(Boolean)
      .flatMap((paragraph, index, array) => {
        const lines = paragraph
          .split("\n")
          .map((line) => `   ${line.trim()}`)
          .filter((line) => line.trim() !== "");
        if (index < array.length - 1) return [...lines, ""];
        return lines;
      });

  const extractLinksFromText = (text) =>
    normalizeText(text)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => /https?:\/\//i.test(line))
      .map((line) => cleanContentLine(line) || line);

  const dedupePreserveOrder = (items) => {
    const seen = new Set();
    return items.filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const extractTiktokTasks = (text) => {
    const normalized = normalizeText(text);
    const sanitized = normalized
      .split("\n")
      .filter((line) => !/performa\s+(tertinggi|terendah)/i.test(line))
      .join("\n");

    const taskSectionMatch = sanitized.match(
      /(?:\*Tugas TikTok\*|Daftar Link Konten TikTok:?)[^\n]*\n([\s\S]*?)(?:\n\s*\n|\n\*|\n#|$)/i
    );

    const taskSection = taskSectionMatch ? taskSectionMatch[1] : sanitized;
    const links = extractLinksFromText(taskSection);

    return dedupePreserveOrder(links);
  };

  const extractRankingSections = (text, metricLabel = "") => {
    const normalized = normalizeText(text);
    const formatLine = (line) => {
      const cleaned = cleanContentLine(line.replace(/^[-•]\s*/, ""));
      if (!cleaned) return null;
      if (/^top 5\b|^bottom 5\b/i.test(cleaned)) return null;
      if (metricLabel && !/likes|komentar/i.test(cleaned))
        return `${cleaned} — ${metricLabel}`;
      return cleaned;
    };

    const readSection = (regex) => {
      const match = normalized.match(regex);
      if (!match) return [];
      return match[1]
        .split("\n")
        .map((line) => line.trim())
        .map(formatLine)
        .filter(Boolean);
    };

    return {
      top: readSection(/Top 5 [^:]*:\s*([\s\S]*?)(?=\n\s*Bottom 5|\n\s*Top 5|$)/i),
      bottom: readSection(/Bottom 5 [^:]*:\s*([\s\S]*?)(?=\n\s*Top 5|\n\s*Bottom 5|$)/i),
    };
  };

  const buildRankingFromData = (entries = [], metricLabel = "") =>
    entries
      .filter((entry) => entry && entry.name)
      .slice(0, 5)
      .map((entry, index) => {
        const score =
          entry.score ?? entry.likes ?? entry.comments ?? entry.value ?? null;
        const metric = metricLabel || entry.metricLabel || "";
        const metricSuffix =
          score == null
            ? metric
              ? ` — ${metric}`
              : ""
            : ` — ${score.toLocaleString("id-ID")}${metric ? ` ${metric}` : ""}`;
        return `${index + 1}. ${entry.name}${metricSuffix}`.trim();
      });

  const buildRankingSectionsFromData = (data = {}, metricLabel = "") => {
    const metric = data?.metricLabel || metricLabel;
    const top = buildRankingFromData(data?.top || [], metric);
    const bottom = buildRankingFromData(data?.bottom || [], metric);
    return { top, bottom };
  };

  const resolveRankingSections = (sections, fallbackData, metricLabel = "") => {
    const hasNarrativeRanking = sections.top.length || sections.bottom.length;
    const fallbackSections = buildRankingSectionsFromData(
      fallbackData,
      metricLabel
    );
    const hasFallbackRanking =
      fallbackSections.top.length || fallbackSections.bottom.length;
    const isTodayRanking =
      fallbackData?.generatedDateKey === todayKey ||
      fallbackData?.generatedDate === tanggal;
    if (hasNarrativeRanking || !isTodayRanking || !hasFallbackRanking)
      return sections;

    return fallbackSections;
  };

  const extractIgData = (text) => {
    const normalized = normalizeText(text);
    const data = {};

    const kontenMatch = normalized.match(/Jumlah konten aktif:\s*([\d.,]+)/i);
    if (kontenMatch) data.contentCount = parseNumber(kontenMatch[1]);

    const likeMatch = normalized.match(
      /Total likes:\s*([\d.,]+)\s+dari\s+([\d.,]+)[^()]*\(([\d.,]+)%/i
    );
    if (likeMatch) {
      data.totalLikes = parseNumber(likeMatch[1]);
      data.totalLikesTarget = parseNumber(likeMatch[2]);
      data.likePercent = parseNumber(likeMatch[3]);
    }

    const targetMatch = normalized.match(
      /Target harian ≥95%:\s*([\d.,]+)\s+likes(?:\s*→\s*kekurangan\s*([\d.,]+))?/i
    );
    if (targetMatch) {
      data.targetLikes = parseNumber(targetMatch[1]);
      data.likeGap = parseNumber(targetMatch[2]);
      data.targetAchieved =
        /target tercapai/i.test(targetMatch[0]) ||
        (data.likeGap != null && data.likeGap <= 0);
    }

    const rataMatch = normalized.match(
      /Rata-rata likes\/konten:\s*([\d.,]+)/i
    );
    if (rataMatch) data.avgLikesPerContent = parseNumber(rataMatch[1]);

    const gapKontenMatch = normalized.match(
      /Rata-rata likes\/konten:[^\n]*;\s*([^\n]+)/i
    );
    if (gapKontenMatch) data.contentGapLine = gapKontenMatch[1].trim();

    const contribMatch = normalized.match(
      /Kontributor likes terbesar:\s*([^\n]+)/i
    );
    if (contribMatch) data.topContributor = contribMatch[1].trim();

    const distribMatch = normalized.match(
      /Distribusi likes per konten:\s*([\s\S]*?)(?:\n#|\nDemikian|$)/i
    );
    if (distribMatch) {
      const distribLines = distribMatch[1]
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      data.topContentLine = distribLines.find((line) => /1\./.test(line)) || "";
      data.otherContentLines = distribLines.slice(1);
    }

    const personilMatch = normalized.match(
      /Personil tercatat:\s*([\d.,]+)\s*→\s*IG\s*([\d.,]+)%\s*\(([\d.,]+)\),\s*TT\s*([\d.,]+)%\s*\(([\d.,]+)\)/i
    );
    if (personilMatch) {
      data.personilTotal = parseNumber(personilMatch[1]);
      data.personilIgPercent = parseNumber(personilMatch[2]);
      data.personilIgCount = parseNumber(personilMatch[3]);
      data.personilTtPercent = parseNumber(personilMatch[4]);
      data.personilTtCount = parseNumber(personilMatch[5]);
    }

    const rataSatkerMatch = normalized.match(
      /Rata-rata satker:\s*IG\s*([\d.,]+)%\s*\(median\s*([\d.,]+)%\),\s*TT\s*([\d.,]+)%\s*\(median\s*([\d.,]+)%\)/i
    );
    if (rataSatkerMatch) {
      data.avgIg = parseNumber(rataSatkerMatch[1]);
      data.medianIg = parseNumber(rataSatkerMatch[2]);
      data.avgTt = parseNumber(rataSatkerMatch[3]);
      data.medianTt = parseNumber(rataSatkerMatch[4]);
    }

    const bestSatkerMatch = normalized.match(
      /Satker dengan capaian ≥90% IG & TT:\s*([^\n.]+)[^\n]*/i
    );
    if (bestSatkerMatch) data.bestSatkers = bestSatkerMatch[1].trim();

    const strongSatkerMatch = normalized.match(
      /Satker di kisaran 80% \(butuh dorongan akhir\):\s*([^\n.]+)[^\n]*/i
    );
    if (strongSatkerMatch) data.strongSatkers = strongSatkerMatch[1].trim();

    const lowSatkerMatch = normalized.match(
      /Satker perlu perhatian \(<10% di kedua kanal\):\s*([^\n.]+)[^\n]*/i
    );
    if (lowSatkerMatch) data.lowSatkers = lowSatkerMatch[1].trim();

    const gapLinesMatch = normalized.match(
      /Gap IG vs TikTok \(≥10 poin[^\n]*\):\s*([\s\S]*?)(?:\n#|\nDemikian|$)/i
    );
    if (gapLinesMatch) {
      data.gapLines = gapLinesMatch[1]
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    }

    const igBacklogMatch = normalized.match(
      /IG belum diisi:\s*([\d.,]+)\s+akun[^≈]*≈([\d.,]+)%: ([^\n)]+)/i
    );
    if (igBacklogMatch) {
      data.igBacklog = parseNumber(igBacklogMatch[1]);
      data.igBacklogTopPercent = parseNumber(igBacklogMatch[2]);
      data.igBacklogTopList = igBacklogMatch[3].trim();
    }

    const ttBacklogMatch = normalized.match(
      /TikTok belum diisi:\s*([\d.,]+)\s+akun[^≈]*≈([\d.,]+)%: ([^\n)]+)/i
    );
    if (ttBacklogMatch) {
      data.ttBacklog = parseNumber(ttBacklogMatch[1]);
      data.ttBacklogTopPercent = parseNumber(ttBacklogMatch[2]);
      data.ttBacklogTopList = ttBacklogMatch[3].trim();
    }

    const projectionMatch = normalized.match(
      /Proyeksi jika 70% Top-10 teratasi:\s*IG\s*→\s*~([\d.,]+)%[,\s]+TT\s*→\s*~([\d.,]+)%/i
    );
    if (projectionMatch) {
      data.projectedIg = parseNumber(projectionMatch[1]);
      data.projectedTt = parseNumber(projectionMatch[2]);
    }

    const topPerfMatch = normalized.match(
      /Top performer rata-rata IG\/TT:\s*([^\n.]+)[^\n]*/i
    );
    if (topPerfMatch) data.topPerformers = topPerfMatch[1].trim();

    const bottomPerfMatch = normalized.match(
      /Bottom performer rata-rata IG\/TT:\s*([^\n.]+)[^\n]*/i
    );
    if (bottomPerfMatch) data.bottomPerformers = bottomPerfMatch[1].trim();

    const notesMatch = normalized.match(/# Catatan Tambahan\s*([\s\S]*?)(?:\nDemikian|$)/i);
    if (notesMatch) {
      data.notes = notesMatch[1]
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" ");
    }

    return data;
  };

  const extractTtData = (text) => {
    const normalized = normalizeText(text);
    const data = {};

    const contentMatch = normalized.match(/Konten dipantau\s*:\s*([\d.,]+)/i);
    if (contentMatch) data.contentCount = parseNumber(contentMatch[1]);

    const interactionMatch = normalized.match(
      /Interaksi aktual\s*:\s*([\d.,]+)\/([\d.,]+)\s*\(([\d.,]+)%/i
    );
    if (interactionMatch) {
      data.totalComments = parseNumber(interactionMatch[1]);
      data.targetComments = parseNumber(interactionMatch[2]);
      data.commentPercent = parseNumber(interactionMatch[3]);
    }

    const hitTargetMatch = normalized.match(
      /Personel mencapai target\s*:\s*([\d.,]+)\/([\d.,]+)\s*\(([\d.,]+)%/i
    );
    if (hitTargetMatch) {
      data.hitTarget = parseNumber(hitTargetMatch[1]);
      data.eligible = parseNumber(hitTargetMatch[2]);
      data.participationPercent = parseNumber(hitTargetMatch[3]);
    }

    const activeMatch = normalized.match(
      /Personel aktif \(≥1 konten\)\s*:\s*([\d.,]+)\/([\d.,]+)\s*\(([\d.,]+)%/i
    );
    if (activeMatch) {
      data.activeCount = parseNumber(activeMatch[1]);
      data.activeEligible = parseNumber(activeMatch[2]);
      data.activationPercent = parseNumber(activeMatch[3]);
    }

    const uniqueMatch = normalized.match(/Partisipan unik\s*:\s*([\d.,]+)/i);
    if (uniqueMatch) data.uniqueParticipants = parseNumber(uniqueMatch[1]);

    const bestContentMatch = normalized.match(
      /Performa tertinggi\s*:\s*([^\n]+)/i
    );
    if (bestContentMatch) data.bestContent = bestContentMatch[1].trim();

    const worstContentMatch = normalized.match(
      /Performa terendah\s*:\s*([^\n]+)/i
    );
    if (worstContentMatch) data.worstContent = worstContentMatch[1].trim();

    const topContribMatch = normalized.match(
      /Penyumbang komentar terbesar\s*:\s*([^\n]+)/i
    );
    if (topContribMatch) data.topContributor = topContribMatch[1].trim();

    const topSatkerMatch = normalized.match(
      /Top satker aktif\s*:\s*([^\n]+)/i
    );
    if (topSatkerMatch) data.topSatkers = topSatkerMatch[1].trim();

    const lowSatkerMatch = normalized.match(
      /Satker perlu perhatian\s*:\s*([^\n]+)/i
    );
    if (lowSatkerMatch) data.lowSatkers = lowSatkerMatch[1].trim();

    const backlogMatch = normalized.match(
      /Personel belum komentar\s*:\s*([\d.,]+)\s*\(prioritas:\s*([^\n]+)\)/i
    );
    if (backlogMatch) {
      data.backlog = parseNumber(backlogMatch[1]);
      data.backlogFocus = backlogMatch[2].trim();
    }

    const missingHandleMatch = normalized.match(
      /Belum input akun TikTok\s*:\s*([\d.,]+)\s*\(sumber utama:\s*([^\n]+)\)/i
    );
    if (missingHandleMatch) {
      data.missingHandle = parseNumber(missingHandleMatch[1]);
      data.missingHandleFocus = missingHandleMatch[2].trim();
    }

    const failureMatch = normalized.match(/⚠️ Data komentar gagal diambil[^\n]*/i);
    if (failureMatch) data.failureNote = failureMatch[0];

    return data;
  };

  const resolvedClientName = (clientName || "DIREKTORAT BINMAS").trim()
    ? (clientName || "DIREKTORAT BINMAS").trim()
    : "DIREKTORAT BINMAS";

  const scopeByClient = (text) => {
    const normalized = normalizeText(text);
    const lines = normalized.split("\n");
    const target = resolvedClientName.toLowerCase();
    const startIdx = lines.findIndex((line) =>
      line.toLowerCase().includes(target)
    );
    if (startIdx === -1) return normalized;
    const clientMarker = /(direktorat|polres|polresta|polrestabes|polda)/i;
    let endIdx = lines.length;
    for (let i = startIdx + 1; i < lines.length; i += 1) {
      const line = lines[i].trim();
      const isNextClient =
        clientMarker.test(line) && !line.toLowerCase().includes(target);
      if (isNextClient) {
        endIdx = i;
        break;
      }
    }
    return lines.slice(startIdx, endIdx).join("\n").trim();
  };

  const scopedIgNarrative = scopeByClient(igNarrative);
  const scopedTtNarrative = scopeByClient(ttNarrative);

  const ig = extractIgData(scopedIgNarrative);
  const tt = extractTtData(scopedTtNarrative);

  const igRankingSections = resolveRankingSections(
    extractRankingSections(scopedIgNarrative, "likes"),
    igRankingData,
    "likes"
  );
  const ttRankingSections = resolveRankingSections(
    extractRankingSections(scopedTtNarrative, "komentar"),
    ttRankingData,
    "komentar"
  );

  const formatUploadTime = (date) => {
    if (!date) return null;
    try {
      const parsed = new Date(date);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed
        .toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Asia/Jakarta",
        })
        .replace(/\./g, ":");
    } catch {
      return null;
    }
  };

  const buildContentLinkList = async () => {
    const linkLines = [];
    let igPosts = [];
    let ttPosts = [];
    let clientType = null;
    let tiktokUsername = null;

    const normalizedClientId = (clientId || resolvedClientName)
      .toString()
      .trim();

    try {
      const client = await findClientById(normalizedClientId);
      clientType = client?.client_type?.toLowerCase() || null;
      tiktokUsername = (client?.client_tiktok || "").replace(/^@/, "");
    } catch {
      clientType = null;
    }

    const shouldUseDailyContent =
      clientType === "direktorat" || isDitbinmas(normalizedClientId);

    if (shouldUseDailyContent) {
      let igExclusionSet = new Set();
      let ttExclusionSet = new Set();
      try {
        [igExclusionSet, ttExclusionSet] = await Promise.all([
          getTaskPostExclusionSet({ clientId: normalizedClientId, platform: "instagram" }),
          getTaskPostExclusionSet({ clientId: normalizedClientId, platform: "tiktok" }),
        ]);
      } catch {
        igExclusionSet = new Set();
        ttExclusionSet = new Set();
      }

      try {
        igPosts = ((await getInstaPostsTodayByClient(normalizedClientId)) || []).filter(
          (post) => !igExclusionSet.has(String(post?.shortcode || "").trim())
        );
      } catch {
        igPosts = [];
      }
      try {
        ttPosts = ((await getTiktokPostsTodayByClient(normalizedClientId)) || []).filter(
          (post) => !ttExclusionSet.has(String(post?.video_id || "").trim())
        );
      } catch {
        ttPosts = [];
      }
    }

    const igLinesFromPosts = igPosts
      .filter((post) => post?.shortcode)
      .map((post) => {
        const uploadTime = formatUploadTime(post?.created_at);
        const uploadLabel = uploadTime ? ` — ${uploadTime} WIB` : "";
        return `https://www.instagram.com/p/${post.shortcode}${uploadLabel}`;
      });

    const ttLinesFromPosts = ttPosts
      .filter((post) => post?.video_id)
      .map((post) => {
        const link = tiktokUsername
          ? `https://www.tiktok.com/@${tiktokUsername}/video/${post.video_id}`
          : `https://www.tiktok.com/video/${post.video_id}`;
        const uploadTime = formatUploadTime(post?.created_at);
        const uploadLabel = uploadTime ? ` — ${uploadTime} WIB` : "";
        return `${link}${uploadLabel}`;
      });

    let igLines = igLinesFromPosts;
    if (!igLines.length) {
      igLines = [ig.topContentLine, ...(ig.otherContentLines || [])]
        .map((line) => cleanContentLine(line))
        .filter(Boolean);
    }

    if (!igLines.length) igLines.push(...extractLinksFromText(scopedIgNarrative));

    if (!igLines.length) {
      const rankedIgLines = dedupePreserveOrder([
        ...igRankingSections.top,
        ...igRankingSections.bottom,
      ]);
      igLines.push(...rankedIgLines);
    }

    let ttLines = ttLinesFromPosts;
    if (!ttLines.length) ttLines = extractTiktokTasks(scopedTtNarrative);

    if (!ttLines.length) {
      const rankedTtLines = dedupePreserveOrder([
        ...ttRankingSections.top,
        ...ttRankingSections.bottom,
      ]);
      ttLines.push(...rankedTtLines);
    }

    if (igLines.length)
      igLines.forEach((line, index) =>
        linkLines.push(`- IG ${index + 1}. ${line}`)
      );
    if (ttLines.length)
      ttLines.forEach((line, index) =>
        linkLines.push(`- TikTok ${index + 1}. ${line}`)
      );

    if (!linkLines.length) {
      linkLines.push("Tidak ada tugas hari ini.");
    }

    const hasDailyContent = igLinesFromPosts.length > 0 || ttLinesFromPosts.length > 0;
    return { linkLines, hasDailyContent };
  };

  const header = `*Laporan Harian Engagement – ${hari}, ${tanggal}*`;
  const linkHeader = "List Link Tugas Instagram dan Tiktok Hari ini :";
  const { linkLines, hasDailyContent } = await buildContentLinkList();

  const igParagraphs = [];
  const ttParagraphs = [];

  const igNarrativeText = normalizeText(scopedIgNarrative).trim();
  const ttNarrativeText = normalizeText(scopedTtNarrative).trim();

  const narrativeHasRanking = (text) => /Top 5|Bottom 5/i.test(text || "");
  const ttNarrativeHasRanking = narrativeHasRanking(ttNarrativeText);
  let resolvedTtRankingSections = ttRankingSections;

  if (
    !(ttRankingSections.top.length || ttRankingSections.bottom.length) &&
    ttNarrativeHasRanking
  ) {
    const fallbackSections = buildRankingSectionsFromData(
      ttRankingData,
      "komentar"
    );
    if (fallbackSections.top.length || fallbackSections.bottom.length)
      resolvedTtRankingSections = fallbackSections;
  }

  const appendRankingBlock = (paragraphs, sections, metricLabel) => {
    if (!(sections.top.length || sections.bottom.length)) return;
    const block = [
      `Top 5 ${metricLabel}:`,
      ...sections.top.map((line) => `- ${line}`),
      "",
      `Bottom 5 ${metricLabel}:`,
      ...sections.bottom.map((line) => `- ${line}`),
    ]
      .filter(Boolean)
      .join("\n");

    if (block.trim()) paragraphs.push(block);
  };

  if (igNarrativeText) {
    igParagraphs.push(igNarrativeText);
    if (!narrativeHasRanking(igNarrativeText))
      appendRankingBlock(igParagraphs, igRankingSections, "Likes");
  } else {
    appendRankingBlock(igParagraphs, igRankingSections, "Likes");
  }

  const ttHasRanking =
    resolvedTtRankingSections.top.length ||
    resolvedTtRankingSections.bottom.length;

  if (ttHasRanking) {
    ttParagraphs.push(`🎵 TikTok (${resolvedClientName.toUpperCase()})`);
    appendRankingBlock(ttParagraphs, resolvedTtRankingSections, "Komentar");
  } else if (ttNarrativeText && !ttNarrativeHasRanking) {
    ttParagraphs.push(ttNarrativeText);
  } else if (ttNarrativeHasRanking) {
    ttParagraphs.push("Tidak ada data peringkat komentar TikTok.");
  }

  if (!hasDailyContent && !igParagraphs.length && !ttParagraphs.length) {
    const noTaskNote = "Tidak ada tugas hari ini.";
    igParagraphs.push(noTaskNote);
    ttParagraphs.push(noTaskNote);
  }

  const buildClosing = () => {
    const igBacklog = ig.igBacklog ?? 0;
    const ttBacklog = ttHasRanking ? tt.backlog ?? 0 : 0;
    const igGood = ig.targetAchieved === true || (ig.likePercent ?? 0) >= 95;
    const ttGood = ttHasRanking ? (tt.commentPercent ?? 0) >= 80 : null;
    const backlogHigh = igBacklog > 30 || (ttHasRanking && ttBacklog > 30);
    const backlogModerate =
      igBacklog > 10 || (ttHasRanking && ttBacklog > 10);
    const likeGapHigh = (ig.likeGap ?? 0) > 0;

    if (igGood && ttHasRanking && ttGood && !backlogModerate)
      return `Capaian IG & TikTok sudah sesuai target; terima kasih atas sinergi hangat seluruh pembina di jajaran ${resolvedClientName}.`;
    if (!ttHasRanking && igGood && !backlogModerate)
      return `Capaian IG sudah sesuai target; terima kasih atas sinergi hangat seluruh pembina di jajaran ${resolvedClientName}.`;
    if (backlogHigh)
      return "Backlog personel masih tinggi; dukungan ekstra dari para pembina untuk satker prioritas akan sangat berarti.";
    if (likeGapHigh || (ttHasRanking && ttGood === false))
      return "Target harian belum sepenuhnya terpenuhi; kolaborasi halus antar satker akan membantu menutup gap likes dan komentar.";
    return `Progres bergerak positif; mari terus kawal pengejaran target harian dengan ritme nyaman ala ${resolvedClientName}.`;
  };

  const sections = [];
  sections.push(
    ["1. 📸 *Instagram*", ...indentParagraphs(igParagraphs)].join("\n")
  );
  sections.push(
    ["2. 🎵 *TikTok*", ...indentParagraphs(ttParagraphs)].join("\n")
  );

  const closingLine = buildClosing();

  return [
    header,
    "",
    `*${resolvedClientName}*`,
    "",
    linkHeader,
    ...linkLines,
    "",
    ...sections,
    "",
    closingLine,
  ]
    .filter((segment) => typeof segment === "string" && segment.trim() !== "")
    .join("\n")
    .trim();
}

async function performAction(
  action,
  clientId,
  waClient,
  chatId,
  roleFlag,
  userClientId,
  context = {},
  fallbackOptions = {}
) {
  let msg = "";
  const { fallbackClients, fallbackContext } = fallbackOptions;
  const fallbackPayload = fallbackClients
    ? { fallbackClients, fallbackContext, reportClient: waClient }
    : {};
  const userClient = userClientId ? await findClientById(userClientId) : null;
  const userType = userClient?.client_type?.toLowerCase();
  const attendanceClientId = String(clientId || userClientId || "").toUpperCase();
  const normalizedRoleFlag = (roleFlag || attendanceClientId).toLowerCase();
  switch (action) {
    case "1": {
      msg = await formatRekapUserData(clientId, roleFlag, {
        menuName: context.menuName,
        chakranarayanaSelectedGroup: context.chakranarayanaSelectedGroup,
      });
      break;
    }
    case "2": {
      msg = await formatExecutiveSummary(clientId, roleFlag, {
        ...context.executiveSummaryOptions,
        menuName: context.menuName,
        chakranarayanaSelectedGroup: context.chakranarayanaSelectedGroup,
      });
      break;
    }
    case "4": {
      try {
        const { filePath } = await saveSatkerUpdateMatrixExcel({
          clientId,
          roleFlag,
          username: context.username,
        });
        const buffer = await readFile(filePath);
        await sendWAFile(
          waClient,
          buffer,
          basename(filePath),
          chatId,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        await unlink(filePath);
        msg = "✅ File Excel dikirim.";
      } catch (error) {
        console.error("Gagal membuat rekap matriks update satker:", error);
        msg =
          error?.message &&
          (error.message.includes("direktorat") ||
            error.message.includes("Client tidak ditemukan"))
            ? error.message
            : "❌ Gagal membuat rekap matriks update satker.";
      }
      break;
    }
      case "5":
        msg = await absensiLikesDitbinmas(attendanceClientId);
        break;
      case "6":
        {
        const recapPeriodOptions = context?.recapPeriodOptions || {};
        const detailMode = context?.detailMode || "all";
        const { operationalDate } = getOperationalAttendanceDate();
        const startDate = recapPeriodOptions.startYmd || operationalDate;
        const endDate = recapPeriodOptions.endYmd || operationalDate;
        const shortcodes = await getStandardInstagramTaskShortcodesByRange(attendanceClientId, {
          startDate,
          endDate,
        });
        msg = await absensiLikesDitbinmasSimple(attendanceClientId, {
          shortcodes: shortcodes
            .map((shortcode) => String(shortcode || "").trim())
            .filter(Boolean),
          periodLabel: recapPeriodOptions.periodLabel,
          detailMode,
        });
        }
        break;
      case "7": {
        const opts = { mode: "all", roleFlag: normalizedRoleFlag };
        msg = await absensiLikes(attendanceClientId, opts);
        break;
      }
      case "8":
        msg = await absensiKomentarTiktok(attendanceClientId, normalizedRoleFlag);
        break;
      case "9":
        msg = await absensiKomentarDitbinmasSimple(attendanceClientId);
        break;
      case "10":
        msg = await absensiKomentarDitbinmas(attendanceClientId);
        break;
    case "11": {
      msg = await absensiRegistrasiDashboardDirektorat(clientId);
      break;
    }
    case "12": {
      const { fetchAndStoreInstaContent } = await import("../fetchpost/instaFetchPost.js");
      const { handleFetchLikesInstagram } = await import("../fetchengagement/fetchLikesInstagram.js");
      const { rekapLikesIG } = await import("../fetchabsensi/insta/absensiLikesInsta.js");
      const targetId = (clientId || DITBINMAS_CLIENT_ID).toUpperCase();
      const targetClient = await findClientById(targetId);
      const targetLabel = targetClient?.nama
        ? `${formatNama(targetClient.nama)} (${targetId})`
        : targetId;
      await fetchAndStoreInstaContent([
        "shortcode",
        "caption",
        "like_count",
        "timestamp",
      ], waClient, chatId, targetId);
      await handleFetchLikesInstagram(null, null, targetId);
      const rekapMsg = await rekapLikesIG(targetId);
      msg =
        rekapMsg ||
        `Belum ada konten IG pada akun Official ${targetLabel} hari ini.`;
      break;
    }
    case "13": {
      const { handleFetchLikesInstagram } = await import("../fetchengagement/fetchLikesInstagram.js");
      const targetId = (clientId || DITBINMAS_CLIENT_ID).toUpperCase();
      const targetClient = await findClientById(targetId);
      const targetLabel = targetClient?.nama
        ? `${formatNama(targetClient.nama)} (${targetId})`
        : targetId;
      await handleFetchLikesInstagram(waClient, chatId, targetId);
      msg = `✅ Selesai fetch likes Instagram ${targetLabel}.`;
      break;
    }
    case "14": {
      const { fetchAndStoreTiktokContent } = await import("../fetchpost/tiktokFetchPost.js");
      const { handleFetchKomentarTiktokBatch } = await import("../fetchengagement/fetchCommentTiktok.js");
      const targetId = (clientId || DITBINMAS_CLIENT_ID).toUpperCase();
      const targetClient = await findClientById(targetId);
      const targetLabel = targetClient?.nama
        ? `${formatNama(targetClient.nama)} (${targetId})`
        : targetId;
      await fetchAndStoreTiktokContent(targetId, waClient, chatId);
      await handleFetchKomentarTiktokBatch(waClient, chatId, targetId);
      const rekapTiktok = await absensiKomentarDitbinmasReport(
        userType === "org" ? { clientFilter: userClientId } : {}
      );
      msg =
        rekapTiktok ||
        `Tidak ada konten TikTok untuk ${targetLabel} hari ini.`;
      break;
    }
    case "15": {
      const { handleFetchKomentarTiktokBatch } = await import("../fetchengagement/fetchCommentTiktok.js");
      const targetId = (clientId || DITBINMAS_CLIENT_ID).toUpperCase();
      const targetClient = await findClientById(targetId);
      const targetLabel = targetClient?.nama
        ? `${formatNama(targetClient.nama)} (${targetId})`
        : targetId;
      await handleFetchKomentarTiktokBatch(waClient, chatId, targetId);
      msg = `✅ Selesai fetch komentar TikTok ${targetLabel}.`;
      break;
    }
    case "16": {
      const { fetchAndStoreInstaContent } = await import("../fetchpost/instaFetchPost.js");
      const { handleFetchLikesInstagram } = await import("../fetchengagement/fetchLikesInstagram.js");
      const { fetchAndStoreTiktokContent } = await import("../fetchpost/tiktokFetchPost.js");
      const { handleFetchKomentarTiktokBatch } = await import("../fetchengagement/fetchCommentTiktok.js");
      const { generateSosmedTaskMessage } = await import("../fetchabsensi/sosmedTask.js");

      const targetId = (clientId || "").toUpperCase();
      const fetchErrors = [];

      let previousIgShortcodes = [];
      let previousTiktokVideoIds = [];
      try {
        previousIgShortcodes = await getShortcodesTodayByClient(targetId);
      } catch (err) {
        console.error("Error reading previous Instagram shortcodes:", err);
        previousIgShortcodes = [];
      }
      try {
        previousTiktokVideoIds = await getVideoIdsTodayByClient(targetId);
      } catch (err) {
        console.error("Error reading previous TikTok video IDs:", err);
        previousTiktokVideoIds = [];
      }

      try {
        await fetchAndStoreInstaContent(
          ["shortcode", "caption", "like_count", "timestamp"],
          waClient,
          chatId,
          targetId
        );
      } catch (err) {
        console.error("Error fetching Instagram content:", err);
        fetchErrors.push("Instagram content");
      }
      try {
        await handleFetchLikesInstagram(null, null, targetId);
      } catch (err) {
        console.error("Error fetching Instagram likes:", err);
        fetchErrors.push("Instagram likes");
      }
      try {
        await fetchAndStoreTiktokContent(targetId, waClient, chatId);
      } catch (err) {
        console.error("Error fetching TikTok content:", err);
        fetchErrors.push("TikTok content");
      }
      try {
        await handleFetchKomentarTiktokBatch(null, null, targetId);
      } catch (err) {
        console.error("Error fetching TikTok comments:", err);
        fetchErrors.push("TikTok comments");
      }
      const previousState = {
        igShortcodes: Array.isArray(previousIgShortcodes)
          ? previousIgShortcodes
          : [],
        tiktokVideoIds: Array.isArray(previousTiktokVideoIds)
          ? previousTiktokVideoIds
          : [],
      };
      try {
        ({ text: msg } = await generateSosmedTaskMessage(targetId, {
          skipTiktokFetch: true,
          skipLikesFetch: true,
          previousState,
        }));
      } catch (err) {
        console.error("Error generating sosmed task message:", err);
        msg = "Gagal membuat pesan tugas.";
        fetchErrors.push("task message");
      }
      if (fetchErrors.length) {
        msg = `${msg}\n\n⚠️ Sebagian data gagal diambil.`.trim();
      }
      break;
    }
    case "54": {
      const { generateSosmedTaskMessage } = await import("../fetchabsensi/sosmedTask.js");
      const targetId = (clientId || DITBINMAS_CLIENT_ID).toUpperCase();
      const { text: taskMessage } = await generateSosmedTaskMessage(targetId, {
        skipTiktokFetch: true,
        skipLikesFetch: true,
      });
      const tanggalPengambilan = getJakartaDayDateLabel();
      msg =
        `*Header Pesan Tugas*
` +
        `Pesan list tugas Instagram & TikTok untuk *${targetId}*
` +
        `Hari/Tanggal pengambilan tugas: ${tanggalPengambilan}

` +
        `${taskMessage}`;
      break;
    }
    case "17": {
        const { text, filename, narrative, textBelum, filenameBelum } = await lapharDitbinmas();
        const dirPath = "laphar";
        await mkdir(dirPath, { recursive: true });
        if (narrative) {
          await sendMenuMessage(waClient, chatId, narrative.trim(), fallbackPayload);
        }
        if (text && filename) {
          const buffer = Buffer.from(text, "utf-8");
          const filePath = join(dirPath, filename);
          await writeFile(filePath, buffer);
          await sendWAFile(waClient, buffer, filename, chatId, "text/plain");
        }
        if (textBelum && filenameBelum) {
          const bufferBelum = Buffer.from(textBelum, "utf-8");
          const filePathBelum = join(dirPath, filenameBelum);
          await writeFile(filePathBelum, bufferBelum);
          await sendWAFile(waClient, bufferBelum, filenameBelum, chatId, "text/plain");
        }
        const recapData = await collectLikesRecap(clientId);
        if (recapData.shortcodes.length) {
          const excelPath = await saveLikesRecapExcel(recapData, clientId);
          const bufferExcel = await readFile(excelPath);
          await sendWAFile(waClient, bufferExcel, basename(excelPath), chatId, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
          await unlink(excelPath);
        }
        return;
      }
      case "18": {
        const { text, filename, narrative, textBelum, filenameBelum } = await lapharTiktokDitbinmas();
        const dirPath = "laphar";
        await mkdir(dirPath, { recursive: true });
        if (narrative) {
          await sendMenuMessage(waClient, chatId, narrative.trim(), fallbackPayload);
        }
        if (text && filename) {
          const buffer = Buffer.from(text, "utf-8");
          const filePath = join(dirPath, filename);
          await writeFile(filePath, buffer);
          await sendWAFile(waClient, buffer, filename, chatId, "text/plain");
        }
        if (textBelum && filenameBelum) {
          const bufferBelum = Buffer.from(textBelum, "utf-8");
          const filePathBelum = join(dirPath, filenameBelum);
          await writeFile(filePathBelum, bufferBelum);
          await sendWAFile(waClient, bufferBelum, filenameBelum, chatId, "text/plain");
        }
        const recapData = await collectKomentarRecap(clientId);
        if (recapData.videoIds.length) {
          const excelPath = await saveCommentRecapExcel(recapData, clientId);
          const bufferExcel = await readFile(excelPath);
          await sendWAFile(waClient, bufferExcel, basename(excelPath), chatId, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
          await unlink(excelPath);
        }
        return;
      }
      case "19": {
        let filePath;
        try {
          const data = await collectLikesRecap(
            clientId,
            buildChakranarayanaMenu5ScopeOptions(clientId, context)
          );
          if (typeof data === "string") {
            msg = data;
            break;
          }
          if (!data.shortcodes.length) {
            msg = `Tidak ada konten IG untuk *${clientId}* hari ini.`;
            break;
          }
          try {
            filePath = await saveLikesRecapExcel(data, clientId);
          } catch (error) {
            console.error("Gagal membuat rekap likes Instagram (Excel):", error);
            msg =
              "❌ Gagal membuat rekap likes Instagram (Excel). Workbook kosong atau data tidak valid.";
            break;
          }
          let buffer;
          try {
            buffer = await readFile(filePath);
          } catch (error) {
            console.error("Gagal membaca file rekap likes Instagram (Excel):", error);
            msg = "❌ Gagal membaca file rekap likes Instagram (Excel).";
            break;
          }
          try {
            await sendWAFile(
              waClient,
              buffer,
              basename(filePath),
              chatId,
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
            msg = "✅ File Excel dikirim.";
          } catch (error) {
            console.error("Gagal mengirim rekap likes Instagram (Excel):", error);
            msg =
              "❌ Gagal mengirim rekap likes Instagram (Excel). Silakan coba lagi.";
          }
        } finally {
          if (filePath) {
            try {
              await stat(filePath);
              await unlink(filePath);
            } catch (error) {
              if (error?.code !== "ENOENT") {
                console.error("Gagal menghapus file sementara:", error);
              }
            }
          }
        }
        break;
      }
      case "20": {
        let filePath;
        try {
          const recapPeriodOptions = context?.recapPeriodOptions || {};
          const periodStart = recapPeriodOptions.startYmd || getJakartaYmd();
          const periodEnd = recapPeriodOptions.endYmd || getJakartaYmd();
          const posts = await getTiktokPostsByDateRange(clientId, periodStart, periodEnd);
          const recapData = await collectKomentarRecap(
            clientId,
            {
              ...buildChakranarayanaMenu5ScopeOptions(clientId, context),
              posts,
            }
          );
          if (!recapData?.videoIds?.length) {
            msg = `Tidak ada konten TikTok untuk *${clientId}* hari ini.`;
            break;
          }
          try {
            filePath = await saveCommentRecapExcel(recapData, clientId);
            const buffer = await readFile(filePath);
            await sendWAFile(
              waClient,
              buffer,
              basename(filePath),
              chatId,
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
            msg = "✅ File Excel dikirim.";
          } catch (error) {
            console.error("Gagal mengirim rekap komentar TikTok (Excel):", error);
            msg =
              "❌ Gagal mengirim rekap komentar TikTok (Excel). Silakan coba lagi.";
          }
        } catch (error) {
          console.error("Gagal menyiapkan rekap komentar TikTok:", error);
          msg =
            "❌ Gagal mengambil data komentar TikTok untuk rekap. Silakan coba lagi.";
        } finally {
          if (filePath) {
            try {
              await unlink(filePath);
            } catch (err) {
              console.error("Gagal menghapus file sementara:", err);
            }
          }
        }
        break;
      }
      case "21": {
        const dirPath = "laphar";
        const tempFiles = [];
        try {
          await mkdir(dirPath, { recursive: true });
          const [ig, tt] = await Promise.all([
            lapharDitbinmas(clientId),
            lapharTiktokDitbinmas(clientId),
          ]);
          const client = await findClientById(clientId);
          const clientName = client?.nama || clientId;
          const narrative = await formatRekapAllSosmed(
            ig.narrative,
            tt.narrative,
            clientName,
            clientId,
            {
              igRankingData: ig.rankingData,
              ttRankingData: tt.rankingData,
            }
          );
          if (narrative) {
            await sendMenuMessage(waClient, chatId, narrative, fallbackPayload);
          }
          if (ig.text && ig.filename) {
            const buffer = Buffer.from(ig.text, "utf-8");
            const filePath = join(dirPath, ig.filename);
            tempFiles.push(filePath);
            await writeFile(filePath, buffer);
            await sendWAFile(waClient, buffer, ig.filename, chatId, "text/plain");
          }
          const igRecap = await collectLikesRecap(clientId);
          if (typeof igRecap === "string") {
            await sendMenuMessage(waClient, chatId, igRecap, fallbackPayload);
          } else if (igRecap?.shortcodes?.length) {
            const excelPath = await saveLikesRecapExcel(igRecap, clientId);
            tempFiles.push(excelPath);
            const bufferExcel = await readFile(excelPath);
            await sendWAFile(
              waClient,
              bufferExcel,
              basename(excelPath),
              chatId,
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
          }
          if (tt.text && tt.filename) {
            const buffer = Buffer.from(tt.text, "utf-8");
            const filePath = join(dirPath, tt.filename);
            tempFiles.push(filePath);
            await writeFile(filePath, buffer);
            await sendWAFile(waClient, buffer, tt.filename, chatId, "text/plain");
          }
          let ttRecap;
          try {
            ttRecap = await collectKomentarRecap(clientId);
          } catch (error) {
            console.error("Gagal menyiapkan rekap komentar TikTok:", error);
            await sendMenuMessage(
              waClient,
              chatId,
              "❌ Gagal menyiapkan rekap komentar TikTok. Silakan coba lagi.",
              fallbackPayload
            );
            return;
          }
          if (ttRecap?.videoIds?.length) {
            const excelPath = await saveCommentRecapExcel(ttRecap, clientId);
            tempFiles.push(excelPath);
            const bufferExcel = await readFile(excelPath);
            await sendWAFile(
              waClient,
              bufferExcel,
              basename(excelPath),
              chatId,
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
          }
        } catch (error) {
          console.error("Gagal memproses menu 21:", error);
          await sendMenuMessage(
            waClient,
            chatId,
            "❌ Terjadi kendala saat memproses menu 21. Silakan coba lagi nanti. Kembali ke menu utama.",
            fallbackPayload
          );
        } finally {
          await Promise.all(
            tempFiles.map(async (filePath) => {
              try {
                await unlink(filePath);
              } catch (err) {
                console.error("Gagal menghapus file sementara:", err);
              }
            })
          );
        }
        return;
      }
      case "22": {
        let filePath;
        const period = context?.period || "today";
        const periodEntry = Object.values(ENGAGEMENT_RECAP_PERIOD_MAP).find(
          (entry) => entry.period === period
        );
        const periodLabel = periodEntry?.label || period;

        try {
          const { filePath: generatedPath } = await saveEngagementRankingExcel({
            clientId,
            roleFlag,
            period,
            menuName: context?.menuName,
            chakranarayanaSelectedGroup: context?.chakranarayanaSelectedGroup,
          });
          filePath = generatedPath;
          const buffer = await readFile(filePath);
          await sendWAFile(
            waClient,
            buffer,
            basename(filePath),
            chatId,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          );
          msg = `✅ File Excel rekap ranking engagement (${periodLabel}) dikirim.`;
        } catch (error) {
          console.error("Gagal membuat rekap ranking engagement:", error);
          if (
            error?.message &&
            (error.message.includes("direktorat") ||
              error.message.includes("Client tidak ditemukan") ||
              error.message.includes("Tidak ada data"))
          ) {
            msg = error.message;
          } else {
            msg = `❌ Gagal membuat rekap ranking engagement (${periodLabel}).`;
          }
        } finally {
          if (filePath) {
            try {
              await unlink(filePath);
            } catch (err) {
              console.error("Gagal menghapus file sementara:", err);
            }
          }
        }
        break;
      }
      case "23": {
        let filePath;
        try {
          filePath = await saveWeeklyLikesRecapExcel(clientId);
          if (!filePath) {
            msg = "Tidak ada data.";
            break;
          }
          const buffer = await readFile(filePath);
          await sendWAFile(waClient, buffer, basename(filePath), chatId, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
          msg = "✅ File Excel dikirim.";
        } catch (error) {
          console.error("Gagal mengirim file Excel:", error);
          msg = "❌ Gagal mengirim file Excel.";
        } finally {
          if (filePath) {
            try {
              await unlink(filePath);
            } catch (err) {
              console.error("Gagal menghapus file sementara:", err);
            }
          }
        }
        break;
      }
      case "24": {
        let filePath;
        try {
          filePath = await saveWeeklyCommentRecapExcel(clientId);
          if (!filePath) {
            msg = "Tidak ada data.";
            break;
          }
          const buffer = await readFile(filePath);
          await sendWAFile(waClient, buffer, basename(filePath), chatId, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
          msg = "✅ File Excel dikirim.";
        } catch (error) {
          console.error("Gagal mengirim file Excel:", error);
          msg = "❌ Gagal mengirim file Excel.";
        } finally {
          if (filePath) {
            try {
              await unlink(filePath);
            } catch (err) {
              console.error("Gagal menghapus file sementara:", err);
            }
          }
        }
        break;
      }
      case "25": {
        try {
          msg = await generateWeeklyTiktokHighLowReport(clientId, { roleFlag });
        } catch (error) {
          console.error("Gagal membuat laporan TikTok Top and Bottom:", error);
          msg =
            error?.message &&
            (error.message.includes("data") ||
              error.message.includes("clientId"))
              ? error.message
              : "❌ Gagal membuat laporan TikTok Top and Bottom.";
        }
        break;
      }
      case "26": {
        if (!isDitbinmas(clientId) || !isDitbinmas(roleFlag)) {
          msg =
            "Menu Instagram Top and Bottom hanya tersedia untuk pengguna DITBINMAS.";
          break;
        }
        try {
          msg = await generateWeeklyInstagramHighLowReport(clientId, { roleFlag });
        } catch (error) {
          console.error("Gagal membuat laporan Instagram Top and Bottom:", error);
          msg =
            error?.message &&
            (error.message.includes("data") ||
              error.message.includes("clientId") ||
              error.message.includes("DITBINMAS"))
              ? error.message
              : "❌ Gagal membuat laporan Instagram Top and Bottom.";
        }
        break;
      }
      case "27": {
        let filePath;
        try {
          filePath = await saveMonthlyLikesRecapExcel(clientId);
          if (!filePath) {
            msg = "Tidak ada data.";
            break;
          }
          const buffer = await readFile(filePath);
          await sendWAFile(waClient, buffer, basename(filePath), chatId, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
          msg = "✅ File Excel dikirim.";
        } catch (error) {
          console.error("Gagal mengirim file Excel:", error);
          msg = "❌ Gagal mengirim file Excel.";
        } finally {
          if (filePath) {
            try {
              await unlink(filePath);
            } catch (err) {
              console.error("Gagal menghapus file sementara:", err);
            }
          }
        }
        break;
      }
      case "28": {
        const recapPeriodOptions = context?.recapPeriodOptions || {};
        const shortcodes = await getStandardInstagramTaskShortcodesByRange(clientId, {
          startDate: recapPeriodOptions.startYmd || null,
          endDate: recapPeriodOptions.endYmd || null,
        });
        const data = await collectLikesRecap(
          clientId,
          {
            ...buildChakranarayanaMenu5ScopeOptions(clientId, context),
            shortcodes,
          }
        );
        if (typeof data === "string") {
          msg = data;
          break;
        }
        if (!data.shortcodes.length) {
          msg = `Tidak ada konten IG untuk *${clientId}* hari ini.`;
          break;
        }
        const filePath = await saveLikesRecapPerContentExcel(data, clientId);
        const buffer = await readFile(filePath);
        await sendWAFile(
          waClient,
          buffer,
          basename(filePath),
          chatId,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        await unlink(filePath);
        msg = "✅ File Excel dikirim.";
        break;
      }
      case "29": {
        const recapData = await collectKomentarRecap(clientId);
        if (!recapData?.videoIds?.length) {
          msg = `Tidak ada konten TikTok untuk *${clientId}* hari ini.`;
          break;
        }
        const filePath = await saveCommentRecapPerContentExcel(recapData, clientId);
        const buffer = await readFile(filePath);
        await sendWAFile(
          waClient,
          buffer,
          basename(filePath),
          chatId,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        await unlink(filePath);
        msg = "✅ File Excel dikirim.";
        break;
      }
      case "30": {
        try {
          const period = context?.period || "today";
          msg = await generateKasatkerReport({
            clientId,
            roleFlag,
            period,
          });
        } catch (error) {
          console.error("Gagal membuat Laporan Kasatker:", error);
          const suffix = context?.period ? ` (${context.period})` : "";
          msg =
            error?.message &&
            (error.message.includes("direktorat") ||
              error.message.includes("Client tidak ditemukan") ||
              error.message.includes("Tidak ada data"))
              ? error.message
              : `❌ Gagal membuat Laporan Kasatker${suffix}.`;
        }
        break;
      }
      case "31": {
        try {
          msg = await formatTopPersonnelRanking(clientId, roleFlag);
        } catch (error) {
          console.error(
            "Gagal membuat ranking like/komentar personel:",
            error
          );
          msg = "❌ Gagal membuat ranking like/komentar personel.";
        }
        break;
      }
      case "32": {
        try {
          msg = await formatTopPolresRanking(clientId, roleFlag);
        } catch (error) {
          console.error(
            "Gagal membuat ranking like/komentar polres:",
            error
          );
          msg = "❌ Gagal membuat ranking like/komentar polres.";
        }
        break;
      }
      case "34": {
        try {
          const period = context?.period || "daily";
          msg = await generateKasatBinmasLikesRecap({ period });
        } catch (error) {
          console.error(
            "Gagal membuat rekap Absensi Likes Kasat Binmas:",
            error
          );
          const suffix = context?.period ? ` (${context.period})` : "";
          msg =
            error?.message &&
            (error.message.includes("direktorat") ||
              error.message.includes("Client tidak ditemukan") ||
              error.message.includes("Tidak ada data"))
              ? error.message
              : `❌ Gagal membuat rekap Absensi Likes Kasat Binmas${suffix}.`;
        }
        break;
      }
      case "35": {
        try {
          const period = context?.period || "daily";
          const referenceDate = context?.referenceDate;
          const normalizedReferenceDate =
            referenceDate !== undefined && referenceDate !== null
              ? resolveBaseDate(referenceDate)
              : undefined;
          msg = await generateKasatBinmasTiktokCommentRecap({
            period,
            referenceDate: normalizedReferenceDate,
          });
        } catch (error) {
          console.error(
            "Gagal membuat rekap Absensi Komentar TikTok Kasat Binmas:",
            error,
          );
          const suffix = context?.period ? ` (${context.period})` : "";
          msg =
            error?.message &&
            (error.message.includes("direktorat") ||
              error.message.includes("Client tidak ditemukan") ||
              error.message.includes("Tidak ada data"))
              ? error.message
              : `❌ Gagal membuat rekap Absensi Komentar TikTok Kasat Binmas${suffix}.`;
        }
        break;
      }
      case "44": {
        try {
          const period = context?.period || "daily";
          const referenceDate = context?.referenceDate;
          const normalizedReferenceDate =
            referenceDate !== undefined && referenceDate !== null
              ? resolveBaseDate(referenceDate)
              : undefined;
          await sendKasatBinmasLikesRecapExcel({
            period,
            referenceDate: normalizedReferenceDate,
            chatId,
            waClient,
          });
        } catch (error) {
          console.error(
            "[submenu 44] Gagal mengirim rekap Likes Kasat Binmas (Excel) via performAction:",
            error
          );
          msg = "❌ Gagal mengirim rekap Likes Kasat Binmas (Excel).";
        }
        break;
      }
      case "42": {
        try {
          const client = await findClientById(clientId);
          const { filePath } = await generateInstagramAllDataRecap({
            clientId,
            roleFlag,
            clientName: client?.nama || clientId,
          });
          const buffer = await readFile(filePath);
          await sendWAFile(
            waClient,
            buffer,
            basename(filePath),
            chatId,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          );
          await unlink(filePath);
          msg = "✅ File Excel Instagram all data dikirim.";
        } catch (error) {
          console.error("Gagal membuat rekap Instagram all data:", error);
          msg =
            error?.message &&
            (error.message.includes("Tidak ada data") ||
              error.message.includes("Client tidak ditemukan"))
              ? error.message
              : "❌ Gagal membuat rekap Instagram all data.";
        }
        break;
      }
      case "43": {
        try {
          const client = await findClientById(clientId);
          const { filePath } = await generateTiktokAllDataRecap({
            clientId,
            roleFlag,
            clientName: client?.nama || clientId,
          });
          const buffer = await readFile(filePath);
          await sendWAFile(
            waClient,
            buffer,
            basename(filePath),
            chatId,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          );
          await unlink(filePath);
          msg = "✅ File Excel TikTok all data dikirim.";
        } catch (error) {
          console.error("Gagal membuat rekap TikTok all data:", error);
          msg =
            error?.message &&
            (error.message.includes("Tidak ada data") ||
              error.message.includes("Client tidak ditemukan"))
              ? error.message
              : "❌ Gagal membuat rekap TikTok all data.";
        }
        break;
      }
      default:
        msg = "Menu tidak dikenal.";
  }
  const normalizedMsg = typeof msg === "string" ? msg.trim() : "";
  if (!normalizedMsg) {
    return;
  }

  await sendMenuMessage(waClient, chatId, normalizedMsg, fallbackPayload);
  if (action === "12" || action === "14" || action === "16") {
    if (Array.isArray(fallbackClients) && fallbackClients.length) {
      await sendWithClientFallback({
        chatId: dirRequestGroup,
        message: normalizedMsg,
        clients: fallbackClients,
        reportClient: waClient,
        reportContext: fallbackContext,
      });
    } else {
      await safeSendMessage(waClient, dirRequestGroup, normalizedMsg);
    }
  }
}

export async function runDirRequestAction({
  action,
  clientId,
  chatId,
  roleFlag,
  userClientId,
  waClient,
  context,
  fallbackClients,
  fallbackContext,
} = {}) {
  if (!action) {
    throw new Error("Action menu wajib diisi");
  }
  if (!waClient) {
    throw new Error("Instans WA client wajib diisi untuk menjalankan menu");
  }
  if (!chatId) {
    throw new Error("chatId penerima wajib diisi untuk menjalankan menu");
  }

  const normalizedAction = String(action).trim();
  const normalizedClient = (clientId || "").trim();
  const resolvedFallbackContext = fallbackContext || {
    action: normalizedAction,
    clientId: normalizedClient,
    chatId,
  };

  return performAction(
    normalizedAction,
    normalizedClient,
    waClient,
    chatId,
    roleFlag,
    userClientId,
    context,
    {
      fallbackClients,
      fallbackContext: resolvedFallbackContext,
    }
  );
}

export const dirRequestHandlers = {
  async chakranarayana_choose_submenu(session, chatId, text, waClient) {
    const choice = String(text || "").trim().toLowerCase();
    if (!choice) {
      await waClient.sendMessage(
        chatId,
        "*Menu Chakranarayana*\n1️⃣ Direktorat\n2️⃣ Jajaran\n\nBalas *angka* submenu atau ketik *batal* untuk keluar."
      );
      return;
    }

    if (choice === "batal") {
      session.menu = null;
      session.step = null;
      await waClient.sendMessage(chatId, "✅ Menu chakranarayana ditutup.");
      return;
    }

    const selectedGroup = choice === "1" ? "direktorat" : choice === "2" ? "jajaran" : null;
    if (!selectedGroup) {
      await waClient.sendMessage(chatId, "❌ Pilihan submenu tidak valid.");
      return;
    }

    const menuCodes = await resolveChakranarayanaMenuCodes(session, selectedGroup);
    const orderedMenuCodes = [...menuCodes];
    session.chakranarayanaMenuMap = orderedMenuCodes;
    session.chakranarayanaSelectedGroup = selectedGroup;
    session.allowedDirrequestMenuChoices = orderedMenuCodes;
    session.step = "chakranarayana_choose_menu";
    const groupLabel = selectedGroup === "direktorat" ? "Direktorat" : "Jajaran";
    await waClient.sendMessage(
      chatId,
      getChakranarayanaMenuText(selectedGroup, groupLabel, orderedMenuCodes)
    );
  },

  async chakranarayana_choose_menu(session, chatId, text, waClient) {
    const choice = String(text || "").trim().toLowerCase();
    if (choice === "batal") {
      session.step = "chakranarayana_choose_submenu";
      await dirRequestHandlers.chakranarayana_choose_submenu(session, chatId, "", waClient);
      return;
    }

    const menuMap = Array.isArray(session.chakranarayanaMenuMap)
      ? session.chakranarayanaMenuMap
      : [];
    const selectedIndex = Number(choice);
    if (!Number.isInteger(selectedIndex) || selectedIndex < 1 || selectedIndex > menuMap.length) {
      await waClient.sendMessage(chatId, "❌ Pilihan menu tidak valid. Ketik angka sesuai daftar.");
      return;
    }

    const mappedMenuChoice = menuMap[selectedIndex - 1];
    session.step = "choose_menu";
    await dirRequestHandlers.choose_menu(session, chatId, mappedMenuChoice, waClient);
  },

  async choose_dash_user(session, chatId, _text, waClient) {
    const dashUsers = session.dash_users || [];
    const chosen = dashUsers[0];
    if (!chosen) {
      await waClient.sendMessage(
        chatId,
        "❌ Data dashboard user tidak ditemukan untuk akses dirrequest."
      );
      return;
    }
    session.role = chosen.role;
    session.username = chosen.username || session.username;
    delete session.dash_users;
    session.step = "choose_client";
    await dirRequestHandlers.choose_client(session, chatId, "", waClient);
  },

  async main(session, chatId, _text, waClient) {
    if (session.menu === "chakranarayana") {
      const chakranarayanaMenuText = getChakranarayanaActiveMenuText(session);
      if (chakranarayanaMenuText) {
        await waClient.sendMessage(chatId, chakranarayanaMenuText);
        session.step = "chakranarayana_choose_menu";
      } else {
        session.step = "chakranarayana_choose_submenu";
        await dirRequestHandlers.chakranarayana_choose_submenu(session, chatId, "", waClient);
      }
      return;
    }

    const availableClients = session.dir_clients || [];
    if (!session.selectedClientId && availableClients.length) {
      session.step = "choose_client";
      await dirRequestHandlers.choose_client(session, chatId, "", waClient);
      return;
    }

    const selectedClientId =
      (session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID).toUpperCase();
    session.client_ids = [selectedClientId];
    session.selectedClientId = selectedClientId;
    session.dir_client_id = selectedClientId;

    const clientChanged = session.clientNameId !== selectedClientId;
    if (!session.clientName || clientChanged) {
      try {
        const client = await findClientById(selectedClientId);
        session.clientName = client?.nama || selectedClientId;
      } catch {
        session.clientName = selectedClientId;
      }
      session.clientNameId = selectedClientId;
    }

    const clientName = session.clientName;
    const menu =
      `Client: *${clientName}*\n` +
      "┏━━━━━━━━━━━━ *MENU DIRREQUEST* ━━━━━━━━━━━━\n" +
        "📊 *Rekap Data*\n" +
        "1️⃣ Rekap Kelengkapan data Personil Satker.\n" +
        "2️⃣ Executive Summary Narative CICERO (minggu sebelumnya)\n" +
        "3️⃣ Rekap data personil\n" +
        "4️⃣ Rekap Matriks Update Satker\n\n" +
        "📅 *Absensi*\n" +
        "5️⃣ Absensi like Direktorat/Bidang\n" +
        "6️⃣ Absensi Instagram Direktorat/Bidang Simple\n" +
        "7️⃣ Absensi like Instagram\n" +
        "8️⃣ Absensi komentar TikTok\n" +
        "9️⃣ Absensi Tiktok Direktorat/Bidang Simple\n" +
        "1️⃣0️⃣ Absensi komentar Direktorat/Bidang\n" +
        "1️⃣1️⃣ Absensi user web dashboard Direktorat/Bidang\n" +
        "4️⃣8️⃣ Absensi Instagram Jajaran\n" +
        "4️⃣9️⃣ Absensi TikTok Jajaran\n" +
        "5️⃣5️⃣ Rekap Instagram Jajaran Perpost\n" +
        "5️⃣6️⃣ Rekap TikTok Jajaran Perpost\n\n" +
        "📥 *Pengambilan Data*\n" +
        "1️⃣2️⃣ Ambil konten & like Instagram\n" +
        "1️⃣3️⃣ Ambil like Instagram saja\n" +
        "1️⃣4️⃣ Ambil konten & komentar TikTok\n" +
        "1️⃣5️⃣ Ambil komentar TikTok saja\n" +
        "1️⃣6️⃣ Ambil semua sosmed & buat tugas\n\n" +
        "4️⃣6️⃣ Input IG post manual\n" +
        "4️⃣7️⃣ Input TikTok post manual\n" +
        "5️⃣0️⃣ Fetch likes IG manual (hari ini)\n" +
        "5️⃣1️⃣ Fetch komentar TikTok manual (hari ini)\n" +
        "5️⃣2️⃣ Fetch komentar IG manual (hari ini)\n" +
        "5️⃣3️⃣ Hapus post tugas (auto IG/TikTok)\n\n" +
        "📝 *Laporan*\n" +
        "1️⃣7️⃣ Laporan harian Instagram Direktorat/Bidang\n" +
        "1️⃣8️⃣ Laporan harian TikTok Direktorat/Bidang\n" +
        "1️⃣9️⃣ Rekap like Instagram (Excel)\n" +
        "2️⃣0️⃣ Rekap komentar TikTok (Excel)\n" +
        "2️⃣1️⃣ Rekap gabungan semua sosmed\n" +
        "2️⃣2️⃣ Rekap ranking engagement jajaran\n\n" +
        "📆 *Laporan Mingguan*\n" +
        "2️⃣3️⃣ Rekap file Instagram mingguan\n" +
        "2️⃣4️⃣ Rekap file Tiktok mingguan\n" +
        "2️⃣5️⃣ TikTok Top and Bottom (Top 5 & Bottom 5)\n" +
        "2️⃣6️⃣ Instagram Top and Bottom (Top 5 & Bottom 5)\n\n" +
        "🗓️ *Laporan Bulanan*\n" +
        "2️⃣7️⃣ Rekap file Instagram bulanan\n" +
        "2️⃣8️⃣ Rekap like Instagram per konten (Excel)\n" +
        "2️⃣9️⃣ Rekap komentar TikTok per konten (Excel)\n\n" +
        "📦 *Rekap All Data*\n" +
        "4️⃣2️⃣ Instagram all data\n" +
        "4️⃣3️⃣ TikTok all data\n\n" +
        "🛡️ *Monitoring Kasatker*\n" +
        "3️⃣0️⃣ Laporan Kasatker\n" +
        "3️⃣1️⃣ Top ranking like/komentar personel\n" +
        "3️⃣2️⃣ Top ranking like/komentar polres tertinggi\n" +
        "3️⃣3️⃣ Absensi Kasatker\n" +
        "3️⃣4️⃣ Absensi likes Instagram Kasat Binmas\n" +
        "3️⃣5️⃣ Absensi komentar TikTok Kasat Binmas\n" +
        "4️⃣4️⃣ Rekap likes Instagram Kasat Binmas (Excel)\n" +
        "4️⃣5️⃣ Rekap komentar TikTok Kasat Binmas (Excel)\n\n" +
        "📡 *Monitoring Satbinmas Official*\n" +
        "3️⃣6️⃣ Ambil metadata harian IG Satbinmas Official\n" +
        "3️⃣7️⃣ Ambil konten harian IG Satbinmas Official (semua akun ORG)\n" +
        "3️⃣8️⃣ Sinkronisasi secUid TikTok Satbinmas Official\n" +
        "3️⃣9️⃣ Ambil konten harian TikTok Satbinmas Official (semua akun ORG)\n" +
        "4️⃣0️⃣ Rekap Instagram Satbinmas Official\n" +
        "4️⃣1️⃣ Rekap TikTok Satbinmas Official\n\n" +
        "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n" +
        "Ketik *angka* menu atau *batal* untuk keluar.";
    await waClient.sendMessage(chatId, menu);
    session.step = "choose_menu";
  },

  async choose_client(session, chatId, text, waClient) {
    // If selected_client_id is already set (operator/super admin direct access)
    // and no dir_clients list is provided, proceed directly to main menu
    if (session.selected_client_id && (!session.dir_clients || session.dir_clients.length === 0)) {
      const clientId = session.selected_client_id.toUpperCase();
      session.selectedClientId = clientId;
      session.dir_client_id = clientId;
      session.client_ids = [clientId];
      try {
        const client = await findClientById(clientId);
        session.clientName = client?.nama || clientId;
      } catch (error) {
        // Log error but continue with client ID as fallback name
        console.error(`Failed to fetch client details for ${clientId}:`, error.message);
        session.clientName = clientId;
      }
      session.clientNameId = clientId;
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    const clients = session.dir_clients || [];
    const choiceList = clients
      .map((client, idx) => {
        const numberLabel = DIGIT_EMOJI[String(idx + 1)] || `${idx + 1}`;
        const nameLabel = client.nama ? ` - ${client.nama}` : "";
        return `${numberLabel} ${client.client_id}${nameLabel}`;
      })
      .join("\n");

    const prompt =
      "Pilih *Client ID* Direktorat aktif sebelum membuka menu dirrequest:\n" +
      (choiceList || "(Belum ada data client Direktorat aktif)") +
      "\n\nBalas *angka* atau *Client ID* yang tertera, atau ketik *batal* untuk keluar.";

    const input = (text || "").trim();

    if (!clients.length) {
      session.selectedClientId = DITBINMAS_CLIENT_ID;
      session.dir_client_id = DITBINMAS_CLIENT_ID;
      session.client_ids = [DITBINMAS_CLIENT_ID];
      try {
        const client = await findClientById(DITBINMAS_CLIENT_ID);
        session.clientName = client?.nama || DITBINMAS_CLIENT_ID;
      } catch {
        session.clientName = DITBINMAS_CLIENT_ID;
      }
      session.clientNameId = DITBINMAS_CLIENT_ID;
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    if (!input) {
      await waClient.sendMessage(chatId, prompt);
      return;
    }

    if (input.toLowerCase() === "batal") {
      session.menu = null;
      session.step = null;
      await waClient.sendMessage(chatId, "✅ Menu dirrequest ditutup.");
      return;
    }

    const normalizedInput = input.toUpperCase();
    let selectedClient = null;

    if (/^\d+$/.test(normalizedInput)) {
      const index = Number(normalizedInput) - 1;
      if (clients[index]) {
        selectedClient = clients[index];
      }
    }

    if (!selectedClient) {
      selectedClient = clients.find(
        (client) => client.client_id?.toUpperCase() === normalizedInput
      );
    }

    if (!selectedClient) {
      await waClient.sendMessage(
        chatId,
        "❌ Pilihan client tidak valid. Silakan pilih sesuai daftar."
      );
      await waClient.sendMessage(chatId, prompt);
      return;
    }

    const normalizedClientId = (selectedClient.client_id || "").toUpperCase();
    session.selectedClientId = normalizedClientId;
    session.dir_client_id = normalizedClientId;
    session.client_ids = [normalizedClientId];
    session.clientName = selectedClient.nama || normalizedClientId;
    session.clientNameId = normalizedClientId;
    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async choose_menu(session, chatId, text, waClient) {
    const choice = text.trim();

    if (
      Array.isArray(session.allowedDirrequestMenuChoices) &&
      session.allowedDirrequestMenuChoices.length > 0 &&
      !session.allowedDirrequestMenuChoices.includes(choice)
    ) {
      await waClient.sendMessage(chatId, "Pilihan tidak valid untuk akses menu ini.");
      return;
    }

    if (
        ![
          "1",
          "2",
          "3",
          "4",
          "5",
          "6",
          "7",
          "8",
          "9",
          "10",
          "11",
          "12",
          "13",
          "14",
          "15",
          "16",
          "17",
          "18",
          "19",
          "20",
          "21",
          "22",
          "23",
          "24",
          "25",
          "26",
          "27",
          "28",
          "29",
          "30",
          "31",
          "32",
          "33",
          "34",
          "35",
          "36",
          "37",
          "38",
          "39",
          "40",
          "41",
          "42",
          "43",
          "44",
          "45",
          "46",
          "47",
          "48",
          "49",
          "50",
          "51",
          "52",
          "53",
          "54",
          "55",
          "56",
        ].includes(choice)
    ) {
      await waClient.sendMessage(chatId, "Pilihan tidak valid. Ketik angka menu.");
      return;
    }
    const userClientId = session.selectedClientId;
    if (!userClientId) {
      await waClient.sendMessage(chatId, "Client belum dipilih.");
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }
    const taskClientId = session.dir_client_id || userClientId;

    if (choice === "2") {
      session.step = "choose_executive_summary_period";
      await waClient.sendMessage(chatId, EXECUTIVE_SUMMARY_MENU_TEXT);
      return;
    }

    if (choice === "3") {
      session.step = "choose_rekap_personil_category";
      await waClient.sendMessage(chatId, REKAP_PERSONIL_MENU_TEXT);
      return;
    }

    if (
      choice === "6" &&
      session.menu === "chakranarayana" &&
      session.chakranarayanaSelectedGroup === "direktorat"
    ) {
      session.step = "choose_chakranarayana_directorate_instagram_simple_type";
      await waClient.sendMessage(chatId, CHAKRANARAYANA_DIRECTORATE_INSTAGRAM_SIMPLE_MENU_TEXT);
      return;
    }

    if (choice === "22") {
      session.step = "choose_engagement_recap_period";
      await waClient.sendMessage(chatId, ENGAGEMENT_RECAP_MENU_TEXT);
      return;
    }

    if (choice === "30") {
      session.step = "choose_kasatker_report_period";
      await waClient.sendMessage(chatId, KASATKER_REPORT_MENU_TEXT);
      return;
    }

    if (choice === "33") {
      session.step = "choose_kasatker_attendance";
      await dirRequestHandlers.choose_kasatker_attendance(session, chatId, "", waClient);
      return;
    }

    if (choice === "34") {
      session.step = "choose_kasat_binmas_likes_period";
      await waClient.sendMessage(chatId, KASAT_BINMAS_LIKES_MENU_TEXT);
      return;
    }

    if (choice === "35") {
      session.step = "choose_kasat_binmas_tiktok_comment_period";
      await waClient.sendMessage(chatId, KASAT_BINMAS_TIKTOK_COMMENT_MENU_TEXT);
      return;
    }

    if (choice === "44") {
      session.step = "choose_kasat_binmas_likes_excel_period";
      await waClient.sendMessage(chatId, KASAT_BINMAS_LIKES_EXCEL_MENU_TEXT);
      return;
    }

    if (choice === "45") {
      session.step = "choose_kasat_binmas_tiktok_comment_excel_period";
      await waClient.sendMessage(chatId, KASAT_BINMAS_TIKTOK_COMMENT_EXCEL_MENU_TEXT);
      return;
    }

    if (choice === "46") {
      if (session.menu === "chakranarayana") {
        session.step = "dirrequest_input_post_manual_prompt";
        await waClient.sendMessage(chatId, DIRREQUEST_INPUT_POST_MANUAL_PROMPT);
        return;
      }
      session.step = "dirrequest_input_ig_manual_prompt";
      await waClient.sendMessage(chatId, DIRREQUEST_INPUT_IG_MANUAL_PROMPT);
      return;
    }

    if (choice === "47") {
      session.step = "dirrequest_input_tiktok_manual_prompt";
      await waClient.sendMessage(chatId, DIRREQUEST_INPUT_TIKTOK_MANUAL_PROMPT);
      return;
    }

    if (choice === "50") {
      const { handleFetchLikesInstagram } = await import("../fetchengagement/fetchLikesInstagram.js");
      const targetClientId = session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID;
      await waClient.sendMessage(chatId, DIRREQUEST_FETCH_IG_MANUAL_LIKES_TEXT);
      await handleFetchLikesInstagram(waClient, chatId, targetClientId, {
        sourceType: "manual_input",
        enrichComments: false,
      });
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    if (choice === "51") {
      const { handleFetchKomentarTiktokBatch } = await import("../fetchengagement/fetchCommentTiktok.js");
      const targetClientId = session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID;
      await waClient.sendMessage(chatId, DIRREQUEST_FETCH_TIKTOK_MANUAL_COMMENTS_TEXT);
      await handleFetchKomentarTiktokBatch(waClient, chatId, targetClientId, {
        sourceType: "manual_input",
      });
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    if (choice === "52") {
      const { handleFetchKomentarInstagram } = await import("../fetchengagement/fetchCommentInstagram.js");
      const targetClientId = session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID;
      await waClient.sendMessage(chatId, DIRREQUEST_FETCH_IG_MANUAL_COMMENTS_TEXT);
      await handleFetchKomentarInstagram(waClient, chatId, targetClientId, {
        sourceType: "manual_input",
        commentsPageDelayMs: 1000,
      });
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    if (choice === "53") {
      session.step = "dirrequest_delete_task_post_prompt";
      await waClient.sendMessage(chatId, DIRREQUEST_DELETE_TASK_POST_PROMPT);
      return;
    }

    if (choice === "48") {
      session.step = "absensi_instagram_jajaran";
      await dirRequestHandlers.absensi_instagram_jajaran(session, chatId, "", waClient);
      return;
    }

    if (choice === "49") {
      session.step = "absensi_tiktok_jajaran";
      await dirRequestHandlers.absensi_tiktok_jajaran(session, chatId, "", waClient);
      return;
    }

    if (choice === "55") {
      session.perpostPlatform = "instagram";
      session.step = "choose_jajaran_perpost_date_option";
      await waClient.sendMessage(chatId, PERPOST_DATE_MENU_TEXT);
      return;
    }

    if (choice === "56") {
      session.perpostPlatform = "tiktok";
      session.step = "choose_jajaran_perpost_date_option";
      await waClient.sendMessage(chatId, PERPOST_DATE_MENU_TEXT);
      return;
    }

    if (choice === "36") {
      session.step = "fetch_satbinmas_official_metadata";
      await dirRequestHandlers.fetch_satbinmas_official_metadata(
        session,
        chatId,
        "",
        waClient
      );
      return;
    }

    if (choice === "37") {
      session.step = "fetch_satbinmas_official_media";
      await dirRequestHandlers.fetch_satbinmas_official_media(
        session,
        chatId,
        "",
        waClient
      );
      return;
    }

    if (choice === "38") {
      session.step = "resolve_satbinmas_official_tiktok_secuid";
      await dirRequestHandlers.resolve_satbinmas_official_tiktok_secuid(
        session,
        chatId,
        "",
        waClient
      );
      return;
    }

    if (choice === "39") {
      session.step = "fetch_satbinmas_official_tiktok_media";
      await dirRequestHandlers.fetch_satbinmas_official_tiktok_media(
        session,
        chatId,
        "",
        waClient
      );
      return;
    }

    if (choice === "40") {
      session.step = "choose_satbinmas_official_instagram_recap_period";
      await waClient.sendMessage(chatId, SATBINMAS_OFFICIAL_INSTAGRAM_RECAP_MENU_TEXT);
      return;
    }

    if (choice === "41") {
      session.step = "choose_satbinmas_official_tiktok_recap_period";
      await waClient.sendMessage(chatId, SATBINMAS_OFFICIAL_TIKTOK_RECAP_MENU_TEXT);
      return;
    }

    if (
      session.menu === "chakranarayana" &&
      session.chakranarayanaSelectedGroup === "direktorat" &&
      ["28", "20"].includes(choice)
    ) {
      session.pendingChakranarayanaRecapAction = choice;
      session.step = "choose_chakranarayana_directorate_recap_period";
      await waClient.sendMessage(chatId, CHAKRANARAYANA_DIRECTORATE_RECAP_PERIOD_MENU_TEXT);
      return;
    }

    await performAction(
      choice,
      taskClientId,
      waClient,
      chatId,
      session.role,
      userClientId,
      {
        username: session.username || session.user?.username,
        menuName: session.menu,
        chakranarayanaSelectedGroup: session.chakranarayanaSelectedGroup,
      }
    );
    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async choose_chakranarayana_directorate_instagram_simple_type(session, chatId, text, waClient) {
    const choice = String(text || "").trim().toLowerCase();

    if (!choice) {
      await waClient.sendMessage(chatId, CHAKRANARAYANA_DIRECTORATE_INSTAGRAM_SIMPLE_MENU_TEXT);
      return;
    }

    if (choice === "batal" || choice === "back") {
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    const detailMode = CHAKRANARAYANA_DIRECTORATE_INSTAGRAM_SIMPLE_ACTION_MAP[choice];
    if (!detailMode) {
      await waClient.sendMessage(chatId, "❌ Pilihan jenis laporan tidak valid.");
      await waClient.sendMessage(chatId, CHAKRANARAYANA_DIRECTORATE_INSTAGRAM_SIMPLE_MENU_TEXT);
      return;
    }

    try {
      const targetClientId =
        session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID;
      await performAction(
        "6",
        targetClientId,
        waClient,
        chatId,
        session.role,
        session.selectedClientId,
        {
          username: session.username || session.user?.username,
          menuName: session.menu,
          chakranarayanaSelectedGroup: session.chakranarayanaSelectedGroup,
          detailMode,
        }
      );
    } catch (error) {
      await waClient.sendMessage(chatId, error?.message || "❌ Gagal memproses jenis laporan.");
    }

    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },


  async choose_chakranarayana_directorate_recap_period(session, chatId, text, waClient) {
    const choice = String(text || "").trim().toLowerCase();

    if (!choice) {
      await waClient.sendMessage(chatId, CHAKRANARAYANA_DIRECTORATE_RECAP_PERIOD_MENU_TEXT);
      return;
    }

    if (choice === "batal" || choice === "back") {
      delete session.pendingChakranarayanaRecapAction;
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    const selectedPeriod = EXECUTIVE_SUMMARY_PERIOD_MAP[choice];
    if (!selectedPeriod) {
      await waClient.sendMessage(chatId, "❌ Pilihan periode tidak valid.");
      await waClient.sendMessage(chatId, CHAKRANARAYANA_DIRECTORATE_RECAP_PERIOD_MENU_TEXT);
      return;
    }

    if (selectedPeriod.period === "selected_month") {
      session.chakranarayanaRecapPeriod = selectedPeriod.period;
      session.step = "input_chakranarayana_directorate_recap_month";
      await waClient.sendMessage(chatId, CHAKRANARAYANA_DIRECTORATE_RECAP_MONTH_PROMPT);
      return;
    }

    if (selectedPeriod.period === "selected_date") {
      session.chakranarayanaRecapPeriod = selectedPeriod.period;
      session.step = "input_chakranarayana_directorate_recap_date";
      await waClient.sendMessage(chatId, CHAKRANARAYANA_DIRECTORATE_RECAP_DATE_PROMPT);
      return;
    }

    try {
      const recapPeriodOptions = resolveChakranarayanaRecapWindow(selectedPeriod.period);
      const targetClientId =
        session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID;
      const action = session.pendingChakranarayanaRecapAction || "28";
      await performAction(
        action,
        targetClientId,
        waClient,
        chatId,
        session.role,
        session.selectedClientId,
        {
          username: session.username || session.user?.username,
          menuName: session.menu,
          chakranarayanaSelectedGroup: session.chakranarayanaSelectedGroup,
          recapPeriodOptions,
        }
      );
    } catch (error) {
      await waClient.sendMessage(chatId, error?.message || "❌ Gagal memproses pilihan periode.");
    }

    delete session.pendingChakranarayanaRecapAction;
    delete session.chakranarayanaRecapPeriod;
    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async input_chakranarayana_directorate_recap_month(session, chatId, text, waClient) {
    const input = String(text || "").trim();

    if (!input) {
      await waClient.sendMessage(chatId, CHAKRANARAYANA_DIRECTORATE_RECAP_MONTH_PROMPT);
      return;
    }

    if (input.toLowerCase() === "batal" || input.toLowerCase() === "back") {
      session.step = "choose_chakranarayana_directorate_recap_period";
      await waClient.sendMessage(chatId, CHAKRANARAYANA_DIRECTORATE_RECAP_PERIOD_MENU_TEXT);
      return;
    }

    try {
      const recapPeriodOptions = resolveChakranarayanaRecapWindow("selected_month", input);
      const targetClientId =
        session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID;
      const action = session.pendingChakranarayanaRecapAction || "28";
      await performAction(
        action,
        targetClientId,
        waClient,
        chatId,
        session.role,
        session.selectedClientId,
        {
          username: session.username || session.user?.username,
          menuName: session.menu,
          chakranarayanaSelectedGroup: session.chakranarayanaSelectedGroup,
          recapPeriodOptions,
        }
      );

      delete session.pendingChakranarayanaRecapAction;
      delete session.chakranarayanaRecapPeriod;
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
    } catch (error) {
      await waClient.sendMessage(chatId, error?.message || "❌ Format bulan tidak valid.");
      await waClient.sendMessage(chatId, CHAKRANARAYANA_DIRECTORATE_RECAP_MONTH_PROMPT);
    }
  },

  async input_chakranarayana_directorate_recap_date(session, chatId, text, waClient) {
    const input = String(text || "").trim();

    if (!input) {
      await waClient.sendMessage(chatId, CHAKRANARAYANA_DIRECTORATE_RECAP_DATE_PROMPT);
      return;
    }

    if (input.toLowerCase() === "batal" || input.toLowerCase() === "back") {
      session.step = "choose_chakranarayana_directorate_recap_period";
      await waClient.sendMessage(chatId, CHAKRANARAYANA_DIRECTORATE_RECAP_PERIOD_MENU_TEXT);
      return;
    }

    try {
      const recapPeriodOptions = resolveChakranarayanaRecapWindow("selected_date", input);
      const targetClientId =
        session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID;
      const action = session.pendingChakranarayanaRecapAction || "28";
      await performAction(
        action,
        targetClientId,
        waClient,
        chatId,
        session.role,
        session.selectedClientId,
        {
          username: session.username || session.user?.username,
          menuName: session.menu,
          chakranarayanaSelectedGroup: session.chakranarayanaSelectedGroup,
          recapPeriodOptions,
        }
      );

      delete session.pendingChakranarayanaRecapAction;
      delete session.chakranarayanaRecapPeriod;
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
    } catch (error) {
      await waClient.sendMessage(chatId, error?.message || "❌ Format tanggal tidak valid.");
      await waClient.sendMessage(chatId, CHAKRANARAYANA_DIRECTORATE_RECAP_DATE_PROMPT);
    }
  },


  async choose_executive_summary_period(session, chatId, text, waClient) {
    const choice = String(text || "").trim().toLowerCase();

    if (!choice) {
      await waClient.sendMessage(chatId, EXECUTIVE_SUMMARY_MENU_TEXT);
      return;
    }

    if (choice === "batal") {
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    const selectedPeriod = EXECUTIVE_SUMMARY_PERIOD_MAP[choice];
    if (!selectedPeriod) {
      await waClient.sendMessage(chatId, "❌ Pilihan periode tidak valid.");
      await waClient.sendMessage(chatId, EXECUTIVE_SUMMARY_MENU_TEXT);
      return;
    }

    if (selectedPeriod.period === "selected_month") {
      session.executiveSummaryPeriod = selectedPeriod.period;
      session.step = "input_executive_summary_month";
      await waClient.sendMessage(chatId, EXECUTIVE_SUMMARY_MONTH_PROMPT);
      return;
    }

    if (selectedPeriod.period === "selected_date") {
      session.executiveSummaryPeriod = selectedPeriod.period;
      session.step = "input_executive_summary_date";
      await waClient.sendMessage(chatId, EXECUTIVE_SUMMARY_DATE_PROMPT);
      return;
    }

    const targetClientId = session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID;
    await performAction(
      "2",
      targetClientId,
      waClient,
      chatId,
      session.role,
      session.selectedClientId,
      {
        username: session.username || session.user?.username,
        menuName: session.menu,
        chakranarayanaSelectedGroup: session.chakranarayanaSelectedGroup,
        executiveSummaryOptions: { period: selectedPeriod.period },
      }
    );
    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async input_executive_summary_month(session, chatId, text, waClient) {
    const input = String(text || "").trim();

    if (!input) {
      await waClient.sendMessage(chatId, EXECUTIVE_SUMMARY_MONTH_PROMPT);
      return;
    }

    if (input.toLowerCase() === "batal") {
      session.step = "choose_executive_summary_period";
      await waClient.sendMessage(chatId, EXECUTIVE_SUMMARY_MENU_TEXT);
      return;
    }

    if (!isValidYm(input)) {
      await waClient.sendMessage(chatId, "❌ Format bulan tidak valid. Gunakan format YYYY-MM.");
      await waClient.sendMessage(chatId, EXECUTIVE_SUMMARY_MONTH_PROMPT);
      return;
    }

    const [, monthText] = input.split("-");
    const month = Number(monthText);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      await waClient.sendMessage(chatId, "❌ Bulan tidak valid. Gunakan rentang bulan 01 sampai 12.");
      await waClient.sendMessage(chatId, EXECUTIVE_SUMMARY_MONTH_PROMPT);
      return;
    }

    const targetClientId = session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID;
    await performAction(
      "2",
      targetClientId,
      waClient,
      chatId,
      session.role,
      session.selectedClientId,
      {
        username: session.username || session.user?.username,
        menuName: session.menu,
        chakranarayanaSelectedGroup: session.chakranarayanaSelectedGroup,
        executiveSummaryOptions: { period: "selected_month", value: input },
      }
    );

    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async input_executive_summary_date(session, chatId, text, waClient) {
    const input = String(text || "").trim();

    if (!input) {
      await waClient.sendMessage(chatId, EXECUTIVE_SUMMARY_DATE_PROMPT);
      return;
    }

    if (input.toLowerCase() === "batal") {
      session.step = "choose_executive_summary_period";
      await waClient.sendMessage(chatId, EXECUTIVE_SUMMARY_MENU_TEXT);
      return;
    }

    if (!isValidYmd(input)) {
      await waClient.sendMessage(chatId, "❌ Format tanggal tidak valid. Gunakan format YYYY-MM-DD.");
      await waClient.sendMessage(chatId, EXECUTIVE_SUMMARY_DATE_PROMPT);
      return;
    }

    const targetClientId = session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID;
    await performAction(
      "2",
      targetClientId,
      waClient,
      chatId,
      session.role,
      session.selectedClientId,
      {
        username: session.username || session.user?.username,
        menuName: session.menu,
        chakranarayanaSelectedGroup: session.chakranarayanaSelectedGroup,
        executiveSummaryOptions: { period: "selected_date", value: input },
      }
    );

    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async dirrequest_input_post_manual_prompt(session, chatId, text, waClient) {
    const input = (text || "").trim();
    if (!input) {
      await waClient.sendMessage(chatId, DIRREQUEST_INPUT_POST_MANUAL_PROMPT);
      return;
    }

    if (input.toLowerCase() === "batal") {
      await waClient.sendMessage(chatId, "✅ Input manual post dibatalkan.");
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    const targetClientId = session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID;
    const { instagramLinks, tiktokInputs, ignoredUrlCount } = extractManualPostTargets(input);

    if (!instagramLinks.length && !tiktokInputs.length && /^\d{8,}$/.test(input)) {
      tiktokInputs.push(input);
    }

    if (!instagramLinks.length && !tiktokInputs.length) {
      await waClient.sendMessage(
        chatId,
        "❌ Link tidak dikenali. Kirim link Instagram/TikTok yang valid (termasuk shortlink TikTok) atau ketik *batal*."
      );
      await waClient.sendMessage(chatId, DIRREQUEST_INPUT_POST_MANUAL_PROMPT);
      return;
    }

    const igSuccess = [];
    const igFailed = [];
    const ttSuccess = [];
    const ttFailed = [];
    const totalTargets = instagramLinks.length + tiktokInputs.length;
    let processedCount = 0;

    await waClient.sendMessage(
      chatId,
      [
        "⏳ Proses input manual multi-link dimulai.",
        `Total target : ${totalTargets}`,
        `Instagram : ${instagramLinks.length}`,
        `TikTok : ${tiktokInputs.length}`,
      ].join("\n")
    );

    if (instagramLinks.length) {
      const { handleFetchLikesInstagram } = await import("../fetchengagement/fetchLikesInstagram.js");
      for (const [index, instagramLink] of instagramLinks.entries()) {
        await waClient.sendMessage(
          chatId,
          `⏳ [Instagram ${index + 1}/${instagramLinks.length}] Memproses link:\n${instagramLink}`
        );
        try {
          const result = await fetchSinglePostKhusus(instagramLink, targetClientId);
          if (result?.shortcode) {
            await handleFetchLikesInstagram(null, null, targetClientId, {
              shortcodes: [result.shortcode],
              sourceType: "manual_input",
              enrichComments: false,
            });
          }
          igSuccess.push(
            [
              `- ${instagramLink}`,
              `  Shortcode: ${result.shortcode || "-"}`,
              `  Likes: ${result.like_count ?? 0}, Komentar: ${result.comment_count ?? 0}`,
            ].join("\n")
          );
          processedCount += 1;
          await waClient.sendMessage(
            chatId,
            `✅ [Instagram ${index + 1}/${instagramLinks.length}] Berhasil diproses. Progress total: ${processedCount}/${totalTargets}`
          );
        } catch (error) {
          igFailed.push(`- ${instagramLink} => ${error?.message || "Gagal diproses"}`);
          processedCount += 1;
          await waClient.sendMessage(
            chatId,
            `⚠️ [Instagram ${index + 1}/${instagramLinks.length}] Gagal diproses. Progress total: ${processedCount}/${totalTargets}`
          );
        }
      }
    }

    if (tiktokInputs.length) {
      const { handleFetchKomentarTiktokBatch } = await import("../fetchengagement/fetchCommentTiktok.js");
      for (const [index, tiktokInput] of tiktokInputs.entries()) {
        await waClient.sendMessage(
          chatId,
          `⏳ [TikTok ${index + 1}/${tiktokInputs.length}] Memproses input:\n${tiktokInput}`
        );
        try {
          const result = await fetchAndStoreSingleTiktokPost(targetClientId, tiktokInput);
          if (result?.videoId) {
            await handleFetchKomentarTiktokBatch(null, null, targetClientId, {
              videoIds: [result.videoId],
              sourceType: "manual_input",
            });
          }
          ttSuccess.push(
            [
              `- ${tiktokInput}`,
              `  Video ID: ${result.videoId || "-"}`,
              `  Likes: ${result.likeCount ?? 0}, Komentar: ${result.commentCount ?? 0}`,
            ].join("\n")
          );
          processedCount += 1;
          await waClient.sendMessage(
            chatId,
            `✅ [TikTok ${index + 1}/${tiktokInputs.length}] Berhasil diproses. Progress total: ${processedCount}/${totalTargets}`
          );
        } catch (error) {
          ttFailed.push(`- ${tiktokInput} => ${error?.message || "Gagal diproses"}`);
          processedCount += 1;
          await waClient.sendMessage(
            chatId,
            `⚠️ [TikTok ${index + 1}/${tiktokInputs.length}] Gagal diproses. Progress total: ${processedCount}/${totalTargets}`
          );
        }
      }
    }

    const summary = [
      "✅ Proses input manual multi-link selesai.",
      `Client : ${targetClientId}`,
      `Instagram berhasil : ${igSuccess.length}`,
      `TikTok berhasil : ${ttSuccess.length}`,
      `Gagal diproses : ${igFailed.length + ttFailed.length}`,
    ];
    if (ignoredUrlCount > 0) {
      summary.push(`Diabaikan (bukan link Instagram/TikTok) : ${ignoredUrlCount}`);
    }
    await waClient.sendMessage(chatId, summary.join("\n"));

    if (igSuccess.length) {
      await waClient.sendMessage(chatId, `*Detail sukses Instagram*\n${igSuccess.join("\n")}`);
    }
    if (ttSuccess.length) {
      await waClient.sendMessage(chatId, `*Detail sukses TikTok*\n${ttSuccess.join("\n")}`);
    }
    if (igFailed.length || ttFailed.length) {
      await waClient.sendMessage(
        chatId,
        `⚠️ *Detail gagal diproses*\n${[...igFailed, ...ttFailed].join("\n")}`
      );
    }

    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async dirrequest_input_ig_manual_prompt(session, chatId, text, waClient) {
    const input = (text || "").trim();
    if (!input) {
      await waClient.sendMessage(chatId, DIRREQUEST_INPUT_IG_MANUAL_PROMPT);
      return;
    }

    if (input.toLowerCase() === "batal") {
      await waClient.sendMessage(chatId, "✅ Input manual Instagram dibatalkan.");
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    const targetClientId = session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID;
    const isValidInstagramLink = /instagram\.com\/(p|reel|tv)\//i.test(input);
    if (!isValidInstagramLink) {
      await waClient.sendMessage(
        chatId,
        "❌ Link Instagram tidak valid. Kirim URL post/reel Instagram yang benar atau ketik *batal*."
      );
      await waClient.sendMessage(chatId, DIRREQUEST_INPUT_IG_MANUAL_PROMPT);
      return;
    }

    try {
      const { handleFetchLikesInstagram } = await import("../fetchengagement/fetchLikesInstagram.js");
      const result = await fetchSinglePostKhusus(input, targetClientId);
      if (result?.shortcode) {
        await handleFetchLikesInstagram(null, null, targetClientId, {
          shortcodes: [result.shortcode],
          sourceType: "manual_input",
          enrichComments: false,
        });
      }
      const summaryLines = [
        "✅ Post Instagram berhasil ditambahkan (manual).",
        "✅ Likes Instagram untuk post manual juga berhasil di-fetch.",
        `Sumber : manual`,
        `Client : ${targetClientId}`,
        `Shortcode : ${result.shortcode || "-"}`,
        `Waktu upload manual : ${formatManualPostDate(result.created_at)}`,
        `Likes : ${result.like_count ?? 0}`,
        `Komentar : ${result.comment_count ?? 0}`,
        `Caption : ${sanitizeManualCaption(result.caption)}`,
      ];
      await waClient.sendMessage(chatId, summaryLines.join("\n"));
    } catch (error) {
      console.error("Gagal input manual post Instagram dirrequest:", error);
      const reason = error?.message || "Terjadi kesalahan saat menyimpan post manual Instagram.";
      await waClient.sendMessage(chatId, `❌ Gagal input manual post Instagram: ${reason}`);
    }

    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async dirrequest_input_tiktok_manual_prompt(session, chatId, text, waClient) {
    const input = (text || "").trim();
    if (!input) {
      await waClient.sendMessage(chatId, DIRREQUEST_INPUT_TIKTOK_MANUAL_PROMPT);
      return;
    }

    if (input.toLowerCase() === "batal") {
      await waClient.sendMessage(chatId, "✅ Input manual TikTok dibatalkan.");
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    const targetClientId = session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID;
    const isValidTikTokInput = /^\d{8,}$/.test(input) || /tiktok\.com\//i.test(input);
    if (!isValidTikTokInput) {
      await waClient.sendMessage(
        chatId,
        "❌ Input TikTok tidak valid. Kirim link post TikTok atau video ID numerik, atau ketik *batal*."
      );
      await waClient.sendMessage(chatId, DIRREQUEST_INPUT_TIKTOK_MANUAL_PROMPT);
      return;
    }

    try {
      const { handleFetchKomentarTiktokBatch } = await import("../fetchengagement/fetchCommentTiktok.js");
      const result = await fetchAndStoreSingleTiktokPost(targetClientId, input);
      if (result?.videoId) {
        await handleFetchKomentarTiktokBatch(null, null, targetClientId, {
          videoIds: [result.videoId],
          sourceType: "manual_input",
        });
      }
      const summaryLines = [
        "✅ Post TikTok berhasil ditambahkan (manual).",
        "✅ Komentar TikTok untuk post manual juga berhasil di-fetch.",
        `Sumber : manual`,
        `Client : ${result.clientId || targetClientId}`,
        `Video ID : ${result.videoId || "-"}`,
        `Waktu upload manual : ${formatManualPostDate(result.createdAt)}`,
        `Likes : ${result.likeCount ?? 0}`,
        `Komentar : ${result.commentCount ?? 0}`,
        `Caption : ${sanitizeManualCaption(result.caption)}`,
      ];
      await waClient.sendMessage(chatId, summaryLines.join("\n"));
    } catch (error) {
      console.error("Gagal input manual post TikTok dirrequest:", error);
      const reason = error?.message || "Terjadi kesalahan saat menyimpan post manual TikTok.";
      await waClient.sendMessage(chatId, `❌ Gagal input manual post TikTok: ${reason}`);
    }

    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async dirrequest_delete_task_post_prompt(session, chatId, text, waClient) {
    const input = (text || "").trim();
    if (!input) {
      await waClient.sendMessage(chatId, DIRREQUEST_DELETE_TASK_POST_PROMPT);
      return;
    }

    if (input.toLowerCase() === "batal") {
      await waClient.sendMessage(chatId, "✅ Penghapusan post tugas dibatalkan.");
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    const targetClientId = session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID;
    const shortcode = extractInstagramShortcode(input);
    const videoId = extractVideoId(input);

    try {
      if (shortcode) {
        await addTaskPostExclusion({
          clientId: targetClientId,
          platform: "instagram",
          contentId: shortcode,
          sourceLink: input,
        });
        const deletedInstaPosts = await deletePostByShortcode(shortcode, targetClientId);
        await waClient.sendMessage(
          chatId,
          [
            "✅ Post tugas Instagram berhasil dihapus dari daftar tugas harian.",
            deletedInstaPosts
              ? "✅ Post Instagram juga berhasil dihapus dari tabel insta_post."
              : "ℹ️ Post Instagram tidak ditemukan di tabel insta_post untuk client ini.",
            "Data likes Instagram yang sudah tersimpan tidak dihapus.",
            `Client : ${targetClientId}`,
            `Shortcode : ${shortcode}`,
          ].join("\n")
        );
      } else if (videoId) {
        await addTaskPostExclusion({
          clientId: targetClientId,
          platform: "tiktok",
          contentId: videoId,
          sourceLink: input,
        });
        const deletedTiktokPosts = await deletePostByVideoId(videoId, targetClientId);
        await waClient.sendMessage(
          chatId,
          [
            "✅ Post tugas TikTok berhasil dihapus dari daftar tugas harian.",
            deletedTiktokPosts
              ? "✅ Post TikTok juga berhasil dihapus dari tabel tiktok_post."
              : "ℹ️ Post TikTok tidak ditemukan di tabel tiktok_post untuk client ini.",
            "Data komentar TikTok yang sudah tersimpan tidak dihapus.",
            `Client : ${targetClientId}`,
            `Video ID : ${videoId}`,
          ].join("\n")
        );
      } else {
        await waClient.sendMessage(
          chatId,
          "❌ Link tidak dikenali. Kirim link post Instagram/TikTok yang valid atau ketik *batal*."
        );
        await waClient.sendMessage(chatId, DIRREQUEST_DELETE_TASK_POST_PROMPT);
        return;
      }
    } catch (error) {
      console.error("Gagal menghapus post tugas dirrequest:", error);
      const reason = error?.message || "Terjadi kesalahan saat menghapus post tugas.";
      await waClient.sendMessage(chatId, `❌ Gagal menghapus post tugas: ${reason}`);
    }

    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async choose_engagement_recap_period(session, chatId, text, waClient) {
    const input = (text || "").trim();
    if (!input) {
      await waClient.sendMessage(chatId, ENGAGEMENT_RECAP_MENU_TEXT);
      return;
    }

    const normalizedInput = input.toLowerCase();
    if (
      normalizedInput === "batal" ||
      normalizedInput === "menu" ||
      normalizedInput === "back" ||
      input === "0"
    ) {
      await waClient.sendMessage(chatId, "✅ Menu rekap ranking engagement ditutup.");
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    const option = ENGAGEMENT_RECAP_PERIOD_MAP[input];
    if (!option) {
      await waClient.sendMessage(
        chatId,
        "Pilihan tidak valid. Balas angka 1 sampai 5 atau ketik batal."
      );
      await waClient.sendMessage(chatId, ENGAGEMENT_RECAP_MENU_TEXT);
      return;
    }

    if (option.period === "selected_month") {
      session.step = "input_engagement_recap_month";
      await waClient.sendMessage(chatId, ENGAGEMENT_RECAP_MONTH_PROMPT);
      return;
    }

    if (option.period === "selected_date") {
      session.step = "input_engagement_recap_date";
      await waClient.sendMessage(chatId, ENGAGEMENT_RECAP_DATE_PROMPT);
      return;
    }

    await dirRequestHandlers.sendEngagementRecapFile(session, chatId, waClient, {
      period: option.period,
      label: option.label,
    });
  },

  async input_engagement_recap_month(session, chatId, text, waClient) {
    const input = String(text || "").trim();

    if (!input) {
      await waClient.sendMessage(chatId, ENGAGEMENT_RECAP_MONTH_PROMPT);
      return;
    }

    if (
      input.toLowerCase() === "batal" ||
      input.toLowerCase() === "back" ||
      input.toLowerCase() === "menu" ||
      input === "0"
    ) {
      session.step = "choose_engagement_recap_period";
      await waClient.sendMessage(chatId, ENGAGEMENT_RECAP_MENU_TEXT);
      return;
    }

    if (!isValidYm(input)) {
      await waClient.sendMessage(chatId, "❌ Format bulan tidak valid. Gunakan format YYYY-MM.");
      await waClient.sendMessage(chatId, ENGAGEMENT_RECAP_MONTH_PROMPT);
      return;
    }

    const [yearText, monthText] = input.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      await waClient.sendMessage(chatId, "❌ Bulan tidak valid. Gunakan rentang bulan 01 sampai 12.");
      await waClient.sendMessage(chatId, ENGAGEMENT_RECAP_MONTH_PROMPT);
      return;
    }

    const startDate = `${yearText}-${monthText}-01`;
    const endDate = getJakartaYmd(new Date(Date.UTC(year, month, 0, 0, 0, 0)));

    await dirRequestHandlers.sendEngagementRecapFile(session, chatId, waClient, {
      period: "selected_month",
      label: `bulan ${input}`,
      startDate,
      endDate,
    });
  },

  async input_engagement_recap_date(session, chatId, text, waClient) {
    const input = String(text || "").trim();

    if (!input) {
      await waClient.sendMessage(chatId, ENGAGEMENT_RECAP_DATE_PROMPT);
      return;
    }

    if (
      input.toLowerCase() === "batal" ||
      input.toLowerCase() === "back" ||
      input.toLowerCase() === "menu" ||
      input === "0"
    ) {
      session.step = "choose_engagement_recap_period";
      await waClient.sendMessage(chatId, ENGAGEMENT_RECAP_MENU_TEXT);
      return;
    }

    if (!isValidYmd(input)) {
      await waClient.sendMessage(chatId, "❌ Format tanggal tidak valid. Gunakan format YYYY-MM-DD.");
      await waClient.sendMessage(chatId, ENGAGEMENT_RECAP_DATE_PROMPT);
      return;
    }

    await dirRequestHandlers.sendEngagementRecapFile(session, chatId, waClient, {
      period: "selected_date",
      label: `tanggal ${input}`,
      startDate: input,
      endDate: input,
    });
  },

  async sendEngagementRecapFile(
    session,
    chatId,
    waClient,
    { period, label, startDate, endDate }
  ) {
    const targetClientId = session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID;
    const roleFlag = session.role;
    let filePath;

    try {
      const requestOptions = {
        clientId: targetClientId,
        roleFlag,
        period,
        menuName: session.menu,
        chakranarayanaSelectedGroup: session.chakranarayanaSelectedGroup,
      };
      if (startDate && endDate) {
        requestOptions.startDate = startDate;
        requestOptions.endDate = endDate;
      }

      const { filePath: generatedPath } = await saveEngagementRankingExcel(requestOptions);
      filePath = generatedPath;
      const buffer = await readFile(filePath);
      await sendWAFile(
        waClient,
        buffer,
        basename(filePath),
        chatId,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      await waClient.sendMessage(chatId, `✅ File Excel rekap ranking engagement (${label}) dikirim.`);
    } catch (error) {
      console.error("Gagal membuat rekap ranking engagement:", error);
      let msg;
      if (
        error?.message &&
        (error.message.includes("direktorat") ||
          error.message.includes("Client tidak ditemukan") ||
          error.message.includes("Tidak ada data"))
      ) {
        msg = error.message;
      } else {
        msg = `❌ Gagal membuat rekap ranking engagement (${label}).`;
      }
      await waClient.sendMessage(chatId, msg);
    } finally {
      if (filePath) {
        try {
          await unlink(filePath);
        } catch (err) {
          console.error("Gagal menghapus file sementara:", err);
        }
      }
    }

    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async choose_rekap_personil_category(session, chatId, text, waClient) {
    const input = (text || "").trim();
    if (!input) {
      await waClient.sendMessage(chatId, REKAP_PERSONIL_MENU_TEXT);
      return;
    }

    if (input.toLowerCase() === "batal") {
      await waClient.sendMessage(chatId, "✅ Menu rekap data personil ditutup.");
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    const option = REKAP_PERSONIL_CATEGORY_MAP[input];
    if (!option) {
      await waClient.sendMessage(
        chatId,
        "Pilihan tidak valid. Balas angka 1 sampai 4 atau ketik *batal*."
      );
      await waClient.sendMessage(chatId, REKAP_PERSONIL_MENU_TEXT);
      return;
    }

    const targetClientId = session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID;
    
    try {
      const msg = await formatRekapDataPersonil(targetClientId, option.category);
      if (msg) {
        await waClient.sendMessage(chatId, msg);
      } else {
        await waClient.sendMessage(
          chatId,
          "❌ Tidak ada data untuk kategori yang dipilih."
        );
      }
    } catch (error) {
      console.error("Gagal membuat rekap data personil:", error);
      let errorMsg;
      if (
        error?.message &&
        (error.message.includes("direktorat") ||
          error.message.includes("Client tidak ditemukan"))
      ) {
        errorMsg = error.message;
      } else {
        errorMsg = `❌ Gagal membuat rekap data personil kategori ${option.description}.`;
      }
      await waClient.sendMessage(chatId, errorMsg);
    }

    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async fetch_satbinmas_official_metadata(session, chatId, text, waClient) {
    const defaultClientId =
      session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID;
    const rawInput = (text || "").trim();

    const formatNumber = (value) => {
      if (value == null) return null;
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return null;
      return numeric.toLocaleString("id-ID", { maximumFractionDigits: 0 });
    };

    if (!rawInput) {
      await waClient.sendMessage(
        chatId,
        SATBINMAS_OFFICIAL_METADATA_PROMPT(defaultClientId)
      );
      return;
    }

    if (rawInput.toLowerCase() === "batal") {
      await waClient.sendMessage(
        chatId,
        "✅ Menu Monitoring Satbinmas Official ditutup."
      );
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    const tokens = rawInput.split(/\s+/);
    const guessedClientId =
      tokens.length >= 2 && /^[A-Za-z0-9_-]{2,}$/u.test(tokens[0])
        ? tokens.shift()
        : defaultClientId;
    const usernamePart = tokens.join(" ") || rawInput;
    const normalizedClientId = (guessedClientId || defaultClientId).toUpperCase();
    const username = usernamePart.replace(/^@/, "").trim();

    if (!username) {
      await waClient.sendMessage(
        chatId,
        "❌ Username Instagram Satbinmas Official belum diisi."
      );
      await waClient.sendMessage(
        chatId,
        SATBINMAS_OFFICIAL_METADATA_PROMPT(normalizedClientId)
      );
      return;
    }

    const usernamePattern = /^[A-Za-z0-9._]{2,}$/u;
    if (!usernamePattern.test(username)) {
      await waClient.sendMessage(
        chatId,
        "❌ Format username tidak valid. Gunakan huruf, angka, titik, atau underscore tanpa spasi."
      );
      await waClient.sendMessage(
        chatId,
        SATBINMAS_OFFICIAL_METADATA_PROMPT(normalizedClientId)
      );
      return;
    }

    try {
      const profile = await fetchInstagramInfo(username);
      if (!profile) {
        await waClient.sendMessage(
          chatId,
          `❌ Metadata tidak ditemukan untuk @${username}.`
        );
      } else {
        const profileName =
          profile.full_name || profile.fullName || profile.username || username;
        const followers =
          profile.followers_count ?? profile.follower_count ?? profile.follower;
        const following = profile.following_count;
        const posts = profile.media_count ?? profile.posts_count;
        const bio = profile.biography || profile.bio;
        const lines = [
          "📡 Metadata IG Satbinmas Official",
          `Client ID : ${normalizedClientId}`,
          `Username  : @${username}`,
          `Nama      : ${profileName}`,
          `Followers : ${formatNumber(followers) || "-"}`,
          `Mengikuti : ${formatNumber(following) || "-"}`,
          `Postingan : ${formatNumber(posts) || "-"}`,
          `Verifikasi: ${profile.is_verified ? "Sudah" : "Belum"}`,
          `Privasi   : ${profile.is_private ? "Private" : "Publik"}`,
        ];
        if (bio) lines.push(`Bio: ${bio}`);

        await waClient.sendMessage(chatId, lines.join("\n"));
      }
    } catch (error) {
      console.error("Gagal mengambil metadata IG Satbinmas Official:", error);
      const reason = error?.message?.slice(0, 400) || "Alasan tidak diketahui.";
      await waClient.sendMessage(
        chatId,
        `❌ Gagal mengambil metadata akun Satbinmas Official: ${reason}`
      );
    }

    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async resolve_satbinmas_official_tiktok_secuid(
    session,
    chatId,
    text,
    waClient
  ) {
    const defaultClientId =
      session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID;
    const rawInput = (text || "").trim();

    if (rawInput.toLowerCase() === "batal") {
      await waClient.sendMessage(
        chatId,
        "✅ Menu sinkronisasi secUid TikTok Satbinmas Official ditutup."
      );
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    try {
      await waClient.sendMessage(
        chatId,
        SATBINMAS_OFFICIAL_TIKTOK_SECUID_PROMPT(defaultClientId)
      );

      const summary = await syncSatbinmasOfficialTiktokSecUidForOrgClients();

      const successLines = [];
      const failedLines = [];
      const missingClients = [];

      summary.clients.forEach((clientSummary) => {
        const clientLabel = clientSummary.name?.trim() || clientSummary.clientId;

        if (clientSummary.missingAccounts) {
          missingClients.push(clientLabel);
          return;
        }

        clientSummary.accounts.forEach((account) => {
          successLines.push(
            `- @${account.username} (${clientLabel}): ${account.secUid}`
          );
        });

        clientSummary.errors.forEach((err) => {
          failedLines.push(
            `- @${err.username || "(kosong)"} (${clientLabel}): ${
              err.message || "Gagal sinkron secUid."
            }`
          );
        });
      });

      const lines = [
        "📡 secUid TikTok Satbinmas Official",
        `Client ORG diproses : ${summary.totals.clients}`,
        `Akun TikTok diproses: ${summary.totals.accounts}`,
        `Berhasil disimpan   : ${summary.totals.resolved}`,
        `Gagal disimpan      : ${summary.totals.failed}`,
      ];

      lines.push("", "🚫 Client tanpa akun TikTok");
      if (missingClients.length) {
        missingClients.forEach((label) => {
          lines.push(`- ${label}`);
        });
      } else {
        lines.push("- Semua client ORG memiliki akun TikTok terdaftar.");
      }

      lines.push("", "✅ secUid tersinkron");
      if (successLines.length) {
        successLines.forEach((msg) => lines.push(msg));
      } else {
        lines.push("- Tidak ada akun yang berhasil disinkron.");
      }

      if (failedLines.length) {
        lines.push("", "⚠️ Gagal sinkron secUid");
        failedLines.forEach((msg) => lines.push(msg));
      }

      await waClient.sendMessage(chatId, lines.join("\n"));
    } catch (error) {
      console.error(
        "Gagal sinkronisasi secUid TikTok Satbinmas Official:",
        error
      );
      const reason = error?.message?.slice(0, 400) || "Alasan tidak diketahui.";
      await waClient.sendMessage(
        chatId,
        `❌ Gagal sinkron secUid TikTok Satbinmas Official: ${reason}`
      );
    }

    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async fetch_satbinmas_official_tiktok_media(session, chatId, text, waClient) {
    const rawInput = (text || "").trim();

    if (rawInput.toLowerCase() === "batal") {
      await waClient.sendMessage(
        chatId,
        "✅ Menu pengambilan konten TikTok Satbinmas Official ditutup."
      );
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    try {
      await waClient.sendMessage(
        chatId,
        SATBINMAS_OFFICIAL_TIKTOK_MEDIA_PROMPT
      );

      const recap = await buildSatbinmasOfficialTiktokRecap();
      await waClient.sendMessage(chatId, recap);
    } catch (error) {
      console.error("Gagal mengambil konten TikTok Satbinmas Official:", error);
      const message =
        error?.message?.slice(0, 400) || "Gagal mengambil konten TikTok Satbinmas Official.";
      await waClient.sendMessage(
        chatId,
        `❌ ${message}`
      );
    }

    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async fetch_satbinmas_official_media(session, chatId, text, waClient) {
    const rawInput = (text || "").trim();

    if (rawInput.toLowerCase() === "batal") {
      await waClient.sendMessage(
        chatId,
        "✅ Menu pengambilan konten Satbinmas Official ditutup."
      );
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    try {
      await waClient.sendMessage(
        chatId,
        SATBINMAS_OFFICIAL_MEDIA_PROMPT
      );

      const recap = await buildSatbinmasOfficialInstagramRecap();
      await waClient.sendMessage(chatId, recap);
    } catch (error) {
      console.error("Gagal mengambil konten Satbinmas Official:", error);
      const message =
        error?.message?.slice(0, 400) || "Gagal mengambil konten Satbinmas Official.";
      await waClient.sendMessage(
        chatId,
        `❌ ${message}`
      );
    }

    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async choose_satbinmas_official_instagram_recap_period(
    session,
    chatId,
    text,
    waClient
  ) {
    const input = (text || "").trim();
    if (!input) {
      await waClient.sendMessage(chatId, SATBINMAS_OFFICIAL_INSTAGRAM_RECAP_MENU_TEXT);
      return;
    }

    const normalizedInput = input.toLowerCase();
    if (
      normalizedInput === "batal" ||
      normalizedInput === "menu" ||
      normalizedInput === "back" ||
      input === "0"
    ) {
      await waClient.sendMessage(
        chatId,
        "✅ Menu rekap Instagram Satbinmas Official ditutup."
      );
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    const option = SATBINMAS_OFFICIAL_RECAP_PERIOD_MAP[input];
    if (!option) {
      await waClient.sendMessage(
        chatId,
        "Pilihan tidak valid. Balas angka 1 sampai 3 atau ketik *batal*."
      );
      await waClient.sendMessage(chatId, SATBINMAS_OFFICIAL_INSTAGRAM_RECAP_MENU_TEXT);
      return;
    }

    try {
      const recap = await buildSatbinmasOfficialInstagramDbRecap(option.period);
      await waClient.sendMessage(chatId, recap);
    } catch (error) {
      console.error("Gagal mengambil rekap Instagram Satbinmas Official:", error);
      const message =
        error?.message?.slice(0, 400) || "Gagal mengambil rekap Instagram Satbinmas Official.";
      await waClient.sendMessage(chatId, `❌ ${message}`);
    }

    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async choose_satbinmas_official_tiktok_recap_period(session, chatId, text, waClient) {
    const input = (text || "").trim();
    if (!input) {
      await waClient.sendMessage(chatId, SATBINMAS_OFFICIAL_TIKTOK_RECAP_MENU_TEXT);
      return;
    }

    const normalizedInput = input.toLowerCase();
    if (
      normalizedInput === "batal" ||
      normalizedInput === "menu" ||
      normalizedInput === "back" ||
      input === "0"
    ) {
      await waClient.sendMessage(chatId, "✅ Menu rekap TikTok Satbinmas Official ditutup.");
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    const option = SATBINMAS_OFFICIAL_RECAP_PERIOD_MAP[input];
    if (!option) {
      await waClient.sendMessage(
        chatId,
        "Pilihan tidak valid. Balas angka 1 sampai 3 atau ketik *batal*."
      );
      await waClient.sendMessage(chatId, SATBINMAS_OFFICIAL_TIKTOK_RECAP_MENU_TEXT);
      return;
    }

    try {
      const recap = await buildSatbinmasOfficialTiktokDbRecap(option.period);
      await waClient.sendMessage(chatId, recap);
    } catch (error) {
      console.error("Gagal mengambil rekap TikTok Satbinmas Official:", error);
      const message =
        error?.message?.slice(0, 400) || "Gagal mengambil rekap TikTok Satbinmas Official.";
      await waClient.sendMessage(chatId, `❌ ${message}`);
    }

    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async choose_kasat_binmas_likes_period(session, chatId, text, waClient) {
    const input = (text || "").trim();
    if (!input) {
      await waClient.sendMessage(chatId, KASAT_BINMAS_LIKES_MENU_TEXT);
      return;
    }

    if (input.toLowerCase() === "batal") {
      await waClient.sendMessage(
        chatId,
        "✅ Menu Absensi Likes Kasat Binmas ditutup."
      );
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    const option = KASAT_BINMAS_LIKES_PERIOD_MAP[input];
    if (!option) {
      await waClient.sendMessage(
        chatId,
        "Pilihan tidak valid. Balas angka 1 sampai 3 atau ketik *batal*."
      );
      await waClient.sendMessage(chatId, KASAT_BINMAS_LIKES_MENU_TEXT);
      return;
    }

    try {
      const narrative = await generateKasatBinmasLikesRecap({
        period: option.period,
      });
      await waClient.sendMessage(chatId, narrative);
    } catch (error) {
      console.error(
        "Gagal membuat rekap Absensi Likes Kasat Binmas:",
        error
      );
      const msg =
        error?.message &&
        (error.message.includes("direktorat") ||
          error.message.includes("Client tidak ditemukan") ||
          error.message.includes("Tidak ada data"))
          ? error.message
          : `❌ Gagal membuat rekap Absensi Likes Kasat Binmas (${option.description}).`;
      await waClient.sendMessage(chatId, msg);
    }

    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async choose_kasat_binmas_likes_excel_period(session, chatId, text, waClient) {
    const input = (text || "").trim();
    if (!input) {
      await safeSendMessage(waClient, chatId, KASAT_BINMAS_LIKES_EXCEL_MENU_TEXT);
      return;
    }

    if (input.toLowerCase() === "batal") {
      await safeSendMessage(
        waClient,
        chatId,
        "✅ Menu Rekap Likes Instagram Kasat Binmas (Excel) ditutup."
      );
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    const option = KASAT_BINMAS_LIKES_PERIOD_MAP[input];
    if (!option) {
      await safeSendMessage(
        waClient,
        chatId,
        "Pilihan tidak valid. Balas angka 1 sampai 3 atau ketik *batal*."
      );
      await safeSendMessage(waClient, chatId, KASAT_BINMAS_LIKES_EXCEL_MENU_TEXT);
      return;
    }

    const referenceDate =
      session?.dirRequestReferenceDate || session?.executionDate || session?.referenceDate;
    const normalizedReferenceDate =
      referenceDate !== undefined && referenceDate !== null
        ? resolveBaseDate(referenceDate)
        : undefined;

    try {
      const result = await sendKasatBinmasLikesRecapExcel({
        period: option.period,
        referenceDate: normalizedReferenceDate,
        chatId,
        waClient,
      });
      if (!result?.success) {
        console.error(
          "[submenu 44] Rekap Likes Kasat Binmas (Excel) gagal dikirim.",
          result?.error
        );
        session.step = "choose_kasat_binmas_likes_excel_period";
        await safeSendMessage(waClient, chatId, KASAT_BINMAS_LIKES_EXCEL_MENU_TEXT);
        return;
      }
    } catch (error) {
      console.error(
        "[submenu 44] Unexpected error rekap Likes Kasat Binmas (Excel):",
        error
      );
      session.step = "choose_kasat_binmas_likes_excel_period";
      await safeSendMessage(
        waClient,
        chatId,
        "❌ Terjadi gangguan saat menyiapkan rekap Likes Kasat Binmas. Silakan coba lagi."
      );
      await safeSendMessage(waClient, chatId, KASAT_BINMAS_LIKES_EXCEL_MENU_TEXT);
      return;
    } finally {
      session.dirRequestReferenceDate = undefined;
      session.executionDate = undefined;
      session.referenceDate = undefined;
    }

    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async choose_kasat_binmas_tiktok_comment_excel_period(
    session,
    chatId,
    text,
    waClient
  ) {
    const input = (text || "").trim();
    if (!input) {
      await waClient.sendMessage(chatId, KASAT_BINMAS_TIKTOK_COMMENT_EXCEL_MENU_TEXT);
      return;
    }

    if (input.toLowerCase() === "batal") {
      await waClient.sendMessage(
        chatId,
        "✅ Menu Rekap Komentar TikTok Kasat Binmas (Excel) ditutup."
      );
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    const option = KASAT_BINMAS_TIKTOK_COMMENT_PERIOD_MAP[input];
    if (!option) {
      await waClient.sendMessage(
        chatId,
        "Pilihan tidak valid. Balas angka 1 sampai 3 atau ketik *batal*."
      );
      await waClient.sendMessage(chatId, KASAT_BINMAS_TIKTOK_COMMENT_EXCEL_MENU_TEXT);
      return;
    }

    const referenceDate =
      session?.dirRequestReferenceDate || session?.executionDate || session?.referenceDate;
    const normalizedReferenceDate =
      referenceDate !== undefined && referenceDate !== null
        ? resolveBaseDate(referenceDate)
        : undefined;

    try {
      await sendKasatBinmasTiktokCommentRecapExcel({
        period: option.period,
        referenceDate: normalizedReferenceDate,
        chatId,
        waClient,
      });
    } catch (error) {
      console.error(
        "Gagal membuat rekap komentar TikTok Kasat Binmas (Excel):",
        error
      );
      const msg =
        error?.message &&
        (error.message.includes("direktorat") ||
          error.message.includes("Client tidak ditemukan") ||
          error.message.includes("Tidak ada data"))
          ? error.message
          : `❌ Gagal mengirim rekap komentar TikTok Kasat Binmas (Excel) (${option.description}).`;
      try {
        await safeSendMessage(waClient, chatId, msg);
      } catch (sendError) {
        console.error(
          "Gagal mengirim pesan error rekap komentar TikTok Kasat Binmas (Excel):",
          sendError
        );
      }
    } finally {
      session.dirRequestReferenceDate = undefined;
      session.executionDate = undefined;
      session.referenceDate = undefined;
    }

    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async choose_kasat_binmas_tiktok_comment_period(session, chatId, text, waClient) {
    const input = (text || "").trim();
    if (!input) {
      await waClient.sendMessage(chatId, KASAT_BINMAS_TIKTOK_COMMENT_MENU_TEXT);
      return;
    }

    if (input.toLowerCase() === "batal") {
      await waClient.sendMessage(
        chatId,
        "✅ Menu Absensi Komentar TikTok Kasat Binmas ditutup."
      );
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    const option = KASAT_BINMAS_TIKTOK_COMMENT_PERIOD_MAP[input];
    if (!option) {
      await waClient.sendMessage(
        chatId,
        "Pilihan tidak valid. Balas angka 1 sampai 3 atau ketik *batal*."
      );
      await waClient.sendMessage(chatId, KASAT_BINMAS_TIKTOK_COMMENT_MENU_TEXT);
      return;
    }

    const referenceDate =
      session?.dirRequestReferenceDate || session?.executionDate || session?.referenceDate;
    const normalizedReferenceDate =
      referenceDate !== undefined && referenceDate !== null
        ? resolveBaseDate(referenceDate)
        : undefined;

    try {
      const narrative = await generateKasatBinmasTiktokCommentRecap({
        period: option.period,
        referenceDate: normalizedReferenceDate,
      });
      await waClient.sendMessage(chatId, narrative);
    } catch (error) {
      console.error(
        "Gagal membuat rekap Absensi Komentar TikTok Kasat Binmas:",
        error
      );
      const msg =
        error?.message &&
        (error.message.includes("direktorat") ||
          error.message.includes("Client tidak ditemukan") ||
          error.message.includes("Tidak ada data"))
          ? error.message
          : `❌ Gagal membuat rekap Absensi Komentar TikTok Kasat Binmas (${option.description}).`;
      await waClient.sendMessage(chatId, msg);
    } finally {
      session.dirRequestReferenceDate = undefined;
      session.executionDate = undefined;
      session.referenceDate = undefined;
    }

    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async choose_kasatker_report_period(session, chatId, text, waClient) {
    const input = (text || "").trim();
    if (!input) {
      await waClient.sendMessage(chatId, KASATKER_REPORT_MENU_TEXT);
      return;
    }

    if (input.toLowerCase() === "batal") {
      await waClient.sendMessage(chatId, "✅ Menu Laporan Kasatker ditutup.");
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    const option = KASATKER_REPORT_PERIOD_MAP[input];
    if (!option) {
      await waClient.sendMessage(
        chatId,
        "Pilihan tidak valid. Balas angka 1 sampai 4 atau ketik *batal*."
      );
      await waClient.sendMessage(chatId, KASATKER_REPORT_MENU_TEXT);
      return;
    }

    const targetClientId =
      session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID;
    const roleFlag = session.role;

    try {
      const narrative = await generateKasatkerReport({
        clientId: targetClientId,
        roleFlag,
        period: option.period,
      });
      await waClient.sendMessage(chatId, narrative);
    } catch (error) {
      console.error("Gagal membuat Laporan Kasatker:", error);
      let msg;
      if (
        error?.message &&
        (error.message.includes("direktorat") ||
          error.message.includes("Client tidak ditemukan") ||
          error.message.includes("Tidak ada data"))
      ) {
        msg = error.message;
      } else {
        msg = `❌ Gagal membuat Laporan Kasatker (${option.label}).`;
      }
      await waClient.sendMessage(chatId, msg);
    }

    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async choose_kasatker_attendance(session, chatId, text, waClient) {
    const targetClientId =
      session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID;
    const roleFlag = session.role;

    try {
      const narrative = await generateKasatkerAttendanceSummary({
        clientId: targetClientId,
        roleFlag,
      });
      await waClient.sendMessage(chatId, narrative);
    } catch (error) {
      console.error("Gagal membuat Absensi Kasatker:", error);
      const msg =
        error?.message &&
        (error.message.includes("direktorat") ||
          error.message.includes("Client tidak ditemukan") ||
          error.message.includes("Tidak ada data"))
          ? error.message
          : "❌ Gagal membuat Absensi Kasatker.";
      await waClient.sendMessage(chatId, msg);
    }

    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async absensi_instagram_jajaran(session, chatId, _text, waClient) {
    const targetClientId = session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID;
    const roleFlag = session.role;

    try {
      await waClient.sendMessage(chatId, "⏳ Sedang mengumpulkan data absensi Instagram jajaran...");
      
      const data = await collectInstagramJajaranAttendance(targetClientId, roleFlag, {
        menuName: session.menu,
        chakranarayanaSelectedGroup: session.chakranarayanaSelectedGroup,
        shortcodes: (await getStandardInstagramTaskPostsToday(targetClientId)).map(
          (post) => post.shortcode
        ),
      });
      const report = formatInstagramJajaranReport(data);
      
      await waClient.sendMessage(chatId, report);
    } catch (error) {
      console.error("Gagal membuat absensi Instagram jajaran:", error);
      const msg = error?.message || "❌ Gagal membuat absensi Instagram jajaran.";
      await waClient.sendMessage(chatId, msg);
    }

    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async absensi_tiktok_jajaran(session, chatId, _text, waClient) {
    const targetClientId = session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID;
    const roleFlag = session.role;

    try {
      await waClient.sendMessage(chatId, "⏳ Sedang mengumpulkan data absensi TikTok jajaran...");
      
      const data = await collectTiktokJajaranAttendance(targetClientId, roleFlag, {
        menuName: session.menu,
        chakranarayanaSelectedGroup: session.chakranarayanaSelectedGroup,
      });
      const report = formatTiktokJajaranReport(data);
      
      await waClient.sendMessage(chatId, report);
    } catch (error) {
      console.error("Gagal membuat absensi TikTok jajaran:", error);
      const msg = error?.message || "❌ Gagal membuat absensi TikTok jajaran.";
      await waClient.sendMessage(chatId, msg);
    }

    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async choose_jajaran_perpost_date_option(session, chatId, text, waClient) {
    const input = String(text || "").trim().toLowerCase();
    if (!input) {
      await waClient.sendMessage(chatId, PERPOST_DATE_MENU_TEXT);
      return;
    }

    if (input === "batal") {
      session.perpostPlatform = undefined;
      session.perpostSelectedDate = undefined;
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    if (input === "1") {
      session.perpostSelectedDate = getJakartaYmd();
      session.step = "choose_jajaran_perpost_post";
      await dirRequestHandlers.choose_jajaran_perpost_post(session, chatId, "", waClient);
      return;
    }

    if (input === "2") {
      session.step = "input_jajaran_perpost_date";
      await waClient.sendMessage(
        chatId,
        appendSubmenuBackInstruction(
          "Masukkan tanggal rekap perpost dengan format *YYYY-MM-DD* (WIB).\nContoh: 2026-01-31"
        )
      );
      return;
    }

    await waClient.sendMessage(chatId, "Pilihan tidak valid. Balas 1/2 atau ketik *batal*.");
    await waClient.sendMessage(chatId, PERPOST_DATE_MENU_TEXT);
  },

  async input_jajaran_perpost_date(session, chatId, text, waClient) {
    const input = String(text || "").trim();
    if (!input) {
      await waClient.sendMessage(chatId, "Masukkan tanggal dengan format YYYY-MM-DD.");
      return;
    }
    if (input.toLowerCase() === "batal") {
      session.step = "choose_jajaran_perpost_date_option";
      await waClient.sendMessage(chatId, PERPOST_DATE_MENU_TEXT);
      return;
    }
    if (!isValidYmd(input)) {
      await waClient.sendMessage(chatId, "❌ Format tanggal tidak valid. Gunakan YYYY-MM-DD.");
      return;
    }

    session.perpostSelectedDate = input;
    session.step = "choose_jajaran_perpost_post";
    await dirRequestHandlers.choose_jajaran_perpost_post(session, chatId, "", waClient);
  },

  async choose_jajaran_perpost_post(session, chatId, text, waClient) {
    const platform = session.perpostPlatform;
    const targetClientId = session.dir_client_id || session.selectedClientId || DITBINMAS_CLIENT_ID;
    const selectedDate = session.perpostSelectedDate || getJakartaYmd();

    if (!platform) {
      await waClient.sendMessage(chatId, "❌ Platform rekap perpost belum dipilih.");
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    if (!session.perpostOptions || !Array.isArray(session.perpostOptions)) {
      let posts = [];
      if (platform === "instagram") {
        posts = await getStandardInstagramTaskPostsByDate(targetClientId, selectedDate);
      } else {
        posts = await getTiktokPostsByDateRange(targetClientId, selectedDate, selectedDate);
      }

      if (!posts.length) {
        await waClient.sendMessage(
          chatId,
          `ℹ️ Tidak ada post ${platform === "instagram" ? "Instagram" : "TikTok"} pada ${formatYmdToIndoLong(selectedDate)}.`
        );
        session.step = "main";
        await dirRequestHandlers.main(session, chatId, "", waClient);
        return;
      }

      if (platform === "instagram") {
        session.perpostOptions = await Promise.all(
          posts.map((post, index) => enrichInstagramPerpostOption(post, index + 1))
        );
      } else {
        session.perpostOptions = await Promise.all(
          posts.map((post, index) => enrichTiktokPerpostOption(post, index + 1))
        );
      }
    }

    const input = String(text || "").trim().toLowerCase();
    if (!input) {
      const listText = session.perpostOptions
        .map((item) => {
          const engagementLines =
            platform === "instagram"
              ? [
                  `Likes Post: ${item.likeCount} | Komentar Post: ${item.commentCount}`,
                  `Likes Terambil (insta_like): ${item.likesByFetcher ?? 0}`,
                ]
              : [
                  `Likes Post: ${item.likeCount} | Komentar Post: ${item.commentCount}`,
                  `Komentar Terambil (tiktok_comment): ${item.commentsByFetcher ?? 0}`,
                ];

          return [
            `${item.index}. ${item.link}`,
            `   Caption: ${item.captionPreview}`,
            `   Engagement: ${engagementLines.join(" | ")}`,
          ].join("\n");
        })
        .join("\n\n");

      await waClient.sendMessage(
        chatId,
        appendSubmenuBackInstruction(
          `Pilih post tugas ${platform === "instagram" ? "Instagram" : "TikTok"} untuk rekap perpost tanggal ${formatYmdToIndoLong(selectedDate)}:\n\n${listText}\n\nBalas nomor post.`
        )
      );
      return;
    }

    if (input === "batal") {
      session.perpostOptions = undefined;
      session.step = "main";
      await dirRequestHandlers.main(session, chatId, "", waClient);
      return;
    }

    const idx = Number(input);
    if (!Number.isInteger(idx) || idx < 1 || idx > session.perpostOptions.length) {
      await waClient.sendMessage(chatId, "❌ Pilihan post tidak valid.");
      return;
    }

    const selectedPost = session.perpostOptions[idx - 1];
    await dirRequestHandlers.send_jajaran_perpost_report(
      session,
      chatId,
      waClient,
      targetClientId,
      session.role,
      platform,
      selectedDate,
      selectedPost
    );
    session.perpostOptions = undefined;
    session.perpostPlatform = undefined;
    session.perpostSelectedDate = undefined;
    session.step = "main";
    await dirRequestHandlers.main(session, chatId, "", waClient);
  },

  async send_jajaran_perpost_report(
    session,
    chatId,
    waClient,
    targetClientId,
    roleFlag,
    platform,
    selectedDate,
    selectedPost
  ) {
    const { mergedIds, usernameToClient, expectedByClient, userStatsByClient } = await buildPolresMapForDirektorat(
      targetClientId,
      roleFlag,
      {
        menuName: session.menu,
        chakranarayanaSelectedGroup: session.chakranarayanaSelectedGroup,
      }
    );
    const presentByClient = new Map();
    mergedIds.forEach((cid) => presentByClient.set(cid, new Set()));

    if (platform === "instagram") {
      const likers = await getLikeUsernamesByShortcode(selectedPost.shortcode);
      likers.map(normalizeSocialUsername).forEach((uname) => {
        const cid = usernameToClient.get(`ig:${uname}`);
        if (cid) presentByClient.get(cid)?.add(uname);
      });
    } else {
      const { comments } = await getCommentsByVideoId(selectedPost.videoId);
      extractUsernamesFromComments(comments)
        .map(normalizeSocialUsername)
        .forEach((uname) => {
          const cid = usernameToClient.get(`tt:${uname}`);
          if (cid) presentByClient.get(cid)?.add(uname);
        });
    }

    const detailEntries = [];
    const summary = {
      totalUsers: 0,
      usernameFilled: 0,
      usernameMissing: 0,
      expected: 0,
      hadir: 0,
      belum: 0,
    };
    for (const cid of mergedIds) {
      const client = await findClientById(cid);
      const clientName = client?.nama || cid;
      const clientType = String(client?.client_type || "").toLowerCase();

      if (clientName.toUpperCase() === "DIREKTORAT LALU LINTAS") {
        continue;
      }

      if (clientType === "direktorat" && String(cid).toUpperCase() !== String(targetClientId).toUpperCase()) {
        continue;
      }

      const userStats = userStatsByClient.get(cid) || {
        totalUsers: 0,
        instagramFilled: 0,
        instagramMissing: 0,
        tiktokFilled: 0,
        tiktokMissing: 0,
      };

      const usernameFilled =
        platform === "instagram" ? userStats.instagramFilled : userStats.tiktokFilled;
      const usernameMissing =
        platform === "instagram" ? userStats.instagramMissing : userStats.tiktokMissing;
      const expected = expectedByClient.get(cid)?.[platform === "instagram" ? "instagram" : "tiktok"] || 0;
      const hadir = presentByClient.get(cid)?.size || 0;
      const belum = Math.max(expected - hadir, 0);
      const persen = expected > 0 ? ((hadir / expected) * 100).toFixed(2) : "0.00";
      summary.totalUsers += userStats.totalUsers;
      summary.usernameFilled += usernameFilled;
      summary.usernameMissing += usernameMissing;
      summary.expected += expected;
      summary.hadir += hadir;
      summary.belum += belum;

      detailEntries.push({
        clientName,
        clientType,
        totalUsers: userStats.totalUsers,
        usernameFilled,
        usernameMissing,
        hadir,
        expected,
        belum,
        persen: Number(persen),
      });
    }

    const getUserGroupRank = (totalUsers) => {
      if (totalUsers > 1000) return 1;
      if (totalUsers >= 500) return 2;
      return 3;
    };

    detailEntries.sort((a, b) => {
      if (a.clientType === "direktorat" && b.clientType !== "direktorat") return -1;
      if (b.clientType === "direktorat" && a.clientType !== "direktorat") return 1;

      const groupRankDiff = getUserGroupRank(a.totalUsers) - getUserGroupRank(b.totalUsers);
      if (groupRankDiff !== 0) return groupRankDiff;

      if (Math.abs(a.persen - b.persen) > 0.01) {
        return b.persen - a.persen;
      }

      return a.clientName.localeCompare(b.clientName, "id-ID");
    });

    const rows = detailEntries.map((entry) => [
      `• *${entry.clientName}*`,
      `  Total User: ${entry.totalUsers} personel`,
      `  Sudah Isi Username: ${entry.usernameFilled} personel`,
      `  Belum Isi Username: ${entry.usernameMissing} personel`,
      `  Hadir: ${entry.hadir}/${entry.expected} personel`,
      `  Belum: ${entry.belum} personel`,
      `  Persentase: ${entry.persen.toFixed(2)}%`,
    ].join("\n"));

    const totalPersen =
      summary.expected > 0 ? ((summary.hadir / summary.expected) * 100).toFixed(2) : "0.00";

    const engagementSummary =
      platform === "instagram"
        ? `Likes: ${selectedPost.likeCount} | Komentar: ${selectedPost.commentCount}`
        : `Komentar: ${selectedPost.commentCount} | Likes: ${selectedPost.likeCount}`;

    const message = [
      "Mohon ijin Komandan,",
      `📋 *Rekap ${platform === "instagram" ? "Instagram" : "TikTok"} Perpost Jajaran*`,
      `Tanggal: ${formatYmdToIndoLong(selectedDate)} (WIB)`,
      `Client Direktorat: *${targetClientId}*`,
      roleFlag ? `Role Filter: *${String(roleFlag).toLowerCase()}*` : null,
      "",
      "*Informasi Konten*",
      `Link Post: ${selectedPost.link}`,
      `Caption: ${selectedPost.captionPreview || "(tanpa caption)"}`,
      `Engagement (dari tabel post): ${engagementSummary}`,
      "",
      "*Ringkasan Pelaksanaan*",
      `Total User: ${summary.totalUsers} personel`,
      `Sudah Isi Username: ${summary.usernameFilled} personel`,
      `Belum Isi Username: ${summary.usernameMissing} personel`,
      `Total Hadir: ${summary.hadir}/${summary.expected} personel (${totalPersen}%)`,
      `Total Belum: ${summary.belum} personel`,
      "",
      "*Rincian per Polres*",
      ...rows,
    ]
      .filter(Boolean)
      .join("\n");

    await waClient.sendMessage(chatId, message);
  },
};

export {
  formatRekapUserData,
  formatTopPersonnelRanking,
  topPersonnelRankingDependencies,
  formatTopPolresRanking,
  topPolresRankingDependencies,
  absensiLikesDitbinmas,
  absensiLikesDitbinmasSimple,
  absensiKomentarDitbinmas,
  absensiKomentarDitbinmasSimple,
  absensiKomentarTiktok,
  formatExecutiveSummary,
  formatRekapBelumLengkapDirektorat,
  formatRekapDataPersonil,
  formatRekapAllSosmed,
};

export default dirRequestHandlers;
