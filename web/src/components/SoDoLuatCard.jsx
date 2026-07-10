// ============================================================
// SoDoLuatCard — SƠ ĐỒ LUỒNG VẬN HÀNH sinh từ bảng luật (tab Cài đặt)
//
// Thiết kế (sau 3 vòng, tham khảo React Flow / XState viz / process-map):
//   • XƯƠNG SỐNG: chỉ các chuyển tiếp TUẦN TỰ (Chưa xử lý → Đã báo Cơ điện →
//     Cơ điện xử lý → Đã khắc phục). Vẽ như bản đồ quy trình, đọc trái→phải.
//   • HÀNH ĐỘNG BẤT KỲ LÚC NÀO (Quản trị/QA đóng·mở lại, IPC bình thường) tách
//     ra panel riêng — KHÔNG trộn vào xương sống (đó là lý do sơ đồ cũ rối).
//   • Lọc theo vai trò: chọn "Cơ điện" → sáng đúng đường Cơ điện đi.
// Mỗi mũi tên = một dòng quy_tac_chuyen_trang_thai ⇒ không thể lệch luật.
// ============================================================
import React, { useMemo, useState } from "react";
import { COLOR } from "../lib/designTokens";
import { phanTichLuat, sinhMermaid, tenTT, VAI_TRO_TEN } from "../lib/soDoLuat";
import { boCucLuong } from "../lib/soDoLayout";

const VAI = {
  IPC:   { net: "#1e72b8", nen: "#eaf3fb", chu: "#155a91" },
  MEP:   { net: "#c77e12", nen: "#fbf0dc", chu: "#8a5606" },
  LOT:   { net: "#d9534f", nen: "#fbe9e8", chu: "#a5322e" },
  QA:    { net: "#0e9c73", nen: "#e4f7f0", chu: "#0b6e52" },
  ADMIN: { net: "#5b6b7d", nen: "#eef1f5", chu: "#3f4d5c" },
  SYSTEM:{ net: "#64748b", nen: "#f1f5f9", chu: "#475569" },
};
const mv = (v) => VAI[v] || VAI.SYSTEM;

// đường cong: xuôi = bézier ngang; ngược/lên = cung phía trên; cùng cột = cung phải
function duong(e) {
  if (e.nguoc) {
    const midY = Math.min(e.y1, e.y2) - 34;
    return `M ${e.x1} ${e.y1} C ${e.x1} ${midY}, ${e.x2} ${midY}, ${e.x2} ${e.y2}`;
  }
  if (e.cungCot) {
    const off = 46;
    return `M ${e.x1} ${e.y1} C ${e.x1 + off} ${e.y1}, ${e.x2 + off} ${e.y2}, ${e.x2} ${e.y2}`;
  }
  const dx = Math.max(46, (e.x2 - e.x1) * 0.45);
  return `M ${e.x1} ${e.y1} C ${e.x1 + dx} ${e.y1}, ${e.x2 - dx} ${e.y2}, ${e.x2} ${e.y2}`;
}

export default function SoDoLuatCard({ dsNut }) {
  const [vai, setVai] = useState("ALL");
  const [daCopy, setDaCopy] = useState(false);

  const g = useMemo(() => (Array.isArray(dsNut) && dsNut.length ? boCucLuong(dsNut) : null), [dsNut]);
  const { canhBatKy, taiCho, vaiCo } = useMemo(() => {
    const pt = phanTichLuat(dsNut);
    const s = new Set([...pt.canhTuanTu, ...pt.canhBatKy, ...pt.taiCho].map((x) => x.vai_tro));
    return { canhBatKy: pt.canhBatKy, taiCho: pt.taiCho, vaiCo: [...s].sort() };
  }, [dsNut]);

  if (!g) return <p className="text-[12px] text-slate-400">Chưa nạp được bảng luật (cần đăng nhập ở chế độ LIVE).</p>;

  const sang = (v) => vai === "ALL" || v === vai;
  const canhSang = g.edges.filter((e) => sang(e.vai_tro));
  const batKySang = canhBatKy.filter((e) => sang(e.vai_tro));
  const taiChoSang = taiCho.filter((t) => sang(t.vai_tro));

  const copyMermaid = async () => {
    try { await navigator.clipboard.writeText(sinhMermaid(dsNut)); setDaCopy(true); setTimeout(() => setDaCopy(false), 2000); }
    catch { alert("Trình duyệt chặn clipboard."); }
  };

  const denTheoVai = {};
  for (const e of batKySang) (denTheoVai[e.vai_tro] ||= []).push(e);

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-[11.5px] text-slate-500 leading-relaxed max-w-xl">
          <b>Luồng vận hành sự cố</b> đọc từ trái sang phải: IPC phát hiện → chuyển Cơ điện → Cơ điện xử lý → khắc phục.
          Mỗi mũi tên là <b>một nút thật</b> trong bảng luật. Chọn một bộ phận để xem đúng đường nó đi khi bấm nút.
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

      {/* XƯƠNG SỐNG — sơ đồ quy trình */}
      <div className="mt-3 overflow-x-auto rounded-2xl ring-1 ring-slate-200 bg-gradient-to-b from-slate-50 to-white p-3">
        <svg width={g.width} height={g.height} style={{ minWidth: g.width }} className="block">
          <defs>
            {Object.entries(VAI).map(([k, m]) => (
              <marker key={k} id={`ar-${k}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto-start-reverse">
                <path d="M 0 1 L 9 5 L 0 9 z" fill={m.net} />
              </marker>
            ))}
            <marker id="ar-mo" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#d7dee6" />
            </marker>
          </defs>

          {/* mũi tên mờ (vai khác) */}
          {vai !== "ALL" && g.edges.filter((e) => !sang(e.vai_tro)).map((e, i) => (
            <path key={"d" + i} d={duong(e)} fill="none" stroke="#e8edf2" strokeWidth="1.5" markerEnd="url(#ar-mo)" />
          ))}

          {/* mũi tên sáng + nhãn nền pill */}
          {canhSang.map((e, i) => {
            const m = mv(e.vai_tro);
            const lx = e.nguoc ? (e.x1 + e.x2) / 2 : (e.x1 + e.x2) / 2;
            const ly = e.nguoc ? Math.min(e.y1, e.y2) - 30 : (e.y1 + e.y2) / 2 - 11;
            const chu = e.nhan.length > 26 ? e.nhan.slice(0, 25) + "…" : e.nhan;
            const w = chu.length * 5.7 + 14;
            return (
              <g key={"e" + i}>
                <path d={duong(e)} fill="none" stroke={m.net} strokeWidth="2.25" markerEnd={`url(#ar-${e.vai_tro})`} opacity="0.92" />
                <rect x={lx - w / 2} y={ly - 8} width={w} height="16" rx="8" fill="#fff" stroke={m.net} strokeOpacity="0.35" />
                <text x={lx} y={ly + 3.5} textAnchor="middle" fontSize="10" fontWeight="600" fill={m.chu || m.net} style={{ pointerEvents: "none" }}>{chu}</text>
              </g>
            );
          })}

          {/* node trạng thái — thẻ có dải màu trái theo "ai vừa đưa vào" (đích), tiêu đề rõ */}
          {g.nodes.map((n) => (
            <g key={n.id}>
              <rect x={n.x} y={n.y} width={n.W} height={n.H} rx="14"
                    fill={n.laDong ? "#ecfdf5" : "#ffffff"} stroke={n.laDong ? "#10b981" : "#d5dee7"} strokeWidth="2"
                    style={{ filter: "drop-shadow(0 2px 4px rgba(15,23,42,0.06))" }} />
              {n.laDong && <rect x={n.x} y={n.y} width="6" height={n.H} rx="3" fill="#10b981" />}
              <text x={n.x + n.W / 2} y={n.y + n.H / 2 - 3} textAnchor="middle" fontSize="13.5" fontWeight="700" fill={COLOR.navy}>
                {n.ten.length > 22 ? n.ten.slice(0, 21) + "…" : n.ten}
              </text>
              <text x={n.x + n.W / 2} y={n.y + n.H / 2 + 13} textAnchor="middle" fontSize="9" fill="#a3b0be">{n.laDong ? "trạng thái đóng" : n.id}</text>
            </g>
          ))}
        </svg>
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
