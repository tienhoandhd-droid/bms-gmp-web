// ============================================================
// SoDoLuatCard — SƠ ĐỒ LUỒNG VẬN HÀNH (React Flow) sinh từ bảng luật (tab Cài đặt)
//
// Vòng 4 (tham khảo React Flow / xyflow — chuẩn node-based diagram):
//   • XƯƠNG SỐNG dựng bằng React Flow + dagre (tự bố cục trái→phải): có PAN/ZOOM,
//     nút "vừa khung", định tuyến cạnh gọn (smoothstep) — hết cảnh bezier chồng chéo.
//   • Cạnh QUAY-LẠI (đích ở bên trái nguồn) vẽ NÉT ĐỨT ⇒ phân biệt đi-tới / quay-lại.
//   • HÀNH ĐỘNG BẤT KỲ LÚC NÀO (Quản trị/QA đóng·mở lại, IPC bình thường) vẫn để
//     panel RIÊNG bên dưới — không trộn vào xương sống (lý do các bản cũ rối).
//   • Lọc theo vai trò: chọn "Cơ điện" → làm mờ đường/nút không thuộc Cơ điện.
// Mỗi cạnh = (các) dòng quy_tac_chuyen_trang_thai ⇒ không thể lệch luật.
// ============================================================
import React, { useMemo, useState, useCallback } from "react";
import { ReactFlow, Background, Controls, Handle, Position, MarkerType, useReactFlow, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { COLOR } from "../lib/designTokens";
import { phanTichLuat, sinhMermaid, tenTT, VAI_TRO_TEN } from "../lib/soDoLuat";
import { dungDoThi, NODE_W, NODE_H } from "../lib/soDoDagre";

const VAI = {
  IPC:   { net: "#1e72b8", nen: "#eaf3fb", chu: "#155a91" },
  MEP:   { net: "#c77e12", nen: "#fbf0dc", chu: "#8a5606" },
  LOT:   { net: "#d9534f", nen: "#fbe9e8", chu: "#a5322e" },
  QA:    { net: "#0e9c73", nen: "#e4f7f0", chu: "#0b6e52" },
  ADMIN: { net: "#5b6b7d", nen: "#eef1f5", chu: "#3f4d5c" },
  SYSTEM:{ net: "#64748b", nen: "#f1f5f9", chu: "#475569" },
};
const mv = (v) => VAI[v] || VAI.SYSTEM;

// ---- Node trạng thái: thẻ bo góc, đổ bóng; trạng thái đóng có dải xanh + nền ngọc ----
function NodeTrangThai({ data }) {
  const dong = data.laDong;
  return (
    <div style={{
      width: NODE_W, height: NODE_H, position: "relative",
      background: dong ? "#ecfdf5" : "#ffffff",
      border: `1.75px solid ${dong ? "#10b981" : "#d5dee7"}`,
      borderRadius: 14, boxShadow: "0 2px 5px rgba(15,23,42,0.07)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "4px 12px 4px 14px", opacity: data.mo ? 0.32 : 1, transition: "opacity .15s",
    }}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 1, height: 1, border: 0 }} />
      {dong && <div style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 5, borderRadius: 3, background: "#10b981" }} />}
      <div style={{ fontSize: 13.5, fontWeight: 700, color: COLOR.navy, textAlign: "center", lineHeight: 1.15 }}>{data.ten}</div>
      <div style={{ fontSize: 9, color: dong ? "#0b8f6a" : "#a3b0be", marginTop: 2 }}>{dong ? "trạng thái đóng" : data.id}</div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 1, height: 1, border: 0 }} />
    </div>
  );
}
const nodeTypes = { tt: NodeTrangThai };

function KhungSoDo({ base, vai }) {
  const rf = useReactFlow();

  const nodes = useMemo(() => base.nodes.map((n) => {
    // node "mờ" nếu KHÔNG có cạnh sáng nào chạm tới (khi đang lọc theo vai)
    const chamSang = vai === "ALL" || base.edges.some(
      (e) => e.data.vai_tro === vai && (e.source === n.id || e.target === n.id));
    return { ...n, data: { ...n.data, mo: !chamSang } };
  }), [base, vai]);

  const edges = useMemo(() => base.edges.map((e) => {
    const sang = vai === "ALL" || e.data.vai_tro === vai;
    const m = mv(e.data.vai_tro);
    return {
      ...e,
      animated: false,
      style: { stroke: m.net, strokeWidth: sang ? 2.25 : 1.25,
        strokeDasharray: e.data.nguoc ? "6 5" : undefined, opacity: sang ? 0.95 : 0.1 },
      markerEnd: { type: MarkerType.ArrowClosed, color: m.net, width: 16, height: 16 },
      labelBgPadding: [6, 3], labelBgBorderRadius: 8,
      labelBgStyle: { fill: "#ffffff", stroke: m.net, strokeOpacity: 0.35, opacity: sang ? 1 : 0.15 },
      labelStyle: { fill: m.chu, fontSize: 10.5, fontWeight: 600, opacity: sang ? 1 : 0.2 },
    };
  }), [base, vai]);

  const onInit = useCallback(() => { setTimeout(() => rf.fitView({ padding: 0.18, duration: 300 }), 0); }, [rf]);

  return (
    <ReactFlow
      nodes={nodes} edges={edges} nodeTypes={nodeTypes}
      onInit={onInit} fitView fitViewOptions={{ padding: 0.18 }}
      nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
      proOptions={{ hideAttribution: true }} minZoom={0.4} maxZoom={1.6}
      defaultEdgeOptions={{ type: "smoothstep" }}
    >
      <Background gap={20} size={1} color="#e2e8f0" />
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  );
}

export default function SoDoLuatCard({ dsNut }) {
  const [vai, setVai] = useState("ALL");
  const [daCopy, setDaCopy] = useState(false);

  const base = useMemo(() => (Array.isArray(dsNut) && dsNut.length ? dungDoThi(dsNut) : null), [dsNut]);
  const { canhBatKy, taiCho, vaiCo } = useMemo(() => {
    const pt = phanTichLuat(dsNut);
    const s = new Set([...pt.canhTuanTu, ...pt.canhBatKy, ...pt.taiCho].map((x) => x.vai_tro));
    return { canhBatKy: pt.canhBatKy, taiCho: pt.taiCho, vaiCo: [...s].sort() };
  }, [dsNut]);

  if (!base || !base.nodes.length) return <p className="text-[12px] text-slate-400">Chưa nạp được bảng luật (cần đăng nhập ở chế độ LIVE).</p>;

  const sang = (v) => vai === "ALL" || v === vai;
  const batKySang = canhBatKy.filter((e) => sang(e.vai_tro));
  const taiChoSang = taiCho.filter((t) => sang(t.vai_tro));
  const denTheoVai = {};
  for (const e of batKySang) (denTheoVai[e.vai_tro] ||= []).push(e);

  const copyMermaid = async () => {
    try { await navigator.clipboard.writeText(sinhMermaid(dsNut)); setDaCopy(true); setTimeout(() => setDaCopy(false), 2000); }
    catch { alert("Trình duyệt chặn clipboard."); }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-[11.5px] text-slate-500 leading-relaxed max-w-xl">
          <b>Luồng vận hành sự cố</b> đọc từ trái sang phải: IPC phát hiện → chuyển Cơ điện → Cơ điện xử lý → khắc phục.
          Mỗi mũi tên là <b>một nút thật</b> trong bảng luật; nét đứt là bước <b>quay lại</b>. Kéo để di chuyển, cuộn để phóng to.
          Các hành động <b>làm được ở bất kỳ trạng thái nào</b> (đóng, mở lại, xác nhận) nằm ở khối bên dưới.
        </p>
        <button onClick={copyMermaid} className="shrink-0 rounded-xl px-3 py-1.5 text-[12px] font-medium text-slate-600 ring-1 ring-slate-200 bg-white hover:bg-slate-50">
          {daCopy ? "✓ Đã copy" : "Copy Mermaid"}
        </button>
      </div>

      {/* Bộ lọc vai trò */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Bộ phận:</span>
        {["ALL", ...vaiCo].map((v) => {
          const on = vai === v;
          const m = v === "ALL" ? { net: COLOR.navy, nen: "#eef2f7" } : mv(v);
          return (
            <button key={v} onClick={() => setVai(v)} className="px-3 py-1.5 rounded-full text-[12px] font-semibold transition"
              style={on ? { background: m.net, color: "#fff" } : { background: m.nen, color: m.chu || m.net }}>
              {v === "ALL" ? "Tất cả" : (VAI_TRO_TEN[v] || v)}
            </button>
          );
        })}
      </div>

      {/* XƯƠNG SỐNG — React Flow */}
      <div className="mt-3 rounded-2xl ring-1 ring-slate-200 bg-gradient-to-b from-slate-50 to-white overflow-hidden" style={{ height: 440 }}>
        <ReactFlowProvider>
          <KhungSoDo base={base} vai={vai} />
        </ReactFlowProvider>
      </div>

      {/* HÀNH ĐỘNG BẤT KỲ LÚC NÀO */}
      {(batKySang.length > 0 || taiChoSang.length > 0) && (
        <div className="mt-3 rounded-2xl ring-1 ring-slate-200 p-3.5 bg-white">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Làm được ở bất kỳ trạng thái nào (không nằm trong luồng tuần tự)</p>
          <div className="mt-2.5 space-y-2">
            {Object.entries(denTheoVai).map(([v, ds]) => (
              <div key={v} className="flex items-start gap-2 flex-wrap">
                <span className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold" style={{ background: mv(v).nen, color: mv(v).chu }}>{VAI_TRO_TEN[v] || v}</span>
                {ds.map((e, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] ring-1 ring-slate-200 text-slate-600">
                    {e.nhan} <span className="text-slate-400">→</span> <b className="text-slate-700">{tenTT(e.den)}</b>
                    {e.moLai && <span className="text-[9px] px-1 rounded bg-sky-50 text-sky-700">mở lại</span>}
                    {e.dong && <span className="text-[9px] px-1 rounded bg-emerald-50 text-emerald-700">đóng</span>}
                  </span>
                ))}
              </div>
            ))}
            {taiChoSang.length > 0 && (
              <div className="pt-1.5 border-t border-slate-100">
                <span className="text-[10.5px] text-slate-400 mr-1.5">Ghi chú tại chỗ (không đổi trạng thái):</span>
                {taiChoSang.map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1 mr-1.5 rounded-lg px-2 py-0.5 text-[11px]" style={{ background: mv(t.vai_tro).nen, color: mv(t.vai_tro).chu }}>
                    <b>{VAI_TRO_TEN[t.vai_tro] || t.vai_tro}</b> {t.nhan}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
