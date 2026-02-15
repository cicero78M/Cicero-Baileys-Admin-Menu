import { collectEngagementRanking } from './engagementRankingExcelService.js';

const CATEGORY_RULES = [
  { key: 'aktif', label: '\n*KEPATUHAN AKTIF*', threshold: 90 },
  { key: 'sedang', label: '\n*KEPATUHAN SEDANG*', threshold: 50 },
  { key: 'rendah', label: '\n*KEPATUHAN RENDAH*', threshold: 0 },
];

function toPercentLabel(value) {
  const pct = Number.isFinite(value) ? Math.max(0, value) : 0;
  const rounded = Math.round(pct * 10) / 10;
  const formatted = Number.isInteger(rounded)
    ? rounded.toString()
    : rounded.toFixed(1);
  return `${formatted}%`;
}

function categorizeCompliance(compliancePct) {
  if (compliancePct >= CATEGORY_RULES[0].threshold) {
    return CATEGORY_RULES[0];
  }
  if (compliancePct >= CATEGORY_RULES[1].threshold) {
    return CATEGORY_RULES[1];
  }
  return CATEGORY_RULES[2];
}

function resolveTimeGreeting(referenceDate = new Date()) {
  const hourLabel = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  }).format(referenceDate);
  const hour = Number.parseInt(hourLabel, 10);

  if (hour >= 4 && hour < 11) {
    return 'Pagi';
  }
  if (hour >= 11 && hour < 15) {
    return 'Siang';
  }
  if (hour >= 15 && hour < 18) {
    return 'Sore';
  }
  return 'Malam';
}

function buildCategorySections(grouped) {
  return CATEGORY_RULES.map((rule) => {
    const entries = grouped[rule.key] || [];
    const title = `${rule.label} (${entries.length} Satker)`;
    if (!entries.length) {
      return `${title}\n-`; // menunjukkan tidak ada satker dalam kategori ini
    }

    const lines = entries.map((entry, idx) => {
      const note = entry.hasNoActivity ? ' (Belum ada pelaksanaan)' : '';
      return `${idx + 1}. ${entry.name} : ${entry.complianceLabel}${note}`;
    });

    return `${title}\n${lines.join('\n')}`;
  });
}

export async function generateKasatkerReport({
  clientId,
  roleFlag = null,
  period = 'today',
  startDate,
  endDate,
  reportDate = new Date(),
} = {}) {
  const {
    clientId: normalizedClientId,
    clientName,
    entries,
    periodInfo,
  } = await collectEngagementRanking(clientId, roleFlag, {
    period,
    startDate,
    endDate,
  });

  const periodLabel = periodInfo?.label || `Periode ${periodInfo?.period || period}`;
  const uppercaseClientName = (clientName || normalizedClientId || '').toString().toUpperCase();

  const satkerEntries = (entries || []).filter(
    (entry) => entry?.cid !== normalizedClientId
  );
  const targetEntries = satkerEntries.length ? satkerEntries : entries || [];

  if (!targetEntries.length) {
    throw new Error('Tidak ada data satker untuk disusun.');
  }

  const grouped = targetEntries.reduce(
    (acc, entry) => {
      if (!entry || typeof entry !== 'object') {
        return acc;
      }
      const compliancePct = Number.isFinite(entry.score)
        ? Math.max(0, Math.min(1, entry.score)) * 100
        : 0;
      const category = categorizeCompliance(compliancePct);
      const item = {
        name: (entry.name || entry.cid || '').toUpperCase(),
        complianceValue: compliancePct,
        complianceLabel: toPercentLabel(compliancePct),
        hasNoActivity: compliancePct === 0,
      };
      if (!acc[category.key]) {
        acc[category.key] = [];
      }
      acc[category.key].push(item);
      return acc;
    },
    { aktif: [], sedang: [], rendah: [] }
  );

  Object.values(grouped).forEach((list) => {
    list.sort(
      (a, b) =>
        b.complianceValue - a.complianceValue || a.name.localeCompare(b.name, 'id-ID', { sensitivity: 'base' })
    );
  });

  const sections = buildCategorySections(grouped);

  const greetingTime = resolveTimeGreeting(reportDate);

  const headerLines = [
    `Selamat ${greetingTime},`,
    '',
    'Mohon ijin Komandan,',
    '',
    'Melaporan kepatuhan pelaksanaan Likes dan Komentar Media Sosial.',
    `Periode ${periodLabel}.`,
    '',
    `Dalam rangka monitoring kepatuhan pelaksanaan tugas likes dan komentar terhadap konten akun resmi ${uppercaseClientName} melalui aplikasi Cicero, berikut disampaikan hasil rekapitulasi tingkat kepatuhan personel per Polres.`,
    '',
    '*KRITERIA KEPATUHAN* - Persentase personel yang melaksanakan tugas _Likes_ dan _Komentar_',
    '',
    '• *AKTIF* : Personil yang sudah melaksanakan ≥ 90%',
    '• *SEDANG* : Personil yang sudah melaksanakan 50% - 89.9%',
    '• *RENDAH* : Personil yang sudah melaksanakan < 50%',
    '',
    '*REKAP KEPATUHAN PER KATEGORI*',
  ];

  const followUpLines = [
    '',
    '*ARAHAN TINDAK LANJUT*',
    '✅ Kepada Kasatker dengan kategori Aktif.',
    'Disampaikan terima kasih dan apresiasi atas kinerja yang konsisten dalam memastikan seluruh personel melaksanakan tugas likes dan komentar dengan baikk. Diharapkan agar tingkat kepatuhan tersebut dapat dipertahankan dan menjadi contoh bagi satuan lainnya.',
    '',
    '⚠️ Kepada Kasatker dengan kategori Rendah.',
    'Diharapkan segera melakukan langkah-langkah perbaikan sebagai berikut:',
    `- Memanggil operator atau staf pengelola media sosial untuk aktif mengikuti arahan dari sistem Cicero melalui kanal koordinasi ${uppercaseClientName} (contoh grup WhatsApp internal direktorat).`,
    '- Menginstruksikan operator agar setiap hari membagikan (share) daftar konten yang wajib di-like dan di-comment oleh jajaran satker.',
    `- Mendorong seluruh personel pada jajaran ${uppercaseClientName} untuk aktif berinteraksi (like dan comment) pada setiap konten resmi direktorat.`,
    '',
    'Terima kasih atas perhatian dan kerja samanya.',
  ];

  return [
    ...headerLines,
    ...sections,
    ...followUpLines,
  ]
    .filter((line) => line !== undefined && line !== null)
    .join('\n')
    .trim();
}

export default {
  generateKasatkerReport,
};
