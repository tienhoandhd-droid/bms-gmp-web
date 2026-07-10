// ============================================================
// soDoLayout.js — Bố cục LUỒNG VẬN HÀNH (chỉ cạnh tuần tự)
//
// Xếp trạng thái thành cột theo chiều xử lý. Node "hub" Cơ điện đang xử lý ở giữa,
// hai trạng thái phụ (chờ / không xử lý được) xếp cùng cột để nhánh gọn. Trả toạ độ
// node + đường cong mũi tên. Đường tự-lặp (A→A) và loop-ngược vẽ cong lên trên.
// ============================================================
import { phanTichLuat, tenTT } from "./soDoLuat";

const CAP = {
  MO_LAI: 0, CHUA_XU_LY: 0,
  DA_BAO_CO_DIEN: 1,
  CO_DIEN_DANG_XU_LY: 2, CO_DIEN_CHO_XU_LY: 2, CO_DIEN_KHONG_XU_LY_DUOC: 2,
  DA_KHAC_PHUC: 3,
};
const HANG = { CO_DIEN_DANG_XU_LY: 0, CO_DIEN_CHO_XU_LY: 1, CO_DIEN_KHONG_XU_LY_DUOC: 2, CHUA_XU_LY: 0, MO_LAI: 1 };
const LA_DONG = new Set(["DA_KHAC_PHUC", "DONG_TU_DONG", "DONG_NGOAI_PHAM_VI", "DA_DONG", "IPC_BINH_THUONG"]);

export function boCucLuong(dsNut, { W = 176, H = 66, gapX = 118, gapY = 30, padX = 28, padY = 60 } = {}) {
  const { canhTuanTu } = phanTichLuat(dsNut);

  const dinh = new Set();
  for (const c of canhTuanTu) { dinh.add(c.tu); dinh.add(c.den); }

  // cột & hàng
  const cot = {};
  for (const d of dinh) { const k = CAP[d] ?? 4; (cot[k] ||= []).push(d); }
  const pos = {};
  let maxRow = 0;
  Object.keys(cot).map(Number).sort((a, b) => a - b).forEach((k, ci) => {
    cot[k].sort((a, b) => (HANG[a] ?? 9) - (HANG[b] ?? 9) || a.localeCompare(b));
    cot[k].forEach((d, idx) => {
      const ri = HANG[d] ?? idx;
      pos[d] = { x: padX + ci * (W + gapX), y: padY + ri * (H + gapY), col: ci, row: ri };
      maxRow = Math.max(maxRow, ri);
    });
  });

  const nodes = [...dinh].map((d) => ({ id: d, ten: tenTT(d), ...pos[d], laDong: LA_DONG.has(d), W, H }));
  const width = padX * 2 + (Math.max(...Object.values(pos).map((p) => p.col)) + 1) * (W + gapX) - gapX;
  const height = padY * 2 + (maxRow + 1) * (H + gapY) - gapY;

  const edges = [];
  for (const c of canhTuanTu) {
    const a = pos[c.tu], b = pos[c.den]; if (!a || !b) continue;
    const nguoc = b.col < a.col || (b.col === a.col && b.row < a.row);   // loop ngược/lên
    let x1, y1, x2, y2;
    if (nguoc) {                       // ra từ TRÊN nguồn, vào TRÊN đích (cung phía trên)
      x1 = a.x + W * 0.35; y1 = a.y; x2 = b.x + W * 0.65; y2 = b.y;
    } else if (b.col === a.col) {       // cùng cột, xuống dưới → ra phải-dưới, vào phải-trên
      x1 = a.x + W; y1 = a.y + H * 0.72; x2 = b.x + W; y2 = b.y + H * 0.28;
    } else {                           // xuôi: ra phải, vào trái
      x1 = a.x + W; y1 = a.y + H / 2; x2 = b.x; y2 = b.y + H / 2;
    }
    edges.push({ x1, y1, x2, y2, nguoc, cungCot: b.col === a.col, vai_tro: c.vai_tro, nhan: c.nhan, dong: c.dong });
  }

  return { nodes, edges, width, height };
}
