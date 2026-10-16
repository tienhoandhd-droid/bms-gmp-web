const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";
const DAY_MS = 24 * 60 * 60 * 1000;

function vietnamCalendarDate(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now instanceof Date ? now : new Date(now));
  const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function toUtcDay(isoDate) {
  const [year, month, day] = String(isoDate).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function isoDay(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function normaliseRow(row = {}) {
  const denominator = Number(row.denominator) || 0;
  const responded = Number(row.responded) || 0;
  return {
    role: row.role || "—",
    denominator,
    responded,
    rate_pct: denominator > 0 && row.rate_pct != null && Number.isFinite(Number(row.rate_pct)) ? Number(row.rate_pct) : null,
  };
}

export function latestCompletedResponseWeek(now = new Date()) {
  const today = vietnamCalendarDate(now);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  // A reporting week ends at the end of Wednesday, so Wednesday remains open.
  const daysSinceCompletedWednesday = ((weekday - 3 + 7) % 7) || 7;
  const endDay = toUtcDay(today) - daysSinceCompletedWednesday * DAY_MS;
  return { start: isoDay(endDay - 6 * DAY_MS), end: isoDay(endDay) };
}

// Wrapper contract: keep the short name for the period selector.
export const latestCompletedWeek = latestCompletedResponseWeek;

export function shiftResponseWeek(period, direction, now = new Date()) {
  const shift = direction < 0 ? -7 : 7;
  const candidate = {
    start: isoDay(toUtcDay(period.start) + shift * DAY_MS),
    end: isoDay(toUtcDay(period.end) + shift * DAY_MS),
  };
  const latest = latestCompletedResponseWeek(now);
  return candidate.end > latest.end ? { ...latest } : candidate;
}

export function buildResponseComparison(data) {
  const currentRows = data?.periods?.[0]?.rows || [];
  const previousRows = data?.periods?.[1]?.rows || [];
  const roles = [...new Set([...currentRows, ...previousRows].map((row) => row.role).filter(Boolean))];
  const currentByRole = new Map(currentRows.map((row) => [row.role, normaliseRow(row)]));
  const previousByRole = new Map(previousRows.map((row) => [row.role, normaliseRow(row)]));

  return roles.map((role) => {
    const current = currentByRole.get(role) || normaliseRow({ role });
    const previous = previousByRole.get(role) || normaliseRow({ role });
    return {
      role,
      current,
      previous,
      delta_pct_points: current.rate_pct == null || previous.rate_pct == null ? null : +(current.rate_pct - previous.rate_pct).toFixed(1),
    };
  });
}

export function formatResponseRate(value) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return `${Number(value).toFixed(1).replace(".0", "").replace(".", ",")}%`;
}

export function formatResponsePeriod(period) {
  if (!period?.start || !period?.end) return "—";
  const formatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  return `${formatter.format(new Date(`${period.start}T00:00:00Z`))} – ${formatter.format(new Date(`${period.end}T00:00:00Z`))}`;
}

export function formatResponseDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: VN_TIME_ZONE }).format(date);
}
