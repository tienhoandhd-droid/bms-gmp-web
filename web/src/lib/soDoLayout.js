// ============================================================
// soDoLayout.js — Bố cục đồ thị máy trạng thái để VẼ (SVG)
//
// Xếp trạng thái thành CỘT theo chiều xử lý (IPC → Cơ điện → đóng). Các luật áp
// cho "mọi trạng thái" (nhắc/tự phân tuyến/mở lại…) gom về MỘT node ảo bên trái
// để không rải 7 mũi tên rối. Rộng rãi để đọc trên máy tính. Thuần hình học.
// ============================================================
import { phanTichLuat, tenTT } from "./soDoLuat";

// Cột theo chiều xử lý. Trạng thái không liệt kê → cột "khác" (5). Gợi ý bố cục.
const CAP = {
  CHUA_XU_LY: 0,
  DA_BAO_CO_DIEN: 1, MO_LAI: 1,
  CO_DIEN_DANG_XU_LY: 2, CO_DIEN_CHO_XU_LY: 2, CO_DIEN_KHONG_XU_LY_DUOC: 2,
  DA_KHAC_PHUC: 3, IPC_BINH_THUONG: 3,
  DONG_TU_DONG: 4, DONG_NGOAI_PHAM_VI: 4, DA_DONG: 4,
};
const LA_DONG = new Set(["DONG_TU_DONG", "DONG_NGOAI_PHAM_VI", "DA_DONG", "DA_KHAC_PHUC", "IPC_BINH_THUONG"]);
const AO = "__MOI_TT__";

export function boCucSoDo(dsNut, { W = 156, H = 64, gapX = 150, gapY = 52, padX = 150, padY = 34 } = {}) {
  const { canh } = phanTichLuat(dsNut);

  const dinh = new Set();
  let coAo = false;
  for (const c of canh) {
    if (c.tu === "«mọi trạng thái»") coAo = true;
    else dinh.add(c.tu);
    dinh.add(c.den);
  }

  // gom theo cột (node thật). Node ảo "mọi trạng thái" đứng riêng ở làn trái ngoài.
  const cot = {};
  for (const d of dinh) { const k = CAP[d] ?? 5; (cot[k] ||= []).push(d); }
  const cols = Object.keys(cot).map(Number).sort((a, b) => a - b);

  const pos = {};
  let maxRow = 0;
  cols.forEach((k, ci) => {
    cot[k].sort((a, b) => tenTT(a).localeCompare(tenTT(b)));
    cot[k].forEach((d, ri) => {
      pos[d] = { x: padX + ci * (W + gapX), y: padY + ri * (H + gapY), col: ci, row: ri };
      maxRow = Math.max(maxRow, ri);
    });
  });

  const nodes = [...dinh].map((d) => ({ id: d, ten: tenTT(d), ...pos[d], laDong: LA_DONG.has(d), W, H }));

  // node ảo "MỌI TRẠNG THÁI" — canh trái, giữa chiều dọc
  const height = padY + (maxRow + 1) * (H + gapY) - gapY + padY;
  if (coAo) {
    pos[AO] = { x: 16, y: height / 2 - H / 2, col: -1, row: 0 };
    nodes.unshift({ id: AO, ten: "Mọi trạng thái", x: pos[AO].x, y: pos[AO].y, laDong: false, ao: true, W: W - 30, H });
  }

  const width = padX + cols.length * (W + gapX) - gapX + padX;

  // cạnh: node ảo phát từ MỌI TRẠNG THÁI; cạnh thường ra phải node nguồn → vào trái đích
  const edges = [];
  for (const c of canh) {
    const den = pos[c.den]; if (!den) continue;
    const nguon = c.tu === "«mọi trạng thái»" ? (pos[AO] && { x: pos[AO].x + (W - 30), y: pos[AO].y + H / 2 }) : (pos[c.tu] && { x: pos[c.tu].x + W, y: pos[c.tu].y + H / 2 });
    if (!nguon) continue;
    edges.push({
      x1: nguon.x, y1: nguon.y, x2: den.x, y2: den.y + H / 2,
      vai_tro: c.vai_tro, nhan: c.nhan, den: c.den, dong: c.dong, moLai: c.moLai,
      moiTruongTat: c.tu === "«mọi trạng thái»",
    });
  }

  return { nodes, edges, width, height };
}
