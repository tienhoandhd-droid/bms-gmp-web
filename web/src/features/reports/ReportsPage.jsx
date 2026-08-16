// ReportsPage.jsx — trang Báo cáo + hướng dẫn email + modal vé email (tách move-only từ App.jsx 17/08/2026).
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileBarChart, History, Mail, Printer, Sparkles } from "lucide-react";
import { Card, SectionTitle } from "../../components/ui/Card";
import { COLOR } from "../../lib/designTokens";
import { guiBaoCaoBu, layWebhookBaoCaoBu } from "../../lib/supabaseData";
import { AiSections } from "../trends/TrendPage";
// ═══ HƯỚNG DẪN NÚT EMAIL (17/07 — tab Nhiệm vụ, cho mọi người đọc) ═══
// Nội dung TĨNH khớp bảng luật + sơ đồ vòng đời: email gửi nút gì, bấm mỗi nút vé đi đâu.
function HuongDanEmailNut() {
  const Nut = ({ mau, khoa, children }) => (
    <span className={`inline-block shrink-0 rounded-lg px-2.5 py-1 text-[11.5px] font-bold ${khoa ? "bg-slate-100 text-slate-400 ring-1 ring-dashed ring-slate-300" : mau}`}>{khoa ? "🔒 " : ""}{children}</span>
  );
  const Dong = ({ nut, mau, khoa, kq }) => (
    <div className="flex items-start gap-2.5">
      <Nut mau={mau} khoa={khoa}>{nut}</Nut>
      <span className="pt-0.5 text-[12px] leading-snug text-slate-600">→ {kq}</span>
    </div>
  );
  return (
    <Card className="p-4 sm:p-5">
      <SectionTitle icon={Mail} hint="khớp bảng luật đang chạy — email nhắc 2 giờ/lần, chỉ gửi trong khung 07:45–16:45">Email cảnh báo — bấm nút nào, vé đi đâu</SectionTitle>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl ring-1 ring-sky-200 bg-sky-50/40 p-4">
          <p className="text-[13px] font-bold text-sky-800">📧 Email IPC — toàn cảnh khu · 4 nút</p>
          <p className="mt-0.5 text-[10.5px] text-slate-500">nút hiện khi vé ở: Chưa xử lý · Mở lại (vé bế tắc: chỉ Cơ điện tự gỡ bằng "Đã có vật tư")</p>
          <div className="mt-3 space-y-2">
            <Dong nut="Chuyển Cơ điện xử lý" mau="bg-sky-100 text-sky-700" kq={<>vé sang <b>Đã báo Cơ điện</b> — đường duy nhất sang tay</>} />
            <Dong nut="Đã kiểm tra — Bình thường ✍" mau="bg-sky-100 text-sky-700" kq={<><b>ĐÓNG vé</b> — cảnh báo giả (IPC đã ra tận nơi, bắt ghi lý do)</>} />
            <Dong nut="Đã khắc phục sự cố ✍" mau="bg-sky-100 text-sky-700" kq={<><b>ĐÓNG vé</b> — IPC tự xử lý được tại chỗ</>} />
            <Dong nut="Không tại hiện trường ⟳" mau="bg-sky-100 text-sky-700" kq={<>vé đứng yên · <b>ân hạn 1 giờ</b>, quá thì lên Trực</>} />
          </div>
          <p className="mt-3 text-[10.5px] leading-relaxed text-slate-500">Mail còn mục 2 <b>"Cơ điện đang xử lý"</b> — chỉ theo dõi, không nút. Vé đã sang Cơ điện thì IPC còn đúng 2 nút đóng (luật "mọi trạng thái" — không phải mất nút). <span className="text-rose-600 font-medium">Nhận mail rồi im lặng quá 20′ → vé tự lên Trực.</span></p>
        </div>
        <div className="rounded-2xl ring-1 ring-amber-200 bg-amber-50/40 p-4">
          <p className="text-[13px] font-bold text-amber-800">📧 Email Cơ điện — theo khu/AHU · đủ 5 nút ngay từ mail đầu</p>
          <p className="mt-0.5 text-[10.5px] text-slate-500">2 nút bấm được ngay + 3 nút 🔒 mở khóa SAU khi bấm "Đã nhận"</p>
          <div className="mt-3 space-y-2">
            <Dong nut="Đã nhận — đang xử lý" mau="bg-amber-100 text-amber-800" kq={<>vé sang <b>Đang xử lý</b> · đồng hồ im lặng nới thành 1 giờ</>} />
            <Dong nut="Không tại hiện trường ⟳" mau="bg-amber-100 text-amber-800" kq={<>vé đứng yên · <b>ân hạn 1 giờ</b>, quá thì lên Trực</>} />
            <Dong nut="Đã khắc phục ✍" khoa kq={<><b>ĐÓNG vé</b> — xong việc, hết email</>} />
            <Dong nut="Không thể xử lý ✍" khoa kq={<span className="text-rose-600"><b>bế tắc</b> — Trực + QA được báo NGAY LẬP TỨC</span>} />
            <Dong nut="Chờ xử lý (khi rảnh)" khoa kq={<>vé sang <b>Chờ xử lý</b> — vẫn nhắc 2h/lần, đồng hồ 1 giờ</>} />
          </div>
          <p className="mt-3 text-[10.5px] leading-relaxed text-slate-500">Nút 🔒 là link thật: bấm <b>sau khi</b> "Đã nhận" là chạy luôn; bấm sớm máy chủ từ chối đúng trình tự, <b>không mất lượt</b>. <span className="text-rose-600 font-medium">Chưa nhận việc mà im lặng quá 15′ → vé lên Trực.</span></p>
        </div>
        <div className="rounded-2xl ring-1 ring-rose-200 bg-rose-50/40 p-4 lg:col-span-2">
          <p className="text-[13px] font-bold text-rose-800">🚨 Nhiệm vụ Trực HSL — tầng điều phối cuối · 3 nút</p>
          <p className="mt-0.5 text-[10.5px] text-slate-500">vé "kêu cứu" lên Trực khi: IPC im lặng &gt; 20′ · Cơ điện chưa nhận việc &gt; 15′ · đang/chờ xử lý &gt; 1 giờ · báo vắng quá 1 giờ · "không xử lý được" → lên NGAY + CC QA</p>
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            <Dong nut="Nhắc IPC ⟳" mau="bg-rose-100 text-rose-700" kq={<>vé giữ nguyên — IPC nhận thêm mail nhắc ra hiện trường (có ghi hồ sơ)</>} />
            <Dong nut="Nhắc Cơ điện ⟳" mau="bg-rose-100 text-rose-700" kq={<>vé giữ nguyên — Cơ điện nhận thêm mail nhắc tiếp nhận / xử lý</>} />
            <Dong nut="Tạm dừng cảnh báo 4 giờ ✍" mau="bg-rose-100 text-rose-700" kq={<>tắt chuông tối đa <b>4 giờ</b>, bắt ghi lý do — vé NGHIÊM TRỌNG / phòng P1 chỉ QA · Quản trị được hoãn</>} />
          </div>
          <p className="mt-3 text-[10.5px] leading-relaxed text-slate-500">Trực là <b>chốt chặn cuối</b>: chưa ai thao tác thì hệ nhắc Trực lại <b>mỗi 1 giờ</b> tới khi có người bấm nút. Ngoài vé leo thang, Trực còn nhận <b>email tổng quan ca 6h · 14h · 22h</b> điểm danh toàn bộ vé đang mở.</p>
        </div>
      </div>
      <p className="mt-3 text-[10.5px] leading-relaxed text-slate-400">Mỗi nút trong email là liên kết dùng <b>1 lần</b>, sống <b>4 giờ</b> — vé để lâu thì dùng email nhắc mới nhất. Bấm nút sẽ mở trang xác nhận, yêu cầu đăng nhập đúng vai trò và đúng khu; nút có ✍ bắt buộc ghi lý do. Email "vé đã đóng" không có nút — hết việc để bấm. Mọi email chỉ gửi trong khung giờ <b>07:45–16:45</b>; ngoài giờ vé vẫn chạy, sáng hôm sau gửi dồn trong ≤ 5 phút.</p>
    </Card>
  );
}


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


// ====== Modal xác nhận thao tác đến từ NÚT TRONG EMAIL (deep link) ======
// Vì sao tồn tại: nút email không thể nhập ghi chú, cũng không biết ai đang bấm.
// Đưa về web ⇒ (1) DB xác thực vai trò + khu qua JWT, (2) nhập được ghi chú bắt
// buộc, (3) audit ghi email THẬT thay vì 'email:IPC', (4) bộ quét link của Gmail
// không thể vô tình thao tác vì mọi thứ chỉ chạy sau khi người dùng bấm Xác nhận.
function ModalVeEmail({ trangThai, onDong, onChay }) {
  const [lyDo, setLyDo] = useState("");
  const [dangChay, setDangChay] = useState(false);
  const [ketQua, setKetQua] = useState(null);
  if (!trangThai) return null;
  const ve = trangThai.ve;
  const canNote = !!ve?.bat_buoc_ly_do;
  const thieuNote = canNote && !lyDo.trim();
  const xacNhan = async () => {
    if (thieuNote || dangChay) return;
    setDangChay(true);
    setKetQua(await onChay(lyDo.trim() || null));
    setDangChay(false);
  };
  const Khung = ({ children }) => createPortal(
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl p-6">{children}</div>
    </div>, document.body);

  if (trangThai.dangTai) return <Khung><p className="text-sm text-slate-500 py-6 text-center">Đang kiểm tra liên kết…</p></Khung>;

  // Màn từ chối. Câu hỏi đầu tiên của người bấm nút luôn là "vậy tôi đã ấn nút nào?"
  // — DB trả sẵn thao_tac_gan_nhat và nut_kha_dung, ta chỉ việc bày ra.
  if (trangThai.loi || (ketQua && !ketQua.ok)) {
    const boiCanh = ketQua && !ketQua.ok ? ketQua : ve;      // nguồn ngữ cảnh giàu nhất đang có
    const ganNhat = boiCanh?.thao_tac_gan_nhat;
    const khaDung = boiCanh?.nut_kha_dung || [];
    return (
      <Khung>
        <h3 className="text-base font-semibold text-rose-700">Không thực hiện được</h3>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{trangThai.loi || ketQua.thong_bao}</p>
        {ganNhat && (
          <div className="mt-3 rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-3 text-[13px]">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Thao tác gần nhất</div>
            <div className="mt-1 text-slate-700 font-medium">{ganNhat.nhan}</div>
            <div className="text-[12px] text-slate-500">{ganNhat.vai_tro} · {ganNhat.boi} · {ganNhat.luc_hien_thi}</div>
          </div>)}
        {khaDung.length > 0 && (
          <div className="mt-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Bây giờ bạn bấm được</div>
            <ul className="mt-1.5 space-y-1">
              {khaDung.map((n) => (
                <li key={n.hanh_dong} className="text-[13px] text-slate-700 flex gap-1.5">
                  <span className="text-slate-300">•</span>{n.nhan}
                </li>))}
            </ul>
          </div>)}
        <p className="text-[12px] text-slate-400 mt-3">Bạn vẫn có thể xử lý sự cố trực tiếp ở tab <b>Sự cố</b>.</p>
        <button onClick={onDong} className="mt-5 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700">Đóng</button>
      </Khung>);
  }

  if (ketQua?.ok) return (
    <Khung>
      <h3 className="text-base font-semibold text-teal-700">✓ Đã ghi nhận</h3>
      <p className="text-sm text-slate-600 mt-2 leading-relaxed">{ketQua.thong_bao}</p>
      <button onClick={onDong} className="mt-5 w-full rounded-xl py-2.5 text-sm font-medium text-white" style={{ backgroundColor: COLOR.teal }}>Xong</button>
    </Khung>);

  return (
    <Khung>
      <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Thao tác từ email · {ve.vai_tro_can}</p>
      <h3 className="text-base font-semibold text-slate-800 mt-1">{ve.nhan}</h3>
      <div className="mt-3 rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-3 text-[13px] text-slate-600 space-y-1">
        <div><b>{ve.ma_hien_thi}</b> · {ve.ma_phong} {ve.ten_phong ? `— ${ve.ten_phong}` : ""}</div>
        <div className="text-[12px] text-slate-500">{ve.khu_vuc} · {ve.ahu || "—"} · {ve.loai_cam_bien} · {ve.muc_canh_bao}</div>
        <div className="text-[12px] text-slate-500">
          Trạng thái: <b>{ve.nhan_trang_thai || ve.trang_thai_hien_tai}</b>
          {ve.giu_trang_thai
            ? <span className="text-slate-400"> — thao tác này chỉ ghi chú, không đổi trạng thái</span>
            : <> → <b>{ve.nhan_trang_thai_sau || ve.trang_thai_sau}</b>{ve.dong_su_co && <span className="text-teal-600"> (đóng sự cố)</span>}</>}
        </div>
        {ve.thao_tac_gan_nhat && (
          <div className="text-[12px] text-slate-500">
            Gần nhất: <b>{ve.thao_tac_gan_nhat.nhan}</b> — {ve.thao_tac_gan_nhat.vai_tro} · {ve.thao_tac_gan_nhat.luc_hien_thi}
          </div>)}
        {ve.so_lan_vang > 0 && (
          <div className="text-[12px] text-amber-700">Đã báo “không tại hiện trường” {ve.so_lan_vang} lần</div>)}
      </div>
      {canNote && (
        <div className="mt-3">
          <label className="text-[11px] uppercase text-slate-500 font-semibold">Nội dung sự cố / biện pháp <span className="text-rose-500">*</span></label>
          <textarea value={lyDo} onChange={(e) => setLyDo(e.target.value)} rows={3} autoFocus
            placeholder="Ví dụ: van điều tiết kẹt, đã chỉnh lại 40% và theo dõi 30 phút"
            className="w-full mt-1.5 rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-sm" />
          <p className="text-[11px] text-slate-400 mt-1">Bắt buộc — ghi vào hồ sơ kiểm toán ALCOA+.</p>
        </div>)}
      <div className="flex gap-2 mt-5">
        <button onClick={onDong} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700">Huỷ</button>
        <button onClick={xacNhan} disabled={thieuNote || dangChay}
          className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-40"
          style={{ backgroundColor: COLOR.teal }}>{dangChay ? "Đang ghi…" : "Xác nhận"}</button>
      </div>
    </Khung>);
}


export { HuongDanEmailNut, ModalVeEmail };
export default ReportsPage;
