// uiConst.js — hằng số THỊ GIÁC dùng chung toàn app (tách move-only từ App.jsx 17/08/2026).
// G2 sẽ token hóa các giá trị này; G1 giữ nguyên từng ký tự.
import { Gauge, Droplets, Thermometer, Wind, AlertTriangle, Cpu } from "lucide-react";
import { SENSOR_META_BASE } from "./designTokens";

/* ============ AQUA CLINICAL NEO-MINIMALISM — HỆ THỦY ============ */
/* Giữ tên biến, làm SÂU màu để đủ tương phản (WCAG): chữ đậm, teal/sky sâu,
   critical đỏ trầm chuyên nghiệp, warning amber đậm, không hồng/vàng nhạt. */
export const PAGE_BG = "linear-gradient(155deg,#EAF3F8 0%,#FAFDFF 45%,#E2F2EE 100%)";
export const cardShadow = { boxShadow: "0 12px 34px -18px rgba(16,40,55,0.30)" };
export const CARD = "rounded-3xl bg-white/95 backdrop-blur ring-1 ring-[#D8E6EC]";
export const STATUS = { normal: { txt: "text-teal-700", bg: "bg-teal-50", dot: "bg-teal-500" }, warning: { txt: "text-amber-700", bg: "bg-amber-50", dot: "bg-amber-500" }, critical: { txt: "text-rose-700", bg: "bg-rose-50", dot: "bg-rose-600" } };
export const PRIORITY = { P1: "bg-rose-600 text-white ring-1 ring-rose-700", P2: "bg-amber-100 text-amber-900 ring-1 ring-amber-400", P3: "bg-sky-100 text-sky-800 ring-1 ring-sky-300" };
export const MUC = { P1: "Mức 1", P2: "Mức 2", P3: "Mức 3" };
// Thang 3 mức từ 10/07/2026 (mức NOTICE cũ đã gỡ — nó chưa bao giờ đổi hành vi gì):
//   0 Kiểm soát tốt      OOS 1 giờ ≤ nguong_canh_bao
//   1 Chú ý — theo dõi   OOS vượt ngưỡng NHƯNG 10 phút cuối đã về dải ⇒ không gửi mail
//   3 Cảnh báo           OOS vượt ngưỡng VÀ 10 phút cuối còn ≥ nguong_hanh_dong ⇒ gửi mail
// Chỉ số 2 giữ chỗ để không phải đánh số lại toàn bộ mã cũ; không mức nào rơi vào đó.
export const LEVELS = [
  { key: "normal", label: "Kiểm soát tốt", txt: "text-teal-700", bg: "bg-teal-50", ring: "ring-teal-200", dot: "bg-teal-400" },
  { key: "notice", label: "Chú ý — theo dõi", txt: "text-sky-700", bg: "bg-sky-50", ring: "ring-sky-200", dot: "bg-sky-400" },
  { key: "warning", label: "Cảnh báo", txt: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-200", dot: "bg-amber-400" },
  { key: "action", label: "Cảnh báo — cần xử lý", txt: "text-rose-700", bg: "bg-rose-50", ring: "ring-rose-200", dot: "bg-rose-500" },
];
// Thứ tự ưu tiên theo dõi: phòng nguy cơ cao nhất (Hành động) xếp trước. -1 = mất dữ liệu.
export const LEVEL_PRIORITY = (lvl) => (lvl == null || lvl < 0 ? -0.5 : lvl);
// WCAG 1.4.1 — mỗi mức có GLYPH riêng (không phân biệt chỉ bằng màu): người mù màu
// vẫn đọc được qua hình dạng. Kiểm soát tốt ✓ · Chú ý ◦ · Cảnh báo ▲ · Hành động ■.
export const LEVEL_GLYPH = ["✓", "◦", "▲", "■"];
export const levelGlyph = (lvl) => (lvl == null || lvl < 0 ? "–" : (LEVEL_GLYPH[lvl] || "•"));

// Meta cơ bản (label/unit/màu) dùng chung với charts.jsx qua lib/designTokens — chỉ icon là riêng App.
export const SENSOR_META = { DP: { ...SENSOR_META_BASE.DP, icon: Gauge }, RH: { ...SENSOR_META_BASE.RH, icon: Droplets }, T: { ...SENSOR_META_BASE.T, icon: Thermometer } };
export const OOS_FILL = "#df7d62";     // vùng OOS

// Chọn icon cho cảnh báo hệ thống LIVE theo mức
export const ICON_CANH_BAO = (a) => (a.kind === "critical" ? Wind : a.kind === "warning" ? AlertTriangle : Cpu);
