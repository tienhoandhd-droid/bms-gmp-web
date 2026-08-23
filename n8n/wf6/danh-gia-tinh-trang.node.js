// WF6 "Đánh giá tình trạng" — dead-man KÉP: (1) mất dữ liệu từ WF1/FMS +
// (2) MỚI: cảnh báo đình trệ (WF2/WF8 ngừng gửi dù có sự cố mở → so_su_co_khong_nhac>0).
const row = $json || {};
const kq  = row.kq  || {};
const cfg = row.cfg || {};
const soKhongNhac = Number(row.so_su_co_khong_nhac || 0);
const TEST = String(cfg.che_do_thu_nghiem ?? 'true').toLowerCase() === 'true';

const matDuLieu   = kq.mat_du_lieu === true;
const alertStalled = soKhongNhac > 0;
const canhBao     = matDuLieu || alertStalled;

const to    = cfg.email_it_gmp || cfg.email_test || '';
// Cảnh báo đình trệ = sự cố không tới người xử lý → CC QA (nghiêm trọng hơn mất dữ liệu thuần).
const toFinal = alertStalled ? [to, cfg.email_qa].filter(Boolean).join(',') : to;
const from  = cfg.email_gui_tu || 'bms-alert@cpc1hn.vn';
const when  = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const bucket = kq.bucket_moi_nhat
  ? new Date(kq.bucket_moi_nhat).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  : '(chưa có dữ liệu)';
const lc = kq.lan_chay_cuoi || null;
const maTrangThai = kq.ma_trang_thai || null;
const wf1 = kq.wf1_gan_nhat || {};
const bucketChiTiet = kq.bucket || {};
const ngoaiLe6h = kq.ngoai_le_6h || {};
const treGio = kq.tre_gio;
const nguong = kq.nguong_gio ?? 2;
const treTxt = (treGio == null) ? 'chưa có dữ liệu giờ nào' : (treGio + ' giờ');
const lcTxt  = lc ? ((lc.ten_workflow || 'WF1') + ' · ' + (lc.trang_thai || '?')) : '(không rõ)';
const nhanNguyenNhan = maTrangThai === 'WF1_PIPELINE_ERROR'
  ? 'workflow thu dữ liệu lỗi'
  : maTrangThai === 'FMS_DATA_LOSS'
    ? 'mất dữ liệu trên hệ FMS'
    : maTrangThai === 'FMS_UNREACHABLE'
      ? 'không kết nối được FMS'
      : 'mất dữ liệu giám sát HVAC';
const huongDanDL = maTrangThai === 'WF1_PIPELINE_ERROR'
  ? 'Kiểm workflow WF1 trên n8n: trạng thái Active, executions gần nhất và Error Workflow. Chênh áp trực tiếp vẫn có thể dùng nếu mạch dữ liệu phút còn tươi.'
  : maTrangThai === 'FMS_DATA_LOSS'
    ? 'WF1 vẫn chạy và vẫn xử lý phòng, nhưng FMS trả 0 điểm đo. Kiểm dịch vụ history/trend của FMS và quyền tài khoản đọc dữ liệu lịch sử.'
    : maTrangThai === 'FMS_UNREACHABLE'
      ? 'Kiểm tài khoản FMS, mạng tới FMS, endpoint/API và execution WF1 gần nhất.'
      : 'Kiểm WF1, FMS và bảng ngoại lệ dữ liệu.';
const tomTatNguon = kq.tom_tat || huongDanDL;

// Khối HTML mất dữ liệu
const khoiDL = matDuLieu ? `
  <p>Hệ thống đang ở trạng thái <b>${nhanNguyenNhan}</b>. Không dùng số hiện tại để kết luận phòng đạt/không đạt cho tới khi nguồn ổn định.</p>
  <p style="margin:6px 0 0;color:#33506e">${tomTatNguon}</p>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin:8px 0">
    <tr><td style="padding:6px 0;color:#90a8bd">Bucket mới nhất</td><td style="padding:6px 0;font-weight:600">${bucket}</td></tr>
    <tr><td style="padding:6px 0;color:#90a8bd">Bucket có giá trị cuối</td><td style="padding:6px 0;font-weight:600">${bucketChiTiet.bucket_co_giatri_cuoi ? new Date(bucketChiTiet.bucket_co_giatri_cuoi).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '(không rõ)'}</td></tr>
    <tr><td style="padding:6px 0;color:#90a8bd">Trễ</td><td style="padding:6px 0;font-weight:600;color:#cf583f">${treTxt} (ngưỡng ${nguong}h)</td></tr>
    <tr><td style="padding:6px 0;color:#90a8bd">WF1 lần chạy cuối</td><td style="padding:6px 0;font-weight:600">${lcTxt}</td></tr>
    <tr><td style="padding:6px 0;color:#90a8bd">WF1 thu được</td><td style="padding:6px 0;font-weight:600">${wf1.phong_hop_le ?? '?'} phòng · ${wf1.diem_thu_duoc ?? '?'} điểm đo · ${wf1.phong_rong ?? '?'} phòng rỗng</td></tr>
    <tr><td style="padding:6px 0;color:#90a8bd">Ngoại lệ 6 giờ</td><td style="padding:6px 0;font-weight:600">${ngoaiLe6h.fms_rong ?? 0} FMS_RONG · ${ngoaiLe6h.fms_login_loi ?? 0} FMS_LOGIN_LOI</td></tr>
  </table>` : '';

// Khối HTML cảnh báo đình trệ (MỚI)
const khoiAL = alertStalled ? `
  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px 14px;margin:8px 0">
    <p style="margin:0 0 6px;font-weight:700;color:#a3161b">⚠ CẢNH BÁO ĐANG ĐÌNH TRỆ — sự cố không tới người xử lý</p>
    <p style="margin:0;font-size:13px">Có <b>${soKhongNhac}</b> sự cố WARNING/CRITICAL đang mở nhưng <b>không được nhắc quá 2 giờ</b> (WF8 lẽ ra nhắc mỗi 30–60′). Nguy cơ: WF8/WF2 (email cảnh báo) ngừng chạy, bị tắt, hoặc lỗi — sự cố phòng sạch đang KHÔNG có ai được báo.</p>
    <p style="margin:6px 0 0;font-size:12px;color:#7f1d1d">Kiểm ngay: n8n → WF8 (Active?) + Executions gần nhất; cấu hình email_ipc/co_dien có đúng không.</p>
  </div>` : '';

const tieuDe = matDuLieu && alertStalled ? '🔴 ' + nhanNguyenNhan.toUpperCase() + ' + CẢNH BÁO ĐÌNH TRỆ'
             : matDuLieu ? '🔴 ' + nhanNguyenNhan
             : '🔴 CẢNH BÁO ĐANG ĐÌNH TRỆ (sự cố không được báo)';

const html = `<!doctype html><html><body style="margin:0;background:#fdf2ef;font-family:Inter,'Segoe UI',Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px -12px rgba(207,88,63,.3)">
      <div style="background:#cf583f;padding:20px 24px;color:#fff"><h1 style="margin:0;font-size:18px">${tieuDe}${TEST?' · (TEST)':''}</h1><p style="margin:4px 0 0;font-size:13px;opacity:.9">${when}</p></div>
      <div style="padding:20px 24px;color:#33506e;font-size:14px;line-height:1.7">
        ${khoiAL}${khoiDL}
        <p style="padding-top:6px;color:#90a8bd;font-size:12px">Email tự gửi mỗi 30 phút tới khi tình trạng trở lại bình thường.</p>
      </div>
    </div></div></body></html>`;

const moTa = [matDuLieu ? `${nhanNguyenNhan} (trễ ${treTxt}/ngưỡng ${nguong}h, bucket ${bucket}, WF1 ${wf1.phong_hop_le ?? '?'} phòng/${wf1.diem_thu_duoc ?? '?'} điểm đo)` : null,
              alertStalled ? `Cảnh báo đình trệ: ${soKhongNhac} sự cố mở không nhắc >2h (nghi WF8/WF2 ngừng)` : null]
             .filter(Boolean).join(' · ');

return [{ json: {
  canh_bao: canhBao,
  to: toFinal, from, subject: `[GMP HVAC]${TEST?' (TEST)':''} ${tieuDe}`, html,
  tre_gio: treGio, nguong_gio: nguong,
  loai_loi: (matDuLieu && alertStalled) ? ((maTrangThai || 'MAT_DU_LIEU') + '_VA_DINH_TRE') : (matDuLieu ? (maTrangThai || 'MAT_DU_LIEU') : 'CANH_BAO_DINH_TRE'),
  mo_ta: moTa,
  kq_json: JSON.stringify(Object.assign({}, kq, { so_su_co_khong_nhac: soKhongNhac })),
  thuoc_thu_nghiem: TEST
}}];
