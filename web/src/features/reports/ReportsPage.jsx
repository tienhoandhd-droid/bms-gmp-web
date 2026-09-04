// ReportsPage.jsx — trang Báo cáo + hướng dẫn email + modal phiếu email (tách move-only từ App.jsx 17/08/2026).
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Activity, AlertOctagon, ClipboardCheck, FileBarChart, History, Mail, Printer, ShieldCheck } from "lucide-react";
import { Card, SectionTitle } from "../../components/ui/Card";
import { KhungLoi } from "../../components/ui/KhungLoi";
import { COLOR } from "../../lib/designTokens";
import { guiBaoCaoBu, layWebhookBaoCaoBu } from "../../lib/supabaseData";
import { AiSections } from "../trends/AiSections";


/* ===== BÁO CÁO ===== */
function ReportsPage({ ai, aiRows = null }) {
  // ==== Gửi báo cáo bù qua WF5 v2 (n8n) — kỳ LIỀN TRƯỚC, chọn để gửi ====
  const [wf5Url, setWf5Url] = useState("");
  const [kyBu, setKyBu] = useState("THANG");           // mặc định: bù THÁNG trước
  const [guiTT, setGuiTT] = useState(null);            // null | 'DANG_GUI' | {ok, message|error}
  // Đợt C 04/09/2026: tách 3 trạng thái nạp địa chỉ gửi — trước đây lỗi mạng và "chưa cấu hình"
  // đều làm nút xám câm, người dùng không biết vì sao không gửi được.
  const [napTT, setNapTT] = useState("DANG_TAI");      // 'DANG_TAI' | 'OK' | 'CHUA_CAU_HINH' | {loi}
  const [lanNap, setLanNap] = useState(0);
  useEffect(() => {
    let huy = false; setNapTT("DANG_TAI");
    (async () => {
      const r = await layWebhookBaoCaoBu();
      if (huy) return;
      if (r.error) { setNapTT({ loi: r.error }); return; }
      setWf5Url(r.url); setNapTT(r.url ? "OK" : "CHUA_CAU_HINH");
    })();
    return () => { huy = true; };
  }, [lanNap]);
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
  const NHAN_DINH_LV = ["text-success bg-success-soft ring-success-line", "text-info bg-info-soft ring-info-line", "text-warning bg-warning-soft ring-warning-line", "text-danger bg-danger-soft ring-danger-line"];
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <SectionTitle icon={FileBarChart}>Báo cáo GMP</SectionTitle>
          <p className="mt-1 text-[12px] text-muted">Kết luận kỳ, bằng chứng dữ liệu, phản hồi bộ phận và thao tác xuất hồ sơ.</p>
        </div>
        <span className="rounded-full bg-subtle px-3 py-1 text-[12px] font-semibold text-muted ring-1 ring-line">Hồ sơ kiểm soát</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-success" strokeWidth={1.8} /><p className="text-[12px] font-semibold uppercase text-muted">Kết luận</p></div>
          <p className="mt-2 text-[13px] text-body">Nhận định đã lưu từ tab Xu hướng là phần mở đầu cho báo cáo kỳ.</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-info" strokeWidth={1.8} /><p className="text-[12px] font-semibold uppercase text-muted">Bằng chứng</p></div>
          <p className="mt-2 text-[13px] text-body">Số liệu, biểu đồ, OOS và độ đầy đủ dữ liệu được giữ theo phạm vi đã chọn.</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2"><AlertOctagon className="h-4 w-4 text-danger" strokeWidth={1.8} /><p className="text-[12px] font-semibold uppercase text-muted">Hành động</p></div>
          <p className="mt-2 text-[13px] text-body">Gửi lại báo cáo kỳ trước hoặc in/lưu PDF khi cần bổ sung hồ sơ.</p>
        </Card>
      </div>

      <Card className="p-6"><SectionTitle icon={ClipboardCheck} hint="tổng hợp từ tab Xu hướng">Nhận định hỗ trợ</SectionTitle>
        {ai ? <div className="rounded-xl ring-1 ring-success-line p-5 text-sm leading-relaxed text-body mt-4" style={{ background: "var(--bg-subtle)" }}><p className="text-[12px] text-muted mb-2">{ai.scope} · {ai.sensor} · {ai.range} · lập lúc {ai.time}</p><AiSections text={ai.text} /></div> : <div className="rounded-xl ring-1 ring-warning-line bg-warning-soft/50 p-5 text-sm text-body mt-4">Chưa có nhận định. Vào tab <b>Xu hướng</b>, chọn đối tượng/khoảng thời gian rồi bấm <b>Lập nhận định</b>.</div>}
        {aiRows && aiRows.length > 0 && (
          <div className="mt-5">
            <p className="text-[12px] uppercase text-muted font-semibold mb-2 flex items-center gap-1.5"><History className="w-3 h-3" strokeWidth={1.8} /> Nhận định gần đây</p>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">{aiRows.map((r, i) => (
              <div key={i} className="rounded-xl bg-subtle ring-1 ring-line/70 p-3.5">
                <div className="flex items-center justify-between gap-2 mb-1"><span className="text-[12px] font-semibold" style={{ color: "var(--text-strong)" }}>{r.scope}<span className="text-muted font-normal"> · {r.sensor} · {r.range}</span></span><span className={`text-[12px] font-semibold px-2 py-0.5 rounded-full ring-1 ${NHAN_DINH_LV[r.level] || NHAN_DINH_LV[0]}`}>{r.time}</span></div>
                <p className="text-[12px] leading-relaxed text-body">{r.text}</p>
              </div>
            ))}</div>
          </div>
        )}
      </Card>
      <Card className="p-6"><SectionTitle icon={Mail} hint="báo cáo quản trị — kỳ liền trước">Gửi lại báo cáo (email)</SectionTitle>
        <p className="text-[12px] text-muted mt-3">Dùng khi cần gửi lại báo cáo của kỳ đã qua. Hệ thống tổng hợp số liệu đo, lập báo cáo PDF và gửi email theo danh sách người nhận đã cấu hình.</p>
        {napTT === "DANG_TAI" && <div className="mt-4 h-10 w-72 max-w-full rounded-xl bg-subtle animate-pulse" role="status" aria-label="Đang kiểm tra cấu hình gửi báo cáo" />}
        {napTT && napTT.loi && <KhungLoi gon className="mt-4" tieuDe="Chưa kiểm tra được cấu hình gửi báo cáo" loi={napTT.loi} onThuLai={() => setLanNap((n) => n + 1)} />}
        {napTT === "CHUA_CAU_HINH" && <p className="mt-4 rounded-xl bg-warning-soft ring-1 ring-warning-line px-4 py-2.5 text-[12px] text-warning font-medium" role="status">Chưa cấu hình địa chỉ gửi báo cáo bù — liên hệ Quản trị hệ thống để thêm vào Cấu hình.</p>}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <label htmlFor="ky-bao-cao-bu" className="text-[12px] uppercase text-muted font-semibold">Kỳ báo cáo</label>
          <select id="ky-bao-cao-bu" value={kyBu} onChange={(e) => setKyBu(e.target.value)} className={sel}>
            {KY_BU.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
          <button onClick={guiBu} disabled={guiTT === "DANG_GUI" || !wf5Url} aria-disabled={!wf5Url || undefined}
            className={`text-xs font-medium rounded-xl px-4 py-2 text-white flex items-center gap-1.5 ${guiTT === "DANG_GUI" ? "opacity-60 cursor-wait" : !wf5Url ? "opacity-50 cursor-not-allowed" : ""}`}
            style={{ backgroundColor: "var(--danger-solid)" }}>
            <Mail className="w-3.5 h-3.5" strokeWidth={1.8} />
            {guiTT === "DANG_GUI" ? "Đang gửi yêu cầu…" : "Gửi lại báo cáo"}
          </button>
          <button onClick={() => window.print()} className="text-xs font-medium rounded-xl px-4 py-2 text-body ring-1 ring-line bg-surface hover:bg-subtle flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" strokeWidth={1.8} /> In hoặc lưu PDF</button>
        </div>
        {guiTT && guiTT !== "DANG_GUI" && (guiTT.ok
          ? <p className="text-xs text-success font-medium mt-3">✓ {guiTT.message || "Đã nhận yêu cầu — báo cáo sẽ được tạo và gửi email trong vài phút."}</p>
          : <p className="text-xs text-danger font-medium mt-3">✗ Không gửi được yêu cầu ({guiTT.error === "CHUA_CAU_HINH_WEBHOOK" ? "chưa cấu hình điểm gửi báo cáo — liên hệ quản trị hệ thống" : guiTT.error}). Thử lại hoặc báo IT.</p>)}
        <p className="text-[12px] text-muted mt-3">Danh sách người nhận quản lý ở tab <b>Người nhận</b>; chưa kích hoạt ai thì gửi về địa chỉ dự phòng trong mục Người nhận → Địa chỉ hệ thống. File PDF/HTML đồng thời được lưu vào kho hồ sơ nội bộ.</p>
      </Card>
    </div>
  );
}




export default ReportsPage;
