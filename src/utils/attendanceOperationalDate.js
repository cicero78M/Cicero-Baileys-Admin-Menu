import { hariIndo } from "./constants.js";

const JAKARTA_TIMEZONE = "Asia/Jakarta";

export function getOperationalAttendanceDate(now = new Date()) {
  const current = now instanceof Date ? now : new Date(now);
  const operationalDate = current.toLocaleDateString("en-CA", {
    timeZone: JAKARTA_TIMEZONE,
  });

  const [year, month, day] = operationalDate.split("-").map(Number);
  const localJakartaDate = new Date(Date.UTC(year, month - 1, day));

  return {
    operationalDate,
    hari: hariIndo[localJakartaDate.getUTCDay()],
    tanggal: localJakartaDate.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    jam: current.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: JAKARTA_TIMEZONE,
    }),
  };
}

export function formatOperationalDateLabel(operationalDate) {
  if (!operationalDate) return "-";
  const parsed = new Date(`${operationalDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return operationalDate;
  const hari = hariIndo[parsed.getUTCDay()] || "";
  const tanggal = parsed.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${hari}, ${tanggal}`.trim();
}
