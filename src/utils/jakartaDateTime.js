const JAKARTA_TIMEZONE = "Asia/Jakarta";
const JAKARTA_UTC_OFFSET = "+07:00";

const jakartaDateTimeFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: JAKARTA_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function getCurrentJakartaTimestamp() {
  return formatJakartaTimestamp(new Date());
}

export function formatJakartaTimestamp(date) {
  const baseDate = date instanceof Date ? date : new Date(date);
  const parts = jakartaDateTimeFormatter.formatToParts(baseDate);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const milliseconds = String(baseDate.getMilliseconds()).padStart(3, "0");
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}.${milliseconds}${JAKARTA_UTC_OFFSET}`;
}

