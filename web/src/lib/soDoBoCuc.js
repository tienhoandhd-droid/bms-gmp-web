// ============================================================
// soDoBoCuc.js — Bố cục NGỮ NGHĨA + PHÂN BỔ CỔNG cho sơ đồ luồng vận hành (React Flow).
//
// Trục xương sống ngang cố định (không auto-layout đảo luồng):
//   Chưa xử lý/Mở lại → Đã báo Cơ điện → CƠ ĐIỆN ĐANG XỬ LÝ (hub) → Đã khắc phục
//   với 2 vệ tinh (Chờ xử lý / Không xử lý được) trên–dưới hub.
//
// CHỐNG ĐÈ ĐƯỜNG (vòng 6): mỗi mũi tên có MỘT điểm cắm RIÊNG trên cạnh node
// (port distribution) — nhiều mũi tên vào/ra cùng một cạnh được rải đều theo thứ tự
// vị trí node đối diện ⇒ không còn chồng lên nhau. Mũi tên LEO THANG dài (lùi ≥1 cột)
// đi theo LÀN PHÍA DƯỚI (ra/vào cạnh dưới) nên không cắt ngang trục xử lý.
// ============================================================
import { phanTichLuat, tenTT } from "./soDoLuat";

export const NODE_W = 184;
export const NODE_H = 62;
const PITCH_X = 272;
const PITCH_Y = 118;
const PAD_X = 30;
const PAD_Y = 34;

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
const DOC = new Set(["left", "right"]); // cạnh dọc → rải theo top%; cạnh ngang → rải theo left%

export function boCucLuong(dsNut) {
  const { canhTuanTu } = phanTichLuat(dsNut);
  const dinh = new Set();
  const gom = new Map();
  for (const c of canhTuanTu) {
    dinh.add(c.tu); dinh.add(c.den);
    const k = `${c.tu}→${c.den}`;
    if (!gom.has(k)) gom.set(k, { tu: c.tu, den: c.den, vais: new Set(), nhans: [] });
    const g = gom.get(k);
    g.vais.add(c.vai_tro); g.nhans.push({ nhan: c.nhan, vai_tro: c.vai_tro });
  }
  if (!dinh.size) return { nodes: [], edges: [] };

  const maxRankBiet = Math.max(...[...dinh].map((d) => RANK[d] ?? -1));
  let ke = maxRankBiet + 1;
  const rank = {}, row = {}, pos = {};
  for (const d of dinh) { rank[d] = RANK[d] ?? ke++; row[d] = ROW[d] ?? 1; }
  for (const d of dinh) pos[d] = { x: PAD_X + rank[d] * PITCH_X, y: PAD_Y + row[d] * PITCH_Y };

  const rowsCot = {};
  for (const d of dinh) (rowsCot[rank[d]] ||= []).push(row[d]);
  const tamCot = {};
  for (const [c, rs] of Object.entries(rowsCot)) { const s = [...rs].sort((a, b) => a - b); tamCot[c] = s[Math.floor(s.length / 2)]; }

  // 1) quyết định CẠNH nào của node cho mỗi đầu mũi tên
  const raw = [...gom.values()].map((e, i) => {
    const sr = rank[e.tu], tr = rank[e.den], sw = row[e.tu], tw = row[e.den];
    let ss, ts;
    if (tr > sr) { ss = "right"; ts = "left"; }        // tiến sang phải
    else if (tr < sr) { ss = "bottom"; ts = "bottom"; } // LÙI ≥1 cột → làn dưới
    else if (tw < sw) { ss = "top"; ts = "bottom"; }    // cùng cột, lên
    else { ss = "bottom"; ts = "top"; }                 // cùng cột, xuống
    const vaoTam = sr === tr && Math.abs(tw - tamCot[tr]) < Math.abs(sw - tamCot[sr]);
    const dut = tr < sr || vaoTam;
    const vai = e.vais.size === 1 ? [...e.vais][0] : "MEP";
    const nhan = e.nhans.length === 1 ? e.nhans[0].nhan : `${e.nhans[0].nhan} +${e.nhans.length - 1}`;
    return { id: `e${i}`, tu: e.tu, den: e.den, ss, ts, dut, vai, nhan, chiTiet: e.nhans };
  });

  // 2) gom các đầu mũi tên theo (node, cạnh) rồi RẢI ĐỀU điểm cắm
  const congTheoNode = {}; // node → cạnh → [{edgeId, end, other}]
  const them = (nid, side, edgeId, end, other) => {
    ((congTheoNode[nid] ||= {})[side] ||= []).push({ edgeId, end, other });
  };
  for (const e of raw) { them(e.tu, e.ss, e.id, "s", e.den); them(e.den, e.ts, e.id, "t", e.tu); }

  const tayCua = {};      // edgeId+end → handleId
  const handlesNode = {}; // node → [{id,type,side,off}]
  for (const [nid, bySide] of Object.entries(congTheoNode)) {
    handlesNode[nid] = [];
    for (const [side, list] of Object.entries(bySide)) {
      list.sort((a, b) => DOC.has(side) ? pos[a.other].y - pos[b.other].y : pos[a.other].x - pos[b.other].x);
      const n = list.length;
      list.forEach((p, idx) => {
        const off = (idx + 1) / (n + 1);
        const hid = `${side}-${p.end}-${idx}`;
        tayCua[p.edgeId + p.end] = hid;
        handlesNode[nid].push({ id: hid, type: p.end === "s" ? "source" : "target", side, off });
      });
    }
  }

  const nodes = [...dinh].map((d) => ({
    id: d, type: "tt", position: pos[d], draggable: false,
    data: { ten: tenTT(d), id: d, laDong: LA_DONG.has(d), owner: OWNER[d] || "SYSTEM", laHub: d === HUB, handles: handlesNode[d] || [] },
  }));

  const edges = raw.map((e) => ({
    id: e.id, source: e.tu, target: e.den,
    sourceHandle: tayCua[e.id + "s"], targetHandle: tayCua[e.id + "t"],
    label: e.nhan, type: "smoothstep",
    data: { vai_tro: e.vai, dut: e.dut, chiTiet: e.chiTiet },
  }));

  return { nodes, edges };
}
