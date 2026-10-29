// dinhDang.js — tiện ích định dạng + PRNG (tách move-only từ App.jsx 17/08/2026).

/* ============ TIỆN ÍCH ============ */
export function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export const fmtH = (v) => (v == null || isNaN(v) ? "—" : `${(+v).toFixed(1).replace(".0", "").replace(".", ",")} giờ`);
export const fmtDelta = (v) => (v == null || isNaN(v) ? "—" : `${v > 0 ? "+" : ""}${(+v).toFixed(1).replace(".0", "")}%`);
export const deltaTone = (v) => (v == null ? "text-muted" : v >= 5 ? "text-success" : v <= -5 ? "text-danger" : "text-muted");
export const pad = (n) => String(n).padStart(2, "0");
export const toLocalInput = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
// Giờ hiện tại theo múi giờ VN (UTC+7) — "YYYY-MM-DD HH:MM:SS", độc lập với múi giờ trình duyệt.
export const vnNow = () => new Date().toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).replace(/\u202f/g, " ");
// Ngày giờ hiển thị LUÔN theo giờ VN (UTC+7), không phụ thuộc múi giờ đặt trên máy/TV
// (ALCOA: mọi màn hình phải hiện cùng một thời điểm cho cùng một bản ghi).
export const VN_TZ = "Asia/Ho_Chi_Minh";
const KIEU_NGAY_GIO = {
  gio: { hour: "2-digit", minute: "2-digit" },                                                        // 08:30
  gioGiay: { hour: "2-digit", minute: "2-digit", second: "2-digit" },                                 // 08:30:15
  ngay: { day: "2-digit", month: "2-digit", year: "numeric" },                                        // 16/10/2026
  ngayGioNgan: { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" },              // 08:30 16/10
  ngayGio: { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" },  // 08:30 16/10/2026
  dayDu: { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" },
};
export const fmtVN = (v, kieu = "ngayGio", rong = "—") => {
  if (v == null || v === "") return rong;
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d)) return rong;
  // ICU in "ngày-tháng" (16-10) khi bỏ năm → đổi về "16/10" cho đồng nhất với các kiểu khác.
  return d.toLocaleString("vi-VN", { ...KIEU_NGAY_GIO[kieu], hourCycle: "h23", timeZone: VN_TZ }).replace(/\b(\d{2})-(\d{2})\b/, "$1/$2");
};
// Phút → "1h05′" (chuyển từ App.jsx 17/08/2026 — dùng chung shell + incidents):
export const fmtPhut = (m) => (m == null ? "—" : m >= 60 ? `${Math.floor(m / 60)} giờ ${String(m % 60).padStart(2, "0")} phút` : `${m} phút`);
