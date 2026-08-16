// dinhDang.js — tiện ích định dạng + PRNG (tách move-only từ App.jsx 17/08/2026).

/* ============ TIỆN ÍCH ============ */
export function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export const fmtH = (v) => (v == null || isNaN(v) ? "—" : `${(+v).toFixed(1).replace(".0", "")}h`);
export const fmtDelta = (v) => (v == null || isNaN(v) ? "—" : `${v > 0 ? "+" : ""}${(+v).toFixed(1).replace(".0", "")}%`);
export const deltaTone = (v) => (v == null ? "text-slate-400" : v >= 5 ? "text-teal-600" : v <= -5 ? "text-rose-600" : "text-slate-400");
export const pad = (n) => String(n).padStart(2, "0");
export const toLocalInput = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
// Giờ hiện tại theo múi giờ VN (UTC+7) — "YYYY-MM-DD HH:MM:SS", độc lập với múi giờ trình duyệt.
export const vnNow = () => new Date().toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).replace(/\u202f/g, " ");
// Phút → "1h05′" (chuyển từ App.jsx 17/08/2026 — dùng chung shell + incidents):
export const fmtPhut = (m) => (m == null ? "—" : m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}′` : `${m}′`);
