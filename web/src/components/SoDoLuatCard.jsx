// ============================================================
// SoDoLuatCard — SƠ ĐỒ ĐỘNG máy trạng thái, sinh TỪ bảng luật (tab Cài đặt)
//
// Vẽ đồ thị SVG thật (node + mũi tên có hướng), KHÔNG nhúng thư viện (CSP/nặng).
// Lọc theo VAI TRÒ: chọn "Cơ điện" → chỉ sáng các chuyển tiếp Cơ điện bấm được,
// từ trạng thái nào tới trạng thái nào. Trả lời trực tiếp câu hỏi:
//   "khi bộ phận X bấm nút, sự cố đi những đường nào?"
// Sơ đồ KHÔNG THỂ lệch luật vì mỗi mũi tên là một dòng quy_tac_chuyen_trang_thai.
// ============================================================
import React, { useMemo, useState } from "react";
import { COLOR } from "../lib/designTokens";
import { phanTichLuat, sinhMermaid, VAI_TRO_TEN } from "../lib/soDoLuat";
import { boCucSoDo } from "../lib/soDoLayout";

const MAU_VAI = {
  IPC:   { net: "#185fa5", nen: "#e6f1fb" },
  MEP:   { net: "#854f0b", nen: "#faeeda" },
  LOT:   { net: "#a32d2d", nen: "#fcebeb" },
  QA:    { net: "#0f6e56", nen: "#e7f6f1" },
  ADMIN: { net: "#475569", nen: "#eef2f7" },
  SYSTEM:{ net: "#64748b", nen: "#f1f5f9" },
};
const mauVai = (v) => MAU_VAI[v] || MAU_VAI.SYSTEM;

// Đường cong Bézier ngang giữa hai điểm (mũi tên mềm, ít chồng chéo)
function duong(e) {
  const dx = Math.max(40, Math.abs(e.x2 - e.x1) * 0.5);
  return `M ${e.x1} ${e.y1} C ${e.x1 + dx} ${e.y1}, ${e.x2 - dx} ${e.y2}, ${e.x2} ${e.y2}`;
}

export default function SoDoLuatCard({ dsNut }) {
  const [vaiChon, setVaiChon] = useState("ALL");
  const [daCopy, setDaCopy] = useState(false);

  const g = useMemo(() => (Array.isArray(dsNut) && dsNut.length ? boCucSoDo(dsNut) : null), [dsNut]);
  const { taiCho, vaiTroCo } = useMemo(() => {
    const pt = phanTichLuat(dsNut);
    const vt = new Set([...pt.canh, ...pt.taiCho].map((x) => x.vai_tro));
    return { taiCho: pt.taiCho, vaiTroCo: [...vt].sort() };
  }, [dsNut]);

  if (!g) return <p className="text-[12px] text-slate-400">Chưa nạp được bảng luật (cần đăng nhập ở chế độ LIVE).</p>;

  const sang = (v) => vaiChon === "ALL" || v === vaiChon;
  const canhHien = g.edges.filter((e) => sang(e.vai_tro));
  const taiChoHien = taiCho.filter((t) => sang(t.vai_tro));

  const copyMermaid = async () => {
    try { await navigator.clipboard.writeText(sinhMermaid(dsNut)); setDaCopy(true); setTimeout(() => setDaCopy(false), 2000); }
    catch { alert("Trình duyệt chặn clipboard."); }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-slate-500 leading-relaxed max-w-xl">
          Mỗi mũi tên là <b>một nút thật</b> trong bảng luật: bộ phận bấm → sự cố chuyển từ trạng thái này sang trạng thái kia.
          Chọn một vai trò để xem <b>đúng những đường nó có thể đi</b> khi bấm nút. Sơ đồ sinh trực tiếp từ luật nên không thể lệch.
        </p>
        <button onClick={copyMermaid} className="shrink-0 rounded-xl px-3 py-1.5 text-[12px] font-medium text-slate-600 ring-1 ring-slate-200 bg-white hover:bg-slate-50">
          {daCopy ? "✓ Đã copy Mermaid" : "Copy mã Mermaid"}
        </button>
      </div>

      {/* Bộ lọc vai trò */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Khi bộ phận bấm nút:</span>
        {["ALL", ...vaiTroCo].map((v) => {
          const on = vaiChon === v;
          const m = v === "ALL" ? { net: COLOR.navy, nen: "#eef2f7" } : mauVai(v);
          return (
            <button key={v} onClick={() => setVaiChon(v)}
              className="px-3 py-1.5 rounded-full text-[12px] font-medium transition"
              style={on ? { background: m.net, color: "#fff" } : { background: m.nen, color: m.net }}>
              {v === "ALL" ? "Tất cả" : (VAI_TRO_TEN[v] || v)}
            </button>
          );
        })}
      </div>

      {/* Đồ thị SVG */}
      <div className="mt-3 overflow-x-auto rounded-2xl ring-1 ring-slate-200 bg-slate-50/60 p-2">
        <svg width={g.width} height={g.height} style={{ minWidth: g.width }} className="block">
          <defs>
            {Object.entries(MAU_VAI).map(([k, m]) => (
              <marker key={k} id={`mui-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={m.net} />
              </marker>
            ))}
            <marker id="mui-mo" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
            </marker>
          </defs>

          {/* Mũi tên mờ (không thuộc vai đang chọn) — vẽ trước để nằm dưới */}
          {vaiChon !== "ALL" && g.edges.filter((e) => !sang(e.vai_tro)).map((e, i) => (
            <path key={"m" + i} d={duong(e)} fill="none" stroke="#e2e8f0" strokeWidth="1.5" markerEnd="url(#mui-mo)" />
          ))}

          {/* Mũi tên đang sáng + nhãn có nền pill (chống chồng chữ) */}
          {canhHien.map((e, i) => {
            const m = mauVai(e.vai_tro);
            const mx = (e.x1 + e.x2) / 2, my = (e.y1 + e.y2) / 2;
            const chu = (VAI_TRO_TEN[e.vai_tro] || e.vai_tro) + ": " + e.nhan;
            const rong = Math.min(chu.length * 5.6 + 12, 190);
            return (
              <g key={"e" + i}>
                <path d={duong(e)} fill="none" stroke={m.net} strokeWidth="2"
                      strokeDasharray={e.moiTruongTat ? "5 3" : undefined} markerEnd={`url(#mui-${e.vai_tro})`} opacity="0.9" />
                <rect x={mx - rong / 2} y={my - 15} width={rong} height="15" rx="7.5" fill="#ffffff" opacity="0.92" stroke={m.nen} />
                <text x={mx} y={my - 4} textAnchor="middle" fontSize="9.5" fontWeight="500" fill={m.net} style={{ pointerEvents: "none" }}>
                  {chu.length > 32 ? chu.slice(0, 31) + "…" : chu}
                </text>
              </g>
            );
          })}

          {/* Node trạng thái */}
          {g.nodes.map((n) => (
            <g key={n.id}>
              <rect x={n.x} y={n.y} width={n.W} height={n.H} rx="12"
                    fill={n.ao ? "#fbfaf7" : n.laDong ? "#eefdf6" : "#ffffff"}
                    stroke={n.ao ? "#cbb994" : n.laDong ? "#0f6e56" : "#cbd5e1"}
                    strokeWidth={n.ao ? 1.5 : 1.75} strokeDasharray={n.ao ? "5 3" : undefined} />
              <text x={n.x + n.W / 2} y={n.y + (n.ao ? 30 : 26)} textAnchor="middle" fontSize="12.5" fontWeight="700" fill={n.ao ? "#9a7b3e" : COLOR.navy}>
                {n.ten.length > 20 ? n.ten.slice(0, 19) + "…" : n.ten}
              </text>
              {n.ao
                ? <text x={n.x + n.W / 2} y={n.y + 46} textAnchor="middle" fontSize="8.5" fill="#b59b6a">áp cho mọi trạng thái</text>
                : <text x={n.x + n.W / 2} y={n.y + 45} textAnchor="middle" fontSize="9" fill="#94a3b8">{n.id}</text>}
            </g>
          ))}
        </svg>
      </div>

      <p className="mt-2 text-[10.5px] text-slate-400">
        Ô nền xanh = trạng thái ĐÓNG sự cố. Mũi tên nét đứt = luật áp cho “mọi trạng thái” (vd nhắc/tạm dừng/ghi chú).
        {vaiChon !== "ALL" && ` Đang xem: ${canhHien.length} chuyển tiếp của ${VAI_TRO_TEN[vaiChon] || vaiChon}.`}
      </p>

      {/* Hành động ghi chú (không đổi trạng thái) — không phải cạnh nên liệt kê riêng */}
      {taiChoHien.length > 0 && (
        <div className="mt-3 rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Hành động ghi chú tại chỗ (bấm nhưng KHÔNG đổi trạng thái)</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {taiChoHien.map((t, i) => (
              <span key={i} className="rounded-lg px-2 py-1 text-[11px]" style={{ background: mauVai(t.vai_tro).nen, color: mauVai(t.vai_tro).net }}>
                <b>{VAI_TRO_TEN[t.vai_tro] || t.vai_tro}</b> · {t.nhan}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
