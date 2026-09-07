// EmailParts.jsx — hướng dẫn nút email + modal phiếu email (tách 17/08/2026: AppShell dùng, không kéo cả ReportsPage vào bundle đầu).
import React, { useId, useState } from "react";
import { createPortal } from "react-dom";
import { Mail } from "lucide-react";
import { Card, SectionTitle } from "../../components/ui/Card";
import { COLOR } from "../../lib/designTokens";
// ═══ HƯỚNG DẪN VẬN HÀNH CẢNH BÁO (v16 — tab Nhiệm vụ, cho mọi người đọc) ═══
// Email chỉ thông báo; mọi thao tác được ghi nhận và xác thực trên web theo bảng luật hiện hành.
function HuongDanEmailNut() {
  return (
    <Card className="p-4 sm:p-5">
      <SectionTitle icon={Mail} hint="Email thông báo việc cần làm; cập nhật xử lý trên BMS">Email cảnh báo và xử lý phiếu</SectionTitle>
      <p className="mt-2 text-[13px] leading-relaxed text-body">Email giúp nhận biết phiếu và mức ưu tiên. Mở <b>Sự cố</b> trên BMS, đối chiếu mã phiếu rồi cập nhật kết quả xử lý tại đó; hệ ghi nhận người thực hiện và lý do khi cần.</p>
      <details className="mt-3 rounded-2xl bg-subtle p-3.5 ring-1 ring-line">
        <summary className="cursor-pointer select-none text-[13px] font-semibold text-body">Xem nhịp nhắc và đường xử lý</summary>
        <div className="mt-3 space-y-3 text-[12px] leading-relaxed text-muted">
          <p><b className="text-info">IPC:</b> chưa tiếp nhận sau 20 phút, hoặc <b className="text-warning">Cơ điện</b> chưa tiếp nhận sau 15 phút, thì hệ báo Trực HSL. Khi đã nhận việc nhưng 60 phút chưa có cập nhật thực chất, hệ gửi nhắc theo người phụ trách.</p>
          <p><b className="text-danger">QA:</b> nhắc tự động tối đa một lần trong mỗi ca 06–14h, 14–22h và 22–06h; hai lần nhắc cách nhau ít nhất 60 phút. Lần đầu xuất hiện khi quá 240 phút chưa có cập nhật thực chất; trường hợp bế tắc được báo ngay. Nhắc thủ công có khoảng chờ 5 phút.</p>
          <p><b className="text-body">Tổng hợp bàn giao:</b> gửi lúc 06:00, 14:00 và 22:00. Tổng hợp QA gửi từ 07:45 trong khung giờ cho phép. Người nhận và lịch gửi phụ thuộc cấu hình vận hành hiện hành.</p>
          <p><b className="text-body">QA và Trực HSL:</b> mở tab <b>Sự cố</b> để xem việc được giao và thao tác phù hợp theo quyền. Khi hiện trường đã sửa, phải ghi nhận kết quả trên BMS để hồ sơ có người thực hiện, thời điểm và lý do.</p>
          <p>Không thao tác trực tiếp từ email. Dùng email mới nhất để nhận diện phiếu, sau đó xử lý trên BMS.</p>
        </div>
      </details>
    </Card>
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
  const idLyDo = useId();
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
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Xác nhận thao tác từ email">
      <div className="w-full max-w-md rounded-3xl bg-surface shadow-2xl p-6">{children}</div>
    </div>, document.body);

  if (trangThai.dangTai) return <Khung><p className="text-sm text-muted py-6 text-center">Đang kiểm tra liên kết…</p></Khung>;

  // Màn từ chối. Câu hỏi đầu tiên của người bấm nút luôn là "vậy tôi đã ấn nút nào?"
  // — DB trả sẵn thao_tac_gan_nhat và nut_kha_dung, ta chỉ việc bày ra.
  if (trangThai.loi || (ketQua && !ketQua.ok)) {
    const boiCanh = ketQua && !ketQua.ok ? ketQua : ve;      // nguồn ngữ cảnh giàu nhất đang có
    const ganNhat = boiCanh?.thao_tac_gan_nhat;
    const khaDung = boiCanh?.nut_kha_dung || [];
    return (
      <Khung>
        <h3 className="text-base font-semibold text-danger">Không thực hiện được</h3>
        <p className="text-sm text-body mt-2 leading-relaxed">{trangThai.loi || ketQua.thong_bao}</p>
        {ganNhat && (
          <div className="mt-3 rounded-2xl bg-subtle ring-1 ring-line p-3 text-[13px]">
            <div className="text-[12px] uppercase tracking-wider text-muted font-semibold">Thao tác gần nhất</div>
            <div className="mt-1 text-body font-medium">{ganNhat.nhan}</div>
            <div className="text-[12px] text-muted">{ganNhat.vai_tro} · {ganNhat.boi} · {ganNhat.luc_hien_thi}</div>
          </div>)}
        {khaDung.length > 0 && (
          <div className="mt-3">
            <div className="text-[12px] uppercase tracking-wider text-muted font-semibold">Bây giờ bạn bấm được</div>
            <ul className="mt-1.5 space-y-1">
              {khaDung.map((n) => (
                <li key={n.hanh_dong} className="text-[13px] text-body flex gap-1.5">
                  <span className="text-muted">•</span>{n.nhan}
                </li>))}
            </ul>
          </div>)}
        <p className="text-[12px] text-muted mt-3">Bạn vẫn có thể xử lý sự cố trực tiếp ở tab <b>Sự cố</b>.</p>
        <button onClick={onDong} className="mt-5 w-full rounded-xl bg-subtle py-2.5 text-sm font-medium text-body">Đóng</button>
      </Khung>);
  }

  if (ketQua?.ok) return (
    <Khung>
      <h3 className="text-base font-semibold text-success">✓ Đã ghi nhận</h3>
      <p className="text-sm text-body mt-2 leading-relaxed">{ketQua.thong_bao}</p>
      <button onClick={onDong} className="mt-5 w-full rounded-xl py-2.5 text-sm font-medium text-white" style={{ backgroundColor: "var(--primary-solid)" }}>Xong</button>
    </Khung>);

  return (
    <Khung>
      <p className="text-[12px] uppercase tracking-wider text-muted font-semibold">Thao tác từ email · {ve.vai_tro_can}</p>
      <h3 className="text-base font-semibold text-strong mt-1">{ve.nhan}</h3>
      <div className="mt-3 rounded-2xl bg-subtle ring-1 ring-line p-3 text-[13px] text-body space-y-1">
        <div><b>{ve.ma_hien_thi}</b> · {ve.ma_phong} {ve.ten_phong ? `— ${ve.ten_phong}` : ""}</div>
        <div className="text-[12px] text-muted">{ve.khu_vuc} · {ve.ahu || "—"} · {ve.loai_cam_bien} · {ve.muc_canh_bao}</div>
        <div className="text-[12px] text-muted">
          Trạng thái: <b>{ve.nhan_trang_thai || ve.trang_thai_hien_tai}</b>
          {ve.giu_trang_thai
            ? <span className="text-muted"> — thao tác này chỉ ghi chú, không đổi trạng thái</span>
            : <> → <b>{ve.nhan_trang_thai_sau || ve.trang_thai_sau}</b>{ve.dong_su_co && <span className="text-success"> (đóng sự cố)</span>}</>}
        </div>
        {ve.thao_tac_gan_nhat && (
          <div className="text-[12px] text-muted">
            Gần nhất: <b>{ve.thao_tac_gan_nhat.nhan}</b> — {ve.thao_tac_gan_nhat.vai_tro} · {ve.thao_tac_gan_nhat.luc_hien_thi}
          </div>)}
        {ve.so_lan_vang > 0 && (
          <div className="text-[12px] text-warning">Đã báo “không tại hiện trường” {ve.so_lan_vang} lần</div>)}
      </div>
      {canNote && (
        <div className="mt-3">
          <label htmlFor={idLyDo} className="text-[12px] uppercase text-muted font-semibold">Nội dung sự cố / biện pháp <span className="text-danger">*</span></label>
          <textarea id={idLyDo} value={lyDo} onChange={(e) => setLyDo(e.target.value)} rows={3} autoFocus
            placeholder="Ví dụ: van điều tiết kẹt, đã chỉnh lại 40% và theo dõi 30 phút"
            className="w-full mt-1.5 rounded-xl bg-surface ring-1 ring-line px-3 py-2 text-sm" />
          <p className="text-[12px] text-muted mt-1">Bắt buộc — ghi vào hồ sơ kiểm toán ALCOA+.</p>
        </div>)}
      <div className="flex gap-2 mt-5">
        <button onClick={onDong} className="flex-1 rounded-xl bg-subtle py-2.5 text-sm font-medium text-body">Huỷ</button>
        <button onClick={xacNhan} disabled={thieuNote || dangChay}
          className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-40"
          style={{ backgroundColor: "var(--primary-solid)" }}>{dangChay ? "Đang lưu…" : "Xác nhận"}</button>
      </div>
    </Khung>);
}


export { HuongDanEmailNut, ModalVeEmail };
