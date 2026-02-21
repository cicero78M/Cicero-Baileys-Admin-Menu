const JAKARTA_TIMEZONE = "Asia/Jakarta";

/**
 * Formatter Jakarta terpusat.
 *
 * Catatan troubleshooting:
 * - Gunakan helper ini saat butuh tanggal/jam agar tidak ikut timezone server.
 * - `formatJakartaQueryDateKey` dipakai untuk key query harian (format `en-CA`: YYYY-MM-DD).
 * - `formatJakartaDisplayDate` dan `formatJakartaDisplayTime` dipakai untuk narasi/report user.
 */
export function formatJakartaDisplayDate(date = new Date(), options = {}) {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: JAKARTA_TIMEZONE,
    ...options,
  });
}

export function formatJakartaDisplayTime(date = new Date(), options = {}) {
  return new Date(date).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: JAKARTA_TIMEZONE,
    ...options,
  });
}

export function formatJakartaQueryDateKey(date = new Date()) {
  return new Date(date).toLocaleDateString("en-CA", {
    timeZone: JAKARTA_TIMEZONE,
  });
}

export function getJakartaTimeZone() {
  return JAKARTA_TIMEZONE;
}
