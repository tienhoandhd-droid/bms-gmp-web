// ============================================================
// soDoLayout.js — Bố cục đồ thị máy trạng thái để VẼ (SVG)
//
// Từ các cạnh (phanTichLuat), xếp trạng thái thành các CỘT theo chiều xử lý
// (dòng chảy IPC → Cơ điện → đóng), rồi tính toạ độ node + đường cong mũi tên.
// Thuần hình học, không phụ thuộc thư viện — hợp CSP, nhẹ.
// ============================================================
import { phanTichLuat, tenTT } from "./soDoLuat";

// Thứ bậc trạng thái theo chiều xử lý (cột trái → phải). Trạng thái không liệt kê
// rơi vào cột "khác" ở cuối. Đây là gợi ý bố cục, KHÔNG phải luật — luật vẫn ở cạnh.
const CAP = {
  CHUA_XU_LY: 0,
  DA_BAO_CO_DIEN: 1,
  CO_DIEN_CHO_XU_LY: 2, CO_DIEN_DANG_XU_LY: 2, CO_DIEN_KHONG_XU_LY_DUOC: 2,
  MO_LAI: 1,
  DA_KHAC_PHUC: 3, IPC_BINH_THUONG: 3,
  DONG_TU_DONG: 4, DONG_NGOAI_PHAM_VI: 4, DA_DONG: 4,
};
const LA_DONG = new Set(["DONG_TU_DONG", "DONG_NGOAI_PHAM_VI", "DA_DONG", "DA_KHAC_PHUC", "IPC_BINH_THUONG"]);

export function boCucSoDo(dsNut, { W = 132, H = 54, gapX = 96, gapY = 30 } = {}) {
  const { canh } = phanTichLuat(dsNut);

  // đỉnh = mọi trạng thái xuất hiện (bỏ «mọi trạng thái» — nó là nguồn ảo)
  const dinh = new Set();
  for (const c of canh) { if (c.tu !== "«mọi trạng thái»") dinh.add(c.tu); dinh.add(c.den); }

  // gom theo cột
  const cot = {};
  for (const d of dinh) { const k = CAP[d] ?? 5; (cot[k] ||= []).push(d); }
  const cols = Object.keys(cot).map(Number).sort((a, b) => a - b);

  // toạ độ node
  const pos = {};
  let maxRow = 0;
  cols.forEach((k, ci) => {
    cot[k].sort();
    cot[k].forEach((d, ri) => { pos[d] = { x: ci * (W + gapX) + 20, y: ri * (H + gapY) + 20, col: ci, row: ri }; maxRow = Math.max(maxRow, ri); });
  });

  const width = cols.length * (W + gapX) + 40;
  const height = (maxRow + 1) * (H + gapY) + 40;

  const nodes = [...dinh].map((d) => ({ id: d, ten: tenTT(d), ...pos[d], laDong: LA_DONG.has(d), W, H }));

  // cạnh: điểm ra bên phải node nguồn, vào bên trái node đích; «mọi trạng thái» = tự-lặp/toả
  const edges = [];
  for (const c of canh) {
    const den = pos[c.den]; if (!den) continue;
    let x1, y1;
    if (c.tu === "«mọi trạng thái»") { x1 = den.x - gapX * 0.55; y1 = den.y + H / 2; }
    else { const tu = pos[c.tu]; if (!tu) continue; x1 = tu.x + W; y1 = tu.y + H / 2; }
    const x2 = den.x, y2 = den.y + H / 2;
    edges.push({ x1, y1, x2, y2, vai_tro: c.vai_tro, nhan: c.nhan, den: c.den, dong: c.dong, moLai: c.moLai, moiTruongTat: c.tu === "«mọi trạng thái»" });
  }

  return { nodes, edges, width, height };
}
