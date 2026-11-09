// khoangThoiGian.js — Bộ chọn khoảng thời gian trang Xu hướng (09/11/2026).
// Ngày luôn là chuỗi "YYYY-MM-DD" (lịch Việt Nam). Mọi phép cộng/trừ ngày làm bằng Date.UTC
// nên không phụ thuộc múi giờ của máy người xem.

export const NUT_NHANH = [
  { k: "homnay", label: "Hôm nay" },
  { k: "homqua", label: "Hôm qua" },
  { k: "7n", label: "7 ngày" },
  { k: "30n", label: "30 ngày" },
  { k: "thangnay", label: "Tháng này" },
  { k: "thangtruoc", label: "Tháng trước" },
  { k: "90n", label: "90 ngày" },
  { k: "180n", label: "180 ngày" },
];

const NGAY_MS = 86400000;
const SO_NGAY_TOI_DA = 366;          // khoảng dài nhất cho phép chọn
const SO_NGAY_THEO_GIO = 7;          // ≤ 7 ngày → xem theo giờ

const DINH_DANG = /^(\d{4})-(\d{2})-(\d{2})$/;

// "YYYY-MM-DD" → số ms UTC lúc 00:00; null nếu sai định dạng hoặc ngày không tồn tại (vd 30/02)
function sangMs(s) {
  const m = DINH_DANG.exec(s || "");
  if (!m) return null;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(ms);
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
  return ms;
}
const sangChuoi = (ms) => new Date(ms).toISOString().slice(0, 10);
const congNgay = (s, n) => sangChuoi(sangMs(s) + n * NGAY_MS);

export function homNayVN(now = new Date()) {
  return sangChuoi(now.getTime() + 7 * 3600000);   // Việt Nam UTC+7, không đổi giờ mùa hè
}

export function soNgay({ tu, den }) {
  return Math.round((sangMs(den) - sangMs(tu)) / NGAY_MS) + 1;
}

export function khoangTuNutNhanh(k, homNay) {
  const [y, m] = homNay.split("-").map(Number);
  switch (k) {
    case "homnay": return { tu: homNay, den: homNay };
    case "homqua": { const h = congNgay(homNay, -1); return { tu: h, den: h }; }
    case "thangnay": return { tu: sangChuoi(Date.UTC(y, m - 1, 1)), den: homNay };
    case "thangtruoc": return { tu: sangChuoi(Date.UTC(y, m - 2, 1)), den: sangChuoi(Date.UTC(y, m - 1, 0)) };
    default: {
      const n = { "7n": 7, "30n": 30, "90n": 90, "180n": 180 }[k] || 30;
      return { tu: congNgay(homNay, -(n - 1)), den: homNay };
    }
  }
}

// Tham số gửi RPC: pDen = null khi khoảng kết thúc hôm nay → giữ đúng hành vi cũ (tính tới hiện tại)
export function thamSoTai(khoang, homNay) {
  const n = soNgay(khoang);
  const theoGio = n <= SO_NGAY_THEO_GIO;
  return { donVi: theoGio ? "GIO" : "NGAY", soDiem: theoGio ? n * 24 : n, pDen: khoang.den === homNay ? null : khoang.den };
}

// Lùi (-1) / tiến (+1) một kỳ cùng độ dài; khi tiến chạm hôm nay thì dừng ở kỳ kết thúc hôm nay
export function dichKy(khoang, huong, homNay) {
  const n = soNgay(khoang);
  let den = congNgay(khoang.den, huong * n);
  if (sangMs(den) > sangMs(homNay)) den = homNay;
  return { tu: congNgay(den, -(n - 1)), den };
}

export function hopLe({ tu, den }, homNay) {
  const a = sangMs(tu), b = sangMs(den);
  if (a == null || b == null) return "Chọn đủ ngày bắt đầu và ngày kết thúc hợp lệ.";
  if (a > b) return "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.";
  if (b > sangMs(homNay)) return "Ngày kết thúc không được sau hôm nay.";
  if (soNgay({ tu, den }) > SO_NGAY_TOI_DA) return `Khoảng tối đa ${SO_NGAY_TOI_DA} ngày.`;
  return "";
}

export function nhanKhoang({ tu, den }) {
  const [y1, m1, d1] = tu.split("-");
  const [y2, m2, d2] = den.split("-");
  if (tu === den) return `${d2}/${m2}/${y2}`;
  return y1 === y2 ? `${d1}/${m1} – ${d2}/${m2}/${y2}` : `${d1}/${m1}/${y1} – ${d2}/${m2}/${y2}`;
}

// Lựa chọn lưu ở phiên bản cũ ("1n", "7n", "30n", "90n", "180n") → nút nhanh tương ứng
export function tuRangeCu(range, homNay) {
  const nut = { "1n": "homnay", "7n": "7n", "30n": "30n", "90n": "90n", "180n": "180n" }[range] || "30n";
  return { nut, ...khoangTuNutNhanh(nut, homNay) };
}
