// ============================================================
// soDoBoCuc.js — Bố cục NGỮ NGHĨA cố định cho sơ đồ luồng vận hành (React Flow).
//
// KHÔNG dùng auto-layout (dagre xếp "Cơ điện không xử lý được" ra cột đầu vì nó có
// mũi tên IPC leo thang → luồng đọc ngược). Thay bằng trục xương sống NGANG cố định:
//
//   [IPC phát hiện]      [Bàn giao]        [Cơ điện xử lý]        [Xong]
//   Chưa xử lý  ┐                       ┌ Cơ điện chờ xử lý ┐
//               ├─→ Đã báo Cơ điện ─→   │ CƠ ĐIỆN ĐANG XỬ LÝ├─→ Đã khắc phục
//   Mở lại      ┘                       └ Không xử lý được  ┘
//
// Hai trạng thái phụ của Cơ điện làm VỆ TINH trên–dưới quanh nút trung tâm (hub).
// Mũi tên TIẾN = nét liền; mũi tên QUAY-LẠI/tiếp tục = nét đứt. Mỗi node tô theo
// bộ phận SỞ HỮU trạng thái (IPC xanh · Cơ điện cam · Xong lục) để đọc "ai làm gì".
// ============================================================
import { phanTichLuat, tenTT } from "./soDoLuat";

export const NODE_W = 184;
export const NODE_H = 62;
const PITCH_X = 268; // khoảng cách cột
const PITCH_Y = 112; // khoảng cách hàng
const PAD_X = 28;
const PAD_Y = 28;

// Cột (rank) + hàng (row) ngữ nghĩa. row: 0 trên · 1 giữa (trục) · 2 dưới.
const RANK = {
  CHUA_XU_LY: 0, MO_LAI: 0,
  DA_BAO_CO_DIEN: 1,
  CO_DIEN_CHO_XU_LY: 2, CO_DIEN_DANG_XU_LY: 2, CO_DIEN_KHONG_XU_LY_DUOC: 2,
  DA_KHAC_PHUC: 3, DONG_TU_DONG: 3, DONG_NGOAI_PHAM_VI: 3, DA_DONG: 3, IPC_BINH_THUONG: 3,
};
const ROW = {
  CHUA_XU_LY: 0, MO_LAI: 2,
  DA_BAO_CO_DIEN: 1,
  CO_DIEN_CHO_XU_LY: 0, CO_DIEN_DANG_XU_LY: 1, CO_DIEN_KHONG_XU_LY_DUOC: 2,
  DA_KHAC_PHUC: 1, DONG_TU_DONG: 1, DONG_NGOAI_PHAM_VI: 1, DA_DONG: 1, IPC_BINH_THUONG: 1,
};
const OWNER = {
  CHUA_XU_LY: "IPC", MO_LAI: "IPC",
  DA_BAO_CO_DIEN: "MEP",
  CO_DIEN_CHO_XU_LY: "MEP", CO_DIEN_DANG_XU_LY: "MEP", CO_DIEN_KHONG_XU_LY_DUOC: "MEP",
  DA_KHAC_PHUC: "DONE", DONG_TU_DONG: "DONE", DONG_NGOAI_PHAM_VI: "DONE", DA_DONG: "DONE", IPC_BINH_THUONG: "DONE",
};
const LA_DONG = new Set(["DA_KHAC_PHUC", "DONG_TU_DONG", "DONG_NGOAI_PHAM_VI", "DA_DONG", "IPC_BINH_THUONG"]);
const HUB = "CO_DIEN_DANG_XU_LY";

// Chọn cặp tay cầm (handle) theo hình học ⇒ mũi tên tiến/lùi KHÔNG chồng nhau.
function chonTay(sr, tr, srow, trow) {
  if (tr > sr) return { sh: "s-r", th: "t-l" };  // tiến sang phải
  if (tr < sr) return { sh: "s-l", th: "t-r" };  // lùi sang trái
  if (trow < srow) return { sh: "s-t", th: "t-b" }; // cùng cột, lên
  return { sh: "s-b", th: "t-t" };                  // cùng cột, xuống
}

export function boCucLuong(dsNut) {
  const { canhTuanTu } = phanTichLuat(dsNut);
  const dinh = new Set();
  const gom = new Map(); // tu→den
  for (const c of canhTuanTu) {
    dinh.add(c.tu); dinh.add(c.den);
    const k = `${c.tu}→${c.den}`;
    if (!gom.has(k)) gom.set(k, { tu: c.tu, den: c.den, vais: new Set(), nhans: [], dong: false });
    const g = gom.get(k);
    g.vais.add(c.vai_tro); g.nhans.push({ nhan: c.nhan, vai_tro: c.vai_tro });
    if (c.dong) g.dong = true;
  }
  if (!dinh.size) return { nodes: [], edges: [], width: 0, height: 0 };

  // rank/row: dùng bảng ngữ nghĩa; đỉnh lạ → xếp nối đuôi cột phải, hàng giữa.
  const maxRankBiet = Math.max(...[...dinh].map((d) => RANK[d] ?? -1));
  const rank = {}, row = {};
  let laRankKeTiep = maxRankBiet + 1;
  for (const d of dinh) {
    rank[d] = RANK[d] ?? laRankKeTiep++;
    row[d] = ROW[d] ?? 1;
  }

  // tâm mỗi cột (để phân biệt "vào trong = quay lại" ở cạnh cùng cột)
  const rowsTheoCot = {};
  for (const d of dinh) (rowsTheoCot[rank[d]] ||= []).push(row[d]);
  const tamCot = {};
  for (const [c, rs] of Object.entries(rowsTheoCot)) {
    const s = [...rs].sort((a, b) => a - b);
    tamCot[c] = s[Math.floor(s.length / 2)];
  }

  const nodes = [...dinh].map((d) => ({
    id: d, type: "tt",
    position: { x: PAD_X + rank[d] * PITCH_X, y: PAD_Y + row[d] * PITCH_Y },
    data: { ten: tenTT(d), id: d, laDong: LA_DONG.has(d), owner: OWNER[d] || "SYSTEM", laHub: d === HUB },
    draggable: false,
  }));

  const edges = [...gom.values()].map((e, i) => {
    const sr = rank[e.tu], tr = rank[e.den], srow = row[e.tu], trow = row[e.den];
    const { sh, th } = chonTay(sr, tr, srow, trow);
    // nét đứt = quay lại: lùi cột, HOẶC cùng cột nhưng đi VÀO tâm (trở về trục xử lý)
    const vaoTam = sr === tr && Math.abs(trow - tamCot[tr]) < Math.abs(srow - tamCot[sr]);
    const dut = tr < sr || vaoTam;
    const vai = e.vais.size === 1 ? [...e.vais][0] : "MEP";
    const nhan = e.nhans.length === 1 ? e.nhans[0].nhan : `${e.nhans[0].nhan} +${e.nhans.length - 1}`;
    return {
      id: `e${i}`, source: e.tu, target: e.den, sourceHandle: sh, targetHandle: th,
      label: nhan, type: "smoothstep",
      data: { vai_tro: vai, dut, dong: e.dong, chiTiet: e.nhans },
    };
  });

  const width = PAD_X * 2 + (Math.max(...Object.values(rank)) + 1) * PITCH_X - (PITCH_X - NODE_W);
  const height = PAD_Y * 2 + (Math.max(...Object.values(row)) + 1) * PITCH_Y - (PITCH_Y - NODE_H);
  return { nodes, edges, width, height };
}
