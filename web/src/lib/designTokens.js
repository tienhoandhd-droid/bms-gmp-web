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
export const COMPLY_NA = "#94a3b8";    // thiếu dữ liệu
export const fmtPct = (v) => (v == null || isNaN(v) ? "—" : `${(+v).toFixed(1).replace(".0", "")}%`);

// ============================================================
// Mảng 3 — THANG MÀU TUÂN THỦ DUY NHẤT (nguồn sự thật cho web + heatmap + báo cáo).
// Trước đây ngưỡng màu lệch ở 4 nơi (visualMap lịch 70/80/88/95 vs pctColor 70/88
// vs dot 80…). Nay MỌI biểu đồ phân-hạng-%-đạt phải gọi complyBucket/complyColor
// dưới đây → đổi 1 chỗ đồng bộ toàn hệ. 5 bậc: nhìn 1 phát biết phòng/ngày nào xấu.
// (Đèn nhị phân đạt/không-đạt tại mốc 80% là ngữ nghĩa RIÊNG — giữ COMPLY_OK/BAD.)
// ============================================================
export const COMPLY_SCALE = [
  { lt: 70,          label: "< 70%",  color: "#B3261E" },  // đỏ trầm — nguy cấp
  { gte: 70, lt: 80, label: "70–80%", color: "#E26A4F" },  // cam đỏ — không đạt
  { gte: 80, lt: 88, label: "80–88%", color: "#D99A2B" },  // vàng đậm — chớm đạt
  { gte: 88, lt: 95, label: "88–95%", color: "#7FBDB5" },  // teal nhạt — khá
  { gte: 95,         label: "≥ 95%",  color: "#0E7C73" },  // teal sâu — tốt
];
export function complyBucket(p) {
  if (p == null || isNaN(p)) return { label: "—", color: COMPLY_NA };
  for (const b of COMPLY_SCALE) {
    if ((b.gte == null || p >= b.gte) && (b.lt == null || p < b.lt)) return b;
  }
  return COMPLY_SCALE[COMPLY_SCALE.length - 1];
}
export const complyColor = (p) => complyBucket(p).color;
// Giữ TÊN pctColor cũ (nhiều nơi import) nhưng nay ủy quyền về thang chuẩn duy nhất.
export const pctColor = complyColor;
