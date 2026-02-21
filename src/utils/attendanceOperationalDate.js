/**
 * Attendance operational date helper.
 * Catatan: formatter tanggal/jam dikonsolidasikan via dateJakarta.js
 * untuk memastikan key query dan narasi tampil konsisten di WIB.
 */
import { hariIndo } from "./constants.js";
import {
  formatJakartaDisplayDate,
  formatJakartaDisplayTime,
  formatJakartaQueryDateKey,
} from "./dateJakarta.js";

export function getOperationalAttendanceDate(now = new Date()) {
  const current = now instanceof Date ? now : new Date(now);
  const operationalDate = formatJakartaQueryDateKey(current);

  const [year, month, day] = operationalDate.split("-").map(Number);
  const localJakartaDate = new Date(Date.UTC(year, month - 1, day));

  return {
    operationalDate,
    hari: hariIndo[localJakartaDate.getUTCDay()],
    tanggal: formatJakartaDisplayDate(localJakartaDate, { timeZone: "UTC" }),
    jam: formatJakartaDisplayTime(current),
  };
}

export function formatOperationalDateLabel(operationalDate) {
  if (!operationalDate) return "-";
  const parsed = new Date(`${operationalDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return operationalDate;
  const hari = hariIndo[parsed.getUTCDay()] || "";
  const tanggal = formatJakartaDisplayDate(parsed, { timeZone: "UTC" });
  return `${hari}, ${tanggal}`.trim();
}
