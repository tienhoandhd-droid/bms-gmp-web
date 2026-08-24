// WF6 "Đánh giá tình trạng" — dead-man BA TẦNG:
//   (1) mất dữ liệu — rollup GIỜ trễ quá ngưỡng (bản gốc)
//   (2) đình trệ     — WF8 ngừng nhắc dù có sự cố mở > 2h (bản gốc)
//   (3) MẤT NGUỒN    — 11/08/2026: canh mạch PHÚT + đọc thẳng phong_hop_le của WF1.
//
// SỬA 11/08 (chủ hệ thống đọc thư 11:05 và chỉ ra): thư cũ TỰ MÂU THUẪN — tiêu đề
// hô "FMS không trả dữ liệu" trong khi thân thư in "Mạch phút 2 phút trước" và
// "WF1 57 phòng · ok". Ba cái phải sửa:
//   a) CHỈ in tín hiệu ĐANG ĐỬe (cờ .do), tín hiệu khoẻ gồn một dòng "còn bình thường".
//   b) Tiêu đề nói ĐÚNG lý do kích hoạt, không đổ hết cho FMS — mạch phút đứng còn
//      có thể do Edge Function / pg_net chứ chưa chắc FMS.
//   c) KHÔNG khẳng định hộ web. RPC nay trả `web_da_to_xam`; chỉ nói web đã ngừng
//      chấm đạt KHI cờ đó bật. (Ở mốc 2 phút web vẫn chấm bình thường — ngưỡng
//      tô xám là 150 phút.)
// CHỐNG SPAM: quét 30' nhưng mỗi LOẠI chỉ gửi lại sau >= giam_sat_re_gui_gio giờ.
const row = $json || {};
const kq  = row.kq  || {};
const cfg = row.cfg || {};
const ng  = row.nguon || {};
const soKhongNhac = Number(row.so_su_co_khong_nhac || 0);
const TEST = String(cfg.che_do_thu_nghiem ?? 'true').toLowerCase() === 'true';

const matDuLieu    = kq.mat_du_lieu === true;
const alertStalled = soKhongNhac > 0;
const matNguon     = ng.mat_nguon === true;
const coVanDe      = matDuLieu || alertStalled || matNguon;

const reGuiGio = Math.max(0.5, Number(cfg.giam_sat_re_gui_gio || 2));
const daDuGio = (moc) => !moc || (Date.now() - new Date(moc).getTime()) >= reGuiGio * 3600 * 1000;
const guiDL = matDuLieu    && daDuGio(row.lan_canh_bao_mat_dl);
const guiAL = alertStalled && daDuGio(row.lan_canh_bao_dinh_tre);
const guiNG = matNguon     && daDuGio(row.lan_canh_bao_nguon);
const nenGui = guiDL || guiAL || guiNG;

// Người nhận theo LOẠI. Mất nguồn dùng email_mat_nguon (11/08: chủ hệ thống không
// nằm trong email_it_gmp nên suốt 85 phút không nhận được gì). Đình trệ vẫn CC QA.
const to = cfg.email_it_gmp || cfg.email_test || '';
const tach = (s) => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
const dsNhan = new Set();
if (matNguon) tach(cfg.email_mat_nguon || to).forEach(e => dsNhan.add(e));
if (matDuLieu || alertStalled) tach(to).forEach(e => dsNhan.add(e));
if (alertStalled) tach(cfg.email_qa).forEach(e => dsNhan.add(e));
const toFinal = [...dsNhan].join(',');

const from  = cfg.email_gui_tu || 'bms-alert@cpc1hn.vn';
const when  = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const bucket = kq.bucket_moi_nhat
  ? new Date(kq.bucket_moi_nhat).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  : '(chưa có dữ liệu)';
const lc = kq.lan_chay_cuoi || null;
const treGio = kq.tre_gio;
const nguong = kq.nguong_gio ?? 2;
const treTxt = (treGio == null) ? 'chưa có dữ liệu giờ nào' : (treGio + ' giờ');
const lcTrangThaiRaw = lc?.trang_thai || null;
const lcTrangThai = lcTrangThaiRaw === 'ok'
  ? 'thành công'
  : lcTrangThaiRaw === 'failed'
    ? 'lỗi'
    : lcTrangThaiRaw === 'partial'
      ? 'chưa đầy đủ'
      : (lcTrangThaiRaw || 'không rõ');
const lcTxt  = lc ? ('Luồng thu dữ liệu · ' + lcTrangThai) : '(không rõ)';
const maTrangThai = kq.ma_trang_thai || ng.ma_trang_thai || null;
const wf1ChiTiet = kq.wf1_gan_nhat || ng.wf1_gan_nhat || {};
const bucketChiTiet = kq.bucket || ng.bucket || {};
const ngoaiLe6h = kq.ngoai_le_6h || ng.ngoai_le_6h || {};
const nhanNguyenNhan = maTrangThai === 'WF1_PIPELINE_ERROR'
  ? 'hệ thống n8n bị lỗi nên không có dữ liệu'
  : maTrangThai === 'FMS_DATA_LOSS'
    ? 'hệ thống BMS lỗi nên dữ liệu FMS bị trống'
    : maTrangThai === 'FMS_UNREACHABLE'
      ? 'hệ thống FMS bị lỗi nên mất dữ liệu'
      : 'mất dữ liệu giám sát HVAC';
const truongHop = maTrangThai === 'WF1_PIPELINE_ERROR'
  ? 'Nguyên nhân 1 — Do hệ thống n8n bị lỗi nên không có dữ liệu'
  : maTrangThai === 'FMS_DATA_LOSS'
    ? 'Nguyên nhân 3 — Do hệ thống BMS lỗi nên dữ liệu FMS bị trống'
    : maTrangThai === 'FMS_UNREACHABLE'
      ? 'Nguyên nhân 2 — Do hệ thống FMS bị lỗi nên mất dữ liệu'
      : 'Nguyên nhân chưa phân loại — cần kiểm n8n, FMS và BMS';
const huongDanDL = maTrangThai === 'WF1_PIPELINE_ERROR'
  ? 'Kiểm tra n8n và luồng thu dữ liệu chính. Nếu toàn bộ n8n dừng, email này cũng có thể không gửi được; cần kiểm tra thêm bằng kênh giám sát ngoài n8n.'
  : maTrangThai === 'FMS_DATA_LOSS'
    ? 'Luồng thu dữ liệu vẫn chạy nhưng nhận về 0 điểm đo. Kiểm tra cấu hình đọc dữ liệu BMS, danh sách điểm đo và dữ liệu lịch sử trên FMS.'
    : maTrangThai === 'FMS_UNREACHABLE'
      ? 'Kiểm tra hệ thống FMS, tài khoản FMS, đường truyền tới FMS và lần chạy gần nhất của luồng thu dữ liệu.'
      : 'Kiểm n8n, FMS, BMS và bảng ngoại lệ dữ liệu.';
const tomTatNguon = kq.tom_tat || ng.tom_tat || huongDanDL;

// ---- Khối MẤT NGUỒN: chỉ liệt kê tín hiệu đang có vấn đề -----------------------
const mp = ng.mach_phut || {}; const mg = ng.mach_gio || {}; const wf1 = wf1ChiTiet;
const hang = [];
const khoe = [];
const dong = (nhan, gt) => `<tr><td style="padding:4px 0;color:#90a8bd">${nhan}</td><td style="padding:4px 0;font-weight:600;color:#9f1239">${gt}</td></tr>`;
if (mp.do) hang.push(dong('Mạch phút', (mp.tuoi_phut == null ? 'không có điểm nào' : 'đứng ' + mp.tuoi_phut + ' phút') + ' · ngưỡng ' + (mp.nguong ?? '?') + "'"));
else if (mp.tuoi_phut != null) khoe.push('mạch phút ' + mp.tuoi_phut + "' trước");
if (mg.do) hang.push(dong('Dữ liệu giờ', (mg.tuoi_phut == null ? 'chưa có mốc dữ liệu nào' : 'đứng ' + mg.tuoi_phut + ' phút') + ' · ngưỡng ' + (mg.nguong_gio ?? '?') + 'h'));
else if (mg.tuoi_phut != null) khoe.push('dữ liệu giờ ' + mg.tuoi_phut + "' trước");
if (wf1.do) {
  const diem = wf1.diem_thu_duoc != null ? ' · ' + wf1.diem_thu_duoc + ' điểm đo' : '';
  const rong = wf1.phong_rong != null ? ' · ' + wf1.phong_rong + ' phòng rỗng' : '';
  const trangThaiGhi = wf1.trang_thai_ghi === 'ok'
    ? 'thành công'
    : wf1.trang_thai_ghi === 'failed'
      ? 'lỗi'
      : wf1.trang_thai_ghi === 'partial'
        ? 'chưa đầy đủ'
        : wf1.trang_thai_ghi;
  hang.push(dong('Luồng thu dữ liệu gần nhất', 'xử lý ' + (wf1.phong_hop_le ?? '?') + ' phòng' + diem + rong + (trangThaiGhi ? ' (nhật ký ghi “' + trangThaiGhi + '”)' : '')));
} else if (wf1.phong_hop_le != null) khoe.push('luồng thu dữ liệu thu ' + wf1.phong_hop_le + ' phòng');
if (maTrangThai === 'FMS_DATA_LOSS') {
  hang.push(dong('Dữ liệu FMS', '0 điểm đo · ' + (ngoaiLe6h.fms_rong ?? 0) + ' lượt dữ liệu trống trong 6 giờ · ' + (ngoaiLe6h.phong_fms_rong ?? '?') + ' phòng ảnh hưởng'));
}

const cauWeb = ng.web_da_to_xam
  ? 'Web đã tạm dừng kết luận đạt/không đạt cho các phòng liên quan.'
  : 'Web vẫn hiển thị theo dữ liệu hiện có và chỉ tạm dừng kết luận khi số liệu quá ' + (ng.nguong_xam_phut ?? 150) + ' phút.';

const khoiNG = matNguon ? `
  <div style="background:#fff1f2;border:1px solid #fda4af;border-radius:10px;padding:12px 14px;margin:8px 0">
    <p style="margin:0 0 6px;font-weight:700;color:#9f1239">⚠ ${nhanNguyenNhan.toUpperCase()}</p>
    <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#9f1239">${truongHop}</p>
    <p style="margin:0;font-size:13px">${tomTatNguon}</p>
    <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin:8px 0 0">${hang.join('')}</table>
    ${khoe.length ? `<p style="margin:6px 0 0;font-size:12px;color:#64748b">Còn bình thường: ${khoe.join(' · ')}.</p>` : ''}
    <p style="margin:8px 0 0;font-size:12px;color:#7f1d1d">${cauWeb} Không dùng số hiện tại để kết luận phòng đạt/không đạt cho tới khi nguồn ổn định.</p>
  </div>` : '';

const khoiDL = matDuLieu ? `
  <p>Hệ thống đang ở trạng thái <b>${nhanNguyenNhan}</b>.</p>
  <p style="margin:6px 0 0;font-weight:700;color:#9f1239">${truongHop}</p>
  <p style="margin:6px 0 0;color:#33506e">${tomTatNguon}</p>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin:8px 0">
    <tr><td style="padding:6px 0;color:#90a8bd">Mốc dữ liệu mới nhất</td><td style="padding:6px 0;font-weight:600">${bucket}</td></tr>
    <tr><td style="padding:6px 0;color:#90a8bd">Mốc cuối có số đo</td><td style="padding:6px 0;font-weight:600">${bucketChiTiet.bucket_co_giatri_cuoi ? new Date(bucketChiTiet.bucket_co_giatri_cuoi).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '(không rõ)'}</td></tr>
    <tr><td style="padding:6px 0;color:#90a8bd">Trễ</td><td style="padding:6px 0;font-weight:600;color:#cf583f">${treTxt} (ngưỡng ${nguong}h)</td></tr>
    <tr><td style="padding:6px 0;color:#90a8bd">Luồng thu dữ liệu lần cuối</td><td style="padding:6px 0;font-weight:600">${lcTxt}</td></tr>
    <tr><td style="padding:6px 0;color:#90a8bd">Dữ liệu thu được</td><td style="padding:6px 0;font-weight:600">${wf1ChiTiet.phong_hop_le ?? '?'} phòng · ${wf1ChiTiet.diem_thu_duoc ?? '?'} điểm đo · ${wf1ChiTiet.phong_rong ?? '?'} phòng rỗng</td></tr>
    <tr><td style="padding:6px 0;color:#90a8bd">Dữ liệu bất thường 6 giờ</td><td style="padding:6px 0;font-weight:600">${ngoaiLe6h.fms_rong ?? 0} lượt trống · ${ngoaiLe6h.fms_login_loi ?? 0} lỗi đăng nhập FMS</td></tr>
  </table>` : '';

const khoiAL = alertStalled ? `
  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px 14px;margin:8px 0">
    <p style="margin:0 0 6px;font-weight:700;color:#a3161b">⚠ CẢNH BÁO ĐANG ĐÌNH TRỆ — sự cố không tới người xử lý</p>
    <p style="margin:0;font-size:13px">Có <b>${soKhongNhac}</b> sự cố CRITICAL đang mở nhưng <b>không được nhắc quá 2 giờ</b>. Nguy cơ: WF8 (email cảnh báo) ngừng chạy, bị tắt, hoặc lỗi — sự cố phòng sạch đang KHÔNG có ai được báo.</p>
    <p style="margin:6px 0 0;font-size:12px;color:#7f1d1d">Kiểm ngay luồng gửi email cảnh báo trên n8n.</p>
  </div>` : '';

// Tiêu đề nói đúng nguyên nhân vận hành; mã kiểm soát vẫn giữ trong loai_loi.
const lyDoArr = Array.isArray(ng.ly_do) ? ng.ly_do : [];
const phan = [(matNguon || matDuLieu) ? truongHop.toUpperCase() : null, alertStalled ? 'CẢNH BÁO ĐÌNH TRỆ' : null].filter(Boolean);
const tieuDe = '🔴 ' + phan.join(' + ');

const html = `<!doctype html><html><body style="margin:0;background:#fdf2ef;font-family:Inter,'Segoe UI',Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px -12px rgba(207,88,63,.3)">
      <div style="background:#cf583f;padding:20px 24px;color:#fff"><h1 style="margin:0;font-size:18px">${tieuDe}${TEST?' · (TEST)':''}</h1><p style="margin:4px 0 0;font-size:13px;opacity:.9">${when}</p></div>
      <div style="padding:20px 24px;color:#33506e;font-size:14px;line-height:1.7">
        ${khoiNG}${khoiAL}${khoiDL}
        <p style="padding-top:6px;color:#90a8bd;font-size:12px">Email gửi lại mỗi ${reGuiGio} giờ theo từng loại cảnh báo tới khi trở lại bình thường (hệ vẫn tự quét mỗi 30 phút).</p>
      </div>
    </div></div></body></html>`;

const moTa = [matNguon ? ('Mất nguồn [' + lyDoArr.join(',') + ']: ' + (ng.tom_tat || '')) : null,
              matDuLieu ? `${truongHop} (trễ ${treTxt}/ngưỡng ${nguong}h, mốc dữ liệu ${bucket})` : null,
              alertStalled ? `Cảnh báo đình trệ: ${soKhongNhac} sự cố mở không nhắc >2h (nghi WF8 ngừng)` : null]
             .filter(Boolean).join(' · ');

// Tên loại ghép bằng _VA_ — giữ tiền tố MAT_DU_LIEU/MAT_NGUON để throttle cũ vẫn bắt,
// đồng thời gắn mã kiểm soát để lọc nguyên nhân dễ hơn trong nhật ký.
const loaiNguon = maTrangThai === 'FMS_DATA_LOSS'
  ? 'MAT_DU_LIEU_FMS_DATA_LOSS'
  : maTrangThai === 'FMS_UNREACHABLE'
    ? 'MAT_NGUON_FMS_UNREACHABLE'
    : maTrangThai === 'WF1_PIPELINE_ERROR'
      ? 'MAT_DU_LIEU_WF1_PIPELINE_ERROR'
      : matNguon ? 'MAT_NGUON' : matDuLieu ? 'MAT_DU_LIEU' : null;
const loai = [loaiNguon, alertStalled ? 'DINH_TRE' : null]
             .filter(Boolean).join('_VA_') || 'BINH_THUONG';

return [{ json: {
  canh_bao: nenGui,
  van_con_van_de: coVanDe,
  to: toFinal, from, subject: `[GMP HVAC]${TEST?' (TEST)':''} ${tieuDe}`, html,
  tre_gio: treGio, nguong_gio: nguong,
  loai_loi: loai,
  mo_ta: moTa,
  kq_json: JSON.stringify(Object.assign({}, kq, { so_su_co_khong_nhac: soKhongNhac, nguon: ng })),
  thuoc_thu_nghiem: TEST
}}];
