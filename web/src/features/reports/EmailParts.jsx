// EmailParts.jsx — hướng dẫn nút email + modal phiếu email (tách 17/08/2026: AppShell dùng, không kéo cả ReportsPage vào bundle đầu).
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Mail } from "lucide-react";
import { Card, SectionTitle } from "../../components/ui/Card";
import { COLOR } from "../../lib/designTokens";
// ═══ HƯỚNG DẪN NÚT EMAIL (17/07 — tab Nhiệm vụ, cho mọi người đọc) ═══
// Nội dung TĨNH khớp bảng luật + sơ đồ vòng đời: email gửi nút gì, bấm mỗi nút phiếu đi đâu.
function HuongDanEmailNut() {
  const Nut = ({ mau, khoa, children }) => (
    <span className={`inline-block shrink-0 rounded-lg px-2.5 py-1 text-[12px] font-bold ${khoa ? "bg-subtle text-muted ring-1 ring-dashed ring-line-strong" : mau}`}>{khoa ? "🔒 " : ""}{children}</span>
  );
  const Dong = ({ nut, mau, khoa, kq }) => (
    <div className="flex items-start gap-2.5">
      <Nut mau={mau} khoa={khoa}>{nut}</Nut>
      <span className="pt-0.5 text-[12px] leading-snug text-body">→ {kq}</span>
    </div>
  );
  return (
    <Card className="p-4 sm:p-5">
      <SectionTitle icon={Mail} hint="khớp bảng luật đang chạy — email nhắc 2 giờ/lần, chỉ gửi trong khung 07:45–16:45">Email cảnh báo — bấm nút nào, phiếu đi đâu</SectionTitle>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl ring-1 ring-info-line bg-info-soft/40 p-4">
          <p className="text-[13px] font-bold text-info">📧 Email IPC — toàn cảnh khu · 4 nút</p>
          <p className="mt-0.5 text-[12px] text-muted">nút hiện khi phiếu ở: Chưa xử lý · Mở lại (phiếu bế tắc: chỉ Cơ điện tự gỡ bằng "Đã có vật tư")</p>
          <div className="mt-3 space-y-2">
            <Dong nut="Chuyển Cơ điện xử lý" mau="bg-info-soft text-info" kq={<>phiếu sang <b>Đã báo Cơ điện</b> — đường duy nhất sang tay</>} />
            <Dong nut="Đã kiểm tra — Bình thường ✍" mau="bg-info-soft text-info" kq={<><b>ĐÓNG phiếu</b> — cảnh báo giả (IPC đã ra tận nơi, bắt ghi lý do)</>} />
            <Dong nut="Đã khắc phục sự cố ✍" mau="bg-info-soft text-info" kq={<><b>ĐÓNG phiếu</b> — IPC tự xử lý được tại chỗ</>} />
            <Dong nut="Không tại hiện trường ⟳" mau="bg-info-soft text-info" kq={<>phiếu đứng yên · <b>ân hạn 1 giờ</b>, quá thì lên Trực</>} />
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">Mail còn mục 2 <b>"Cơ điện đang xử lý"</b> — chỉ theo dõi, không nút. Phiếu đã sang Cơ điện thì IPC còn đúng 2 nút đóng (luật "mọi trạng thái" — không phải mất nút). <span className="text-danger font-medium">Nhận mail rồi im lặng quá 20′ → phiếu tự lên Trực.</span></p>
        </div>
        <div className="rounded-2xl ring-1 ring-warning-line bg-warning-soft/40 p-4">
          <p className="text-[13px] font-bold text-warning">📧 Email Cơ điện — theo khu/AHU · đủ 5 nút ngay từ mail đầu</p>
          <p className="mt-0.5 text-[12px] text-muted">2 nút bấm được ngay + 3 nút 🔒 mở khóa SAU khi bấm "Đã nhận"</p>
          <div className="mt-3 space-y-2">
            <Dong nut="Đã nhận — đang xử lý" mau="bg-warning-soft text-warning" kq={<>phiếu sang <b>Đang xử lý</b> · đồng hồ im lặng nới thành 1 giờ</>} />
            <Dong nut="Không tại hiện trường ⟳" mau="bg-warning-soft text-warning" kq={<>phiếu đứng yên · <b>ân hạn 1 giờ</b>, quá thì lên Trực</>} />
            <Dong nut="Đã khắc phục ✍" khoa kq={<><b>ĐÓNG phiếu</b> — xong việc, hết email</>} />
            <Dong nut="Không thể xử lý ✍" khoa kq={<span className="text-danger"><b>bế tắc</b> — Trực + QA được báo NGAY LẬP TỨC</span>} />
            <Dong nut="Chờ xử lý (khi rảnh)" khoa kq={<>phiếu sang <b>Chờ xử lý</b> — vẫn nhắc 2h/lần, đồng hồ 1 giờ</>} />
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">Nút 🔒 là link thật: bấm <b>sau khi</b> "Đã nhận" là chạy luôn; bấm sớm máy chủ từ chối đúng trình tự, <b>không mất lượt</b>. <span className="text-danger font-medium">Chưa nhận việc mà im lặng quá 15′ → phiếu lên Trực.</span></p>
        </div>
        <div className="rounded-2xl ring-1 ring-danger-line bg-danger-soft/40 p-4 lg:col-span-2">
          <p className="text-[13px] font-bold text-danger">🚨 Nhiệm vụ Trực HSL — tầng điều phối cuối · 3 nút</p>
          <p className="mt-0.5 text-[12px] text-muted">phiếu "kêu cứu" lên Trực khi: IPC im lặng &gt; 20′ · Cơ điện chưa nhận việc &gt; 15′ · đang/chờ xử lý &gt; 1 giờ · báo vắng quá 1 giờ · "không xử lý được" → lên NGAY + CC QA</p>
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            <Dong nut="Nhắc IPC ⟳" mau="bg-danger-soft text-danger" kq={<>phiếu giữ nguyên — IPC nhận thêm mail nhắc ra hiện trường (có ghi hồ sơ)</>} />
            <Dong nut="Nhắc Cơ điện ⟳" mau="bg-danger-soft text-danger" kq={<>phiếu giữ nguyên — Cơ điện nhận thêm mail nhắc tiếp nhận / xử lý</>} />
            <Dong nut="Tạm dừng cảnh báo 4 giờ ✍" mau="bg-danger-soft text-danger" kq={<>tắt chuông tối đa <b>4 giờ</b>, bắt ghi lý do — phiếu NGHIÊM TRỌNG / phòng P1 chỉ QA · Quản trị được hoãn</>} />
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">Trực là <b>chốt chặn cuối</b>: chưa ai thao tác thì hệ nhắc Trực lại <b>mỗi 1 giờ</b> tới khi có người bấm nút. Ngoài phiếu leo thang, Trực còn nhận <b>email tổng quan ca 6h · 14h · 22h</b> điểm danh toàn bộ phiếu đang mở.</p>
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-muted">Mỗi nút trong email là liên kết dùng <b>1 lần</b>, sống <b>4 giờ</b> — phiếu để lâu thì dùng email nhắc mới nhất. Bấm nút sẽ mở trang xác nhận, yêu cầu đăng nhập đúng vai trò và đúng khu; nút có ✍ bắt buộc ghi lý do. Email "phiếu đã đóng" không có nút — hết việc để bấm. Mọi email chỉ gửi trong khung giờ <b>07:45–16:45</b>; ngoài giờ phiếu vẫn chạy, sáng hôm sau gửi dồn trong ≤ 5 phút.</p>
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
          <label className="text-[12px] uppercase text-muted font-semibold">Nội dung sự cố / biện pháp <span className="text-danger">*</span></label>
          <textarea value={lyDo} onChange={(e) => setLyDo(e.target.value)} rows={3} autoFocus
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
