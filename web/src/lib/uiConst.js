// uiConst.js — hằng số THỊ GIÁC dùng chung toàn app (tách move-only từ App.jsx 17/08/2026).
// G2 sẽ token hóa các giá trị này; G1 giữ nguyên từng ký tự.
import { Gauge, Droplets, Thermometer, Wind, AlertTriangle, Cpu } from "lucide-react";
import { SENSOR_META_BASE } from "./designTokens";

/* ============ AQUA CLINICAL NEO-MINIMALISM — HỆ THỦY ============ */
/* Giữ tên biến, làm SÂU màu để đủ tương phản (WCAG): chữ đậm, teal/sky sâu,
   critical đỏ trầm chuyên nghiệp, warning amber đậm, không hồng/vàng nhạt. */
export const PAGE_BG = "var(--bg-canvas)";   // G2: một nền phẳng theo token — bỏ gradient 3 lớp
// Báo cáo (10): card thường KHÔNG bóng — viền là lớp phân tách; bóng chỉ cho modal/drawer/popover.
export const cardShadow = {};
export const POP_SHADOW = { boxShadow: "0 24px 60px -22px rgba(16,40,55,0.40)" };
export const CARD = "rounded-3xl bg-surface ring-1 ring-line";
export const STATUS = { normal: { txt: "text-success", bg: "bg-success-soft", dot: "bg-success-solid" }, warning: { txt: "text-warning", bg: "bg-warning-soft", dot: "bg-warning-solid" }, critical: { txt: "text-danger", bg: "bg-danger-soft", dot: "bg-danger-solid" } };
export const PRIORITY = { P1: "bg-danger-solid text-white ring-1 ring-danger", P2: "bg-warning-soft text-warning ring-1 ring-warning", P3: "bg-info-soft text-info ring-1 ring-info-line" };
export const MUC = { P1: "Mức 1", P2: "Mức 2", P3: "Mức 3" };
// Thang 3 mức từ 10/07/2026 (mức NOTICE cũ đã gỡ — nó chưa bao giờ đổi hành vi gì):
//   0 Kiểm soát tốt      OOS 1 giờ ≤ nguong_canh_bao
//   1 Chú ý — theo dõi   OOS vượt ngưỡng NHƯNG 10 phút cuối đã về dải ⇒ không gửi mail
//   3 Cảnh báo           OOS vượt ngưỡng VÀ 10 phút cuối còn ≥ nguong_hanh_dong ⇒ gửi mail
// Chỉ số 2 giữ chỗ để không phải đánh số lại toàn bộ mã cũ; không mức nào rơi vào đó.
export const LEVELS = [
  { key: "normal", label: "Kiểm soát tốt", txt: "text-success", bg: "bg-success-soft", ring: "ring-success-line", dot: "bg-success-solid" },
  { key: "notice", label: "Chú ý — theo dõi", txt: "text-info", bg: "bg-info-soft", ring: "ring-info-line", dot: "bg-info-solid" },
  { key: "warning", label: "Cảnh báo", txt: "text-warning", bg: "bg-warning-soft", ring: "ring-warning-line", dot: "bg-warning-solid" },
  { key: "action", label: "Cảnh báo — cần xử lý", txt: "text-danger", bg: "bg-danger-soft", ring: "ring-danger-line", dot: "bg-danger-solid" },
];
// Thứ tự ưu tiên theo dõi: phòng nguy cơ cao nhất (Hành động) xếp trước. -1 = mất dữ liệu.
export const LEVEL_PRIORITY = (lvl) => (lvl == null || lvl < 0 ? -0.5 : lvl);
// WCAG 1.4.1 — mỗi mức có GLYPH riêng (không phân biệt chỉ bằng màu): người mù màu
// vẫn đọc được qua hình dạng. Kiểm soát tốt ✓ · Chú ý ◦ · Cảnh báo ▲ · Hành động ■.
export const LEVEL_GLYPH = ["✓", "◦", "▲", "■"];
export const levelGlyph = (lvl) => (lvl == null || lvl < 0 ? "–" : (LEVEL_GLYPH[lvl] || "•"));

// Meta cơ bản (label/unit/màu) dùng chung với charts.jsx qua lib/designTokens — chỉ icon là riêng App.
export const SENSOR_META = { DP: { ...SENSOR_META_BASE.DP, icon: Gauge }, RH: { ...SENSOR_META_BASE.RH, icon: Droplets }, T: { ...SENSOR_META_BASE.T, icon: Thermometer } };

// Chọn icon cho cảnh báo hệ thống LIVE theo mức
export const ICON_CANH_BAO = (a) => (a.kind === "critical" ? Wind : a.kind === "warning" ? AlertTriangle : Cpu);
