// ReportsPage.jsx — trang Báo cáo + hướng dẫn email + modal vé email (tách move-only từ App.jsx 17/08/2026).
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileBarChart, History, Mail, Printer, Sparkles } from "lucide-react";
import { Card, SectionTitle } from "../../components/ui/Card";
import { COLOR } from "../../lib/designTokens";
import { guiBaoCaoBu, layWebhookBaoCaoBu } from "../../lib/supabaseData";
import { AiSections } from "../trends/AiSections";


/* ===== BÁO CÁO ===== */
function ReportsPage({ ai, aiRows = null }) {
  // ==== Gửi báo cáo bù qua WF5 v2 (n8n) — kỳ LIỀN TRƯỚC, chọn để gửi ====
  const [wf5Url, setWf5Url] = useState("");
  const [kyBu, setKyBu] = useState("THANG");           // mặc định: bù THÁNG trước
  const [guiTT, setGuiTT] = useState(null);            // null | 'DANG_GUI' | {ok, message|error}
  useEffect(() => { let huy = false; (async () => { const u = await layWebhookBaoCaoBu(); if (!huy) setWf5Url(u || ""); })(); return () => { huy = true; }; }, []);
  const KY_BU = [
    { key: "THANG", label: "Tháng trước" },
    { key: "TUAN", label: "Tuần trước" },
    { key: "QUY", label: "Quý trước" },
  ];
  const guiBu = async () => {
    if (guiTT === "DANG_GUI") return;
    setGuiTT("DANG_GUI");
    const r = await guiBaoCaoBu(wf5Url, kyBu);
    setGuiTT(r);
  };
  const sel = "rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-[13px] text-slate-700 outline-none";
  const AI_LV = ["text-teal-700 bg-teal-50 ring-teal-200", "text-sky-700 bg-sky-50 ring-sky-200", "text-amber-700 bg-amber-50 ring-amber-200", "text-rose-700 bg-rose-50 ring-rose-200"];
  return (
    <div className="space-y-5">
      <SectionTitle icon={FileBarChart}>Báo cáo & Phân tích AI</SectionTitle>
      <Card className="p-6"><SectionTitle icon={Sparkles} hint="tích hợp từ tab Xu hướng GMP">Phân tích AI</SectionTitle>
        {ai ? <div className="rounded-2xl ring-1 ring-teal-100 p-5 text-sm leading-relaxed text-slate-700 mt-4" style={{ background: "linear-gradient(135deg,#EAF6F3,#fff)" }}><p className="text-[11px] text-slate-500 mb-2">{ai.scope} · {ai.sensor} · {ai.range} · tạo lúc {ai.time}</p><AiSections text={ai.text} /></div> : <div className="rounded-2xl ring-1 ring-amber-100 bg-amber-50/50 p-5 text-sm text-slate-600 mt-4">Chưa có phân tích. Vào tab <b>Xu hướng GMP</b>, chọn đối tượng/khoảng thời gian rồi bấm <b>AI phân tích</b>.</div>}
        {aiRows && aiRows.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2 flex items-center gap-1.5"><History className="w-3 h-3" strokeWidth={1.8} /> Phân tích đã lưu — gần đây</p>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">{aiRows.map((r, i) => (
              <div key={i} className="rounded-2xl bg-slate-50 ring-1 ring-slate-200/70 p-3.5">
                <div className="flex items-center justify-between gap-2 mb-1"><span className="text-[12px] font-semibold" style={{ color: COLOR.navy }}>{r.scope}<span className="text-slate-400 font-normal"> · {r.sensor} · {r.range}</span></span><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 ${AI_LV[r.level] || AI_LV[0]}`}>{r.time}</span></div>
                <p className="text-[12px] leading-relaxed text-slate-600">{r.text}</p>
              </div>
            ))}</div>
          </div>
        )}
      </Card>
      <Card className="p-6"><SectionTitle icon={Mail} hint="báo cáo quản trị WF5 v2 — kỳ liền trước">Gửi báo cáo bù (email)</SectionTitle>
        <p className="text-[12px] text-slate-500 mt-3">Dùng khi cần gửi lại báo cáo của kỳ đã qua (ví dụ lịch tự động bị lỡ). Hệ thống tổng hợp số liệu thật từ Supabase (<code className="text-[11px]">rpc_bao_cao_tong_hop</code>), ráp scorecard + PDF rồi gửi email trong nền (~1 phút).</p>
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <label className="text-[11px] uppercase text-slate-500 font-semibold">Kỳ báo cáo</label>
          <select value={kyBu} onChange={(e) => setKyBu(e.target.value)} className={sel}>
            {KY_BU.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
          <button onClick={guiBu} disabled={guiTT === "DANG_GUI" || !wf5Url}
            className={`text-xs font-medium rounded-xl px-4 py-2 text-white flex items-center gap-1.5 ${guiTT === "DANG_GUI" ? "opacity-60 cursor-wait" : !wf5Url ? "opacity-50 cursor-not-allowed" : ""}`}
            style={{ backgroundColor: COLOR.coral }}>
            <Mail className="w-3.5 h-3.5" strokeWidth={1.8} />
            {guiTT === "DANG_GUI" ? "Đang gửi yêu cầu…" : "Gửi báo cáo bù"}
          </button>
          <button onClick={() => window.print()} className="text-xs font-medium rounded-xl px-4 py-2 text-slate-600 ring-1 ring-slate-200 bg-white hover:bg-slate-50 flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" strokeWidth={1.8} /> In / PDF</button>
        </div>
        {guiTT && guiTT !== "DANG_GUI" && (guiTT.ok
          ? <p className="text-xs text-teal-600 font-medium mt-3">✓ {guiTT.message || "Đã nhận yêu cầu — báo cáo sẽ được tạo và gửi email trong vài phút."}</p>
          : <p className="text-xs text-rose-600 font-medium mt-3">✗ Không gửi được yêu cầu ({guiTT.error === "CHUA_CAU_HINH_WEBHOOK" ? "chưa cấu hình cau_hinh.wf5_webhook_bao_cao_bu" : guiTT.error}). Thử lại hoặc báo IT.</p>)}
        <p className="text-[11px] text-slate-400 mt-3">Người nhận quản lý trong bảng <b>nguoi_nhan_bao_cao</b> (Supabase — bật <code className="text-[10px]">kich_hoat</code> sau khi điền email thật); chưa kích hoạt ai thì gửi về địa chỉ trong <code className="text-[10px]">cau_hinh.email_bao_cao_thang/tuan</code>. File PDF/HTML đồng thời lưu Google Drive.</p>
      </Card>
    </div>
  );
}




export default ReportsPage;
