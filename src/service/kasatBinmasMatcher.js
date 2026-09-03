const REGION_KEYWORDS = [
  'POLRES', 'POLDA', 'POLRESTA', 'POLTABES', 'POLSEK',
  'KOTA', 'KAB', 'KABUPATEN', 'RESORT', 'WILAYAH',
];
const REGION_REGEX = new RegExp(`\\b(${REGION_KEYWORDS.join('|')})\\b`, 'g');
const KASAT_BINMAS_REGEX = /^KASAT\s*BINMAS\b/;

export function matchesKasatBinmasJabatan(jabatan = '') {
  const normalized = String(jabatan || '')
    .replace(/[.,/:;\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .replace(REGION_REGEX, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.startsWith('KASAT') && KASAT_BINMAS_REGEX.test(normalized);
}

export default { matchesKasatBinmasJabatan };
