const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(value, fieldName = 'date') {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} tidak valid`);
  }
  return parsed;
}

function toJakartaCalendarParts(value) {
  const date = toDate(value);
  const shifted = new Date(date.getTime() + JAKARTA_OFFSET_MS);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    dayOfWeek: shifted.getUTCDay(),
  };
}

function createUtcDateForJakarta(year, month, day) {
  return new Date(Date.UTC(year, month, day) - JAKARTA_OFFSET_MS);
}

export function getJakartaDayRange(referenceDate = new Date()) {
  const { year, month, day } = toJakartaCalendarParts(referenceDate);
  const start = createUtcDateForJakarta(year, month, day);
  const end = new Date(start.getTime() + DAY_MS - 1);
  return { start, end };
}

export function getJakartaMonthRange(referenceDate = new Date()) {
  const { year, month } = toJakartaCalendarParts(referenceDate);
  const start = createUtcDateForJakarta(year, month, 1);
  const nextMonthStart = createUtcDateForJakarta(year, month + 1, 1);
  const end = new Date(nextMonthStart.getTime() - 1);
  return { start, end };
}

export function getJakartaWeekRange(referenceDate = new Date(), weekStartsOn = 1) {
  const { start: dayStart } = getJakartaDayRange(referenceDate);
  const { dayOfWeek } = toJakartaCalendarParts(referenceDate);
  const normalizedWeekStart = Number.isInteger(weekStartsOn)
    ? ((weekStartsOn % 7) + 7) % 7
    : 1;
  const distance = (dayOfWeek - normalizedWeekStart + 7) % 7;
  const start = new Date(dayStart.getTime() - distance * DAY_MS);
  const end = new Date(start.getTime() + (7 * DAY_MS) - 1);
  return { start, end };
}
