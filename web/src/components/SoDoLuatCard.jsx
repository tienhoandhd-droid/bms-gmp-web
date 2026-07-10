// ============================================================
// SoDoLuatCard — hiển thị máy trạng thái sinh TỪ bảng luật (tab Cài đặt)
//
// Không nhúng thư viện Mermaid (nặng + CSP): vẽ bằng danh sách cạnh nhóm theo
// trạng thái nguồn, mỗi cạnh tô màu đúng nút thật (mau_nen từ bảng luật). Kèm
// nút copy chuỗi Mermaid cho ai muốn render ra sơ đồ đồ hoạ ngoài.
// ============================================================
import React, { useMemo, useState } from "react";
import { COLOR } from "../lib/designTokens";
import { phanTichLuat, sinhMermaid, tenTT, VAI_TRO_TEN } from "../lib/soDoLuat";

const MAU_VAI = { IPC: "#e6f1fb", MEP: "#faeeda", LOT: "#fcebeb", QA: "#e7f6f1", ADMIN: "#eef2f7", SYSTEM: "#f1f5f9" };

export default function SoDoLuatCard({ dsNut }) {
  const [daCopy, setDaCopy] = useState(false);
  const { canh, taiCho, theoTu } = useMemo(() => {
    const pt = phanTichLuat(dsNut);
    const theoTu = {};
    for (const c of pt.canh) (theoTu[c.tu] ||= []).push(c);
    return { ...pt, theoTu };
  }, [dsNut]);

  if (!Array.isArray(dsNut) || dsNut.length === 0) {
    return <p className="text-[12px] text-slate-400">Chưa nạp được bảng luật (cần đăng nhập ở chế độ LIVE).</p>;
  }

  const copyMermaid = async () => {
    try { await navigator.clipboard.writeText(sinhMermaid(dsNut)); setDaCopy(true); setTimeout(() => setDaCopy(false), 2000); }
    catch { alert("Trình duyệt chặn clipboard — mở Console và copy thủ công."); }
  };

  const dsTu = Object.keys(theoTu).sort((a, b) => (a === "«mọi trạng thái»" ? 1 : b === "«mọi trạng thái»" ? -1 : a.localeCompare(b)));

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-slate-500 leading-relaxed max-w-2xl">
          Sơ đồ này <b>sinh trực tiếp từ bảng luật</b> (<code>quy_tac_chuyen_trang_thai</code>) — không phải hình vẽ tay,
          nên <b>không thể lệch</b> với hành vi thật của hệ. Mỗi mũi tên là một dòng luật đang kích hoạt; thêm/bớt một nút
          là sơ đồ đổi theo. {canh.length} chuyển tiếp · {taiCho.length} hành động ghi chú tại chỗ.
        </p>
        <button onClick={copyMermaid} className="shrink-0 rounded-xl px-3 py-1.5 text-[12px] font-medium text-slate-600 ring-1 ring-slate-200 bg-white hover:bg-slate-50">
          {daCopy ? "✓ Đã copy Mermaid" : "Copy mã Mermaid"}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {dsTu.map((tu) => (
          <div key={tu} className="rounded-2xl ring-1 ring-slate-200 p-3">
            <div className="text-[12px] font-semibold" style={{ color: COLOR.navy }}>
              {tu === "«mọi trạng thái»" ? "Từ bất kỳ trạng thái nào" : tenTT(tu)}
              <span className="ml-2 text-[10px] font-normal text-slate-400 tabular-nums">{tu === "«mọi trạng thái»" ? "" : tu}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {theoTu[tu].sort((a, b) => a.vai_tro.localeCompare(b.vai_tro)).map((c, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11.5px]" style={{ background: MAU_VAI[c.vai_tro] || "#f1f5f9" }}>
                  <span className="font-semibold text-slate-700">{VAI_TRO_TEN[c.vai_tro] || c.vai_tro}</span>
                  <span className="text-slate-500">{c.nhan}</span>
                  <span className="text-slate-400">→</span>
                  <span className="font-medium text-slate-700">{tenTT(c.den)}</span>
                  {c.dong && <span className="text-[9px] px-1 rounded bg-white/70 text-emerald-700">đóng</span>}
                  {c.moLai && <span className="text-[9px] px-1 rounded bg-white/70 text-sky-700">mở lại</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {taiCho.length > 0 && (
        <div className="mt-3 rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Hành động ghi chú (không đổi trạng thái)</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {taiCho.map((t, i) => (
              <span key={i} className="rounded-lg px-2 py-1 text-[11px]" style={{ background: MAU_VAI[t.vai_tro] || "#f1f5f9" }}>
                <b className="text-slate-700">{VAI_TRO_TEN[t.vai_tro] || t.vai_tro}</b> <span className="text-slate-500">{t.nhan}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
