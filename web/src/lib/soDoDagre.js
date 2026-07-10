// ============================================================
// soDoDagre.js — Dựng đồ thị LUỒNG VẬN HÀNH cho React Flow, tự bố cục bằng dagre.
//
// Chỉ nhận cạnh TUẦN TỰ (xương sống). dagre xếp hạng trái→phải (rankdir LR) nên các
// bước quy trình chảy ngang; cạnh quay-lại (đích nằm bên trái nguồn) được đánh dấu
// `nguoc` để vẽ nét đứt cong lên — người xem phân biệt "đi tới" với "quay lại".
// Trả về đúng định dạng React Flow (nodes/edges) — component chỉ việc tô màu theo vai.
// ============================================================
import dagre from "@dagrejs/dagre";
import { phanTichLuat, tenTT } from "./soDoLuat";

const LA_DONG = new Set(["DA_KHAC_PHUC", "DONG_TU_DONG", "DONG_NGOAI_PHAM_VI", "DA_DONG", "IPC_BINH_THUONG"]);
export const NODE_W = 190;
export const NODE_H = 62;

// Gộp nhiều nút cùng (tu→den) thành MỘT cạnh, giữ danh sách nhãn/vai để hiện gọn.
export function dungDoThi(dsNut) {
  const { canhTuanTu } = phanTichLuat(dsNut);
  const dinh = new Set();
  const gomCanh = new Map(); // key tu→den
  for (const c of canhTuanTu) {
    dinh.add(c.tu); dinh.add(c.den);
    const k = `${c.tu}→${c.den}`;
    if (!gomCanh.has(k)) gomCanh.set(k, { tu: c.tu, den: c.den, nhanDs: [], vaiDs: new Set(), dong: false });
    const g = gomCanh.get(k);
    g.nhanDs.push({ nhan: c.nhan, vai_tro: c.vai_tro });
    g.vaiDs.add(c.vai_tro);
    if (c.dong) g.dong = true;
  }
  if (!dinh.size) return { nodes: [], edges: [] };

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 46, ranksep: 96, marginx: 16, marginy: 24, ranker: "tight-tree" });
  g.setDefaultEdgeLabel(() => ({}));
  for (const d of dinh) g.setNode(d, { width: NODE_W, height: NODE_H });
  for (const e of gomCanh.values()) g.setEdge(e.tu, e.den);
  dagre.layout(g);

  const px = (id) => g.node(id);
  const nodes = [...dinh].map((d) => {
    const p = px(d);
    return {
      id: d,
      type: "tt",
      position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 },
      data: { ten: tenTT(d), id: d, laDong: LA_DONG.has(d) },
      sourcePosition: "right",
      targetPosition: "left",
      draggable: false,
    };
  });

  const edges = [...gomCanh.values()].map((e, i) => {
    const a = px(e.tu), b = px(e.den);
    const nguoc = b.x < a.x - 4; // đích nằm bên trái nguồn ⇒ quay lại
    // vai đại diện cho màu: nếu chỉ 1 vai thì lấy vai đó, nhiều vai → SYSTEM (xám)
    const vai = e.vaiDs.size === 1 ? [...e.vaiDs][0] : "SYSTEM";
    const nhan = e.nhanDs.length === 1
      ? e.nhanDs[0].nhan
      : `${e.nhanDs[0].nhan} +${e.nhanDs.length - 1}`;
    return {
      id: `e${i}`,
      source: e.tu,
      target: e.den,
      label: nhan,
      type: "smoothstep",
      data: { vai_tro: vai, nguoc, dong: e.dong, chiTiet: e.nhanDs },
    };
  });

  return { nodes, edges };
}
