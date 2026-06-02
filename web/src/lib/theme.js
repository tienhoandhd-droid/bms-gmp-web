// ============================================================
// theme.js — Hệ thiết kế "AQUA CLINICAL NEO-MINIMALISM"
// ------------------------------------------------------------
// Design tokens cho AquaBMS: nền sáng – hệ thủy – sạch – kiểm soát cao,
// cảnh báo NỔI BẬT, tương phản đạt WCAG (text ≥ 4.5:1, UI ≥ 3:1).
//
// Cách dùng: import { TOKEN } from "./lib/theme"  rồi thay COLOR cũ.
// File này CHỈ là nguồn token — chưa áp vào giao diện. Bạn có thể chỉnh
// hex tại đây để duyệt bảng màu trước khi áp dụng toàn hệ thống.
// ============================================================

// ---------- 1. MÀU NỀN TẢNG (base) ----------
export const BASE = {
  ink:        "#0F2233", // chữ chính (đậm hơn navy cũ) — contrast ~13:1 trên nền sáng
  navy:       "#14324A", // tiêu đề phụ
  slate:      "#4A6072", // chữ phụ (đủ 4.5:1 trên trắng)
  slateSoft:  "#6B8090", // chú thích (chỉ cho text ≥ 12px)
  line:       "#D5E2EA", // viền/đường kẻ nhạt
  // Hệ thủy — làm SÂU hơn để đủ tương phản (teal/sky cũ quá nhạt):
  teal:       "#0E7C73", // teal sâu — nhấn chính, đủ 3:1 cho icon/viền
  tealDeep:   "#0A5F58", // teal rất sâu — chữ trên nền teal nhạt
  sky:        "#1E72B8", // sky sâu — nhấn phụ
  skyDeep:    "#155A92",
  // Bề mặt:
  bg:         "#F2F8FA", // nền trang (hơi nước rất nhạt)
  surface:    "#FFFFFF", // thẻ
  surfaceSub: "#EAF3F6", // nền phụ trong thẻ
};

// ---------- 2. TRẠNG THÁI NGỮ NGHĨA (semantic status) ----------
// Mỗi trạng thái KHÔNG chỉ khác màu: có {text, bg, border, badgeBg, badgeText,
// icon, stripe} để dùng đồng bộ chữ + nền + viền + badge + icon + sọc trái.
export const STATUS = {
  ok: {        // Đạt / Kiểm soát tốt
    key: "ok", label: "Đạt",
    text: "#0A5F58", bg: "#E2F4F0", border: "#7FC9BE",
    badgeBg: "#0E7C73", badgeText: "#FFFFFF",
    icon: "#0E7C73", stripe: "#0E7C73",
  },
  warning: {   // Cảnh báo
    key: "warning", label: "Cảnh báo",
    text: "#8A5300", bg: "#FCEFD2", border: "#E0A53A",   // amber ĐẬM, không vàng nhạt
    badgeBg: "#C77E12", badgeText: "#FFFFFF",
    icon: "#B26F0E", stripe: "#D99A2B",
  },
  critical: {  // Hành động ngay / OOS / P1 — Mức 1
    key: "critical", label: "Hành động ngay",
    text: "#8E1B1B", bg: "#FBE4E2", border: "#D9534F",   // đỏ TRẦM chuyên nghiệp, không hồng nhạt
    badgeBg: "#B3261E", badgeText: "#FFFFFF",
    icon: "#B3261E", stripe: "#B3261E",
  },
  missing: {   // Thiếu dữ liệu — cam/nâu RIÊNG, không trùng warning
    key: "missing", label: "Thiếu dữ liệu",
    text: "#7A4A1E", bg: "#F3E6D8", border: "#C58A52",
    badgeBg: "#9C6B33", badgeText: "#FFFFFF",
    icon: "#9C6B33", stripe: "#B07A3C",
  },
  processing: { // Đang xử lý
    key: "processing", label: "Đang xử lý",
    text: "#155A92", bg: "#E1EFF9", border: "#5AA0D4",
    badgeBg: "#1E72B8", badgeText: "#FFFFFF",
    icon: "#1E72B8", stripe: "#1E72B8",
  },
  info: {      // Trung tính / chú ý nhẹ
    key: "info", label: "Cần chú ý",
    text: "#155A92", bg: "#E8F1F8", border: "#9CC4E2",
    badgeBg: "#3B7FB8", badgeText: "#FFFFFF",
    icon: "#2E73AE", stripe: "#3B7FB8",
  },
  neutral: {   // Bình thường — KHÔNG nổi hơn cảnh báo
    key: "neutral", label: "Bình thường",
    text: "#4A6072", bg: "#F4F8FA", border: "#D5E2EA",
    badgeBg: "#E7EEF2", badgeText: "#4A6072",
    icon: "#6B8090", stripe: "#CBD8E0",
  },
};

// Bậc tuân thủ → trạng thái (đồng bộ ngưỡng 80%):
export const compToStatus = (pct) =>
  pct == null ? STATUS.missing : pct < 70 ? STATUS.critical : pct < 80 ? STATUS.warning : pct < 88 ? STATUS.info : STATUS.ok;

// Mức ưu tiên sự cố → trạng thái:
export const priorityToStatus = { P1: STATUS.critical, P2: STATUS.warning, P3: STATUS.info };

// ---------- 3. THANG CHỮ (typography) — không dùng 10–11px cho thông tin quan trọng ----------
export const TYPE = {
  micro:      "text-[12px]",            // nhỏ nhất cho phép (chú thích phụ)
  small:      "text-[13px]",            // label/badge
  body:       "text-[14px] leading-relaxed",
  bodyStrong: "text-[14px] font-medium",
  cardTitle:  "text-[16px] font-semibold",   // tiêu đề thẻ 15–18px
  sectionTitle:"text-[18px] font-semibold",
  modalTitle: "text-[20px] font-semibold",   // 18–22px
  kpi:        "text-[44px] font-light tabular-nums leading-none", // 36–52px
  kpiSm:      "text-[34px] font-light tabular-nums leading-none",
};

// ---------- 4. KHOẢNG CÁCH (spacing) ----------
export const SPACE = { xs: "0.5rem", sm: "0.75rem", md: "1rem", lg: "1.5rem", xl: "2rem", "2xl": "2.5rem" };

// ---------- 5. ĐỘ NỔI (shadow/elevation) — nhẹ, sạch, không đổ bóng nặng ----------
export const ELEV = {
  card:   { boxShadow: "0 10px 30px -18px rgba(16,40,55,0.28)" },
  raised: { boxShadow: "0 16px 40px -20px rgba(16,40,55,0.34)" },
  pop:    { boxShadow: "0 24px 60px -22px rgba(16,40,55,0.40)" }, // dropdown/modal
  alert:  { boxShadow: "0 12px 32px -16px rgba(179,38,30,0.30)" }, // thẻ cảnh báo critical
};

// ---------- 6. VIỀN / RING ----------
export const RING = {
  base:  "ring-1 ring-[#D5E2EA]",
  focus: "outline-none focus-visible:ring-2 focus-visible:ring-[#1E72B8] focus-visible:ring-offset-1", // focus rõ cho bàn phím
  card:  "rounded-2xl ring-1 ring-[#D8E6EC]",
  stripeLeftStrong: "border-l-[6px]", // sọc trái dày cho P1/OOS
  stripeLeft: "border-l-4",
};

// Transition chuẩn GMP — nhẹ, 150–200ms, không animation gây rối:
export const MOTION = "transition duration-150 ease-out";
export const HOVER_CARD = "hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-20px_rgba(16,40,55,0.4)]";

// ---------- 7. MÀU BIỂU ĐỒ (Recharts) ----------
export const CHART = {
  DP:        "#0E7C73", // Chênh áp — teal sâu
  RH:        "#1E72B8", // Độ ẩm — blue/cyan sâu
  T:         "#B26F0E", // Nhiệt độ — amber/nâu đủ tương phản
  complyFill:"#DCF1EC", // vùng đạt — xanh rất nhạt
  oosFill:   "#FBE4E2", // vùng OOS — đỏ nhạt
  oosDot:    "#B3261E", // ĐIỂM OOS — đỏ đậm (nổi bật)
  limit:     "#C77E12", // đường giới hạn GHD/GHT — amber đậm, nét rõ
  grid:      "#D5E2EA",
  axis:      "#4A6072",
};

// Gộp lại cho tiện import 1 chỗ:
export const TOKEN = { BASE, STATUS, TYPE, SPACE, ELEV, RING, MOTION, HOVER_CARD, CHART, compToStatus, priorityToStatus };
export default TOKEN;
