// ============================================================
// designTokens.js — HẰNG SỐ THIẾT KẾ DÙNG CHUNG (App.jsx + charts.jsx).
// Trước v12 các hằng này bị LẶP ở 2 nơi → sửa 1 chỗ quên chỗ kia.
// Module này nhỏ (không kéo ECharts) nên nằm ở bundle chính an toàn.
//
// Mảng 4: hệ thiết kế AQUA CLINICAL (theme.js) trước đây là DEAD CODE (0 import).
// Nay gộp về đây làm 1 điểm import: re-export STATUS/TYPE/RING/ELEV… để App/charts
// dùng token đạt-WCAG thay vì hằng rời rạc. COLOR giữ nguyên tên & giá trị (đã khớp
// AQUA CLINICAL: navy≈13:1, teal/sky sâu) để KHÔNG phải sửa ~98 chỗ đang dùng COLOR.*
// ============================================================
export {
  BASE, STATUS, TYPE, SPACE, ELEV, RING, MOTION, HOVER_CARD, CHART,
  compToStatus, priorityToStatus, TOKEN,
} from "./theme";

export const COLOR = { navy: "#102A3E", ink: "#33506e", teal: "#0E7C73", sky: "#1E72B8", coral: "#D9534F", coralDeep: "#B3261E", sand: "#C77E12", softCoral: "#D9534F" };
export const SENSOR_COLOR = { DP: "#0E7C73", RH: "#1E72B8", T: "#B26F0E" };
// Meta cơ bản (label + unit). App.jsx tự bổ sung icon (lucide) — icon không đưa
// vào đây để charts.jsx (lazy) không phải kéo theo thư viện icon.
export const SENSOR_META_BASE = { DP: { label: "Chênh áp", unit: "Pa" }, RH: { label: "Độ ẩm", unit: "%" }, T: { label: "Nhiệt độ", unit: "°C" } };
export const COMPLY_OK = "#0E7C73";    // đạt
export const COMPLY_BAD = "#B3261E";   // dưới ngưỡng (đỏ trầm)
export const fmtPct = (v) => (v == null || isNaN(v) ? "—" : `${(+v).toFixed(1).replace(".0", "")}%`);
// Đèn giao thông thống nhất web + báo cáo: <70 đỏ, 70–<88 vàng, ≥88 xanh.
export const pctColor = (p) => (p == null ? "#94a3b8" : p < 70 ? COMPLY_BAD : p < 88 ? "#d99a2b" : COMPLY_OK);
