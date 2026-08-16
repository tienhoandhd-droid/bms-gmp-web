// ReportsPage.jsx — trang Báo cáo + hướng dẫn email + modal phiếu email (tách move-only từ App.jsx 17/08/2026).
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
  const sel = "rounded-xl bg-surface ring-1 ring-line px-3 py-2 text-[13px] text-body outline-none";
  const AI_LV = ["text-success bg-success-soft ring-success-line", "text-info bg-info-soft ring-info-line", "text-warning bg-warning-soft ring-warning-line", "text-danger bg-danger-soft ring-danger-line"];
  return (
    <div className="space-y-5">
      <SectionTitle icon={FileBarChart}>Báo cáo & Phân tích AI</SectionTitle>
      <Card className="p-6"><SectionTitle icon={Sparkles} hint="tích hợp từ tab Xu hướng">Nhận định xu hướng</SectionTitle>
        {ai ? <div className="rounded-2xl ring-1 ring-success-line p-5 text-sm leading-relaxed text-body mt-4" style={{ background: "var(--bg-subtle)" }}><p className="text-[12px] text-muted mb-2">{ai.scope} · {ai.sensor} · {ai.range} · lập lúc {ai.time}</p><AiSections text={ai.text} /></div> : <div className="rounded-2xl ring-1 ring-warning-line bg-warning-soft/50 p-5 text-sm text-body mt-4">Chưa có nhận định. Vào tab <b>Xu hướng</b>, chọn đối tượng/khoảng thời gian rồi bấm <b>AI phân tích</b>.</div>}
        {aiRows && aiRows.length > 0 && (
          <div className="mt-5">
            <p className="text-[12px] uppercase tracking-wider text-muted font-semibold mb-2 flex items-center gap-1.5"><History className="w-3 h-3" strokeWidth={1.8} /> Nhận định gần đây</p>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">{aiRows.map((r, i) => (
              <div key={i} className="rounded-2xl bg-subtle ring-1 ring-line/70 p-3.5">
                <div className="flex items-center justify-between gap-2 mb-1"><span className="text-[12px] font-semibold" style={{ color: "var(--text-strong)" }}>{r.scope}<span className="text-muted font-normal"> · {r.sensor} · {r.range}</span></span><span className={`text-[12px] font-semibold px-2 py-0.5 rounded-full ring-1 ${AI_LV[r.level] || AI_LV[0]}`}>{r.time}</span></div>
                <p className="text-[12px] leading-relaxed text-body">{r.text}</p>
              </div>
            ))}</div>
          </div>
        )}
      </Card>
      <Card className="p-6"><SectionTitle icon={Mail} hint="báo cáo quản trị — kỳ liền trước">Gửi lại báo cáo (email)</SectionTitle>
        <p className="text-[12px] text-muted mt-3">Dùng khi cần gửi lại báo cáo của kỳ đã qua (ví dụ lịch tự động bị lỡ). Hệ thống tổng hợp số liệu thật, ráp scorecard + PDF rồi gửi email trong nền (~1 phút).</p>
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <label className="text-[12px] uppercase text-muted font-semibold">Kỳ báo cáo</label>
          <select value={kyBu} onChange={(e) => setKyBu(e.target.value)} className={sel}>
            {KY_BU.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
          <button onClick={guiBu} disabled={guiTT === "DANG_GUI" || !wf5Url}
            className={`text-xs font-medium rounded-xl px-4 py-2 text-white flex items-center gap-1.5 ${guiTT === "DANG_GUI" ? "opacity-60 cursor-wait" : !wf5Url ? "opacity-50 cursor-not-allowed" : ""}`}
            style={{ backgroundColor: "var(--danger-solid)" }}>
            <Mail className="w-3.5 h-3.5" strokeWidth={1.8} />
            {guiTT === "DANG_GUI" ? "Đang gửi yêu cầu…" : "Gửi lại báo cáo"}
          </button>
          <button onClick={() => window.print()} className="text-xs font-medium rounded-xl px-4 py-2 text-body ring-1 ring-line bg-surface hover:bg-subtle flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" strokeWidth={1.8} /> In hoặc lưu PDF</button>
        </div>
        {guiTT && guiTT !== "DANG_GUI" && (guiTT.ok
          ? <p className="text-xs text-success font-medium mt-3">✓ {guiTT.message || "Đã nhận yêu cầu — báo cáo sẽ được tạo và gửi email trong vài phút."}</p>
          : <p className="text-xs text-danger font-medium mt-3">✗ Không gửi được yêu cầu ({guiTT.error === "CHUA_CAU_HINH_WEBHOOK" ? "chưa cấu hình cau_hinh.wf5_webhook_bao_cao_bu" : guiTT.error}). Thử lại hoặc báo IT.</p>)}
        <p className="text-[12px] text-muted mt-3">Danh sách người nhận quản lý ở tab <b>Người nhận</b>; chưa kích hoạt ai thì gửi về địa chỉ dự phòng trong mục Người nhận → Địa chỉ hệ thống. File PDF/HTML đồng thời được lưu vào Drive nội bộ.</p>
      </Card>
    </div>
  );
}




export default ReportsPage;
