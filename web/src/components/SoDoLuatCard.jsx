// ============================================================
// SoDoLuatCard — SƠ ĐỒ LUỒNG VẬN HÀNH (React Flow) sinh từ bảng luật (tab Cài đặt)
//
// Vòng 5 — bố cục NGỮ NGHĨA cố định (soDoBoCuc), không để auto-layout đảo luồng:
//   • Trục xương sống NGANG: IPC phát hiện → Đã báo Cơ điện → Cơ điện xử lý → Khắc phục.
//   • 2 trạng thái phụ Cơ điện (chờ / không xử lý được) là VỆ TINH trên–dưới quanh hub.
//   • Mũi tên TIẾN nét liền · QUAY-LẠI/tiếp tục nét đứt · 8 tay-cầm ⇒ không chồng nhau.
//   • Node tô theo BỘ PHẬN SỞ HỮU trạng thái (IPC xanh · Cơ điện cam · Xong lục) — đọc
//     ngay "ai làm gì ở đâu". Hub "Cơ điện đang xử lý" viền đậm để thấy tâm quy trình.
//   • Hành động BẤT KỲ LÚC NÀO (đóng/mở lại/xác nhận) vẫn ở panel riêng bên dưới.
//   • React Flow: pan/zoom, nút vừa-khung. Mỗi cạnh = (các) dòng quy_tac_chuyen_trang_thai.
// ============================================================
import React, { useMemo, useState, useCallback } from "react";
import { ReactFlow, Background, Controls, Handle, Position, MarkerType, useReactFlow, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { COLOR } from "../lib/designTokens";
import { phanTichLuat, sinhMermaid, tenTT, VAI_TRO_TEN } from "../lib/soDoLuat";
import { boCucLuong, NODE_W, NODE_H } from "../lib/soDoBoCuc";

const VAI = {
  IPC:   { net: "#1e72b8", nen: "#eaf3fb", chu: "#155a91" },
  MEP:   { net: "#c77e12", nen: "#fbf0dc", chu: "#8a5606" },
  LOT:   { net: "#d9534f", nen: "#fbe9e8", chu: "#a5322e" },
  QA:    { net: "#0e9c73", nen: "#e4f7f0", chu: "#0b6e52" },
  ADMIN: { net: "#5b6b7d", nen: "#eef1f5", chu: "#3f4d5c" },
  SYSTEM:{ net: "#64748b", nen: "#f1f5f9", chu: "#475569" },
};
const mv = (v) => VAI[v] || VAI.SYSTEM;
// màu theo BỘ PHẬN SỞ HỮU trạng thái
const OWN = {
  IPC:   { net: "#1e72b8", nen: "#f2f8fd", ten: "IPC" },
  MEP:   { net: "#c77e12", nen: "#fdf7ec", ten: "Cơ điện" },
  DONE:  { net: "#10b981", nen: "#ecfdf5", ten: "Hoàn tất" },
  SYSTEM:{ net: "#94a3b8", nen: "#f8fafc", ten: "" },
};
const POS = { left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom };
const DOC = new Set(["left", "right"]);

// ---- Node trạng thái: thẻ có dải màu bộ phận sở hữu; hub viền đậm; điểm cắm RẢI ĐỀU ----
function NodeTrangThai({ data }) {
  const o = OWN[data.owner] || OWN.SYSTEM;
  const dong = data.laDong;
  return (
    <div style={{
      width: NODE_W, height: NODE_H, position: "relative",
      background: dong ? o.nen : "#ffffff",
      border: `${data.laHub ? 2.5 : 1.75}px solid ${o.net}`,
      borderRadius: 14, boxShadow: data.laHub ? "0 3px 10px rgba(199,126,18,0.22)" : "0 2px 5px rgba(15,23,42,0.07)",
      opacity: data.mo ? 0.3 : 1, transition: "opacity .15s", overflow: "hidden",
    }}>
      {/* dải màu bộ phận sở hữu bên trái */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6, background: o.net }} />
      <div style={{ position: "absolute", inset: 0, paddingLeft: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: COLOR.navy, textAlign: "center", lineHeight: 1.14, padding: "0 8px" }}>{data.ten}</div>
        <div style={{ fontSize: 9, fontWeight: 600, color: o.net, marginTop: 3, letterSpacing: 0.2 }}>
          {data.laHub ? "◆ TÂM XỬ LÝ" : (dong ? "✓ trạng thái đóng" : o.ten)}
        </div>
      </div>
      {/* điểm cắm do bố cục rải đều — mỗi mũi tên một điểm riêng ⇒ không đè nhau */}
      {(data.handles || []).map((h) => (
        <Handle key={h.id} id={h.id} type={h.type} position={POS[h.side]}
          style={{ [DOC.has(h.side) ? "top" : "left"]: `${h.off * 100}%`, opacity: 0, width: 1, height: 1, minWidth: 1, minHeight: 1, border: 0 }} />
      ))}
    </div>
  );
}
const nodeTypes = { tt: NodeTrangThai };

function KhungSoDo({ base, vai }) {
  const rf = useReactFlow();

  const nodes = useMemo(() => base.nodes.map((n) => {
    const chamSang = vai === "ALL" || base.edges.some(
      (e) => e.data.vai_tro === vai && (e.source === n.id || e.target === n.id));
    return { ...n, data: { ...n.data, mo: !chamSang } };
  }), [base, vai]);

  const edges = useMemo(() => base.edges.map((e) => {
    const sang = vai === "ALL" || e.data.vai_tro === vai;
    const m = mv(e.data.vai_tro);
    return {
      ...e, animated: false,
      style: { stroke: m.net, strokeWidth: sang ? 2.25 : 1.1,
        strokeDasharray: e.data.dut ? "6 5" : undefined, opacity: sang ? 0.95 : 0.09 },
      markerEnd: { type: MarkerType.ArrowClosed, color: m.net, width: 15, height: 15 },
      labelBgPadding: [6, 3], labelBgBorderRadius: 8,
      labelBgStyle: { fill: "#ffffff", stroke: m.net, strokeOpacity: 0.35, opacity: sang ? 1 : 0.12 },
      labelStyle: { fill: m.chu, fontSize: 10, fontWeight: 600, opacity: sang ? 1 : 0.15 },
    };
  }), [base, vai]);

  const onInit = useCallback(() => { setTimeout(() => rf.fitView({ padding: 0.16, duration: 300 }), 0); }, [rf]);

  return (
    <ReactFlow
      nodes={nodes} edges={edges} nodeTypes={nodeTypes}
      onInit={onInit} fitView fitViewOptions={{ padding: 0.16 }}
      nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
      proOptions={{ hideAttribution: true }} minZoom={0.35} maxZoom={1.6}
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

  const base = useMemo(() => (Array.isArray(dsNut) && dsNut.length ? boCucLuong(dsNut) : null), [dsNut]);
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
          Node tô màu theo <b>bộ phận sở hữu</b> (IPC xanh · Cơ điện cam · Hoàn tất lục). Mũi tên <b>nét liền là tiến</b>,
          <b> nét đứt là quay lại / xử lý tiếp</b>. Kéo để di chuyển, cuộn để phóng to.
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
