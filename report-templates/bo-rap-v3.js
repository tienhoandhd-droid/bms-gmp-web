'use strict';
/* ============================================================================
 * BỘ RÁP BÁO CÁO BMS — BẢN ĐÓNG GÓI TỰ CHỨA (sinh bởi dong-goi.js, ĐỪNG SỬA TAY)
 * Sửa ở bốn tệp nguồn trong n8n/wf5/bo-cuc-moi-2026-09-03/ rồi chạy lại
 * node dong-goi.js. Cách dùng trong node Code:
 *   const BO_RAP = ... (toàn bộ tệp này) ...
 *   const kq = BO_RAP.rapTatCa(d, duBao, cfg);
 *   // kq.bao_cao_html · kq.dashboard_html · kq.email_html
 * ========================================================================= */
var BO_RAP = (function () {
  var __kho = {}, __san = {};
  function __dinh_nghia(ten, ham) { __kho[ten] = ham; }
  function __require(ten) {
    ten = ten.replace(/^\.\//, '').replace(/\.js$/, '');
    if (__san[ten]) return __san[ten].exports;
    var m = { exports: {} };
    __san[ten] = m;
    __kho[ten](m, __require);
    return m.exports;
  }
__dinh_nghia("bao-cao-loi", function (module, require) {
'use strict';
/* ===========================================================================
 * LÕI BÁO CÁO GIÁM SÁT MÔI TRƯỜNG — dùng chung cho hai đầu ra
 *   · bản in (scorecard A4 → PDF)
 *   · bản xem trên máy (dashboard tương tác)
 *
 * Hai đầu ra phải nói CÙNG một ngôn ngữ và CÙNG một cách xếp hạng, nên mọi
 * từ ngữ, luật phân cấp và phép tính đều nằm ở đây, không viết lại hai lần.
 *
 * MỤC LỤC
 *   1. Từ điển tiếng Việt        — không để chữ viết tắt lọt ra bản đọc
 *   2. Hằng số nghiệp vụ
 *   3. Tiện ích chung
 *   4. Phân cấp việc phải xử lý  — luật cố định, không hỏi mô hình ngôn ngữ
 *   5. Phân tích theo chỉ tiêu   — chênh áp / nhiệt độ / độ ẩm
 *   6. Cây hệ thống → khu → cụm AHU → phòng
 *   7. Biểu đồ SVG
 * ========================================================================= */

/* ===== 1. TỪ ĐIỂN TIẾNG VIỆT ===========================================
 * Nguyên tắc: bản báo cáo cho người đọc KHÔNG được chứa chữ viết tắt kỹ thuật
 * chưa giải nghĩa. Mã gốc vẫn giữ trong phụ lục truy vết để đối chiếu hệ thống.
 * ===================================================================== */

// Loại cảm biến
const TEN_CHI_TIEU = {
  DP: 'Chênh áp',
  RH: 'Độ ẩm',
  T:  'Nhiệt độ'
};
const TEN_CHI_TIEU_DAY_DU = {
  DP: 'Chênh áp giữa các phòng',
  RH: 'Độ ẩm tương đối trong phòng',
  T:  'Nhiệt độ trong phòng'
};
// Vì sao chỉ tiêu này quan trọng — dùng làm câu dẫn đầu mỗi mục
const Y_NGHIA_CHI_TIEU = {
  DP: 'Chênh áp giữ cho không khí luôn đi từ phòng sạch hơn sang phòng kém sạch hơn. '
    + 'Tụt dưới giới hạn dưới thì dòng khí có thể đảo chiều, kéo theo nguy cơ nhiễm chéo — đây là hướng nặng nhất. '
    + 'Vượt trên giới hạn trên cũng là sai lệch: nó phá cân bằng dòng khí giữa các phòng, gây khó mở cửa '
    + 'và hao năng lượng; và nếu phòng vượt áp là phòng kém sạch hơn phòng bên cạnh thì dòng khí vẫn có '
    + 'thể đi sai chiều. Mức độ nguy hiểm tuỳ tương quan áp giữa hai phòng liền kề, nên không xếp sẵn '
    + 'là nhẹ hơn hay nặng hơn hướng tụt dưới.',
  RH: 'Độ ẩm vượt giới hạn trên kéo dài làm tăng nguy cơ phát triển vi sinh vật; '
    + 'độ ẩm quá thấp gây tích điện và ảnh hưởng thao tác.',
  T:  'Nhiệt độ ra ngoài dải cho phép ảnh hưởng tới điều kiện thao tác và độ ổn định của sản phẩm.'
};
// Hướng nguy hiểm của từng chỉ tiêu (khớp với luật trong rpc_chi_so_cam_bien)
const HUONG_NGUY_HIEM = {
  DP: 'thấp hơn giới hạn dưới',
  RH: 'cao hơn giới hạn trên',
  T:  'ra ngoài cả hai phía'
};

// Truy vấn trả hai con số cho mỗi phòng: `gio_lech` là giờ ngoài giới hạn theo HƯỚNG NGUY
// HIỂM của chỉ tiêu đó, `gio_lech_nguoc` là giờ ngoài giới hạn theo hướng còn lại. Ý nghĩa
// của hai trường này ĐẢO NHAU giữa các chỉ tiêu, nên phải tra bảng chứ không
// được mặc định "gio_lech là tụt dưới".
//
// Cả hai hướng đều phải trình bày. Chênh áp vượt TRÊN giới hạn cũng là sai lệch:
// tuy không mang nguy cơ nhiễm chéo như tụt dưới, nhưng nó phá cân bằng dòng khí
// giữa các phòng, gây khó mở cửa, hao năng lượng, và ở phòng bẩn hơn thì có thể
// đẩy khí ngược sang phòng sạch hơn.
const HAI_HUONG = {
  DP: {
    chinh:      { ten: 'Tụt dưới giới hạn dưới', ngan: 'tụt dưới',
                  he_qua: 'dòng khí có thể đảo chiều — nguy cơ nhiễm chéo' },
    nguoc:      { ten: 'Vượt trên giới hạn trên', ngan: 'vượt trên',
                  he_qua: 'phá cân bằng dòng khí giữa các phòng, khó mở cửa, hao năng lượng; '
                        + 'ở phòng kém sạch hơn còn có thể đẩy khí ngược sang phòng sạch hơn' }
  },
  RH: {
    chinh:      { ten: 'Vượt trên giới hạn trên', ngan: 'vượt trên',
                  he_qua: 'nguy cơ phát triển vi sinh vật' },
    nguoc:      { ten: 'Tụt dưới giới hạn dưới', ngan: 'tụt dưới',
                  he_qua: 'tích điện, ảnh hưởng thao tác và vật liệu' }
  },
  T: {
    chinh:      { ten: 'Ra ngoài dải cho phép', ngan: 'ngoài giới hạn',
                  he_qua: 'ảnh hưởng điều kiện thao tác và độ ổn định của sản phẩm' },
    nguoc:      null   // truy vấn đã gộp cả hai phía cho nhiệt độ
  }
};

// Mức cảnh báo
const TEN_MUC_CANH_BAO = {
  CRITICAL: 'nghiêm trọng',
  WARNING:  'cảnh báo',
  OK:       'trong ngưỡng',
  NORMAL:   'trong ngưỡng'
};

// Mức ưu tiên phòng
const TEN_UU_TIEN = {
  P1: 'Mức 1 — theo dõi đặc biệt',
  P2: 'Mức 2',
  P3: 'Mức 3'
};
const TEN_UU_TIEN_NGAN = { P1: 'Mức 1', P2: 'Mức 2', P3: 'Mức 3' };

// Trạng thái sự cố
const TEN_TRANG_THAI = {
  CHUA_XU_LY:      'Chưa xử lý',
  IPC_BAT_THUONG:  'Giám sát trong quá trình xác nhận là bất thường',
  IPC_BINH_THUONG: 'Giám sát trong quá trình xác nhận là bình thường',
  DA_KHAC_PHUC:    'Đã khắc phục',
  DONG_TU_DONG:    'Hệ thống tự đóng khi số đo trở lại trong ngưỡng',
  DANG_XU_LY:      'Đang xử lý'
};

// Ngoại lệ khi thu dữ liệu — viết thành câu người vận hành hiểu được
const TEN_NGOAI_LE = {
  FMS_HTTP_LOI:      'Máy chủ giám sát báo lỗi khi hệ thống hỏi dữ liệu',
  FMS_RONG:          'Máy chủ giám sát trả lời nhưng không kèm điểm đo nào',
  FMS_LOGIN_LOI:     'Không đăng nhập được vào máy chủ giám sát',
  MAT_DU_LIEU:       'Khoảng trống không có dữ liệu',
  SENSOR_DUNG_HINH:  'Cảm biến đứng hình — giá trị không đổi bất thường'
};

// Cách một đợt ngoài giới hạn kết thúc
const TEN_KET_THUC = {
  HET_KY:      'còn đang ở ngoài giới hạn khi hết kỳ',
  TRO_LAI:     'số đo đã trở lại trong ngưỡng',
  MAT_DU_LIEU: 'mất dữ liệu nên không xác định được'
};

// Kết luận độ tin cậy dữ liệu
const TEN_KET_LUAN_DU_LIEU = {
  DAY_DU:      'Dữ liệu đầy đủ',
  CO_HAN_CHE:  'Dữ liệu có hạn chế',
  KHONG_DU:    'Dữ liệu không đủ để kết luận'
};

// Ra ngoài phía nào
const TEN_HUONG = { CAO: 'vượt giới hạn trên', THAP: 'tụt dưới giới hạn dưới' };

const TEN_KY = { TUAN: 'tuần', THANG: 'tháng', QUY: 'quý' };

// Tra từ điển an toàn: không có thì trả lại nguyên văn, KHÔNG nuốt mất giá trị
function dich(tuDien, ma, macDinh) {
  if (ma == null || ma === '') return macDinh == null ? '—' : macDinh;
  const k = String(ma);
  return Object.prototype.hasOwnProperty.call(tuDien, k) ? tuDien[k] : k;
}

// Một số chuỗi do truy vấn sinh sẵn có lẫn thuật ngữ viết tắt. Dịch lại trước
// khi đưa ra bản đọc — không sửa ở tầng dữ liệu vì tầng đó còn dùng để đối chiếu.
const CUM_KY_THUAT = [
  [/t[íi]n hi[ệe]u SPC ngo[àa]i ki[ểe]m so[áa]t\s*\(EWMA\/CUSUM\/Nelson\)/gi,
   'tín hiệu vượt kiểm soát thống kê'],
  [/t[íi]n hi[ệe]u SPC ngo[àa]i ki[ểe]m so[áa]t/gi, 'tín hiệu vượt kiểm soát thống kê'],
  [/\bSPC\b/g, 'kiểm soát thống kê'],
  [/\bEWMA\b/g, 'trung bình trượt có trọng số'],
  [/\bCUSUM\b/g, 'tổng tích luỹ sai lệch'],
  [/\bNelson\s*\d*\b/g, 'quy tắc Nelson'],
  [/\bR²\s*=\s*/g, 'mức độ tin cậy R² '],
  [/\bMTTR\b/g, 'thời gian khắc phục trung bình'],
  [/\bOOS\b/g, 'ngoài ngưỡng'],
  [/\bDQ\b/g, 'độ đầy đủ dữ liệu'],
  // Người đọc yêu cầu không dùng chữ viết tắt: "điểm %" phải viết đủ.
  // Người đọc quen ký hiệu hơn chữ, và câu luôn kèm cả hai số gốc trong ngoặc
  // nên không sợ hiểu nhầm sang phần trăm tương đối.
  [/điểm\s+phần\s+trăm/g, 'điểm %'],   // không dùng \b: chữ có dấu không phải ký tự từ trong biểu thức JavaScript
  // Chuỗi từ truy vấn dùng dấu chấm thập phân kiểu Anh — đổi sang lối Việt.
  // Chỉ khớp khi cả hai bên đều là chữ số, nên mã phòng "C1.R19" không bị đụng.
  [/(\d)\.(\d)/g, '$1,$2']
];
function vietLai(s) {
  if (s == null) return '';
  let r = String(s);
  CUM_KY_THUAT.forEach(function (c) { r = r.replace(c[0], c[1]); });
  return r;
}

/* ===== 2. HẰNG SỐ NGHIỆP VỤ ============================================= */

const NGUONG_HANH_DONG   = 80;   // % thời gian trong ngưỡng — dưới mức này là không đạt
const GIO_SU_CO_CAP_A    = 24;   // sự cố mở quá số giờ này thì lên cấp A
const GIO_NGHIEM_TRONG_A = 100;  // số giờ nghiêm trọng trong kỳ đưa phòng lên cấp A
const SUT_GIAM_CAP_B     = 10;   // giảm bao nhiêu điểm % so kỳ trước thì vào cấp B
const NGOAI_LE_HE_THONG  = 100;  // số lần lỗi thu dữ liệu đủ để coi là sự cố hệ thống
const TOI_DA_CAP_A       = 7;    // trần số dòng cấp A ở phần chính
const DOT_LECH_DANG_KE   = 4;    // đợt ngoài giới hạn từ mấy giờ trở lên mới đưa vào bảng
// Dưới ngưỡng này thì bỏ hai tầng so sánh khu và cụm, đi thẳng vào từng phòng:
// chia 12 phòng cho 3 khu thì mỗi khu còn vài phòng, so sánh không nói lên điều gì
// mà vẫn tốn hai biểu đồ người đọc phải lướt qua.
const DU_PHONG_DE_SO_SANH = 20;

// Ngưỡng nghi ngờ số đo hỏng: phòng sạch không thể có nhiệt độ 0 °C hay độ ẩm 0 %.
// Không tự ý xoá khỏi dữ liệu — chỉ đánh dấu để người đọc biết mà đối chiếu.
const NGHI_LOI_DO = { T: 5, RH: 5, DP: null };   // DP có thể bằng 0 thật (mất áp hoàn toàn)

/* ===== 3. TIỆN ÍCH CHUNG ================================================ */

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const so = (v, n) => (v == null || !isFinite(v)) ? '—' : Number(v).toFixed(n == null ? 1 : n);
const ngayNgan = (iso) => String(iso || '').slice(8, 10) + '/' + String(iso || '').slice(5, 7);
const ngayDai  = (iso) => String(iso || '').slice(0, 10).split('-').reverse().join('/');
const gioPhut  = (iso) => String(iso || '').slice(11, 16);

// Số giờ viết cho người đọc: 162 giờ → "162 giờ (6,8 ngày)"
function gioDoc(g) {
  if (g == null || !isFinite(g)) return '—';
  const n = Number(g);
  if (n < 24) return soVN(n, n % 1 ? 1 : 0) + ' giờ';
  return soVN(n, n % 1 ? 1 : 0) + ' giờ (' + soVN(n / 24, 1) + ' ngày)';
}

// Viết một con số theo lối Việt Nam: dấu phẩy ngăn phần thập phân, dấu chấm
// ngăn hàng nghìn — 12861.6 đọc rất khó, 12.861,6 thì nhìn là biết mười hai nghìn.
// Tự viết thay vì dùng Intl để không phụ thuộc vào việc môi trường chạy n8n có
// nạp đủ dữ liệu ngôn ngữ hay không.
function soVN(v, n) {
  if (v == null || !isFinite(v)) return '—';
  n = n == null ? 1 : n;
  const am = Number(v) < 0;
  const x = Math.abs(Number(v)).toFixed(n).split('.');
  const nguyen = x[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (am ? '-' : '') + nguyen + (x[1] ? ',' + x[1] : '');
}

// Viết một tỉ lệ phần trăm. Không có số thì trả dấu gạch TRỌN VẸN — nối tay
// so(v,1) + '%' sẽ cho ra "—%", một thứ vô nghĩa lọt vào bản báo cáo.
function phanTram(v, n) {
  return (v == null || !isFinite(v)) ? '—' : soVN(v, n == null ? 1 : n) + '%';
}

// Số giờ trần trụi rất khó hình dung: "12.861,6 giờ" là nhiều hay ít? Kèm thêm
// tỉ lệ trên tổng thời gian THỰC SỰ CÓ SỐ ĐO thì đọc phát biết ngay mức độ.
// Mẫu số phải là giờ có số đo, không phải giờ kỳ vọng — lấy giờ kỳ vọng thì
// những kỳ mất dữ liệu sẽ bị làm nhẹ đi một cách giả tạo.
function gioTyLe(gio, tongGioDo) {
  const g = gioDoc(gio);
  if (gio == null || !tongGioDo) return g;
  return g + ' · ' + phanTram(100 * Number(gio) / tongGioDo, 1);
}

/** Mã + tên phòng, nhưng nhiều phòng có tên trùng luôn mã (C1.PAL3) — in cả
 * hai thành "C1.PAL3 · C1.PAL3". Hàm này bỏ phần lặp. */
function tenPhongGon(ma, ten) {
  const m = String(ma || ''), t = String(ten || '').trim();
  return (!t || t === m) ? m : m + ' · ' + t;
}

function delta(nay, truoc, donVi, tangLaTot) {
  if (nay == null || truoc == null) return { chu: '—', huong: 'khong' };
  const d = nay - truoc;
  if (Math.abs(d) < 0.05) return { chu: 'không đổi', huong: 'khong' };
  const tot = tangLaTot ? d > 0 : d < 0;
  return { chu: (d > 0 ? '+' : '') + soVN(d, 1) + (donVi || ''), huong: tot ? 'tot' : 'xau' };
}

/* ===== 4. PHÂN CẤP VIỆC PHẢI XỬ LÝ =====================================
 * Cấp A: đe dọa chất lượng sản phẩm, phải xử lý trong kỳ này.
 * Cấp B: xu hướng xấu, cần theo dõi trước kỳ sau.
 * Cấp C: khảo cứu, đẩy xuống phụ lục.
 *
 * Toàn bộ do luật cố định quyết định. Mô hình ngôn ngữ KHÔNG tham gia bước này.
 * ===================================================================== */

function phanCap(d) {
  const phongTheoMa = {};
  (d.tat_ca_phong || []).forEach((p) => { phongTheoMa[p.ma_phong] = p; });

  // Tỉ lệ thời gian chênh áp TỤT DƯỚI giới hạn dưới của từng phòng. Đây là con
  // số đáng lo nhất — tụt dưới thì dòng khí có thể đảo chiều — và nó KHÁC với
  // ngưỡng hành động 80%: ngưỡng 80% gộp cả ba chỉ tiêu, còn con số này chỉ nói
  // riêng chênh áp và chỉ nói riêng hướng nguy hiểm.
  const lechDuoiDP = {};
  const gioDoDP = {};
  Object.keys(d.chuoi_cam_bien || {}).forEach(function (kh) {
    const v = kh.split('|');
    if (v[1] !== 'DP') return;
    (d.chuoi_cam_bien[kh].chuoi || []).forEach(function (x) {
      gioDoDP[v[0]] = (gioDoDP[v[0]] || 0) + (x.gio_co_dl || 0);
    });
  });
  (((d.chi_so_cam_bien || {}).DP || {}).top_phong || []).forEach(function (r) {
    const gd = gioDoDP[r.ma_phong];
    if (gd) lechDuoiDP[r.ma_phong] = 100 * (r.gio_lech || 0) / gd;
  });

  // Gom theo ĐỐI TƯỢNG: mỗi phòng đúng một dòng, dù trúng nhiều luật.
  const theoPhong = {};
  function ghi(maPhong, muc) {
    const p = phongTheoMa[maPhong] || {};
    const o = theoPhong[maPhong] || (theoPhong[maPhong] = {
      ma_phong: maPhong,
      ten: p.ten_phong || maPhong,
      khu: p.khu_vuc || '—',
      uu_tien: p.muc_uu_tien || 'P3',
      ahu: p.ahu || '—',
      tuan_thu: p.ty_le_tuan_thu,
      gio_nghiem_trong: p.so_gio_critical || 0,
      su_co_qua_han: 0,
      loai: [], can_cu: [], viec: [], nguon: []
    });
    if (o.loai.indexOf(muc.loai) === -1) o.loai.push(muc.loai);
    o.can_cu.push(muc.can_cu);
    if (o.viec.indexOf(muc.viec) === -1) o.viec.push(muc.viec);
    if (o.nguon.indexOf(muc.nguon) === -1) o.nguon.push(muc.nguon);
    if (muc.su_co_gio) o.su_co_qua_han = Math.max(o.su_co_qua_han, muc.su_co_gio);
  }

  /* Truy vấn trả về sự cố ĐANG MỞ TẠI LÚC CHẠY, không phải sự cố thuộc kỳ. Với
   * báo cáo tháng 08 chạy ngày 03/09 thì cả bốn sự cố còn mở đều bắt đầu từ
   * tháng 09 — nằm ngoài kỳ. Đưa chúng vào danh sách việc phải xử lý của kỳ là
   * sai phạm vi: kết quả kỳ 08 lại chứa sự việc của kỳ 09, mà số giờ kéo dài
   * cũng đo tới lúc chạy chứ không tới ngày chốt kỳ.
   * Vẫn giữ lại để báo, nhưng tách riêng và ghi rõ là ngoài kỳ. */
  const chotKy = d.den_ngay ? String(d.den_ngay).slice(0, 10) : null;
  const trongKy = (s) => !chotKy || !s.bat_dau || String(s.bat_dau).slice(0, 10) <= chotKy;
  const suCoDangMo = (d.su_co && d.su_co.danh_sach_dang_mo || []);
  const suCoNgoaiKy = suCoDangMo.filter((s) => !trongKy(s))
    .sort((a, b) => (b.keo_dai_gio || 0) - (a.keo_dai_gio || 0));

  // A1. Sự cố mức nghiêm trọng còn mở quá lâu ở phòng mức 1 hoặc mức 2
  suCoDangMo
    .filter(trongKy)
    .filter((s) => s.keo_dai_gio >= GIO_SU_CO_CAP_A && (s.uu_tien === 'P1' || s.uu_tien === 'P2'))
    .forEach((s) => {
      ghi(s.phong, {
        loai: 'Sự cố chưa xử lý',
        su_co_gio: s.keo_dai_gio,
        // Câu ngắn, số đứng trước, giải thích sau — người quản lý lướt qua là nắm.
        can_cu: 'Sự cố số ' + s.ma_su_co + ' mức ' + dich(TEN_MUC_CANH_BAO, s.muc_canh_bao)
              + ' — ' + dich(TEN_TRANG_THAI, s.trang_thai).toLowerCase() + ', đã '
              + gioDoc(s.keo_dai_gio) + ' kể từ ' + ngayDai(s.bat_dau) + '.',
        viec: 'Cơ điện xác minh tại chỗ và đóng sự cố. Quá 24 giờ nữa chưa xong thì '
            + 'Bảo đảm chất lượng mở phiếu sai lệch.',
        nguon: 'su_co.danh_sach_dang_mo'
      });
    });

  // A2. Phòng theo dõi đặc biệt (mức 1) dưới ngưỡng hành động
  (d.tat_ca_phong || [])
    .filter((p) => p.muc_uu_tien === 'P1' && p.ty_le_tuan_thu < NGUONG_HANH_DONG)
    .forEach((p) => {
      ghi(p.ma_phong, {
        loai: 'Phòng theo dõi đặc biệt dưới ngưỡng',
        can_cu: 'Trong ngưỡng ' + phanTram(p.ty_le_tuan_thu) + ', phải đạt '
              + NGUONG_HANH_DONG + '%. '
              + (lechDuoiDP[p.ma_phong] != null
                  ? 'Chênh áp tụt dưới giới hạn ' + phanTram(lechDuoiDP[p.ma_phong])
                    + ' thời gian, đây là hướng gây nhiễm chéo. ' : '')
              + gioDoc(p.so_gio_critical) + ' ở mức nghiêm trọng.',
        viec: 'Cơ điện kiểm cụm ' + (p.ahu || 'xử lý không khí liên quan')
            + ': lọc, van gió, cài đặt chênh áp. Giám sát trong quá trình khoanh vùng khung giờ ngoài giới hạn.',
        nguon: 'tat_ca_phong (mức ưu tiên 1)'
      });
    });

  // A3. Phòng ngoài mức 1 nhưng số giờ nghiêm trọng quá cao
  (d.tat_ca_phong || [])
    .filter((p) => p.muc_uu_tien !== 'P1' && p.so_gio_critical >= GIO_NGHIEM_TRONG_A)
    .forEach((p) => {
      ghi(p.ma_phong, {
        loai: 'Nhiều giờ ở mức nghiêm trọng',
        can_cu: 'Trong ngưỡng ' + phanTram(p.ty_le_tuan_thu) + '. '
              + (lechDuoiDP[p.ma_phong] != null
                  ? 'Chênh áp tụt dưới giới hạn ' + phanTram(lechDuoiDP[p.ma_phong])
                    + ' thời gian, đây là hướng gây nhiễm chéo. ' : '')
              + gioDoc(p.so_gio_critical) + ' ở mức nghiêm trọng.',
        viec: 'Cơ điện kiểm cụm ' + (p.ahu || 'xử lý không khí liên quan')
            + '. Giám sát trong quá trình đối chiếu lịch sản xuất xem có trùng ca không.',
        nguon: 'tat_ca_phong (số giờ nghiêm trọng)'
      });
    });

  // Xếp hạng theo THỨ TỰ TỪ ĐIỂN — giải thích được bằng một câu khi bị hỏi:
  //   mức ưu tiên phòng → có sự cố quá hạn → thiếu hụt so ngưỡng → số giờ nghiêm trọng
  const hangUuTien = { P1: 0, P2: 1, P3: 2 };
  const thieuHut = (o) => Math.max(0, NGUONG_HANH_DONG - (o.tuan_thu == null ? NGUONG_HANH_DONG : o.tuan_thu));
  const capA = Object.keys(theoPhong).map((k) => theoPhong[k]).sort((a, b) =>
       (hangUuTien[a.uu_tien] - hangUuTien[b.uu_tien])
    || ((b.su_co_qua_han > 0 ? 1 : 0) - (a.su_co_qua_han > 0 ? 1 : 0))
    || (thieuHut(b) - thieuHut(a))
    || (b.gio_nghiem_trong - a.gio_nghiem_trong));

  // Toàn vẹn dữ liệu: hạng mục HỆ THỐNG, đứng trước cấp A và không tranh chỗ
  // với các phòng — số đo không tin được thì mọi kết luận phía dưới đều treo.
  const tc = d.do_tin_cay_du_lieu || {};
  const nl = d.ngoai_le || {};
  const tongNgoaiLe = tc.tong_ngoai_le != null ? tc.tong_ngoai_le : (nl.tong_so || 0);
  let heThong = null;
  if (tongNgoaiLe >= NGOAI_LE_HE_THONG || (tc.ket_luan && tc.ket_luan !== 'DAY_DU')) {
    const dsLoai = (tc.ngoai_le_theo_loai || nl.theo_loai || []).slice()
      .sort((a, b) => b.so_lan - a.so_lan)
      .map((t) => ({ ten: dich(TEN_NGOAI_LE, t.ma_loi || t.loai), so_lan: t.so_lan }));
    heThong = {
      ket_luan: dich(TEN_KET_LUAN_DU_LIEU, tc.ket_luan, 'Dữ liệu có hạn chế'),
      do_phu_pct: tc.do_phu_pct,
      gio_rong: tc.gio_rong,
      gio_co_du_lieu: tc.gio_co_du_lieu,
      gio_ky_vong: tc.gio_ky_vong,
      tong_ngoai_le: tongNgoaiLe,
      danh_sach: dsLoai,
      viec: 'Bộ phận công nghệ thông tin và bộ phận quản lý hệ thống toà nhà: kiểm nguồn dữ liệu '
          + 'giám sát, xác nhận các giờ trống đã được lấp đủ trước khi phát hành kỳ sau.'
    };
  }

  const capB = (d.phong_xau_bat_thuong || []).filter((p) => p.delta <= -SUT_GIAM_CAP_B).slice(0, 6);
  const spcXau = (d.xu_huong_dang_chu_y || []).filter((x) => x.huong === 'worsening').slice(0, 5);

  return { capA: capA.slice(0, TOI_DA_CAP_A), capA_tat_ca: capA, capA_tong: capA.length,
           heThong: heThong, capB: capB, spcXau: spcXau, suCoNgoaiKy: suCoNgoaiKy };
}

/* ===== 5. PHÂN TÍCH THEO CHỈ TIÊU ======================================
 * Ba chỉ tiêu KHÔNG cộng chéo với nhau: Pa, %RH và °C là ba thang khác nhau.
 * Mỗi chỉ tiêu được xếp hạng riêng, trong phạm vi các phòng thực sự có đo.
 * ===================================================================== */

// Bóc chuỗi theo cảm biến: khóa gốc dạng "C1.R19|DP"
function bocChuoiCamBien(d) {
  const raw = d.chuoi_cam_bien || {};
  const theoLoai = { DP: {}, RH: {}, T: {} };
  Object.keys(raw).forEach((k) => {
    const v = k.split('|');
    const maPhong = v[0], loai = v[1];
    if (!theoLoai[loai]) theoLoai[loai] = {};
    theoLoai[loai][maPhong] = raw[k];
  });
  return theoLoai;
}

// Đánh dấu điểm nghi số đo hỏng — KHÔNG xoá, chỉ gắn cờ để hiển thị khác đi
function danhDauNghiLoi(chuoi, loai) {
  const nguong = NGHI_LOI_DO[loai];
  return (chuoi || []).map((c) => {
    const nghi = nguong != null && c.min != null && c.min < nguong && c.tb != null && c.tb >= nguong;
    return Object.assign({}, c, { nghi_loi_do: !!nghi });
  });
}

// Gom các đợt ngoài giới hạn (rpc_su_kien_vuot_nguong) theo chỉ tiêu
function docSuKien(d, loai) {
  const sk = d.su_kien_vuot_nguong || {};
  return (sk.danh_sach || [])
    .filter((s) => s.loai_cam_bien === loai && (s.so_gio || 0) >= DOT_LECH_DANG_KE)
    .sort((a, b) => (b.so_gio || 0) - (a.so_gio || 0));
}

/**
 * Tổng hợp một chỉ tiêu: dùng cho cả ba mục Chênh áp / Nhiệt độ / Độ ẩm.
 * Trả về đủ thứ để dựng mục mà không phải đụng lại dữ liệu gốc.
 */
function tongHopChiTieu(d, loai) {
  const chiSo = (d.chi_so_cam_bien || {})[loai] || {};
  const chuoi = bocChuoiCamBien(d)[loai] || {};
  const phongTheoMa = {};
  (d.tat_ca_phong || []).forEach((p) => { phongTheoMa[p.ma_phong] = p; });

  // Quy hai trường của truy vấn về đúng hướng vật lý: giờ tụt dưới và giờ vượt trên.
  const hh = HAI_HUONG[loai] || {};
  const chinhLaDuoi = hh.chinh && hh.chinh.ngan === 'tụt dưới';
  const xepHang = (chiSo.top_phong || []).map((r) => {
    const gChinh = r.gio_lech || 0;
    const gNguoc = r.gio_lech_nguoc || 0;
    return Object.assign({}, r, {
      chuoi: danhDauNghiLoi((chuoi[r.ma_phong] || {}).chuoi, loai),
      ghd: (chuoi[r.ma_phong] || {}).ghd,
      ght: (chuoi[r.ma_phong] || {}).ght,
      gio_do: ((chuoi[r.ma_phong] || {}).chuoi || [])
                .reduce(function (t, x) { return t + (x.gio_co_dl || 0); }, 0),
      gio_duoi: hh.nguoc ? (chinhLaDuoi ? gChinh : gNguoc) : null,
      gio_tren: hh.nguoc ? (chinhLaDuoi ? gNguoc : gChinh) : null,
      gio_lech_tong: gChinh + gNguoc
    });
  });

  // Phòng theo dõi đặc biệt (mức 1) CÓ đo chỉ tiêu này
  const dacBiet = Object.keys(chuoi)
    .filter((ma) => (phongTheoMa[ma] || {}).muc_uu_tien === 'P1')
    .map((ma) => {
      const p = phongTheoMa[ma];
      const c = chuoi[ma];
      const ds = danhDauNghiLoi(c.chuoi, loai);
      const gioNgh = ds.reduce((t, x) => t + (x.ngh || 0), 0);
      const gioCb  = ds.reduce((t, x) => t + (x.cb || 0), 0);
      const gioTong = ds.reduce((t, x) => t + (x.gio_co_dl || 0), 0);
      const xh = xepHang.filter((r) => r.ma_phong === ma)[0];
      return {
        ma_phong: ma, ten_phong: p.ten_phong, khu: p.khu_vuc, ahu: p.ahu,
        ghd: c.ghd, ght: c.ght, don_vi: chiSo.don_vi,
        chuoi: ds, gio_nghiem_trong: gioNgh, gio_canh_bao: gioCb, gio_co_du_lieu: gioTong,
        ty_le_trong_nguong: xh ? xh.ty_le_trong_nguong : null,
        gio_lech: xh ? xh.gio_lech : null,
        so_dot: xh ? xh.so_dot : null,
        dot_dai_nhat: xh ? xh.dot_dai_nhat : null,
        con_lech_cuoi_ky: xh ? xh.con_lech_cuoi_ky : null
      };
    })
    .sort((a, b) => (a.ty_le_trong_nguong == null ? 999 : a.ty_le_trong_nguong)
                  - (b.ty_le_trong_nguong == null ? 999 : b.ty_le_trong_nguong));

  // Phòng cần vẽ biểu đồ chuỗi ngày: phòng theo dõi đặc biệt CỘNG các phòng ra ngoài
  // nặng nhất. Chỉ vẽ phòng mức 1 thì có chỉ tiêu chỉ còn đúng một biểu đồ, trong
  // khi tám phòng ra ngoài giới hạn nhiều hơn hẳn lại không ai nhìn thấy đường đi của số đo.
  const suKien = docSuKien(d, loai);
  const soPhongDo = Object.keys(chuoi).length;
  // Tổng thời gian có số đo của riêng chỉ tiêu này, cộng qua mọi phòng mọi ngày.
  let tongGioDo = 0;
  Object.keys(chuoi).forEach(function (ma) {
    (chuoi[ma].chuoi || []).forEach(function (x) { tongGioDo += (x.gio_co_dl || 0); });
  });
  const soPhongDat = xepHang.filter((r) => r.ty_le_trong_nguong >= NGUONG_HANH_DONG).length;

  const TOI_DA_VE = 6;
  const daCo = {};
  dacBiet.forEach(function (x) { daCo[x.ma_phong] = 1; });
  const themVe = xepHang.slice()
    .sort(function (a, b) { return (b.gio_lech_tong || 0) - (a.gio_lech_tong || 0); })
    .filter(function (r) { return !daCo[r.ma_phong] && (r.gio_lech_tong || 0) > 0; })
    .slice(0, Math.max(0, TOI_DA_VE - dacBiet.length))
    .map(function (r) {
      const c = chuoi[r.ma_phong] || {};
      const ds = danhDauNghiLoi(c.chuoi, loai);
      return {
        ma_phong: r.ma_phong, ten_phong: r.ten_phong, khu: r.khu_vuc, ahu: r.ahu,
        uu_tien: r.muc_uu_tien,
        ghd: c.ghd, ght: c.ght, don_vi: chiSo.don_vi, chuoi: ds,
        gio_nghiem_trong: ds.reduce(function (t, x) { return t + (x.ngh || 0); }, 0),
        gio_co_du_lieu: ds.reduce(function (t, x) { return t + (x.gio_co_dl || 0); }, 0),
        gio_do: r.gio_do,
        ty_le_trong_nguong: r.ty_le_trong_nguong, gio_lech: r.gio_lech,
        gio_duoi: r.gio_duoi, gio_tren: r.gio_tren,
        so_dot: r.so_dot, dot_dai_nhat: r.dot_dai_nhat, con_lech_cuoi_ky: r.con_lech_cuoi_ky
      };
    });

  return {
    loai: loai,
    ten: dich(TEN_CHI_TIEU, loai),
    ten_day_du: dich(TEN_CHI_TIEU_DAY_DU, loai),
    y_nghia: Y_NGHIA_CHI_TIEU[loai],
    huong_nguy_hiem: HUONG_NGUY_HIEM[loai],
    don_vi: chiSo.don_vi || '',
    so_phong_do: soPhongDo,
    so_phong_trong_bang: (chiSo.top_phong || []).length,
    so_phong_dat_trong_bang: soPhongDat,
    xep_hang: xepHang,
    dac_biet: dacBiet,
    them_ve: themVe,
    su_kien: suKien,
    hai_huong: hh,
    tong_gio_do: tongGioDo,
    tong_gio_lech: xepHang.reduce((t, r) => t + (r.gio_lech || 0), 0),
    tong_gio_duoi: hh.nguoc ? xepHang.reduce((t, r) => t + (r.gio_duoi || 0), 0) : null,
    tong_gio_tren: hh.nguoc ? xepHang.reduce((t, r) => t + (r.gio_tren || 0), 0) : null,
    so_phong_lech_duoi: hh.nguoc ? xepHang.filter((r) => (r.gio_duoi || 0) > 0).length : null,
    so_phong_lech_tren: hh.nguoc ? xepHang.filter((r) => (r.gio_tren || 0) > 0).length : null
  };
}

/**
 * Gom một chỉ tiêu lên cấp KHU và cấp CỤM, để đọc từ tổng thể xuống chi tiết.
 *
 * Chỉ gom những đại lượng CỘNG ĐƯỢC: số phòng, số phòng đạt, tổng giờ ngoài giới hạn.
 * KHÔNG lấy trung bình của các tỉ lệ phần trăm — mỗi phòng có số giờ đo khác
 * nhau nên trung bình cộng của các tỉ lệ là con số không bảo vệ được khi bị hỏi.
 * Thay vào đó nêu phòng kém nhất và trung vị, đều là số có thật.
 */
function gomChiTieuTheoCap(ct) {
  function trungVi(ds) {
    if (!ds.length) return null;
    const s = ds.slice().sort((a, b) => a - b);
    const g = Math.floor(s.length / 2);
    return s.length % 2 ? s[g] : (s[g - 1] + s[g]) / 2;
  }
  function gom(rows) {
    const tyLe = rows.map((r) => r.ty_le_trong_nguong).filter((v) => v != null);
    const kem = rows.slice().sort((a, b) =>
      (a.ty_le_trong_nguong == null ? 999 : a.ty_le_trong_nguong)
      - (b.ty_le_trong_nguong == null ? 999 : b.ty_le_trong_nguong))[0];
    return {
      so_phong: rows.length,
      so_phong_dat: rows.filter((r) => r.ty_le_trong_nguong >= NGUONG_HANH_DONG).length,
      tong_gio_lech: rows.reduce((t, r) => t + (r.gio_lech || 0), 0),
      tong_gio_duoi: rows.reduce((t, r) => t + (r.gio_duoi || 0), 0),
      tong_gio_tren: rows.reduce((t, r) => t + (r.gio_tren || 0), 0),
      tong_gio_do:   rows.reduce((t, r) => t + (r.gio_do || 0), 0),
      trung_vi: trungVi(tyLe),
      kem_nhat: kem || null,
      so_con_lech: rows.filter((r) => r.con_lech_cuoi_ky).length
    };
  }

  const theoKhu = {}, theoCum = {};
  (ct.xep_hang || []).forEach((r) => {
    (theoKhu[r.khu_vuc] || (theoKhu[r.khu_vuc] = [])).push(r);
    const k = (r.khu_vuc || '—') + ' | ' + (r.ahu || '—');
    (theoCum[k] || (theoCum[k] = [])).push(r);
  });

  // Xếp theo TỈ LỆ thời gian ngoài giới hạn, không theo số giờ cộng dồn — cùng lý do khi vẽ:
  // nhóm đông phòng luôn nhiều giờ hơn dù chất lượng có khi tốt hơn.
  const nang = (x) => x.tong_gio_do
    ? (x.tong_gio_duoi + x.tong_gio_tren) / x.tong_gio_do
    : (x.tong_gio_duoi + x.tong_gio_tren);
  const khu = Object.keys(theoKhu).map((k) => Object.assign({ khu: k }, gom(theoKhu[k])))
    .sort((a, b) => nang(b) - nang(a));
  const cum = Object.keys(theoCum).map((k) => {
    const v = k.split(' | ');
    return Object.assign({ khu: v[0], ahu: v[1], nhan: v[1] + ' (khu ' + v[0] + ')' }, gom(theoCum[k]));
  }).sort((a, b) => nang(b) - nang(a));

  return { khu: khu, cum: cum };
}

/* ===== 6. CÂY HỆ THỐNG → KHU → CỤM AHU → PHÒNG =========================
 * Trình bày từ lớn tới nhỏ: toàn nhà máy, rồi so sánh các khu, trong mỗi khu
 * so sánh các cụm xử lý không khí, trong mỗi cụm liệt kê phòng.
 * ===================================================================== */

function dungCay(d) {
  // Giờ thực sự có số đo của từng phòng, cộng qua mọi chỉ tiêu và mọi ngày —
  // dùng làm mẫu số khi viết tỉ lệ, thay vì lấy giờ kỳ vọng.
  const gioDoPhong = {};
  Object.keys(d.chuoi_cam_bien || {}).forEach(function (kh) {
    const ma = kh.split('|')[0];
    (d.chuoi_cam_bien[kh].chuoi || []).forEach(function (x) {
      gioDoPhong[ma] = (gioDoPhong[ma] || 0) + (x.gio_co_dl || 0);
    });
  });
  const theoKhu = ((d.xu_huong || {}).theo_khu || []);
  const theoAhu = ((d.xu_huong || {}).theo_ahu || []);
  const ahuTheoTen = {};
  theoAhu.forEach((a) => { ahuTheoTen[a.ahu] = a; });

  const gom = {};
  (d.tat_ca_phong || []).forEach((p) => {
    const khu = p.khu_vuc || '—', ahu = p.ahu || '(chưa gán cụm)';
    const k = gom[khu] || (gom[khu] = { khu: khu, ten_khu: khu, cum: {}, so_phong: 0 });
    const c = k.cum[ahu] || (k.cum[ahu] = { ahu: ahu, phong: [] });
    c.phong.push(p);
    k.so_phong++;
  });

  const cay = Object.keys(gom).map((khu) => {
    const k = gom[khu];
    const tt = theoKhu.filter((x) => x.khu_vuc === khu)[0] || {};
    const cum = Object.keys(k.cum).map((ahu) => {
      const c = k.cum[ahu];
      const a = ahuTheoTen[ahu] || {};
      const phong = c.phong.slice().sort((x, y) => x.ty_le_tuan_thu - y.ty_le_tuan_thu);
      return {
        ahu: ahu,
        ty_le_tb: a.ty_le_tb,
        chuoi: a.chuoi || [],
        so_phong: phong.length,
        so_phong_dat: phong.filter((p) => p.ty_le_tuan_thu >= NGUONG_HANH_DONG).length,
        so_phong_dac_biet: phong.filter((p) => p.muc_uu_tien === 'P1').length,
        gio_nghiem_trong: phong.reduce((t, p) => t + (p.so_gio_critical || 0), 0),
        gio_do: phong.reduce((t, p) => t + (gioDoPhong[p.ma_phong] || 0), 0),
        phong: phong
      };
    }).sort((x, y) => (x.ty_le_tb == null ? 999 : x.ty_le_tb) - (y.ty_le_tb == null ? 999 : y.ty_le_tb));

    return {
      khu: khu,
      ty_le_tb: tt.ty_le_tb,
      chuoi: tt.chuoi || [],
      so_phong: k.so_phong,
      so_phong_dat: cum.reduce((t, c) => t + c.so_phong_dat, 0),
      so_cum: cum.length,
      gio_nghiem_trong: cum.reduce((t, c) => t + c.gio_nghiem_trong, 0),
      gio_do: cum.reduce((t, c) => t + c.gio_do, 0),
      cum: cum
    };
  }).sort((a, b) => (a.ty_le_tb == null ? 999 : a.ty_le_tb) - (b.ty_le_tb == null ? 999 : b.ty_le_tb));

  return cay;
}

/* ===== 7. BIỂU ĐỒ SVG ==================================================
 * Bảng màu đã qua scripts/validate_palette.js của skill dataviz:
 *   · nhấn #1D4ED8 với vượt ngưỡng #DC2626 — cách nhau ΔE 28.0 dưới mắt mù màu
 *   · thang nghiêm trọng một tông #F87171 → #DC2626 → #7F1D1D — đạt toàn bộ
 * Nguyên tắc: CHỈ tô màu chỗ bất thường; đạt ngưỡng thì để trung tính.
 * Mọi chỗ có màu đều kèm số hoặc chữ, không bao giờ chỉ dựa vào màu.
 * ===================================================================== */

const MAU = {
  muc: '#111820', muc2: '#3B4652', mo: '#6B7686', nhat: '#9AA6B2',
  vien: '#E4E9EF', vien2: '#F1F4F8', giay: '#FFFFFF', nen: '#FAFAF9',
  nhan: '#1D4ED8', nhanNhat: '#DBEAFE',
  cap1: '#F87171', cap2: '#DC2626', cap3: '#7F1D1D',
  dat: '#E7E5E4',
  // Hai phía ra ngoài giới hạn — cặp đã qua kiểm định: ΔE 30.9 dưới mắt mù màu đỏ-lục.
  // Tím dùng cho 'vượt trên' để không lẫn với xanh nhấn của đường dữ liệu.
  lechDuoi: '#DC2626', lechTren: '#7C3AED'
};

function mauTheoTyLe(v) {
  if (v == null) return '#F4F4F5';
  if (v >= NGUONG_HANH_DONG) return '#FFFFFF';
  if (v >= 50) return MAU.cap1;
  if (v >= 20) return MAU.cap2;
  return MAU.cap3;
}

// Bản đồ phòng × ngày có gần 900 ô. Lặp fill/stroke/rx trên từng ô làm tệp phình
// hơn 100 KB, nên mỗi mức là một lớp CSS, ô chỉ mang toạ độ và tên lớp.
function lopTheoTyLe(v) {
  if (v == null) return 'k0';
  if (v >= NGUONG_HANH_DONG) return 'k1';
  if (v >= 50) return 'k2';
  if (v >= 20) return 'k3';
  return 'k4';
}
const CSS_BAN_DO =
  '.o-bd rect{rx:2;stroke:' + MAU.vien + ';stroke-width:.6}'
  + '.o-bd .k0{fill:#F4F4F5}.o-bd .k1{fill:#FFF}'
  + '.o-bd .k2{fill:' + MAU.cap1 + '}.o-bd .k3{fill:' + MAU.cap2 + '}.o-bd .k4{fill:' + MAU.cap3 + '}';

/**
 * Tóm tắt một chuỗi ngày thành một câu ngắn cho phần chú giải khi rê chuột.
 * Liệt kê đủ mọi ngày làm tệp phình rất nhanh (một kỳ tháng có 29 điểm, nhân với
 * hơn trăm biểu đồ nhỏ), mà người đọc cũng không đọc hết dãy số đó.
 */
function tomTatChuoi(chuoi) {
  const ds = (chuoi || []).filter((c) => c.ty_le != null);
  if (!ds.length) return 'không có số đo';
  const dau = ds[0], cuoi = ds[ds.length - 1];
  let thap = ds[0];
  ds.forEach((c) => { if (c.ty_le < thap.ty_le) thap = c; });
  const s1 = ngayNgan(dau.ngay) + ': ' + phanTram(dau.ty_le, 0) + ' → ' + ngayNgan(cuoi.ngay) + ': '
           + phanTram(cuoi.ty_le, 0);
  return thap === dau || thap === cuoi ? s1
    : s1 + '; thấp nhất ' + phanTram(thap.ty_le, 0) + ' ngày ' + ngayNgan(thap.ngay);
}

/** Sparkline đặt trong ô bảng — có mốc ngưỡng hành động. */
function svgSpark(chuoi, rong, cao) {
  const w = rong || 96, h = cao || 24;
  const pts = (chuoi || []).map((c) => c.ty_le);
  if (pts.length < 2) return '<span class="mo">—</span>';
  const x = (i) => (i / (pts.length - 1)) * (w - 2) + 1;
  const y = (v) => h - 2 - (Math.max(0, Math.min(100, v)) / 100) * (h - 4);
  const dd = pts.map((v, i) => (i ? 'L' : 'M') + Math.round(x(i)) + ' ' + Math.round(y(v))).join(' ');
  const cuoi = pts[pts.length - 1];
  return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '"'
    + ' role="img" aria-label="Diễn biến trong kỳ, ngày cuối ' + soVN(cuoi, 1) + ' phần trăm">'
    + '<title>' + tomTatChuoi(chuoi) + '</title>'
    + '<line x1="1" x2="' + (w - 1) + '" y1="' + Math.round(y(NGUONG_HANH_DONG)) + '" y2="' + Math.round(y(NGUONG_HANH_DONG))
    + '" stroke="' + MAU.nhat + '" stroke-width="1" stroke-dasharray="2 2"/>'
    + '<path d="' + dd + '" fill="none" stroke="' + MAU.nhan + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>'
    + '<circle cx="' + Math.round(x(pts.length - 1)) + '" cy="' + Math.round(y(cuoi)) + '" r="2.2" fill="'
    + (cuoi < NGUONG_HANH_DONG ? MAU.cap2 : MAU.nhan) + '"/></svg>';
}

/** Đường tỉ lệ trong ngưỡng theo ngày, tô phần còn thiếu so với ngưỡng hành động. */
function svgDuongNgay(chuoi, nhan) {
  const W = 760, H = 190, L = 42, R = 14, T = 14, B = 26;
  const pts = chuoi || [];
  if (pts.length < 2) return '<p class="mo">Không đủ điểm để vẽ.</p>';
  const iw = W - L - R, ih = H - T - B;
  const buoc = Math.max(1, Math.ceil(pts.length / 12));   // thưa nhãn khi kỳ dài
  const x = (i) => L + (i / (pts.length - 1)) * iw;
  const y = (v) => T + ih - (Math.max(0, Math.min(100, v)) / 100) * ih;
  const duong = pts.map((p, i) => (i ? 'L' : 'M') + so(x(i), 1) + ' ' + so(y(p.ty_le), 1)).join(' ');
  const vung = duong + ' L' + so(x(pts.length - 1), 1) + ' ' + so(y(NGUONG_HANH_DONG), 1)
             + ' L' + so(x(0), 1) + ' ' + so(y(NGUONG_HANH_DONG), 1) + ' Z';
  let g = '';
  [0, 20, 40, 60, 80, 100].forEach((v) => {
    g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + so(y(v), 1) + '" y2="' + so(y(v), 1)
       + '" stroke="' + MAU.vien2 + '"/>'
       + '<text x="' + (L - 8) + '" y="' + so(y(v) + 3.5, 1) + '" text-anchor="end" class="svg-truc">' + v + '</text>';
  });
  let diem = '';
  pts.forEach((p, i) => {
    diem += '<circle cx="' + so(x(i), 1) + '" cy="' + so(y(p.ty_le), 1) + '" r="'
         + (pts.length > 14 ? 2.2 : 3.4) + '" fill="' + MAU.nhan + '" stroke="#fff" stroke-width="1.2">'
         + '<title>' + ngayNgan(p.ngay) + ': ' + phanTram(p.ty_le) + '</title></circle>';
    if (i % buoc === 0 || i === pts.length - 1) {
      diem += '<text x="' + so(x(i), 1) + '" y="' + (H - 8) + '" text-anchor="middle" class="svg-truc">'
            + ngayNgan(p.ngay) + '</text>';
    }
  });
  const dau = pts[0], cuoi = pts[pts.length - 1];
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="bieu-do" role="img" aria-label="' + esc(nhan || '') + '">'
    + g + '<path d="' + vung + '" fill="' + MAU.cap1 + '" fill-opacity="0.14"/>'
    + '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + so(y(NGUONG_HANH_DONG), 1) + '" y2="'
    + so(y(NGUONG_HANH_DONG), 1) + '" stroke="' + MAU.cap2 + '" stroke-width="1.4" stroke-dasharray="5 3"/>'
    + '<text x="' + (W - R) + '" y="' + so(y(NGUONG_HANH_DONG) - 6, 1)
    + '" text-anchor="end" class="svg-nhan-nguong">ngưỡng hành động ' + NGUONG_HANH_DONG + '%</text>'
    + '<path d="' + duong + '" fill="none" stroke="' + MAU.nhan + '" stroke-width="2" stroke-linejoin="round"/>'
    + diem
    + '<text x="' + so(x(0) + 6, 1) + '" y="' + so(y(dau.ty_le) - 10, 1) + '" class="svg-nhan">' + phanTram(dau.ty_le) + '</text>'
    + '<text x="' + so(x(pts.length - 1) - 6, 1) + '" y="' + so(y(cuoi.ty_le) - 10, 1)
    + '" text-anchor="end" class="svg-nhan">' + phanTram(cuoi.ty_le) + '</text></svg>';
}

/**
 * Biểu đồ dải giới hạn — biểu đồ quan trọng nhất của mục chênh áp.
 * Vẽ dải cho phép (giới hạn dưới → giới hạn trên) làm nền, dải thấp nhất–cao nhất
 * mỗi ngày, và đường trung bình. Người đọc thấy ngay số đo nằm trong hay ngoài dải.
 */
function svgDaiGioiHan(o) {
  const pts = (o.chuoi || []).filter((c) => c.tb != null);
  if (pts.length < 2) return '<p class="mo">Không đủ điểm để vẽ.</p>';
  const W = 700, H = 168, L = 46, R = 62, T = 12, B = 24;
  const iw = W - L - R, ih = H - T - B;

  let lo = Infinity, hi = -Infinity;
  pts.forEach((c) => {
    [c.tb, c.min, c.max].forEach((v) => {
      if (v != null && isFinite(v) && !(c.nghi_loi_do && v === c.min)) {
        lo = Math.min(lo, v); hi = Math.max(hi, v);
      }
    });
  });
  if (o.ghd != null) lo = Math.min(lo, o.ghd);
  if (o.ght != null) hi = Math.max(hi, o.ght);
  if (!isFinite(lo) || !isFinite(hi)) return '<p class="mo">Không đủ điểm để vẽ.</p>';
  const dem = (hi - lo) * 0.12 || 1;
  lo -= dem; hi += dem;

  const buoc = Math.max(1, Math.ceil(pts.length / 12));
  const x = (i) => L + (i / (pts.length - 1)) * iw;
  const y = (v) => T + ih - ((v - lo) / (hi - lo)) * ih;

  // dải cho phép
  let nen = '';
  if (o.ghd != null && o.ght != null) {
    nen = '<rect x="' + L + '" y="' + so(y(o.ght), 1) + '" width="' + iw + '" height="'
        + so(Math.max(0, y(o.ghd) - y(o.ght)), 1) + '" fill="' + MAU.nhanNhat + '" fill-opacity="0.55"/>'
      + '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + so(y(o.ghd), 1) + '" y2="' + so(y(o.ghd), 1)
      + '" stroke="' + MAU.nhan + '" stroke-width="1.2" stroke-dasharray="4 3"/>'
      + '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + so(y(o.ght), 1) + '" y2="' + so(y(o.ght), 1)
      + '" stroke="' + MAU.nhan + '" stroke-width="1.2" stroke-dasharray="4 3"/>'
      + '<text x="' + (W - R + 6) + '" y="' + so(y(o.ght) + 4, 1) + '" class="svg-nhan-gh">trên ' + soVN(o.ght, 1) + '</text>'
      + '<text x="' + (W - R + 6) + '" y="' + so(y(o.ghd) + 4, 1) + '" class="svg-nhan-gh">dưới ' + soVN(o.ghd, 1) + '</text>';
  }
  // vạch trục
  let truc = '';
  const mocs = [lo + (hi - lo) * 0.05, (lo + hi) / 2, hi - (hi - lo) * 0.05];
  mocs.forEach((v) => {
    truc += '<text x="' + (L - 8) + '" y="' + so(y(v) + 3.5, 1) + '" text-anchor="end" class="svg-truc">'
          + soVN(v, 1) + '</text>';
  });

  // dải thấp nhất–cao nhất mỗi ngày
  // Mỗi ngày một vạch dọc, nhưng gom hết vào MỘT <path> thay vì mỗi ngày một thẻ
  // <line> — cùng hình ảnh, mà kỳ tháng bớt được vài chục thẻ trên mỗi biểu đồ.
  let dDai = '';
  pts.forEach((c, i) => {
    if (c.min == null || c.max == null) return;
    const minVe = c.nghi_loi_do ? c.tb : c.min;   // điểm nghi lỗi đo thì không kéo dải xuống
    dDai += 'M' + so(x(i), 1) + ' ' + so(y(c.max), 1) + 'V' + so(y(minVe), 1);
  });
  const dai = dDai
    ? '<path d="' + dDai + '" stroke="' + MAU.nhat + '" stroke-width="' + (pts.length > 20 ? 2 : 4)
      + '" stroke-linecap="round" opacity="0.5" fill="none"/>'
    : '';

  const duong = pts.map((c, i) => (i ? 'L' : 'M') + so(x(i), 1) + ' ' + so(y(c.tb), 1)).join(' ');
  let diem = '', nhanNgay = '';
  pts.forEach((c, i) => {
    const ngoai = (o.ghd != null && c.tb < o.ghd) || (o.ght != null && c.tb > o.ght);
    diem += '<circle cx="' + so(x(i), 1) + '" cy="' + so(y(c.tb), 1) + '" r="'
         + (pts.length > 20 ? 2.4 : 3.6) + '" fill="' + (ngoai ? MAU.cap2 : MAU.nhan)
         + '" stroke="#fff" stroke-width="1.2"><title>' + ngayNgan(c.ngay) + ': ' + soVN(c.tb, 1)
         + ' (' + soVN(c.min, 1) + '–' + soVN(c.max, 1) + ')' + esc(o.don_vi ? ' ' + o.don_vi : '')
         + (c.ngh ? ', ' + c.ngh + 'h nghiêm trọng' : '')
         + (c.nghi_loi_do ? ', nghi lỗi đo' : '') + '</title></circle>';
    if (c.nghi_loi_do) {
      diem += '<circle cx="' + so(x(i), 1) + '" cy="' + so(y(c.min), 1) + '" r="2.6" fill="#fff" stroke="'
           + MAU.mo + '" stroke-width="1.2" stroke-dasharray="1.5 1.5"/>';
    }
    if (i % buoc === 0 || i === pts.length - 1) {
      nhanNgay += '<text x="' + so(x(i), 1) + '" y="' + (H - 7) + '" text-anchor="middle" class="svg-truc">'
                + ngayNgan(c.ngay) + '</text>';
    }
  });

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="bieu-do" role="img" aria-label="'
    + esc((o.ten_phong || o.ma_phong || '') + ' — ' + (o.don_vi || '')) + '">'
    + nen + truc + dai
    + '<path d="' + duong + '" fill="none" stroke="' + MAU.nhan + '" stroke-width="1.8" stroke-linejoin="round"/>'
    + diem + nhanNgay + '</svg>';
}

/** Thanh ngang xếp hạng — dùng cho bảng phòng ra ngoài giới hạn nhiều nhất theo từng chỉ tiêu. */
function svgThanhXepHang(rows, khoaGiaTri, donVi, nguocDau) {
  if (!rows || !rows.length) return '';
  // Vẽ theo tỉ lệ trên giờ có số đo của chính phòng đó: phòng mất dữ liệu vài
  // ngày sẽ có ít giờ ngoài giới hạn hơn dù thực tế ra ngoài giới hạn nhiều hơn.
  const coTyLe = rows.every((r) => r.gio_do);
  const lay = (r) => coTyLe ? 100 * Math.abs(r[khoaGiaTri] || 0) / r.gio_do : Math.abs(r[khoaGiaTri] || 0);
  const W = 700, hangCao = 22, L = 208, R = 66, T = 6;
  const H = T + rows.length * hangCao + 6;
  const iw = W - L - R;
  const max = Math.max.apply(null, rows.map(lay)) || 1;
  let s = '';
  rows.forEach((r, i) => {
    const v = lay(r);
    const gio = Math.abs(r[khoaGiaTri] || 0);
    const w = (v / max) * iw;
    const cy = T + i * hangCao;
    const dat = nguocDau ? (r.ty_le_trong_nguong >= NGUONG_HANH_DONG) : false;
    s += '<g><title>' + esc(tenPhongGon(r.ma_phong, r.ten_phong)) + ' — '
      + (coTyLe ? phanTram(v) + ' thời gian có số đo (' + soVN(gio, 1) + ' giờ)' : soVN(gio, 1) + ' ' + esc(donVi || ''))
      + (r.ty_le_trong_nguong != null ? ', trong ngưỡng ' + phanTram(r.ty_le_trong_nguong) : '') + '</title>'
      + '<text x="0" y="' + (cy + 15) + '" class="svg-hang">'
      + esc(tenPhongGon(r.ma_phong, String(r.ten_phong || '').slice(0, 20))) + '</text>'
      + '<rect x="' + L + '" y="' + (cy + 5) + '" width="' + so(Math.max(2, w), 1) + '" height="12" rx="3" fill="'
      + (dat ? MAU.dat : (v / max > 0.66 ? MAU.cap3 : v / max > 0.33 ? MAU.cap2 : MAU.cap1)) + '"/>'
      + '<text x="' + (L + Math.max(2, w) + 7) + '" y="' + (cy + 15) + '" class="svg-nhan">'
      + (coTyLe ? phanTram(v) : soVN(gio, 1)) + '</text>'
      + '</g>';
  });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="bieu-do" role="img" aria-label="Xếp hạng phòng">' + s + '</svg>';
}

/**
 * So sánh cấp trên (khu hoặc cụm) cho MỘT chỉ tiêu.
 * Độ dài thanh là tổng giờ ngoài giới hạn — đại lượng cộng được. Bên phải ghi số phòng
 * đạt trên tổng, để người đọc thấy ngay "cả cụm hỏng" hay "một phòng hỏng".
 */
function svgSoSanhCap(rows, khoaNhan) {
  if (!rows || !rows.length) return '';
  const W = 700, hangCao = 26, Lx = 186, R = 132, T = 6;
  const H = T + rows.length * hangCao + 6;
  const iw = W - Lx - R;
  const coTyLe = rows.every((r) => r.tong_gio_do);
  const lay = (r) => coTyLe ? 100 * (r.tong_gio_lech || 0) / r.tong_gio_do : (r.tong_gio_lech || 0);
  const max = Math.max.apply(null, rows.map(lay)) || 1;
  let s = '';
  rows.forEach((r, i) => {
    const v = lay(r);
    const gio = r.tong_gio_lech || 0;
    const w = Math.max(2, (v / max) * iw);
    const cy = T + i * hangCao;
    const heo = r.so_phong ? (r.so_phong - r.so_phong_dat) / r.so_phong : 0;
    const mau = heo >= 0.8 ? MAU.cap3 : heo >= 0.4 ? MAU.cap2 : heo > 0 ? MAU.cap1 : MAU.dat;
    s += '<g><title>' + esc(r[khoaNhan]) + ' — ngoài giới hạn '
      + (coTyLe ? phanTram(v) + ' thời gian có số đo (' + soVN(gio, 0) + ' giờ)' : soVN(gio, 1) + ' giờ') + ', '
      + r.so_phong_dat + '/' + r.so_phong + ' phòng đạt ngưỡng'
      + (r.trung_vi != null ? ', trung vị thời gian trong ngưỡng ' + phanTram(r.trung_vi) : '')
      + (r.kem_nhat ? ', kém nhất ' + r.kem_nhat.ma_phong + ' ' + phanTram(r.kem_nhat.ty_le_trong_nguong) : '')
      + '</title>'
      + '<text x="0" y="' + (cy + 17) + '" class="svg-hang">' + esc(r[khoaNhan]) + '</text>'
      + '<rect x="' + Lx + '" y="' + (cy + 6) + '" width="' + so(w, 1) + '" height="13" rx="3" fill="' + mau + '"/>'
      + '<text x="' + (Lx + w + 7) + '" y="' + (cy + 17) + '" class="svg-nhan">'
      + (coTyLe ? phanTram(v) : soVN(gio, 0) + ' giờ') + '</text>'
      + '<text x="' + W + '" y="' + (cy + 17) + '" text-anchor="end" class="svg-hang">'
      + r.so_phong_dat + '/' + r.so_phong + ' phòng đạt'
      + (r.so_con_lech ? ' · ' + r.so_con_lech + ' còn ngoài giới hạn' : '') + '</text></g>';
  });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="bieu-do" role="img" aria-label="So sánh tổng giờ ngoài giới hạn">'
    + s + '</svg>';
}

/**
 * Thanh hai chiều: trục ở giữa, bên trái là giờ TỤT DƯỚI giới hạn dưới,
 * bên phải là giờ VƯỢT TRÊN giới hạn trên. Hai bên dùng hai màu khác hẳn nhau
 * (đã kiểm định ΔE 30.9 dưới mắt mù màu) và đều có số ghi kèm.
 *
 * Dùng thang chung cho cả hai bên để so sánh được độ nặng giữa hai hướng.
 */
function svgThanhHaiChieu(rows, khoaNhan, khoaDuoi, khoaTren) {
  const ds = (rows || []).filter((r) => (r[khoaDuoi] || 0) > 0 || (r[khoaTren] || 0) > 0);
  if (!ds.length) return '<p class="mo">Kỳ này không có giờ ngoài giới hạn nào theo cả hai hướng.</p>';
  const coSoPhong = ds.some((r) => r.so_phong != null);

  // Độ dài thanh vẽ theo TỈ LỆ, không theo số giờ cộng dồn. Khu C1 có 37 phòng
  // còn khu Q2 có 9 phòng: so bằng số giờ tuyệt đối thì khu đông phòng luôn thua
  // dù chất lượng có khi còn tốt hơn. Số giờ vẫn xem được khi rê chuột.
  const coTyLe = ds.every((r) => r.tong_gio_do);
  const gt = (r, kh) => coTyLe ? 100 * (r[kh] || 0) / r.tong_gio_do : (r[kh] || 0);
  const W = 700, hangCao = 26, Lx = 176, R = coSoPhong ? 126 : 16, T = 22;
  const H = T + ds.length * hangCao + 8;
  const nua = Math.round((W - Lx - R) / 2);
  const giua = Lx + nua;
  const max = Math.max.apply(null, ds.map((r) => Math.max(gt(r, khoaDuoi), gt(r, khoaTren)))) || 1;
  const rong = (v) => Math.max(0, (v / max) * (nua - 52));

  let s = '<text x="' + (giua - 8) + '" y="12" text-anchor="end" class="svg-nhan-duoi">← tụt dưới giới hạn dưới</text>'
        + '<text x="' + (giua + 8) + '" y="12" class="svg-nhan-tren">vượt trên giới hạn trên →</text>'
        + '<line x1="' + giua + '" x2="' + giua + '" y1="' + (T - 4) + '" y2="' + (T + ds.length * hangCao)
        + '" stroke="' + MAU.muc2 + '" stroke-width="1"/>';
  ds.forEach((r, i) => {
    const d = gt(r, khoaDuoi) || 0, t = gt(r, khoaTren) || 0;
    const gioD = r[khoaDuoi] || 0, gioT = r[khoaTren] || 0;
    const viet = (v, gio) => coTyLe ? phanTram(v) : soVN(gio, 0);
    const cy = T + i * hangCao;
    s += '<g><title>' + esc(r[khoaNhan]) + ' — tụt dưới ' + viet(d, gioD) + ' ('
      + soVN(gioD, 0) + ' giờ), vượt trên ' + viet(t, gioT) + ' (' + soVN(gioT, 0) + ' giờ)'
      + (coTyLe ? '; tỉ lệ tính trên ' + soVN(r.tong_gio_do, 0) + ' giờ có số đo của nhóm' : '') + '</title>'
      + '<text x="0" y="' + (cy + 16) + '" class="svg-hang">' + esc(r[khoaNhan]) + '</text>'
      + (d > 0
          ? '<rect x="' + so(giua - rong(d), 1) + '" y="' + (cy + 5) + '" width="' + so(rong(d), 1)
            + '" height="13" rx="2" fill="' + MAU.lechDuoi + '"/>'
            + '<text x="' + so(giua - rong(d) - 6, 1) + '" y="' + (cy + 16)
            + '" text-anchor="end" class="svg-nhan">' + viet(d, gioD) + '</text>' : '')
      + (t > 0
          ? '<rect x="' + giua + '" y="' + (cy + 5) + '" width="' + so(rong(t), 1)
            + '" height="13" rx="2" fill="' + MAU.lechTren + '"/>'
            + '<text x="' + so(giua + rong(t) + 6, 1) + '" y="' + (cy + 16) + '" class="svg-nhan">'
            + viet(t, gioT) + '</text>' : '')
      + (coSoPhong && r.so_phong != null
          ? '<text x="' + W + '" y="' + (cy + 16) + '" text-anchor="end" class="svg-hang">'
            + r.so_phong_dat + '/' + r.so_phong + ' phòng đạt'
            + (r.so_con_lech ? ' · ' + r.so_con_lech + ' còn ngoài giới hạn' : '') + '</text>'
          : '')
      + '</g>';
  });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="bieu-do" role="img"'
    + ' aria-label="Số giờ ngoài giới hạn theo hai hướng">' + s + '</svg>'
    + '<p class="chu-thich">'
    + (coTyLe
        ? 'Độ dài thanh và con số là tỉ lệ thời gian ngoài giới hạn trên tổng thời gian có số đo của chính nhóm đó, '
          + 'nên khu ít phòng và khu nhiều phòng so được với nhau. Số giờ cộng dồn xem khi rê chuột.'
        : 'Đơn vị: giờ, cộng dồn các phòng trong nhóm.')
    + ' Hai bên dùng chung một thang nên so được độ nặng giữa hai hướng.</p>';
}

/**
 * Xu hướng dài: chuỗi ngày đã đo nối tiếp bằng phần ngoại suy.
 * Hai phần vẽ khác nhau — đã đo là đường liền, ngoại suy là đường đứt kèm dải
 * dao động — để không ai nhầm số dự đoán với số đã đo.
 */
function svgXuHuongDai(chuoi, duBao) {
  const ds = (chuoi || []).filter(function (c) { return c.y != null; });
  if (ds.length < 3) return '<p class="mo">Chưa đủ chuỗi ngày để vẽ xu hướng dài.</p>';
  const db = (duBao || []).filter(function (c) { return c.gia_tri != null; });
  const W = 760, H = 190, Lx = 42, R = 14, T = 14, B = 26;
  const iw = W - Lx - R, ih = H - T - B;
  const n = ds.length + db.length;
  const x = (i) => Lx + (i / (n - 1)) * iw;
  const y = (v) => T + ih - (Math.max(0, Math.min(100, v)) / 100) * ih;

  let g = '';
  [0, 20, 40, 60, 80, 100].forEach(function (v) {
    g += '<line x1="' + Lx + '" x2="' + (W - R) + '" y1="' + so(y(v), 1) + '" y2="' + so(y(v), 1)
       + '" stroke="' + MAU.vien2 + '"/>'
       + '<text x="' + (Lx - 8) + '" y="' + so(y(v) + 3.5, 1) + '" text-anchor="end" class="svg-truc">'
       + v + '</text>';
  });
  g += '<line x1="' + Lx + '" x2="' + (W - R) + '" y1="' + so(y(NGUONG_HANH_DONG), 1) + '" y2="'
     + so(y(NGUONG_HANH_DONG), 1) + '" stroke="' + MAU.cap2 + '" stroke-width="1.4" stroke-dasharray="5 3"/>'
     + '<text x="' + (W - R) + '" y="' + so(y(NGUONG_HANH_DONG) - 6, 1)
     + '" text-anchor="end" class="svg-nhan-nguong">ngưỡng hành động ' + NGUONG_HANH_DONG + '%</text>';

  const dDo = ds.map(function (c, i) {
    return (i ? 'L' : 'M') + so(x(i), 1) + ' ' + so(y(c.y), 1); }).join(' ');

  let dDuBao = '', dai = '';
  if (db.length) {
    const noi = [{ gia_tri: ds[ds.length - 1].y }].concat(db);
    dDuBao = noi.map(function (c, i) {
      return (i ? 'L' : 'M') + so(x(ds.length - 1 + i), 1) + ' ' + so(y(c.gia_tri), 1); }).join(' ');
    const tren = db.map(function (c, i) {
      return (i ? 'L' : 'M') + so(x(ds.length + i), 1) + ' ' + so(y(c.canh_tren), 1); }).join(' ');
    const duoi = db.slice().reverse().map(function (c, i) {
      return 'L' + so(x(n - 1 - i), 1) + ' ' + so(y(c.canh_duoi), 1); }).join(' ');
    dai = '<path d="' + tren + ' ' + duoi + ' Z" fill="' + MAU.nhan + '" fill-opacity="0.10"/>';
    g += '<line x1="' + so(x(ds.length - 1), 1) + '" x2="' + so(x(ds.length - 1), 1) + '" y1="' + T
       + '" y2="' + (T + ih) + '" stroke="' + MAU.nhat + '" stroke-width="1" stroke-dasharray="2 3"/>'
       + '<text x="' + so(x(ds.length - 1) + 5, 1) + '" y="' + (T + 10) + '" class="svg-truc">hôm nay</text>';
  }

  let nhan = '';
  const buoc = Math.max(1, Math.ceil(ds.length / 8));
  ds.forEach(function (c, i) {
    if (i % buoc === 0 || i === ds.length - 1) {
      nhan += '<text x="' + so(x(i), 1) + '" y="' + (H - 8) + '" text-anchor="middle" class="svg-truc">'
            + ngayNgan(c.ngay) + '</text>';
    }
  });

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="bieu-do" role="img"'
    + ' aria-label="Xu hướng thời gian trong ngưỡng qua ' + ds.length + ' ngày và phần ngoại suy">'
    + g + dai
    + '<path d="' + dDo + '" fill="none" stroke="' + MAU.nhan + '" stroke-width="2" stroke-linejoin="round"/>'
    + (dDuBao ? '<path d="' + dDuBao + '" fill="none" stroke="' + MAU.nhan + '" stroke-width="2"'
              + ' stroke-dasharray="5 4" opacity="0.75"/>' : '')
    + nhan + '</svg>'
    + '<p class="chu-thich">Đường liền là số đã đo. Đường đứt và vùng mờ là phần ngoại suy — '
    + 'không phải số đo, chỉ đúng khi không có thay đổi nào về thiết bị hay cách vận hành.</p>';
}

/** Dumbbell kỳ trước → kỳ này. */
function svgDumbbell(rows) {
  if (!rows || !rows.length) return '<p class="mo">Không có phòng nào tụt quá ngưỡng.</p>';
  const W = 760, hangCao = 26, L = 210, R = 56, T = 18;
  const H = T + rows.length * hangCao + 22;
  const iw = W - L - R;
  const x = (v) => L + (Math.max(0, Math.min(100, v)) / 100) * iw;
  let s = '';
  [0, 25, 50, 75, 100].forEach((v) => {
    s += '<line x1="' + so(x(v), 1) + '" x2="' + so(x(v), 1) + '" y1="' + T + '" y2="'
       + (T + rows.length * hangCao) + '" stroke="' + MAU.vien2 + '"/>'
       + '<text x="' + so(x(v), 1) + '" y="' + (H - 6) + '" text-anchor="middle" class="svg-truc">' + v + '%</text>';
  });
  s += '<line x1="' + so(x(NGUONG_HANH_DONG), 1) + '" x2="' + so(x(NGUONG_HANH_DONG), 1) + '" y1="' + T
     + '" y2="' + (T + rows.length * hangCao) + '" stroke="' + MAU.cap2 + '" stroke-width="1.2" stroke-dasharray="4 3"/>';
  rows.forEach((r, i) => {
    const cy = T + i * hangCao + hangCao / 2;
    const x1 = x(r.tuan_thu_ky_truoc), x2 = x(r.tuan_thu_ky_nay);
    s += '<g><title>' + esc(r.ma_phong) + ' — kỳ trước ' + phanTram(r.tuan_thu_ky_truoc) + ', kỳ này '
      + phanTram(r.tuan_thu_ky_nay) + '</title>'
      + '<text x="0" y="' + so(cy + 4, 1) + '" class="svg-hang">'
      + esc(tenPhongGon(r.ma_phong, String(r.ten_phong || '').slice(0, 22))) + '</text>'
      + '<line x1="' + so(x1, 1) + '" x2="' + so(x2, 1) + '" y1="' + so(cy, 1) + '" y2="' + so(cy, 1)
      + '" stroke="' + MAU.cap1 + '" stroke-width="3" stroke-linecap="round"/>'
      + '<circle cx="' + so(x1, 1) + '" cy="' + so(cy, 1) + '" r="4.5" fill="#fff" stroke="' + MAU.mo + '" stroke-width="1.6"/>'
      + '<circle cx="' + so(x2, 1) + '" cy="' + so(cy, 1) + '" r="4.5" fill="' + MAU.cap2 + '" stroke="#fff" stroke-width="1.4"/>'
      + '<text x="' + (W - R + 8) + '" y="' + so(cy + 4, 1) + '" class="svg-nhan">' + soVN(r.delta, 1) + '</text></g>';
  });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="bieu-do" role="img" aria-label="Tuân thủ kỳ trước so kỳ này">'
    + s + '</svg>';
}

/** Small multiples — mỗi ô một cụm hoặc một khu, chung một trục. */
function svgSmallMultiples(ds, khoaTen, khoaTyLe) {
  if (!ds || !ds.length) return '';
  return '<div class="luoi-sm">' + ds.map((a) => {
    const v = a[khoaTyLe];
    const duoi = v != null && v < NGUONG_HANH_DONG;
    return '<figure class="o-sm"><figcaption><span class="sm-ten">' + esc(a[khoaTen]) + '</span>'
      + '<span class="sm-so' + (duoi ? ' sm-xau' : '') + '">' + phanTram(v) + '</span></figcaption>'
      + svgSpark(a.chuoi, 150, 34) + '</figure>';
  }).join('') + '</div>';
}

/** Bản đồ phòng × ngày. */
function svgBanDo(phongs, ngays) {
  if (!phongs.length || !ngays.length) return '';
  const oW = ngays.length > 15 ? 17 : 30, oH = 15, L = 122, T = 20;
  const W = L + ngays.length * oW + 8, H = T + phongs.length * oH + 6;
  const buoc = Math.max(1, Math.ceil(ngays.length / 16));
  let s = '';
  ngays.forEach((n, j) => {
    if (j % buoc === 0 || j === ngays.length - 1) {
      s += '<text x="' + (L + j * oW + oW / 2) + '" y="' + (T - 7) + '" text-anchor="middle" class="svg-truc">'
         + ngayNgan(n) + '</text>';
    }
  });
  phongs.forEach((p, i) => {
    const y = T + i * oH;
    s += '<text x="' + (L - 6) + '" y="' + (y + oH - 4) + '" text-anchor="end" class="svg-hang-nho">'
       + esc(p.ma_phong) + (p.muc_uu_tien === 'P1' ? ' ◆' : '') + '</text>';
    const map = {};
    (p.chuoi || []).forEach((c) => { map[c.ngay] = c.ty_le; });
    ngays.forEach((n, j) => {
      const v = map[n];
      // Ô chỉ mang toạ độ và tên lớp; màu, bo góc, viền nằm trong CSS_BAN_DO.
      // Chỉ ô DƯỚI ngưỡng mới kèm chú giải rê chuột — ô đạt thì con số chính xác
      // không đáng để cõng thêm một thẻ cho mỗi ngày của mỗi phòng.
      const duoiNguong = v != null && v < NGUONG_HANH_DONG;
      s += '<rect x="' + (L + j * oW) + '" y="' + y + '" width="' + (oW - 2) + '" height="' + (oH - 2)
        + '" class="' + lopTheoTyLe(v) + '"'
        + (duoiNguong || v == null
            ? '><title>' + esc(p.ma_phong) + ' ' + ngayNgan(n) + ': '
              + (v == null ? 'không có số đo' : phanTram(v, 0)) + '</title></rect>'
            : '/>')
        + (duoiNguong && oW >= 24
            ? '<text x="' + Math.round(L + j * oW + (oW - 2) / 2) + '" y="' + (y + oH - 5)
              + '" text-anchor="middle" class="svg-o' + (v < 50 ? ' svg-o-dam' : '') + '">'
              + Math.round(v) + '</text>' : '');
    });
  });
  return '<div class="cuon-ngang o-bd"><svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H
    + '" class="bieu-do" role="img" aria-label="Bản đồ thời gian trong ngưỡng theo phòng và ngày">' + s + '</svg></div>';
}

module.exports = {
  TEN_CHI_TIEU: TEN_CHI_TIEU, TEN_CHI_TIEU_DAY_DU: TEN_CHI_TIEU_DAY_DU,
  Y_NGHIA_CHI_TIEU: Y_NGHIA_CHI_TIEU, HUONG_NGUY_HIEM: HUONG_NGUY_HIEM,
  TEN_MUC_CANH_BAO: TEN_MUC_CANH_BAO, TEN_UU_TIEN: TEN_UU_TIEN, TEN_UU_TIEN_NGAN: TEN_UU_TIEN_NGAN,
  TEN_TRANG_THAI: TEN_TRANG_THAI, TEN_NGOAI_LE: TEN_NGOAI_LE, TEN_KET_THUC: TEN_KET_THUC,
  TEN_KET_LUAN_DU_LIEU: TEN_KET_LUAN_DU_LIEU, TEN_HUONG: TEN_HUONG, TEN_KY: TEN_KY,
  dich: dich, vietLai: vietLai,
  NGUONG_HANH_DONG: NGUONG_HANH_DONG, GIO_SU_CO_CAP_A: GIO_SU_CO_CAP_A,
  GIO_NGHIEM_TRONG_A: GIO_NGHIEM_TRONG_A, SUT_GIAM_CAP_B: SUT_GIAM_CAP_B,
  NGOAI_LE_HE_THONG: NGOAI_LE_HE_THONG, TOI_DA_CAP_A: TOI_DA_CAP_A, DOT_LECH_DANG_KE: DOT_LECH_DANG_KE,
  DU_PHONG_DE_SO_SANH: DU_PHONG_DE_SO_SANH,
  esc: esc, so: so, soVN: soVN, tenPhongGon: tenPhongGon, phanTram: phanTram, gioTyLe: gioTyLe, ngayNgan: ngayNgan, ngayDai: ngayDai, gioPhut: gioPhut, gioDoc: gioDoc, delta: delta,
  phanCap: phanCap, tongHopChiTieu: tongHopChiTieu, gomChiTieuTheoCap: gomChiTieuTheoCap, bocChuoiCamBien: bocChuoiCamBien, dungCay: dungCay,
  MAU: MAU, mauTheoTyLe: mauTheoTyLe, CSS_BAN_DO: CSS_BAN_DO,
  svgSpark: svgSpark, svgDuongNgay: svgDuongNgay, svgDaiGioiHan: svgDaiGioiHan,
  svgThanhXepHang: svgThanhXepHang, svgDumbbell: svgDumbbell, svgSoSanhCap: svgSoSanhCap,
  svgThanhHaiChieu: svgThanhHaiChieu, HAI_HUONG: HAI_HUONG, svgXuHuongDai: svgXuHuongDai,
  svgSmallMultiples: svgSmallMultiples, svgBanDo: svgBanDo
};

});
__dinh_nghia("rap-bao-cao.node", function (module, require) {
'use strict';
/* ===========================================================================
 * RÁP BÁO CÁO BẢN IN (scorecard A4 → PDF)
 *
 * Trình tự trình bày đi từ LỚN TỚI NHỎ:
 *   toàn nhà máy → so sánh các khu → trong mỗi khu so sánh các cụm xử lý
 *   không khí → trong mỗi cụm liệt kê từng phòng.
 *
 * Chênh áp là mục lớn nhất và đứng trước, vì đây là hàng rào ngăn nhiễm chéo.
 * Nhiệt độ và độ ẩm có mục riêng, chỉ tính trên các phòng thực sự có đo.
 *
 * Mọi từ ngữ, luật xếp hạng và biểu đồ lấy từ bao-cao-loi.js để bản in và
 * bản xem trên máy không nói hai giọng khác nhau.
 * ========================================================================= */

const L = require('./bao-cao-loi.js');
const { esc, so, soVN, phanTram, ngayDai, ngayNgan, gioDoc, gioPhut, delta, dich, NGUONG_HANH_DONG, TOI_DA_CAP_A } = L;

/* ===== CSS ============================================================== */

const CSS = `
/* ── Thang cỡ chữ và khoảng cách ──────────────────────────────────────────
   Mỗi bậc cách nhau đủ để mắt nhận ra ngay thứ bậc, không cần đọc mới biết
   cái nào lớn hơn. Khoảng cách dùng bội số của 4 để mọi khối thẳng hàng.  */
:root{
  --muc:${L.MAU.muc}; --muc2:${L.MAU.muc2}; --mo:${L.MAU.mo}; --nhat:${L.MAU.nhat};
  --vien:${L.MAU.vien}; --vien2:${L.MAU.vien2}; --giay:${L.MAU.giay}; --nen:${L.MAU.nen};
  --nhan:${L.MAU.nhan}; --nhan-nhat:${L.MAU.nhanNhat};
  --cap1:${L.MAU.cap1}; --cap2:${L.MAU.cap2}; --cap3:${L.MAU.cap3};
  --c-duoi:${L.MAU.lechDuoi}; --c-tren:${L.MAU.lechTren};

  /* Thang cỡ chữ cho MÀN HÌNH. Chuẩn đọc trên màn hình hiện nay là 16px cho
     thân bài; 14px nhét được nhiều thông tin hơn nhưng đó là ưu tiên sai khi
     người đọc là quản lý. Bản in ra giấy vẫn giữ cỡ nhỏ hơn ở khối @media print
     vì giấy đọc gần hơn màn hình. */
  --co-1: 12px;  --co-2: 13px;  --co-3: 14px;  --co-4: 16px;
  --co-5: 18px;  --co-6: 22px;  --co-7: 28px;  --co-8: 58px;
  --k-1: 4px;  --k-2: 8px;  --k-3: 12px;  --k-4: 16px;
  --k-5: 24px; --k-6: 32px; --k-7: 44px;
  --le: 40px;
  /* Ba tầng bề mặt. Trang phẳng lì thì mắt không biết cái gì thuộc cái gì;
     nhưng đây là tài liệu chất lượng nên bóng phải rất nhẹ, đủ để tách tầng
     chứ không thành trang trí. Khi in thì bỏ hết bóng. */
  --nen-0:#F4F5F7;     /* nền ngoài cùng */
  --bong-1:0 1px 2px rgba(17,24,32,.04);
  --bong-2:0 2px 8px rgba(17,24,32,.06), 0 1px 2px rgba(17,24,32,.04);
  --bo-1: 4px;  --bo-2: 6px;  --bo-3: 8px;   /* ba bậc bo góc, không dùng giá trị lẻ */                       /* lề trái phải chung cho mọi mục */
  --mono: ui-monospace,'SF Mono','Cascadia Code',Consolas,monospace;
}
*{box-sizing:border-box}
body{margin:0;background:var(--nen-0);color:var(--muc);
  font:var(--co-4)/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Arial,sans-serif;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.trang{max-width:1000px;margin:0 auto;background:var(--giay);
  box-shadow:0 0 0 1px rgba(17,24,32,.05), 0 8px 32px rgba(17,24,32,.06)}

/* ── Đầu trang ───────────────────────────────────────────────────────── */
.dau{display:flex;justify-content:space-between;align-items:flex-end;gap:var(--k-5);
  padding:var(--k-6) var(--le) var(--k-4);border-bottom:2px solid var(--muc)}
.dau h1{margin:0 0 var(--k-1);font-size:var(--co-7);line-height:1.25;letter-spacing:-.015em;font-weight:640}
.dau .phu{color:var(--mo);font-size:var(--co-3)}
.ma-tl{text-align:right;font-family:var(--mono);font-size:var(--co-1);color:var(--muc2);
  line-height:1.9;white-space:nowrap}
.ma-tl b{color:var(--muc)}

/* ── Mục lục ─────────────────────────────────────────────────────────── */
.muc-luc{padding:var(--k-5) var(--le);border-bottom:1px solid var(--vien);background:var(--nen)}
.ml-nhan{font-size:var(--co-1);color:var(--mo);letter-spacing:.09em;text-transform:uppercase;
  font-weight:600;margin-bottom:var(--k-3)}
.muc-luc ol{margin:0;padding:0;list-style:none;
  display:grid;grid-template-columns:repeat(3,1fr);gap:var(--k-2) var(--k-5)}
.muc-luc li{font-size:var(--co-3);color:var(--muc2);display:flex;gap:var(--k-2);align-items:baseline}
.ml-so{font-family:var(--mono);font-size:var(--co-1);color:var(--mo);min-width:14px}
.ml-phu{color:var(--mo);font-size:var(--co-2);margin-left:var(--k-1)}
.ml-cuoi{margin-top:var(--k-3);font-size:var(--co-2);color:var(--mo)}

/* ── Mục ─────────────────────────────────────────────────────────────── */
section{padding:var(--k-7) var(--le);border-bottom:1px solid var(--vien)}
h2{margin:0 0 var(--k-3);font-size:20px;font-weight:650;letter-spacing:-.015em;
  display:flex;align-items:baseline;gap:var(--k-3);line-height:1.3}
h2 .dem{color:var(--mo);font-weight:400;font-size:var(--co-3)}
.so-muc{font-family:var(--mono);font-size:var(--co-3);color:var(--nhan);font-weight:700;
  background:var(--nhan-nhat);border-radius:var(--bo-1);padding:2px 8px;flex:none;
  line-height:1.4;align-self:center}
/* Tầng con trong mục dài: có vạch mảnh phía trên để mắt biết đã sang phần mới,
   không phải cuộn mãi một khối chữ liền. */
h3{margin:var(--k-6) 0 var(--k-3);padding-top:var(--k-3);font-size:17px;font-weight:640;
  display:flex;align-items:baseline;gap:var(--k-2);border-top:1px solid var(--vien2)}
h3:first-of-type{border-top:none;padding-top:0;margin-top:var(--k-5)}
.so-muc-phu{font-family:var(--mono);font-size:var(--co-1);color:var(--mo);font-weight:600;flex:none}
.nhan-phu{margin:var(--k-4) 0 var(--k-1);font-size:var(--co-2);color:var(--mo);
  letter-spacing:.04em;text-transform:uppercase;font-weight:600}
.mota{margin:0 0 var(--k-4);color:var(--muc2);font-size:var(--co-3);max-width:76ch;line-height:1.65}
.mo{color:var(--mo)}
.chinh{border-top:3px solid var(--muc)}

/* ── Kết luận và số dẫn ──────────────────────────────────────────────── */
.ket-luan{display:flex;gap:var(--k-3);align-items:baseline;padding:var(--k-3) var(--k-4);
  border-radius:var(--bo-3);background:#FEF2F2;border:1px solid #FCA5A5;margin:0 0 var(--k-6)}
.ket-luan.dat{background:var(--nen);border-color:var(--vien)}
.ket-luan .nhan-tt{font-weight:650;white-space:nowrap;font-size:var(--co-3)}
.ket-luan p{margin:0;font-size:var(--co-4)}

.hero{display:grid;grid-template-columns:200px 1fr;gap:var(--k-6);align-items:center}
.hero .so-lon{font-size:var(--co-8);line-height:.95;font-weight:650;letter-spacing:-.035em;
  font-variant-numeric:tabular-nums}
.hero .don-vi{font-size:var(--co-6);color:var(--mo);font-weight:400;letter-spacing:0}
.hero .nhan-hero{font-size:var(--co-2);color:var(--mo);margin-top:var(--k-2);line-height:1.4;max-width:22ch}
.hero .delta{margin-top:var(--k-2);font-size:var(--co-3)}

.kpi-hang{display:grid;grid-template-columns:repeat(4,1fr);gap:0;
  border:1px solid var(--vien);border-radius:var(--bo-3);overflow:hidden;margin-top:var(--k-6);
  box-shadow:var(--bong-1)}
.kpi{background:var(--giay);padding:var(--k-3) var(--k-4);border-left:1px solid var(--vien)}
.kpi:first-child{border-left:none}
.kpi .ten{font-size:var(--co-1);color:var(--mo);letter-spacing:.03em}
.kpi .gt{font-size:var(--co-6);font-weight:640;font-variant-numeric:tabular-nums;
  margin-top:var(--k-1);line-height:1.15;letter-spacing:-.02em}
.kpi .ct{font-size:var(--co-2);color:var(--mo);margin-top:var(--k-1);line-height:1.45}
.tang{font-size:var(--co-3);font-variant-numeric:tabular-nums}
.tang-xau{color:var(--cap2);font-weight:600}
/* Số giờ đi kèm tỉ lệ: giờ thô không cho biết nặng nhẹ khi các phòng có
   số giờ đo khác nhau. */
.phu-ty-le{font-size:var(--co-1);color:var(--mo);font-weight:400}
.phu-th{font-weight:400;text-transform:none;letter-spacing:0;color:var(--nhat)}
.tang-tot{color:var(--muc2)}

/* ── Bảng: bỏ viền dọc, dùng khoảng trắng và một đường ngang mảnh ────── */
table{width:100%;border-collapse:collapse;font-size:var(--co-3)}
/* Tiêu đề cột ĐƯỢC phép xuống dòng. Ép nowrap thì bảng mười cột tự giãn rộng ra
   quá khung và sinh thanh cuộn ngang dù nội dung vẫn vừa. Chỉ cột số mới cần
   giữ nguyên một dòng. */
th{text-align:left;font-size:var(--co-1);color:var(--mo);font-weight:600;letter-spacing:.03em;
  padding:var(--k-2);border-bottom:1px solid var(--muc2);vertical-align:bottom;line-height:1.35}
th.so{white-space:nowrap}
td{padding:var(--k-2);border-bottom:1px solid var(--vien2);vertical-align:top;line-height:1.5}
/* Hàng chẵn tô rất nhạt: bảng mười cột mà không có gì dẫn mắt thì rất dễ lạc dòng. */
tbody tr:nth-child(even){background:#FCFCFD}
tbody tr:hover{background:var(--nhan-nhat)}
tbody tr:last-child td{border-bottom:none}
td.so,th.so{text-align:right;font-variant-numeric:tabular-nums}
.ma{font-family:var(--mono);font-size:var(--co-2)}

/* ── Việc phải xử lý ─────────────────────────────────────────────────── */
.viec{border-left:3px solid var(--cap2);background:#FEF8F8}
.viec td{padding:var(--k-3) var(--k-2)}
.viec .tieu{font-weight:640;font-size:var(--co-3)}
.viec .can-cu{color:var(--muc2);font-size:var(--co-2);margin-top:var(--k-1);line-height:1.55}
.viec .lam{color:var(--muc2);font-size:var(--co-2);margin-top:var(--k-2);padding-left:var(--k-3);
  border-left:2px solid var(--vien);line-height:1.55}
.the{display:inline-block;font-size:11px;padding:1px 6px;border-radius:99px;border:1px solid var(--vien);
  color:var(--muc2);background:var(--giay);vertical-align:middle;font-weight:600;white-space:nowrap}
.the-p1{border-color:var(--cap2);color:var(--cap2)}
.the-gt{font-weight:400;color:var(--mo)}
.the-loai{background:var(--nen)}
.stt-a{font-family:var(--mono);font-size:var(--co-2);color:var(--mo);font-weight:600}

.he-thong{border:1px solid var(--vien);border-left:3px solid var(--muc);border-radius:var(--bo-2);
  padding:var(--k-3) var(--k-4);margin:0 0 var(--k-4);background:var(--nen)}
.ht-nhan{font-size:var(--co-1);color:var(--mo);font-weight:600;letter-spacing:.04em;
  text-transform:uppercase;margin-bottom:var(--k-1)}
.he-thong p{margin:0;font-size:var(--co-3);line-height:1.6}
.ht-viec{color:var(--muc2);font-size:var(--co-2);margin-top:var(--k-2) !important;
  padding-left:var(--k-3);border-left:2px solid var(--vien)}

/* ── Hai phía ra ngoài giới hạn ──────────────────────────────────────────────────── */
.hai-huong{display:grid;grid-template-columns:1fr 1fr;gap:var(--k-3);margin:0 0 var(--k-5)}
.hh-o{border:1px solid var(--vien);border-radius:var(--bo-3);padding:var(--k-3) var(--k-4);border-left-width:3px}
.hh-duoi{border-left-color:var(--c-duoi);background:#FEF7F7}
.hh-tren{border-left-color:var(--c-tren);background:#FAF8FE}
.hh-ten{font-size:var(--co-2);color:var(--mo);font-weight:600}
.hh-gt{font-size:var(--co-6);font-weight:640;font-variant-numeric:tabular-nums;
  margin:var(--k-1) 0;letter-spacing:-.02em}
.hh-phu{font-size:var(--co-2);color:var(--muc2);line-height:1.5}
.svg-nhan-duoi{font-size:11.5px;fill:var(--c-duoi);font-weight:600}
.svg-nhan-tren{font-size:11.5px;fill:var(--c-tren);font-weight:600}
td.o-duoi{color:var(--c-duoi);font-weight:600}
td.o-tren{color:var(--c-tren);font-weight:600}

/* ── Biểu đồ ─────────────────────────────────────────────────────────── */
/* Biểu đồ đặt trong khung riêng, có nền và khoảng thở — để nó là một đối tượng
   nhìn được, không lẫn vào dòng chữ phía trên. */
.bieu-do{width:100%;height:auto;display:block}
.khung-bd{background:var(--nen);border:1px solid var(--vien2);border-radius:var(--bo-3);
  padding:var(--k-3) var(--k-4);margin:var(--k-2) 0}
.spark{display:inline-block;vertical-align:middle}
.svg-truc{font-size:11px;fill:var(--mo)}
.svg-hang{font-size:12px;fill:var(--muc2)}
.svg-hang-nho{font-size:10.5px;fill:var(--muc2);font-family:var(--mono)}
.svg-nhan{font-size:12px;fill:var(--muc);font-weight:600}
.svg-nhan-nguong{font-size:11px;fill:var(--cap2)}
.svg-nhan-gh{font-size:10.5px;fill:var(--nhan)}
.svg-o{font-size:9.5px;fill:#7F1D1D}
.svg-o-dam{fill:#fff}
.chu-thich{font-size:var(--co-2);color:var(--mo);margin:var(--k-2) 0 0;line-height:1.55;max-width:76ch}
.cuon-ngang{overflow-x:auto}
.hop-luu-y{margin:14px 0 0;padding:12px 16px;background:#FFFBEB;border-left:4px solid #B45309;border-radius:0 6px 6px 0;font-size:var(--co-3);line-height:1.6;}
${L.CSS_BAN_DO}

.luoi-sm{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--k-3) var(--k-4);margin-top:var(--k-2)}
.o-sm{margin:0;padding:var(--k-2) var(--k-3);border:1px solid var(--vien);border-radius:var(--bo-2)}
.o-sm figcaption{display:flex;justify-content:space-between;align-items:baseline;
  font-size:var(--co-2);margin-bottom:var(--k-1)}
.sm-ten{color:var(--muc2)}
.sm-so{font-variant-numeric:tabular-nums;font-weight:640}
.sm-xau{color:var(--cap2)}

/* ── Ô phòng theo dõi đặc biệt ───────────────────────────────────────── */
.o-phong{border:1px solid var(--vien);border-radius:var(--bo-3);padding:var(--k-4);
  margin-bottom:var(--k-3);background:var(--giay);box-shadow:var(--bong-1)}
.o-phong.lech{border-color:#FCA5A5;background:#FEFBFB}
.o-phong-dau{display:flex;justify-content:space-between;align-items:flex-start;
  gap:var(--k-4);margin-bottom:var(--k-2)}
.o-phong-ten{font-weight:640;font-size:var(--co-4)}
.o-phong-phu{font-size:var(--co-2);color:var(--mo);margin-top:2px}
.o-phong-so{text-align:right;white-space:nowrap}
.o-phong-so .lon{font-size:var(--co-6);font-weight:640;font-variant-numeric:tabular-nums;
  line-height:1.1;letter-spacing:-.02em}
.o-phong-so .nho{font-size:var(--co-2);color:var(--mo)}
.dong-so{display:flex;gap:var(--k-5);flex-wrap:wrap;font-size:var(--co-2);color:var(--muc2);
  margin-top:var(--k-2);padding-top:var(--k-2);border-top:1px solid var(--vien2)}
.dong-so b{font-variant-numeric:tabular-nums;color:var(--muc)}

/* ── Cây khu → cụm → phòng ───────────────────────────────────────────── */
.khoi-khu{border:1px solid var(--vien);border-radius:var(--bo-3);margin-bottom:var(--k-5);
  overflow:hidden;box-shadow:var(--bong-1)}
.khu-dau{display:flex;justify-content:space-between;align-items:center;gap:var(--k-4);
  padding:var(--k-3) var(--k-4);background:var(--nen);border-bottom:1px solid var(--vien)}
.khu-ten{font-weight:650;font-size:var(--co-5)}
.khu-mo-ta{font-size:var(--co-2);color:var(--mo);margin-top:2px}
.khu-so{text-align:right;font-size:var(--co-3);color:var(--muc2)}
.khu-so b{font-variant-numeric:tabular-nums;color:var(--muc)}
.khu-so-phu{font-size:var(--co-2);color:var(--mo);margin-top:2px}
.khoi-cum{padding:var(--k-3) var(--k-4);border-bottom:1px solid var(--vien2)}
.khoi-cum:last-child{border-bottom:none}
.cum-dau{display:flex;justify-content:space-between;align-items:baseline;
  gap:var(--k-3);margin-bottom:var(--k-2)}
.cum-ten{font-weight:640;font-size:var(--co-3)}
.cum-so{font-size:var(--co-2);color:var(--muc2);font-variant-numeric:tabular-nums}
.bang-phong{width:100%;font-size:var(--co-2)}
.bang-phong td{padding:var(--k-1) var(--k-2);border-bottom:1px solid var(--vien2)}

/* ── Nhận định ───────────────────────────────────────────────────────── */
.phat-hien{border:1px solid var(--vien);border-radius:var(--bo-3);padding:var(--k-4);
  margin-bottom:var(--k-3);background:var(--giay);box-shadow:var(--bong-1)}
.phat-hien h4{margin:0 0 var(--k-3);font-size:var(--co-4);font-weight:640;
  display:flex;align-items:baseline;gap:var(--k-2);line-height:1.4}
.stt{display:inline-flex;width:20px;height:20px;border-radius:99px;background:var(--muc);color:#fff;
  font-size:var(--co-1);align-items:center;justify-content:center;flex:none;font-weight:600}
.phat-hien dl{margin:0;display:grid;grid-template-columns:124px 1fr;gap:var(--k-1) var(--k-4);
  font-size:var(--co-3)}
.phat-hien dt{color:var(--mo);font-size:var(--co-1);letter-spacing:.03em;text-transform:uppercase;
  padding-top:3px;font-weight:600}
.phat-hien dd{margin:0;line-height:1.6}
.canh-bao-nhe{background:#FFFBEB;border:1px solid #FDE68A;padding:var(--k-3);border-radius:var(--bo-2);
  font-size:var(--co-3);margin:var(--k-3) 0 0;line-height:1.6}

/* ── Phụ lục ─────────────────────────────────────────────────────────── */
.pl-dau{background:var(--muc);color:#fff;padding:var(--k-4) var(--le)}
.pl-dau h2{color:#fff;margin:0;font-size:var(--co-5)}
details{border-bottom:1px solid var(--vien)}
details summary{padding:var(--k-4) var(--le);cursor:pointer;font-weight:640;font-size:var(--co-4);
  list-style:none;display:flex;justify-content:space-between;align-items:center;gap:var(--k-4)}
details summary::-webkit-details-marker{display:none}
details summary::after{content:'+';color:var(--mo);font-size:var(--co-6);font-weight:400}
details[open] summary::after{content:'−'}
details .noi-dung{padding:0 var(--le) var(--k-5)}

/* ── Kiểm soát tài liệu ──────────────────────────────────────────────── */
.canh-bao-in{border:1px solid var(--muc2);border-left:3px solid var(--muc);border-radius:var(--bo-2);
  padding:var(--k-3) var(--k-4);margin-bottom:var(--k-4);background:var(--nen);
  font-size:var(--co-3);line-height:1.6}
.bang-ksts th{width:190px;text-align:left;vertical-align:top;color:var(--muc2);font-weight:640;
  font-size:var(--co-3);text-transform:none;letter-spacing:0;border-bottom:1px solid var(--vien2);
  padding:var(--k-3) var(--k-2) var(--k-3) 0}
.bang-ksts td{font-size:var(--co-3);padding:var(--k-3) 0 var(--k-3) var(--k-2)}
.bang-ksts .mo{font-size:var(--co-2);margin-top:3px;line-height:1.55}

/* ── Ký duyệt và chân trang ──────────────────────────────────────────── */
.ky{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--k-5);margin-top:var(--k-2)}
.o-ky{border:1px solid var(--vien);border-radius:var(--bo-2);padding:var(--k-3) var(--k-4);
  min-height:112px;display:flex;flex-direction:column}
.o-ky .vt{font-size:var(--co-1);color:var(--mo);letter-spacing:.04em;text-transform:uppercase;font-weight:600}
.o-ky .ten{font-weight:640;margin-top:var(--k-1);font-size:var(--co-4)}
.o-ky .y{font-size:var(--co-2);color:var(--mo);margin-top:auto}
/* Dòng dẫn sang mục sau */
.dan-tiep{display:flex;align-items:center;gap:var(--k-3);margin-top:var(--k-6);
  padding:var(--k-3) var(--k-4);border:1px solid var(--vien);border-radius:var(--bo-3);
  background:var(--nen);text-decoration:none;color:var(--muc2);transition:border-color .12s ease}
.dan-tiep:hover{border-color:var(--nhan);background:var(--nhan-nhat)}
.dan-nhan{font-size:var(--co-1);color:var(--mo);text-transform:uppercase;letter-spacing:.05em;
  font-weight:600;white-space:nowrap}
.dan-cau{font-size:var(--co-3);flex:1}
.dan-mui{color:var(--nhan);font-size:var(--co-5)}
@media print{.dan-tiep{display:none}}

.ve-muc-luc{display:block;margin-top:var(--k-5);font-size:var(--co-2);color:var(--mo);
  text-decoration:none}
.ve-muc-luc:hover{color:var(--nhan)}
@media print{.ve-muc-luc{display:none}}
.chan{padding:var(--k-4) var(--le) var(--k-6);font-size:var(--co-1);color:var(--mo);
  font-family:var(--mono);line-height:1.8}


/* ── Tiếp cận và phản hồi tương tác ───────────────────────────────────────
   Bản báo cáo cũng là một giao diện: người đọc dùng bàn phím, rê chuột, nhảy
   mục. Thiếu những thứ dưới đây thì tài liệu vẫn đúng nhưng khó dùng.        */
:focus-visible{outline:2px solid var(--nhan);outline-offset:2px;border-radius:var(--bo-1)}
:focus:not(:focus-visible){outline:none}
::selection{background:var(--nhan-nhat)}

/* Bỏ qua phần đầu, nhảy thẳng vào nội dung — người dùng bàn phím cần nó đầu tiên */
.bo-qua{position:absolute;left:-9999px;top:0;background:var(--muc);color:#fff;
  padding:var(--k-2) var(--k-4);border-radius:0 0 6px 0;z-index:99;font-size:var(--co-3)}
.bo-qua:focus{left:0}

/* Mục lục bấm được: nhảy tới mục, chừa chỗ cho đầu trang dính */
.muc-luc a{color:inherit;text-decoration:none;display:flex;gap:var(--k-2);align-items:baseline;
  padding:2px 4px;margin:-2px -4px;border-radius:var(--bo-1)}
.muc-luc a:hover{background:var(--nhan-nhat);color:var(--nhan)}
section[id]{scroll-margin-top:var(--k-5)}

/* Hàng bảng và khối sáng lên khi rê chuột — người đọc dò theo hàng ngang
   trên bảng rộng rất dễ lạc dòng */
tbody tr{transition:background .12s ease}
tbody tr:hover{background:var(--nen)}
.o-phong,.khoi-cum,.hh-o,.phat-hien,.o-sm{transition:border-color .12s ease}
.o-phong:hover,.o-sm:hover{border-color:var(--nhat)}
details summary:hover{background:var(--nen)}

/* Ai đặt hệ thống ở chế độ giảm chuyển động thì tắt mọi hiệu ứng */
@media (prefers-reduced-motion: reduce){
  *{transition:none !important;animation:none !important;scroll-behavior:auto !important}
}

/* ── Bản in A4 ───────────────────────────────────────────────────────── */
@page{size:A4;margin:14mm 12mm 16mm}
@media print{
  /* Giấy đọc gần hơn màn hình, và mỗi bậc cỡ chữ tăng thêm là thêm mấy trang
     giấy mỗi kỳ. Trả về thang nhỏ hơn một bậc so với bản xem trên màn hình. */
  :root{
    --co-1:10.5px; --co-2:11.5px; --co-3:12px; --co-4:13px;
    --co-5:15px; --co-6:18px; --co-7:23px; --co-8:48px;
  }
  body{background:#fff;font-size:12px}
  h2{font-size:16px}
  h3{font-size:14px}
  .trang,.o-phong,.khoi-khu,.phat-hien,.kpi-hang{box-shadow:none !important}
  .khung-bd{background:none;border:none;padding:0}
  tbody tr:nth-child(even){background:none}
  .trang{max-width:none}
  section{padding:var(--k-5) 0;page-break-inside:avoid}
  .dau,.muc-luc,.pl-dau,details summary,details .noi-dung,.chan{padding-left:0;padding-right:0}
  .chinh{page-break-before:always}          /* mỗi mục lớn bắt đầu trang mới */
  /* mục lục đi liền tóm tắt điều hành trên trang đầu — người quản lý mở ra
     là thấy ngay tài liệu có gì và kết luận ra sao, không phải lật trang */
  .phat-hien,.o-sm,.o-phong,.khoi-khu,.khoi-cum,tr,.viec,.hh-o{page-break-inside:avoid}
  h2,h3{page-break-after:avoid}
  details{page-break-inside:auto}
  details summary::after{content:''}
  details .noi-dung{display:block}
  .cuon-ngang{overflow:visible}
  a{text-decoration:none;color:inherit}
  .bo-qua{display:none}
  .muc-luc a:hover{background:none}
}
`;

/* ===== KHỐI NHẬN ĐỊNH — nhận JSON có cấu trúc ========================== */

const TRUONG_BAT_BUOC = ['quan_sat', 'lien_he', 'gia_thuyet', 'can_xac_minh', 'ai_lam'];

function locPhatHien(ds) {
  const dat = [], loai = [];
  (ds || []).forEach((f) => {
    const thieu = TRUONG_BAT_BUOC.filter((k) => !f[k] || !String(f[k]).trim());
    if (thieu.length) loai.push({ f: f, thieu: thieu }); else dat.push(f);
  });
  return { dat: dat, loai: loai };
}

function renderNhanDinh(khoi) {
  const kq = locPhatHien(khoi && khoi.phat_hien);
  if (!kq.dat.length) {
    return '<p class="canh-bao-nhe">Không có phát hiện nào đủ năm phần bắt buộc nên phần nhận định để trống. '
         + 'Số liệu trong báo cáo không phụ thuộc phần này.</p>';
  }
  const dong = kq.dat.map((f, i) => ''
    + '<article class="phat-hien">'
    + '<h4><span class="stt">' + (i + 1) + '</span> '
    +   esc(L.vietLai(f.tieu_de || f.doi_tuong || 'Phát hiện')) + '</h4>'
    + '<dl>'
    + '<dt>Quan sát được</dt><dd>' + esc(L.vietLai(f.quan_sat)) + '</dd>'
    + '<dt>Liên hệ</dt><dd>' + esc(L.vietLai(f.lien_he)) + '</dd>'
    + '<dt>AI đề xuất <span class="the the-gt">giả thuyết · chưa xác nhận</span></dt><dd>'
    +   esc(L.vietLai(f.gia_thuyet)) + '</dd>'
    + '<dt>Cần xác minh</dt><dd>' + esc(L.vietLai(f.can_xac_minh)) + '</dd>'
    + '<dt>Ai làm</dt><dd>' + esc(L.vietLai(f.ai_lam)) + (f.han ? ' · hạn ' + esc(f.han) : '') + '</dd>'
    + '</dl></article>').join('');
  const ghi = kq.loai.length
    ? '<p class="canh-bao-nhe">Đã loại ' + kq.loai.length + ' phát hiện vì thiếu phần bắt buộc: '
      + esc(kq.loai.map((x) => x.thieu.join(', ')).join(' | ')) + '.</p>' : '';
  return dong + ghi;
}

/* ===== MỘT MỤC CHỈ TIÊU (chênh áp / nhiệt độ / độ ẩm) ================== */

function mucChiTieu(ct, laMucLon, soMuc, cauDan) {
  const capChiTieu = L.gomChiTieuTheoCap(ct);
  const hh = ct.hai_huong || {};
  const soSanhDuocTheoCap = ct.so_phong_do >= L.DU_PHONG_DE_SO_SANH;
  if (!ct.so_phong_do) {
    return '<section><h2><span class="so-muc">' + soMuc + '</span>' + esc(ct.ten)
      + '</h2><p class="mo">Kỳ này không có phòng nào đo '
      + esc(String(ct.ten).toLowerCase()) + '.</p></section>';
  }

  // Mỗi phòng một biểu đồ dải giới hạn
  function oMotPhong(p, ctx) {
    const lech = p.ty_le_trong_nguong != null && p.ty_le_trong_nguong < NGUONG_HANH_DONG;
    return '<div class="o-phong' + (lech ? ' lech' : '') + '">'
      + '<div class="o-phong-dau"><div>'
      +   '<div class="o-phong-ten">' + esc(L.tenPhongGon(p.ma_phong, p.ten_phong)) + '</div>'
      +   '<div class="o-phong-phu">Khu ' + esc(p.khu) + ' · cụm ' + esc(p.ahu)
      +     ' · giới hạn cho phép ' + soVN(p.ghd, 1) + ' – ' + soVN(p.ght, 1) + ' ' + esc(p.don_vi) + '</div>'
      + '</div><div class="o-phong-so">'
      +   '<div class="lon">' + soVN(p.ty_le_trong_nguong, 1) + '%</div>'
      +   '<div class="nho">thời gian trong ngưỡng</div></div></div>'
      + L.svgDaiGioiHan(p)
      + '<div class="dong-so">'
      +   '<span>Thời gian ngoài giới hạn: <b>' + L.gioTyLe(p.gio_lech, p.gio_do) + '</b></span>'
      +   '<span>Số đợt ngoài giới hạn: <b>' + (p.so_dot == null ? '—' : p.so_dot) + '</b></span>'
      +   '<span>Đợt dài nhất: <b>' + (p.dot_dai_nhat == null ? '—' : gioDoc(p.dot_dai_nhat)) + '</b></span>'
      +   '<span>Thời gian ở mức nghiêm trọng: <b>' + L.gioTyLe(p.gio_nghiem_trong, p.gio_co_du_lieu || p.gio_do) + '</b></span>'
      +   (p.con_lech_cuoi_ky ? '<span class="tang-xau">Còn đang ở ngoài giới hạn khi hết kỳ</span>' : '')
      + '</div></div>';
  }
  const oPhong = ct.dac_biet.map((p) => oMotPhong(p, ct)).join('');

  const nghiLoi = ct.dac_biet.concat(ct.them_ve || [])
    .some((p) => (p.chuoi || []).some((c) => c.nghi_loi_do));
  const oPhongThem = (ct.them_ve || []).map((p) => oMotPhong(p, ct)).join('');

  // Xếp hạng phòng ra ngoài giới hạn nhiều nhất
  // Xếp theo TỔNG cả hai hướng, không chỉ hướng nguy hiểm — nếu không, phòng
  // vượt trên rất nặng nhưng không tụt dưới sẽ không bao giờ xuất hiện.
  const bangXep = ct.xep_hang.slice()
    .sort((a, b) => (b.gio_lech_tong || 0) - (a.gio_lech_tong || 0))
    .slice(0, laMucLon ? 12 : 8);
  const hangXep = bangXep.map((r) => ''
    + '<tr><td><span class="ma">' + esc(r.ma_phong) + '</span><br><span class="mo">' + esc(r.ten_phong) + '</span></td>'
    + '<td>' + esc(r.khu_vuc) + ' · ' + esc(r.ahu) + '</td>'
    + '<td>' + esc(dich(L.TEN_UU_TIEN_NGAN, r.muc_uu_tien)) + '</td>'
    + '<td class="so">' + esc(r.gioi_han) + '</td>'
    + '<td class="so' + (r.ty_le_trong_nguong < NGUONG_HANH_DONG ? ' tang-xau' : '') + '">'
    +   soVN(r.ty_le_trong_nguong, 1) + '</td>'
    + (hh.nguoc
        ? '<td class="so o-duoi">' + soVN(r.gio_duoi, 1)
          + (r.gio_do ? '<br><span class="phu-ty-le">' + phanTram(100 * r.gio_duoi / r.gio_do) + '</span>' : '')
          + '</td><td class="so o-tren">' + soVN(r.gio_tren, 1)
          + (r.gio_do ? '<br><span class="phu-ty-le">' + phanTram(100 * r.gio_tren / r.gio_do) + '</span>' : '')
          + '</td>'
        : '<td class="so">' + soVN(r.gio_lech, 1)
          + (r.gio_do ? '<br><span class="phu-ty-le">' + phanTram(100 * r.gio_lech / r.gio_do) + '</span>' : '')
          + '</td>')
    + '<td class="so">' + (r.so_dot == null ? '—' : r.so_dot) + '</td>'
    + '<td class="so">' + (r.dot_dai_nhat == null ? '—' : r.dot_dai_nhat) + '</td>'
    + '<td>' + (r.con_lech_cuoi_ky ? '<span class="tang-xau">còn ngoài giới hạn</span>' : 'đã trở lại') + '</td></tr>').join('');

  // Đợt ngoài giới hạn kéo dài
  const dotDai = ct.su_kien.slice(0, laMucLon ? 10 : 6);
  const hangDot = dotDai.map((s) => ''
    + '<tr><td><span class="ma">' + esc(s.ma_phong) + '</span><br><span class="mo">' + esc(s.ten_phong) + '</span></td>'
    + '<td>' + esc(s.khu_vuc) + ' · ' + esc(s.ahu) + '</td>'
    + '<td>' + esc(dich(L.TEN_HUONG, s.huong)) + '</td>'
    + '<td class="so">' + gioDoc(s.so_gio) + '</td>'
    + '<td>' + ngayDai(s.bat_dau) + ' ' + gioPhut(s.bat_dau) + '<br><span class="mo">→ '
    +   ngayDai(s.ket_thuc) + ' ' + gioPhut(s.ket_thuc) + '</span></td>'
    + '<td class="so">' + soVN(s.huong === 'CAO' ? s.gia_tri_max : s.gia_tri_min, 1) + ' ' + esc(s.don_vi) + '</td>'
    + '<td>' + esc(dich(L.TEN_KET_THUC, s.ket_thuc_do)) + '</td></tr>').join('');

  return '<section' + (laMucLon ? ' class="chinh"' : '') + ' id="muc-' + soMuc + '">'
    + '<h2><span class="so-muc">' + soMuc + '</span>' + esc(ct.ten_day_du)
    + ' <span class="dem">— ' + ct.so_phong_do + ' phòng có đo'
    + (laMucLon ? ', chỉ tiêu trọng tâm của kỳ' : '') + '</span></h2>'
    + '<p class="mota">' + esc(ct.y_nghia) + ' Hướng nguy hiểm của chỉ tiêu này là <b>'
    + esc(ct.huong_nguy_hiem) + '</b>.' + (hh.nguoc ? ' Cả hai hướng đều được tính: bảng xếp hạng xếp theo TỔNG số giờ ngoài giới hạn của hai hướng và tách rõ từng hướng thành hai cột, để phòng ra ngoài giới hạn nhiều ở hướng nhẹ hơn vẫn hiện ra.' : ' Truy vấn đã gộp cả hai phía cho chỉ tiêu này nên chỉ có một con số giờ ngoài giới hạn.') + '</p>'

    /* Tầng 1 — toàn nhà máy */
    + '<h3><span class="so-muc-phu">' + soMuc + '.1</span>Toàn nhà máy</h3>'
    + '<p class="mota">Phần trăm đi kèm số giờ là tỉ lệ trên tổng thời gian THỰC SỰ CÓ SỐ ĐO của chỉ tiêu này ('
    + soVN(ct.tong_gio_do, 0) + ' giờ), không phải trên thời gian kỳ vọng — lấy thời gian kỳ vọng thì '
    + 'kỳ nào mất dữ liệu sẽ bị làm nhẹ đi một cách giả tạo.</p>'
    + '<p class="mota">' + ct.so_phong_dat_trong_bang + '/' + ct.so_phong_do + ' phòng đạt ngưỡng hành động '
    + NGUONG_HANH_DONG + '% thời gian trong ngưỡng. Con số này tính <b>riêng</b> cho ' + esc(String(ct.ten).toLowerCase())
    + ', nên khác con số ở mục 1 và mục 6 — hai chỗ đó gộp cả ba chỉ tiêu của phòng lại.</p>'
    + (hh.nguoc
        ? '<div class="hai-huong">'
          + '<div class="hh-o hh-duoi"><div class="hh-ten">' + esc(hh.chinh.ngan === 'tụt dưới'
              ? hh.chinh.ten : hh.nguoc.ten) + '</div>'
          +   '<div class="hh-gt">' + L.gioTyLe(ct.tong_gio_duoi, ct.tong_gio_do) + '</div>'
          +   '<div class="hh-phu">' + ct.so_phong_lech_duoi + '/' + ct.so_phong_do + ' phòng · '
          +   esc(hh.chinh.ngan === 'tụt dưới' ? hh.chinh.he_qua : hh.nguoc.he_qua) + '</div></div>'
          + '<div class="hh-o hh-tren"><div class="hh-ten">' + esc(hh.chinh.ngan === 'vượt trên'
              ? hh.chinh.ten : hh.nguoc.ten) + '</div>'
          +   '<div class="hh-gt">' + L.gioTyLe(ct.tong_gio_tren, ct.tong_gio_do) + '</div>'
          +   '<div class="hh-phu">' + ct.so_phong_lech_tren + '/' + ct.so_phong_do + ' phòng · '
          +   esc(hh.chinh.ngan === 'vượt trên' ? hh.chinh.he_qua : hh.nguoc.he_qua) + '</div></div>'
          + '</div>'
        : '<p class="mota">Tổng thời gian ra ngoài dải cho phép trong cả kỳ: '
          + L.gioTyLe(ct.tong_gio_lech, ct.tong_gio_do)
          + ' thời gian có số đo, cộng dồn trên ' + ct.so_phong_do + ' phòng. Truy vấn gộp chung cả hai phía cho chỉ tiêu này.</p>')

    /* Hai tầng so sánh giữa các nhóm — chỉ có nghĩa khi đủ nhiều phòng */
    + (soSanhDuocTheoCap ? (''
    /* Tầng 2 — so sánh các khu */
      + '<h3><span class="so-muc-phu">' + soMuc + '.2</span>Ba khu so với nhau</h3>'
      + '<p class="mota">So bằng <b>tỉ lệ</b> thời gian ngoài giới hạn của từng nhóm, không bằng số giờ cộng dồn: '
      + 'khu C1 có 37 phòng còn khu Q2 chỉ có 9 phòng, so số giờ thì nhóm đông phòng luôn thua dù chất '
      + 'lượng có khi còn tốt hơn. Mẫu số là thời gian có số đo của chính nhóm đó; số giờ cộng dồn xem '
      + 'khi rê chuột. Bên phải là số phòng đạt trên tổng số phòng của nhóm.</p>'
    // Chỉ tiêu có hai hướng thì vẽ THẲNG biểu đồ hai chiều. Trước đây vẽ thêm một
    // biểu đồ một chiều ở trên, nhưng nó chỉ cộng hướng nguy hiểm mà nhãn lại ghi
    // "tổng số giờ ngoài giới hạn" — khu C1 hiện 8878 giờ trong khi tổng thật là 14430 giờ.
    + (hh.nguoc
        ? L.svgThanhHaiChieu(capChiTieu.khu.map((x) => Object.assign({ nhan: 'Khu ' + x.khu }, x)),
            'nhan', 'tong_gio_duoi', 'tong_gio_tren')
        : L.svgSoSanhCap(capChiTieu.khu.map((x) => Object.assign({ nhan: 'Khu ' + x.khu }, x)), 'nhan'))

      /* Tầng 3 — so sánh các cụm xử lý không khí */
      + '<h3><span class="so-muc-phu">' + soMuc + '.3</span>Các cụm xử lý không khí so với nhau</h3>'
      + '<p class="mota">Nhiều phòng cùng một cụm cùng ra ngoài giới hạn là dấu hiệu nên nghi cụm trước khi đi '
      + 'sửa từng phòng — dấu hiệu, chưa phải kết luận: các phòng cùng cụm còn có thể giống nhau ở '
      + 'chỗ khác, như cùng khu sản xuất hay cùng ca vận hành.</p>'
    + (hh.nguoc
        ? L.svgThanhHaiChieu(capChiTieu.cum.slice(0, laMucLon ? 10 : 6), 'nhan', 'tong_gio_duoi', 'tong_gio_tren')
        : L.svgSoSanhCap(capChiTieu.cum.slice(0, laMucLon ? 10 : 6), 'nhan'))

      ) : '<p class="mota">Chỉ có ' + ct.so_phong_do + ' phòng đo chỉ tiêu này nên không tách '
        + 'theo khu và theo cụm — chia ra thì mỗi nhóm còn vài phòng, so sánh không nói lên điều gì. '
        + 'Xem thẳng từng phòng bên dưới.</p>')

    /* Tầng 4 — từng phòng */
    + (ct.dac_biet.length
        ? '<h3><span class="so-muc-phu">' + soMuc + '.4</span>Từng phòng theo dõi đặc biệt <span class="mo">— ' + ct.dac_biet.length
          + ' phòng, xếp từ kém nhất</span></h3>'
          + '<p class="mota">Vùng xanh nhạt là dải cho phép của chính phòng đó. Đường đậm là trung bình mỗi ngày, '
          + 'thanh dọc mờ là khoảng từ thấp nhất tới cao nhất trong ngày. Chấm đỏ là ngày có trung bình nằm ngoài dải.'
          + (nghiLoi ? ' Vòng tròn rỗng nét đứt là số đo thấp bất thường, nghi do lỗi phép đo — giữ lại để đối chiếu, '
                     + 'không tính vào khoảng dao động.' : '') + '</p>'
          + oPhong
        : '<p class="mo">Không có phòng theo dõi đặc biệt nào đo chỉ tiêu này.</p>')

    + (oPhongThem
        ? '<h4>Các phòng ra ngoài giới hạn nhiều nhất còn lại <span class="mo">— ' + ct.them_ve.length
          + ' phòng, không thuộc nhóm theo dõi đặc biệt nhưng ra ngoài giới hạn nhiều hơn</span></h4>'
          + oPhongThem
        : '')

    + '<h3><span class="so-muc-phu">' + soMuc + '.5</span>Xếp hạng phòng ra ngoài giới hạn nhiều nhất</h3>'
    + L.svgThanhXepHang(bangXep, hh.nguoc ? 'gio_lech_tong' : 'gio_lech', 'giờ', true)
    + '<p class="chu-thich">Độ dài thanh là tổng số giờ ngoài giới hạn của cả hai hướng. '
    + 'Thanh xám là phòng vẫn đạt ngưỡng hành động. Hai cột số trong bảng bên dưới tách riêng từng hướng.</p>'
    + '<div class="cuon-ngang"><table style="margin-top:12px"><thead><tr><th>Phòng</th><th>Khu · cụm</th>'
    + '<th>Ưu tiên</th><th class="so">Giới hạn (' + esc(ct.don_vi) + ')</th>'
    + '<th class="so">Thời gian trong ngưỡng %</th>'
    + (hh.nguoc
        ? '<th class="so">Giờ tụt dưới<br><span class="phu-th">và % thời gian đo</span></th>'
          + '<th class="so">Giờ vượt trên<br><span class="phu-th">và % thời gian đo</span></th>'
        : '<th class="so">Giờ ra ngoài dải<br><span class="phu-th">và % thời gian đo</span></th>')
    + '<th class="so">Số đợt ngoài giới hạn</th>'
    + '<th class="so">Đợt dài nhất (giờ)</th><th>Trạng thái cuối kỳ</th></tr></thead><tbody>'
    + hangXep + '</tbody></table></div>'

    + (hangDot
        ? '<h3><span class="so-muc-phu">' + soMuc + '.6</span>Các đợt ngoài giới hạn kéo dài <span class="mo">— từ ' + L.DOT_LECH_DANG_KE + ' giờ trở lên</span></h3>'
          + '<div class="cuon-ngang"><table><thead><tr><th>Phòng</th><th>Khu · cụm</th><th>Ra ngoài phía nào</th>'
          + '<th class="so">Thời gian kéo dài</th><th>Từ → đến</th><th class="so">Giá trị xa dải nhất</th><th>Đợt ngoài giới hạn kết thúc thế nào</th>'
          + '</tr></thead><tbody>' + hangDot + '</tbody></table></div>'
        : '')
    + (cauDan || '')
    + '</section>';
}

/* ===== MỤC PHÂN CẤP: nhà máy → khu → cụm → phòng ======================= */

function mucPhanCap(cay, dayDu, soMuc, cauDan) {
  const khoi = cay.map((k) => {
    const cum = k.cum.map((c) => {
      const phong = (dayDu ? c.phong : c.phong.slice(0, 5)).map((p) => ''
        + '<tr><td><span class="ma">' + esc(p.ma_phong) + '</span></td>'
        + '<td>' + esc(p.ten_phong) + (p.muc_uu_tien === 'P1' ? ' <span class="the the-p1">Mức 1</span>' : '') + '</td>'
        + '<td class="so' + (p.ty_le_tuan_thu < NGUONG_HANH_DONG ? ' tang-xau' : '') + '">'
        +   soVN(p.ty_le_tuan_thu, 1) + '%</td>'
        + '<td class="so">' + gioDoc(p.so_gio_critical) + '</td></tr>').join('');
      const con = !dayDu && c.phong.length > 5
        ? '<tr><td colspan="4" class="mo">… và ' + (c.phong.length - 5) + ' phòng nữa, xem phụ lục.</td></tr>' : '';
      return '<div class="khoi-cum">'
        + '<div class="cum-dau"><span class="cum-ten">Cụm ' + esc(c.ahu)
        + ' <span class="mo" style="font-weight:400">cấp khí cho ' + c.so_phong + ' phòng</span> '
        + L.svgSpark(c.chuoi, 92, 20) + '</span>'
        + '<span class="cum-so">giữ trong ngưỡng ' + phanTram(c.ty_le_tb) + ' thời gian · '
        + c.so_phong_dat + '/' + c.so_phong + ' phòng đạt · '
        + L.gioTyLe(c.gio_nghiem_trong, c.gio_do) + ' ở mức nghiêm trọng'
        + (c.so_phong_dac_biet ? ' · trong đó ' + c.so_phong_dac_biet
            + ' phòng thuộc nhóm theo dõi đặc biệt' : '') + '</span></div>'
        + '<table class="bang-phong"><tbody>' + phong + con + '</tbody></table></div>';
    }).join('');

    return '<div class="khoi-khu">'
      + '<div class="khu-dau"><div>'
      +   '<span class="khu-ten">Khu ' + esc(k.khu) + '</span>'
      +   '<div class="khu-mo-ta">' + k.so_phong + ' phòng, do ' + k.so_cum
      +     ' cụm xử lý không khí cấp khí</div></div>'
      + '<div class="khu-so">'
      +   '<div>Giữ được số đo trong ngưỡng <b>' + phanTram(k.ty_le_tb) + '</b> thời gian</div>'
      +   '<div class="khu-so-phu"><b>' + k.so_phong_dat + '/' + k.so_phong + '</b> phòng đạt ngưỡng '
      +     NGUONG_HANH_DONG + '% · <b>' + L.gioTyLe(k.gio_nghiem_trong, k.gio_do)
      +     '</b> ở mức nghiêm trọng</div></div></div>'
      + cum + '</div>';
  }).join('');

  return '<section id="muc-' + soMuc + '"><h2><span class="so-muc">' + soMuc
    + '</span>Toàn nhà máy → khu → cụm xử lý không khí → phòng</h2>'
    + '<p class="mota">Xếp từ kém nhất lên. Mỗi khu hiện các cụm xử lý không khí thuộc khu đó, '
    + 'mỗi cụm hiện các phòng do cụm đó cấp khí — để thấy ngay vấn đề nằm ở một phòng riêng lẻ '
    + 'hay ở cả cụm.</p>'
    + '<h3>So sánh các khu</h3>'
    + '<div class="khung-bd">' + L.svgSmallMultiples(cay.map((k) => ({ ten: 'Khu ' + k.khu, ty_le: k.ty_le_tb, chuoi: k.chuoi })), 'ten', 'ty_le') + '</div>'
    + '<h3>Chi tiết từng khu</h3>'
    + khoi + (cauDan || '') + '</section>';
}

/* Thứ tự mục cố định — dùng cho cả mục lục lẫn số hiệu in cạnh tiêu đề, để
 * không bao giờ ngoài giới hạn nhau. Khi thêm mục mới thì sửa ở đây trước. */
const VE_ML = '<a class="ve-muc-luc" href="#muc-luc">↑ Về mục lục</a>';

/* Dòng dẫn cuối mỗi mục lớn. Báo cáo tháng dài gần bốn mươi trang; hết một mục
 * mà không có gì nối sang mục sau thì người đọc dễ dừng lại giữa chừng. Câu này
 * nói mục tiếp theo trả lời câu hỏi gì, để họ biết có đáng đọc tiếp không. */
function dan(soMuc, cau) {
  return '<a class="dan-tiep" href="#muc-' + soMuc + '">'
    + '<span class="dan-nhan">Tiếp theo · mục ' + soMuc + '</span>'
    + '<span class="dan-cau">' + cau + '</span><span class="dan-mui">→</span></a>';
}

// Tên ở đây phải TRÙNG tiêu đề thật của mục. Mục lục ghi một đằng, tiêu đề một
// nẻo thì người đọc bấm vào rồi phân vân không biết có đúng chỗ mình cần không.
const MUC_LUC = [
  { ten: 'Tóm tắt điều hành',              phu: 'kết luận và bốn chỉ số chính' },
  { ten: 'Việc phải xử lý trong kỳ này',   phu: 'do luật cố định chọn' },
  { ten: 'Chênh áp giữa các phòng',        phu: 'chỉ tiêu trọng tâm · xét cả hai phía' },
  { ten: 'Nhiệt độ trong phòng' },
  { ten: 'Độ ẩm tương đối trong phòng' },
  { ten: 'Toàn nhà máy → khu → cụm xử lý không khí → phòng' },
  { ten: 'Theo dõi trước kỳ sau' },
  { ten: 'Nhận định' },
  { ten: 'Dự báo kỳ sau' }
];

/* ===== RÁP TOÀN BỘ ====================================================== */

function rapBaoCao(d, duBao, cfg) {
  const c = cfg || {};
  const k = d.kpi_ky_nay || {}, kt = d.kpi_ky_truoc || {};
  const cap = L.phanCap(d);
  const cay = L.dungCay(d);
  const chuoi = (d.chuoi_ngay && d.chuoi_ngay.total) || [];
  const ngays = chuoi.map((x) => x.ngay);
  const laThang = String(d.ky).toUpperCase() !== 'TUAN';

  const ctDP = L.tongHopChiTieu(d, 'DP');
  const ctT  = L.tongHopChiTieu(d, 'T');
  const ctRH = L.tongHopChiTieu(d, 'RH');

  const dTuanThu = delta(k.ty_le_tuan_thu, kt.ty_le_tuan_thu, ' điểm %', true);
  const dNghiem  = delta(k.so_gio_critical, kt.so_gio_critical, ' giờ', false);

  const dat = (k.ty_le_tuan_thu || 0) >= NGUONG_HANH_DONG && !cap.capA.length;
  // Câu kết luận phải nói thẳng ý nghĩa, không bắt người đọc tự trừ rồi tự suy
  // ra "vậy là phải làm gì". Dưới ngưỡng hành động nghĩa là PHẢI khắc phục,
  // không phải chỉ theo dõi tiếp — nói rõ điều đó ra.
  const thieu = NGUONG_HANH_DONG - (k.ty_le_tuan_thu || 0);
  const ketLuan = dat
    ? 'Toàn nhà máy giữ được số đo trong ngưỡng cho phép ' + phanTram(k.ty_le_tuan_thu)
      + ' thời gian, đạt ngưỡng hành động ' + NGUONG_HANH_DONG + '%. Kỳ này không có phòng nào '
      + 'phải xử lý ngay.'
    : 'Toàn nhà máy chỉ giữ được số đo trong ngưỡng cho phép ' + phanTram(k.ty_le_tuan_thu)
      + ' thời gian, trong khi ngưỡng hành động là ' + NGUONG_HANH_DONG + '% — còn thiếu '
      + soVN(thieu, 1) + ' điểm %. Dưới ngưỡng hành động nghĩa là phải khắc phục, '
      + 'không phải chỉ theo dõi tiếp. Có ' + cap.capA_tong + ' phòng cần xử lý'
      + (cap.capA_tong > TOI_DA_CAP_A
          ? ': mục 2 nêu ' + TOI_DA_CAP_A + ' phòng nặng nhất, đủ ' + cap.capA_tong
            + ' phòng ở phụ lục A.' : '.');

  const phongBanDo = (d.tat_ca_phong || [])
    .filter((p) => p.muc_uu_tien === 'P1' || p.muc_uu_tien === 'P2' || p.ty_le_tuan_thu < NGUONG_HANH_DONG)
    .sort((a, b) => a.ty_le_tuan_thu - b.ty_le_tuan_thu).slice(0, 26);

  const hangCapA = cap.capA.map((v, i) => ''
    + '<tr class="viec"><td class="so stt-a">A' + (i + 1) + '</td>'
    + '<td>' + v.loai.map((x) => '<span class="the the-loai">' + esc(x) + '</span>').join(' ') + '</td>'
    + '<td><div class="tieu"><span class="ma">' + esc(v.ma_phong) + '</span> · ' + esc(v.ten)
    +   ' <span class="the ' + (v.uu_tien === 'P1' ? 'the-p1' : '') + '">'
    +   esc(dich(L.TEN_UU_TIEN_NGAN, v.uu_tien)) + '</span></div>'
    +   v.can_cu.map((x) => '<div class="can-cu">' + esc(x) + '</div>').join('')
    +   v.viec.map((x) => '<div class="lam">' + esc(x) + '</div>').join('') + '</td>'
    + '<td class="so">' + soVN(v.tuan_thu, 1) + '%</td>'
    + '<td class="so">' + esc(v.ahu) + '</td></tr>').join('');

  const ht = cap.heThong;
  const heThongHtml = ht
    ? '<div class="he-thong"><div class="ht-nhan">Mức độ tin cậy của số đo</div>'
      + '<p><b>' + esc(ht.ket_luan) + '.</b> '
      + (ht.do_phu_pct != null
          ? 'Hệ thống thu được ' + L.phanTram(ht.do_phu_pct) + ' số giờ so với kỳ vọng ('
            + soVN(ht.gio_co_du_lieu || 0, 0) + '/' + soVN(ht.gio_ky_vong || 0, 0) + ' giờ), còn ' + soVN(ht.gio_rong || 0, 0)
            + ' giờ không có số đo. '
          : 'Kỳ này không đọc được chỉ số độ phủ dữ liệu. ')
      + 'Trong kỳ có ' + soVN(ht.tong_ngoai_le, 0) + ' lượt trục trặc khi lấy dữ liệu: '
      + esc(ht.danh_sach.map((x) => x.ten + ' — ' + soVN(x.so_lan, 0) + ' lượt').join('; ')) + '. '
      + 'Kết luận của báo cáo chỉ áp dụng cho khoảng thời gian thực sự có số đo.</p>'
      + '<p class="ht-viec">' + esc(ht.viec) + '</p></div>'
    : '';

  const hangCapB = cap.capB.map((p) => ''
    + '<tr><td><span class="ma">' + esc(p.ma_phong) + '</span><br><span class="mo">' + esc(p.ten_phong) + '</span></td>'
    + '<td class="so">' + soVN(p.tuan_thu_ky_truoc, 1) + '%</td>'
    + '<td class="so">' + soVN(p.tuan_thu_ky_nay, 1) + '%</td>'
    + '<td class="so tang-xau">' + soVN(p.delta, 1) + '</td>'
    + '<td>' + esc(L.vietLai((p.ly_do || []).join(' · '))) + '</td></tr>').join('');

  const hangPhong = (d.tat_ca_phong || []).slice()
    .sort((a, b) => a.ty_le_tuan_thu - b.ty_le_tuan_thu).map((p) => ''
    + '<tr><td><span class="ma">' + esc(p.ma_phong) + '</span></td><td>' + esc(p.ten_phong) + '</td>'
    + '<td>' + esc(p.khu_vuc) + '</td><td>' + esc(p.ahu || '—') + '</td>'
    + '<td>' + esc(dich(L.TEN_UU_TIEN_NGAN, p.muc_uu_tien)) + '</td>'
    + '<td class="so' + (p.ty_le_tuan_thu < NGUONG_HANH_DONG ? ' tang-xau' : '') + '">' + soVN(p.ty_le_tuan_thu, 1) + '</td>'
    + '<td class="so">' + p.so_gio_critical + '</td><td class="so">' + soVN(p.dq_pct, 1) + '</td>'
    + '</tr>').join('');

  const hangGioiHan = (d.gioi_han_tham_chieu || []).map((g) => ''
    + '<tr><td>' + esc(dich(L.TEN_UU_TIEN_NGAN, g.muc_uu_tien)) + '</td>'
    + '<td>' + esc(dich(L.TEN_CHI_TIEU, g.chi_tieu)) + '</td>'
    + '<td class="so">' + soVN(g.ghd, 1) + '</td><td class="so">' + soVN(g.ght, 1) + '</td>'
    + '<td>' + esc(g.don_vi) + '</td><td class="so">' + g.so_phong + '</td></tr>').join('');

  const db = duBao || {};
  const cuoi = (db.du_bao || []).slice(-1)[0] || {};
  const duBaoHtml = db.du_bao_dang_tin
    ? '<p>Xu hướng <b>' + esc(db.huong === 'cai_thien' ? 'đang cải thiện'
        : db.huong === 'xau_di' ? 'đang xấu đi' : 'đi ngang') + '</b>, mỗi ngày thay đổi '
      + soVN(db.do_doc_ngay, 3) + ' điểm %. Mức độ tin cậy của phép ngoại suy: R² '
      + soVN(db.r2, 3) + ' trên cửa sổ ' + db.cua_so_ngay + ' ngày (đủ tin cậy để nêu số). '
      + 'Nếu giữ nguyên xu hướng, sau 7 ngày nữa thời gian trong ngưỡng vào khoảng <b>'
      + soVN(cuoi.gia_tri, 1) + '%</b> (dao động ' + soVN(cuoi.canh_duoi, 1) + '–' + soVN(cuoi.canh_tren, 1) + '%).</p>'
      + '<p class="mo">Đây là phép ngoại suy tuyến tính từ số liệu đã có, không phải cam kết. '
      + 'Nó chỉ đúng khi không có thay đổi nào về thiết bị hay cách vận hành.</p>'
    : '<p class="canh-bao-nhe">Số liệu dao động quá bất thường (R² ' + soVN(db.r2, 3)
      + ') nên chưa đủ tin cậy để nêu con số dự báo. Không trích số dự báo nào vào kết luận.</p>';

  const tenKy = dich(L.TEN_KY, String(d.ky).toUpperCase(), String(d.ky).toLowerCase());

  return '<!doctype html>\n<html lang="vi"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>' + esc(c.tieu_de || 'Báo cáo giám sát môi trường') + '</title>'
    + '<style>' + CSS + '</style></head><body>'
    + '<a class="bo-qua" href="#muc-1">Bỏ qua phần đầu, vào thẳng nội dung</a>'
    + '<div class="trang">'

    + '<header class="dau"><div>'
    + '<h1>' + esc(c.tieu_de || 'Báo cáo giám sát môi trường phòng sạch') + '</h1>'
    + '<div class="phu">' + esc(c.don_vi || 'Hệ quản lý toà nhà') + ' · báo cáo ' + esc(tenKy)
    + ' · từ ' + ngayDai(d.tu_ngay) + ' đến ' + ngayDai(d.den_ngay)
    + ' · ' + (k.so_ngay_co_du_lieu || 0) + ' ngày có số đo</div></div>'
    + '<div class="ma-tl">Mã tài liệu <b>' + esc(c.ma_tai_lieu || '—') + '</b><br>'
    + 'Phiên bản <b>' + esc(c.phien_ban || '1') + '</b><br>'
    + 'Ngày phát hành <b>' + esc(c.phat_hanh || ngayDai(d.tao_luc)) + '</b></div></header>'

    /* Mục lục — báo cáo kỳ tháng dài, người đọc cần biết trong tay có gì */
    + '<nav class="muc-luc" id="muc-luc"><div class="ml-nhan">Nội dung</div><ol>'
    + MUC_LUC.map(function (m, i) {
        return '<li><a href="#muc-' + (i + 1) + '"><span class="ml-so">' + (i + 1) + '</span>'
          + '<span>' + esc(m.ten)
          + (m.phu ? '<span class="ml-phu">' + esc(m.phu) + '</span>' : '') + '</span></a></li>';
      }).join('')
    + '</ol><div class="ml-cuoi">Phụ lục · số liệu tra cứu &nbsp;·&nbsp; Ký duyệt</div></nav>'
    + '<main>'

    /* 1 · Tóm tắt điều hành */
    + '<section id="muc-1"><h2><span class="so-muc">1</span>Tóm tắt điều hành</h2>'
    + '<div class="ket-luan' + (dat ? ' dat' : '') + '">'
    + '<span class="nhan-tt">' + (dat ? 'Kết luận: trong kiểm soát' : 'Kết luận: cần hành động') + '</span>'
    + '<p>' + esc(ketLuan) + '</p></div>'
    + '<div class="hero"><div>'
    + '<div class="so-lon">' + soVN(k.ty_le_tuan_thu, 1) + '<span class="don-vi">%</span></div>'
    + '<div class="nhan-hero">thời gian số đo nằm trong ngưỡng cho phép</div>'
    + '<div class="delta tang tang-' + dTuanThu.huong + '">' + esc(dTuanThu.chu) + ' so với kỳ trước ('
    + soVN(kt.ty_le_tuan_thu, 1) + '%)</div></div>'
    + '<div class="khung-bd">' + L.svgDuongNgay(chuoi, 'Thời gian trong ngưỡng theo ngày')
    + '<p class="chu-thich">Tỉ lệ thời gian số đo nằm trong ngưỡng cho phép, tính theo từng ngày. '
    + 'Vạch đỏ đứt là ngưỡng hành động; vùng hồng là phần còn thiếu so với ngưỡng đó.</p></div></div>'
    + '<div class="kpi-hang">'
    + '<div class="kpi"><div class="ten">Thời gian ở mức nghiêm trọng</div><div class="gt">'
    +   soVN(k.so_gio_critical || 0, 0) + '<span class="don-vi" style="font-size:13px"> giờ</span>'
    +   (ht && ht.gio_co_du_lieu
          ? '<span class="don-vi" style="font-size:14px"> · '
            + phanTram(100 * (k.so_gio_critical || 0) / ht.gio_co_du_lieu) + '</span>' : '')
    +   '</div>'
    +   '<div class="ct tang tang-' + dNghiem.huong + '">' + esc(dNghiem.chu) + ' so với kỳ trước'
    +   (ht && ht.gio_co_du_lieu ? ' · phần trăm tính trên ' + soVN(ht.gio_co_du_lieu, 0)
          + ' giờ thu được số đo' : '') + '</div></div>'
    + '<div class="kpi"><div class="ten">Sự cố còn mở</div><div class="gt">' + ((d.su_co || {}).dang_mo || 0) + '</div>'
    +   '<div class="ct">phát sinh ' + ((d.su_co || {}).mo_trong_ky || 0) + ' · đã đóng '
    +   ((d.su_co || {}).dong_trong_ky || 0) + ' · trung bình khắc phục ' + soVN((d.su_co || {}).mttr_gio, 1) + ' giờ</div></div>'
    + '<div class="kpi"><div class="ten">Phòng phải xử lý</div><div class="gt">' + cap.capA_tong + '</div>'
    +   '<div class="ct">trong tổng số ' + (k.so_phong_khong_dat || 0) + '/'
    +   (k.tong_phong_co_du_lieu || 0) + ' phòng chưa đạt ngưỡng ' + NGUONG_HANH_DONG + '%</div></div>'
    + '<div class="kpi"><div class="ten">Thời gian thu được số đo</div><div class="gt">'
    +   soVN((ht && ht.do_phu_pct) != null ? ht.do_phu_pct : k.dq_pct, 1) + '%</div>'
    +   '<div class="ct">' + (ht ? (ht.gio_rong || 0) + ' giờ không có số đo' : 'đầy đủ') + '</div></div>'
    + '</div></section>'

    /* 2 · Việc phải xử lý */
    + '<section class="chinh" id="muc-2"><h2><span class="so-muc">2</span>Việc phải xử lý trong kỳ này '
    + '<span class="dem">— ' + cap.capA_tong + ' phòng'
    + (cap.capA_tong > TOI_DA_CAP_A ? ', hiển thị ' + TOI_DA_CAP_A + ' phòng nặng nhất' : '') + '</span></h2>'
    + '<p class="mota">Danh sách này do luật cố định chọn ra, không do máy viết nhận định quyết định. '
    + 'Một phòng vào danh sách khi: có sự cố mức nghiêm trọng mở quá ' + L.GIO_SU_CO_CAP_A
    + ' giờ mà chưa xử lý; hoặc là phòng theo dõi đặc biệt mà thời gian trong ngưỡng dưới ' + NGUONG_HANH_DONG + '%; '
    + 'hoặc có từ ' + L.GIO_NGHIEM_TRONG_A + ' giờ trở lên ở mức nghiêm trọng. '
    + 'Thứ tự ưu tiên: mức ưu tiên của phòng, rồi tới có sự cố quá hạn hay không, '
    + 'rồi tới mức thiếu hụt so với ngưỡng, cuối cùng là số giờ ở mức nghiêm trọng.</p>'
    + heThongHtml
    + (hangCapA
        ? '<div class="cuon-ngang"><table><thead><tr><th class="so" style="width:34px">#</th>'
          + '<th style="width:150px">Vì sao vào danh sách</th><th>Phòng · căn cứ · việc cần làm</th>'
          + '<th class="so" style="width:76px">Thời gian trong ngưỡng</th><th class="so" style="width:88px">Cụm</th>'
          + '</tr></thead><tbody>' + hangCapA + '</tbody></table></div>'
        : '<p class="mo">Kỳ này không có phòng nào phải xử lý ngay.</p>')
    /* Sự cố mở sau ngày chốt kỳ: truy vấn trả về sự cố đang mở TẠI LÚC CHẠY nên
       có cả sự việc của kỳ sau. Không đưa vào danh sách trên (sai phạm vi kỳ),
       nhưng vẫn phải báo vì đang còn treo. */
    + ((cap.suCoNgoaiKy || []).length
        ? '<div class="hop-luu-y"><b>Ngoài kỳ báo cáo.</b> ' + cap.suCoNgoaiKy.length
          + ' sự cố mở sau ngày chốt kỳ ' + L.ngayDai(d.den_ngay)
          + ' và tới lúc lập báo cáo vẫn chưa xử lý: '
          + cap.suCoNgoaiKy.map((x) => L.esc(x.phong) + ' (số ' + x.ma_su_co + ', mở '
              + L.ngayDai(x.bat_dau) + ', đã ' + L.soVN(x.keo_dai_gio, 0) + ' giờ)').join('; ')
          + '. Không tính vào kết quả kỳ này — sẽ vào báo cáo kỳ sau.</div>'
        : '')
    + dan(3, 'Chênh áp — chỉ tiêu trọng tâm: hàng rào ngăn nhiễm chéo, và là nơi ra ngoài giới hạn nhiều nhất kỳ này.')
    + VE_ML + '</section>'

    /* 3 · Chênh áp — mục trọng tâm */
    + mucChiTieu(ctDP, true, 3, dan(4, 'Nhiệt độ: chỉ 12 phòng có đo, nhưng đây là điều kiện thao tác và độ ổn định của sản phẩm.'))

    /* 4 · Nhiệt độ và độ ẩm */
    + mucChiTieu(ctT, false, 4, dan(5, 'Độ ẩm: hướng nguy hiểm là vượt trên — nguy cơ phát triển vi sinh vật.'))
    + mucChiTieu(ctRH, false, 5, dan(6, 'Toàn nhà máy → khu → cụm → phòng: xem vấn đề nằm ở một phòng lẻ hay cả cụm.'))

    /* 5 · Phân cấp nhà máy → khu → cụm → phòng */
    + mucPhanCap(cay, laThang, 6, dan(7, 'Theo dõi trước kỳ sau: phòng nào tụt rõ so với kỳ trước, chưa tới mức phải xử lý ngay.'))

    /* 6 · Theo dõi trước kỳ sau */
    + '<section id="muc-7"><h2><span class="so-muc">7</span>Theo dõi trước kỳ sau</h2>'
    + '<p class="mota">Phòng tụt từ ' + L.SUT_GIAM_CAP_B + ' điểm % trở lên so với kỳ trước. '
    + 'Vòng tròn rỗng là kỳ trước, chấm đặc là kỳ này.</p>'
    + '<div class="khung-bd">' + L.svgDumbbell(cap.capB) + '</div>'
    + (hangCapB
        ? '<div class="cuon-ngang"><table style="margin-top:16px"><thead><tr><th>Phòng</th>'
          + '<th class="so">Kỳ trước</th><th class="so">Kỳ này</th><th class="so">Chênh lệch (điểm %)</th>'
          + '<th>Vì sao phát hiện</th></tr></thead><tbody>' + hangCapB + '</tbody></table></div>'
        : '')
    + '</section>'

    /* 7 · Nhận định */
    + '<section id="muc-8"><h2><span class="so-muc">8</span>Nhận định</h2>'
    + '<p class="mota">Mỗi phát hiện phải nêu đủ năm phần. Giả thuyết chỉ là giả thuyết: hệ thống không có '
    + 'dữ liệu lệnh công việc hay hành động khắc phục, nên không kết luận nguyên nhân và không xác nhận '
    + 'việc gì đã được làm.</p>'
    + renderNhanDinh(c.nhan_dinh)
    + dan(9, 'Xu hướng dài và dự báo kỳ sau: kỳ này nằm ở đâu trong mạch ba mươi ngày gần nhất.')
    + VE_ML + '</section>'

    /* 8 · Dự báo */
    + '<section id="muc-9"><h2><span class="so-muc">9</span>Xu hướng dài và dự báo kỳ sau</h2>'
    + '<p class="mota">Biểu đồ gộp ' + ((duBao || {}).chuoi || []).length + ' ngày đã đo gần nhất '
    + 'với phần ngoại suy 7 ngày tới, để thấy kỳ này nằm ở đâu trong mạch dài chứ không chỉ so với '
    + 'một kỳ liền trước.</p>'
    + '<div class="khung-bd">' + L.svgXuHuongDai((duBao || {}).chuoi, (duBao || {}).du_bao) + '</div>'
    + duBaoHtml + '</section>'

    /* Phụ lục */
    + '<div class="pl-dau"><h2>Phụ lục · số liệu tra cứu</h2></div>'

    + (cap.capA_tong > TOI_DA_CAP_A
        ? '<details><summary>Phụ lục A · Toàn bộ ' + cap.capA_tong + ' phòng phải xử lý</summary>'
          + '<div class="noi-dung"><div class="cuon-ngang"><table><thead><tr><th class="so">#</th><th>Phòng</th>'
          + '<th>Khu · cụm</th><th>Ưu tiên</th><th class="so">Thời gian trong ngưỡng %</th>'
          + '<th class="so">Giờ ở mức nghiêm trọng</th><th class="so">Sự cố đã mở (giờ)</th><th>Vì sao vào danh sách</th></tr></thead><tbody>'
          + cap.capA_tat_ca.map((v, i) => '<tr><td class="so stt-a">A' + (i + 1) + '</td>'
              + '<td><span class="ma">' + esc(v.ma_phong) + '</span><br><span class="mo">' + esc(v.ten) + '</span></td>'
              + '<td>' + esc(v.khu) + ' · ' + esc(v.ahu) + '</td>'
              + '<td>' + esc(dich(L.TEN_UU_TIEN_NGAN, v.uu_tien)) + '</td>'
              + '<td class="so tang-xau">' + soVN(v.tuan_thu, 1) + '</td>'
              + '<td class="so">' + soVN(v.gio_nghiem_trong, 0) + '</td>'
              + '<td class="so">' + (v.su_co_qua_han ? soVN(v.su_co_qua_han, 1) : '—') + '</td>'
              + '<td>' + esc(v.loai.join(' · ')) + '</td></tr>').join('')
          + '</tbody></table></div></div></details>'
        : '')

    + '<details><summary>Phụ lục B · Bản đồ thời gian trong ngưỡng theo phòng và ngày</summary>'
    + '<div class="noi-dung"><p class="mota">Ô trắng là ngày đạt ngưỡng ' + NGUONG_HANH_DONG
    + '%. Chỉ ngày dưới ngưỡng mới tô màu, càng đậm càng nặng. Dấu ◆ sau mã phòng là phòng theo dõi đặc biệt.</p>'
    + L.svgBanDo(phongBanDo, ngays) + '</div></details>'

    + (laThang ? ''   // kỳ tháng: phần cây ở trên đã liệt kê đủ từng phòng theo cụm
        : '<details><summary>Phụ lục C · Toàn bộ ' + ((d.tat_ca_phong || []).length) + ' phòng có số đo</summary>'
    + '<div class="noi-dung"><div class="cuon-ngang"><table><thead><tr><th>Mã phòng</th><th>Tên phòng</th><th>Khu</th>'
    + '<th>Cụm</th><th>Ưu tiên</th><th class="so">Thời gian trong ngưỡng %</th><th class="so">Giờ ở mức nghiêm trọng</th>'
    + '<th class="so">Thời gian có số đo %</th></tr></thead><tbody>' + hangPhong
    + '</tbody></table></div></div></details>')

    + '<details><summary>Phụ lục D · Giới hạn áp dụng trong kỳ</summary>'
    + '<div class="noi-dung"><div class="cuon-ngang"><table><thead><tr><th>Mức ưu tiên</th>'
    + '<th>Chỉ tiêu</th><th class="so">Giới hạn dưới</th><th class="so">Giới hạn trên</th>'
    + '<th>Đơn vị</th><th class="so">Số phòng</th></tr></thead><tbody>' + hangGioiHan
    + '</tbody></table></div></div></details>'

    /* Kiểm soát tài liệu — phần bên bảo đảm chất lượng soi đầu tiên khi thanh tra.
       Nguyên tắc toàn vẹn dữ liệu đòi hỏi trả lời được: ai lập, lập lúc nào, số
       liệu lấy từ đâu, ngưỡng lấy từ đâu, bản gốc lưu ở đâu, bản in này có được
       kiểm soát không. */
    + '<section id="muc-ksts"><h2>Kiểm soát tài liệu</h2>'
    + '<div class="canh-bao-in"><b>Bản in trên giấy là bản không kiểm soát.</b> '
    + 'Bản có hiệu lực là tệp gốc lưu tại nơi ghi bên dưới. Trước khi dùng bản in để ra quyết định, '
    + 'phải đối chiếu mã lần chạy với bản gốc.</div>'
    + '<div class="cuon-ngang"><table class="bang-ksts"><tbody>'
    + '<tr><th>Người lập</th><td>' + esc(c.he_thong_lap || 'Hệ thống báo cáo tự động — không có thao tác thủ công')
    +   '<div class="mo">Báo cáo do máy dựng từ số liệu đo. Người lập, người soát xét và người phê duyệt '
    +   'ký ở mục dưới; chữ ký đó mới là căn cứ phát hành.</div></td></tr>'
    + '<tr><th>Thời điểm lập</th><td>' + esc(String(d.tao_luc).slice(0, 19).replace('T', ' '))
    +   ' giờ Việt Nam</td></tr>'
    + '<tr><th>Nguồn số liệu</th><td><span class="ma">' + esc(d.nguon || 'rpc_bao_cao_tong_hop')
    +   '(' + esc(d.ky) + ', ' + esc(d.tu_ngay) + ', ' + esc(d.den_ngay) + ')</span>'
    +   '<div class="mo">Số liệu đọc trực tiếp từ kho dữ liệu đo, không qua bước nhập tay nào.</div></td></tr>'
    + '<tr><th>Nguồn ngưỡng giới hạn</th><td>' + esc(c.nguon_gioi_han || 'Bảng cấu hình giới hạn theo phòng '
    +   'trong hệ quản lý toà nhà') + '<div class="mo">Giới hạn dưới và giới hạn trên áp dụng trong kỳ được '
    +   'liệt kê đầy đủ ở phụ lục D. Bộ ráp báo cáo không tự đặt ngưỡng nào.</div></td></tr>'
    + '<tr><th>Mã lần chạy</th><td><span class="ma">' + esc(c.ma_lan_chay || '—') + '</span>'
    +   '<div class="mo">Dùng mã này để tìm lại đúng lần chạy đã sinh ra bản báo cáo.</div></td></tr>'
    + '<tr><th>Nơi lưu bản gốc</th><td>' + esc(c.noi_luu || 'Thư mục báo cáo trên Google Drive của bộ phận')
    +   (c.link_drive ? ' · <span class="ma">' + esc(c.link_drive) + '</span>' : '') + '</td></tr>'
    + '<tr><th>Quy trình áp dụng</th><td>' + esc(c.quy_trinh || 'Chưa khai báo — cần điền mã quy trình giám sát '
    +   'môi trường đang có hiệu lực') + '</td></tr>'
    + '<tr><th>Cách phân loại mức xử lý</th><td>Do luật cố định trong bộ ráp báo cáo quyết định, '
    +   'không do máy viết nhận định. Tiêu chí ghi ngay đầu mục 2.</td></tr>'
    + '</tbody></table></div>'
    + (c.lich_su && c.lich_su.length
        ? '<h3>Lịch sử sửa đổi tài liệu</h3><div class="cuon-ngang"><table><thead><tr>'
          + '<th>Phiên bản</th><th>Ngày</th><th>Nội dung thay đổi</th><th>Người sửa</th></tr></thead><tbody>'
          + c.lich_su.map(function (x) {
              return '<tr><td>' + esc(x.phien_ban) + '</td><td>' + esc(x.ngay) + '</td><td>'
                + esc(x.thay_doi) + '</td><td>' + esc(x.nguoi || '—') + '</td></tr>';
            }).join('')
          + '</tbody></table></div>'
        : '')
    + '</section>'

    + '<section id="muc-ky"><h2>Ký duyệt</h2><div class="ky">'
    + '<div class="o-ky"><div class="vt">Người lập</div><div class="ten">' + esc(c.lap_ten || '—')
    +   '</div><div class="y">' + esc(c.lap_chuc || 'Bộ phận quản lý hệ thống toà nhà') + '</div></div>'
    + '<div class="o-ky"><div class="vt">Người soát xét</div><div class="ten">' + esc(c.soat_ten || '—')
    +   '</div><div class="y">' + esc(c.soat_chuc || 'Bộ phận giám sát trong quá trình · Bộ phận cơ điện') + '</div></div>'
    + '<div class="o-ky"><div class="vt">Người phê duyệt</div><div class="ten">' + esc(c.duyet_ten || '—')
    +   '</div><div class="y">' + esc(c.duyet_chuc || 'Bộ phận bảo đảm chất lượng') + '</div></div>'
    + '</div></section>'

    + '</main><footer class="chan">Nguồn số liệu: ' + esc(d.nguon || 'rpc_bao_cao_tong_hop') + '(' + esc(d.ky) + ', '
    + esc(d.tu_ngay) + ', ' + esc(d.den_ngay) + ') · lập lúc '
    + esc(String(d.tao_luc).slice(0, 19).replace('T', ' ')) + ' · mã lần chạy ' + esc(c.ma_lan_chay || '—')
    + '<br>Số liệu do hệ thống tính. Việc phân loại mức ưu tiên xử lý do luật cố định trong bộ ráp báo cáo, '
    + 'không do máy viết nhận định quyết định.</footer>'

    + '</div></body></html>';
}

module.exports = { rapBaoCao: rapBaoCao, locPhatHien: locPhatHien, CSS: CSS };

});
__dinh_nghia("dashboard.node", function (module, require) {
'use strict';
/* ===========================================================================
 * BẢNG THEO DÕI TƯƠNG TÁC — công cụ tra cứu, không phải bản in chia thẻ
 *
 * Bản in trả lời câu hỏi CỐ ĐỊNH: kỳ này thế nào, phải xử lý gì.
 * Bảng theo dõi phải trả lời câu hỏi người dùng TỰ ĐẶT RA lúc đang xem:
 *   "cho tôi xem riêng phòng mức 1 của cụm AHU C1-3 đang chưa đạt, xếp theo
 *    số giờ nghiêm trọng, rồi mở phòng nặng nhất ra xem chênh áp ngày nào
 *    tụt và tụt sâu tới đâu"
 * Bản in không làm được vì nó cố định. Đó là lý do bảng này tồn tại.
 *
 * VÌ THẾ KIẾN TRÚC KHÁC HẲN BẢN IN: nhúng DỮ LIỆU rồi dựng giao diện trong
 * trình duyệt, chứ không dựng sẵn HTML. Không nhúng dữ liệu thì không thể tra
 * tới từng ngày của từng phòng.
 *
 * Đổi lại tệp nặng hơn nên để trên Drive và gửi đường dẫn, đừng đính kèm thư.
 *
 * Phần chạy trong trình duyệt giữ ở mức đọc hiểu được: một nguồn trạng thái
 * duy nhất là biến `loc`, mọi thay đổi đều chạy qua `veLai()`.
 * ========================================================================= */

const L = require('./bao-cao-loi.js');
const { esc, so, soVN, phanTram, ngayDai, ngayNgan, gioPhut, gioDoc, delta, dich,
        NGUONG_HANH_DONG } = L;

/* ===== 1. RÚT GỌN DỮ LIỆU ĐỂ NHÚNG =====================================
 * Chỉ giữ trường thực sự dùng, và làm tròn số: chuỗi ngày của 57 phòng × 3
 * chỉ tiêu là hơn năm nghìn điểm, giữ 13 chữ số thập phân thì phình vô ích.
 * ===================================================================== */

const lam = (v, n) => (v == null || !isFinite(v)) ? null : Number(Number(v).toFixed(n == null ? 1 : n));

function duLieuNhung(d) {
  const chuoiCB = L.bocChuoiCamBien(d);
  const ngays = ((d.chuoi_ngay || {}).total || []).map((x) => x.ngay);

  const gioDoPhong = {};
  Object.keys(d.chuoi_cam_bien || {}).forEach(function (kh) {
    const ma = kh.split('|')[0];
    (d.chuoi_cam_bien[kh].chuoi || []).forEach(function (x) {
      gioDoPhong[ma] = (gioDoPhong[ma] || 0) + (x.gio_co_dl || 0);
    });
  });

  const chiSo = {};
  ['DP', 'T', 'RH'].forEach(function (loai) {
    const tp = ((d.chi_so_cam_bien || {})[loai] || {}).top_phong || [];
    tp.forEach(function (r) {
      chiSo[r.ma_phong + '|' + loai] = {
        tt: lam(r.ty_le_trong_nguong), gl: lam(r.gio_lech), gn: lam(r.gio_lech_nguoc),
        sd: r.so_dot, dd: r.dot_dai_nhat, cl: !!r.con_lech_cuoi_ky
      };
    });
  });

  const phong = (d.tat_ca_phong || []).map(function (p) {
    return {
      ma: p.ma_phong, ten: p.ten_phong, khu: p.khu_vuc, ahu: p.ahu || '—',
      ut: p.muc_uu_tien || 'P3',
      tt: lam(p.ty_le_tuan_thu), gn: p.so_gio_critical || 0, dq: lam(p.dq_pct),
      gd: gioDoPhong[p.ma_phong] || 0,
      ch: (p.chuoi || []).map(function (c) { return lam(c.ty_le); })
    };
  });

  // Chuỗi ngày theo từng cảm biến — nguồn cho biểu đồ chi tiết từng phòng.
  // Dùng mảng thay đối tượng: [ngày, trung bình, thấp nhất, cao nhất, giờ nghiêm trọng, giờ cảnh báo]
  const cb = {};
  ['DP', 'T', 'RH'].forEach(function (loai) {
    Object.keys(chuoiCB[loai] || {}).forEach(function (ma) {
      const v = chuoiCB[loai][ma];
      cb[ma + '|' + loai] = {
        ghd: lam(v.ghd), ght: lam(v.ght),
        ch: (v.chuoi || []).map(function (x) {
          return [x.ngay, lam(x.tb), lam(x.min), lam(x.max), x.ngh || 0, x.cb || 0];
        })
      };
    });
  });

  const suKien = ((d.su_kien_vuot_nguong || {}).danh_sach || []).map(function (s) {
    return { p: s.ma_phong, l: s.loai_cam_bien, h: s.huong, g: lam(s.so_gio),
             bd: s.bat_dau, kt: s.ket_thuc, kd: s.ket_thuc_do,
             gt: lam(s.huong === 'CAO' ? s.gia_tri_max : s.gia_tri_min), dv: s.don_vi };
  });

  const chotKy = d.den_ngay ? String(d.den_ngay).slice(0, 10) : null;
  const suCo = ((d.su_co || {}).danh_sach_dang_mo || []).map(function (s) {
    return { p: s.phong, ma: s.ma_su_co, mc: s.muc_canh_bao, bd: s.bat_dau,
             kd: lam(s.keo_dai_gio), tt: s.trang_thai,
             nk: !!(chotKy && s.bat_dau && String(s.bat_dau).slice(0, 10) > chotKy) };
  });

  return {
    ky: d.ky, tu: d.tu_ngay, den: d.den_ngay, ngay: ngays, nguong: NGUONG_HANH_DONG,
    phong: phong, cb: cb, chiSo: chiSo, suKien: suKien, suCo: suCo,
    capA: L.phanCap(d).capA_tat_ca.map(function (v) {
      return { ma: v.ma_phong, cc: v.can_cu, viec: v.viec };
    })
  };
}

/* ===== 2. GIAO DIỆN ===================================================== */

const CSS = `
:root{
  --muc:${L.MAU.muc}; --muc2:${L.MAU.muc2}; --mo:${L.MAU.mo}; --nhat:${L.MAU.nhat};
  --vien:${L.MAU.vien}; --vien2:${L.MAU.vien2}; --giay:${L.MAU.giay}; --nen:${L.MAU.nen};
  --nhan:${L.MAU.nhan}; --nhan-nhat:${L.MAU.nhanNhat};
  --cap1:${L.MAU.cap1}; --cap2:${L.MAU.cap2}; --cap3:${L.MAU.cap3};
  --c-duoi:${L.MAU.lechDuoi}; --c-tren:${L.MAU.lechTren};
  /* Cùng thang với bản xem trên màn hình của bản in: thân bài 16px. */
  --co-1:12px; --co-2:13px; --co-3:14px; --co-4:16px; --co-5:18px; --co-6:22px; --co-7:26px;
  --k-1:4px; --k-2:8px; --k-3:12px; --k-4:16px; --k-5:24px; --k-6:32px;
  --bo-1:4px; --bo-2:6px; --bo-3:8px;
  --nen-0:#F4F5F7;
  --bong-1:0 1px 2px rgba(17,24,32,.04);
  --bong-2:0 2px 8px rgba(17,24,32,.06), 0 1px 2px rgba(17,24,32,.04);
  --mono: ui-monospace,'SF Mono','Cascadia Code',Consolas,monospace;
}
*{box-sizing:border-box}
body{margin:0;background:var(--nen-0);color:var(--muc);
  font:var(--co-4)/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Arial,sans-serif}
.khung{max-width:1180px;margin:0 auto;padding:0 var(--k-5) 60px}

.dinh{position:sticky;top:0;z-index:30;background:var(--giay);
  border-bottom:1px solid var(--vien);margin:0 calc(var(--k-5) * -1);padding:0 var(--k-5);
  box-shadow:var(--bong-1)}
.dinh-tren{display:flex;justify-content:space-between;align-items:flex-end;gap:var(--k-5);
  padding:var(--k-4) 0 var(--k-3)}
.dinh h1{margin:0;font-size:var(--co-7);font-weight:640;letter-spacing:-.015em}
.dinh .phu{color:var(--mo);font-size:var(--co-2);margin-top:2px}
.chi-so-nhanh{display:flex;gap:var(--k-5);align-items:flex-end}
.csn{text-align:right}
.csn .gt{font-size:var(--co-5);font-weight:640;font-variant-numeric:tabular-nums;
  line-height:1.1;color:var(--muc2);letter-spacing:-.02em}
.csn .ten{font-size:var(--co-1);color:var(--mo)}
.csn-chinh{padding-right:var(--k-5);border-right:1px solid var(--vien)}
.csn-chinh .gt{font-size:var(--co-7);font-weight:650;color:var(--muc)}
.csn-chinh .ten{color:var(--muc2)}
.csn .xau{color:var(--cap2)}
.thanh-the{display:flex;gap:2px;overflow-x:auto}
.the-nut{appearance:none;border:none;background:none;padding:var(--k-3) var(--k-4);
  font-size:var(--co-3);color:var(--muc2);cursor:pointer;border-bottom:2px solid transparent;
  white-space:nowrap;font-family:inherit}
.the-nut:hover{color:var(--muc)}
.the-nut[aria-selected="true"]{color:var(--nhan);border-bottom-color:var(--nhan);font-weight:600}

.loc{display:flex;flex-wrap:wrap;align-items:center;gap:var(--k-2) var(--k-3);
  padding:var(--k-3) 0;font-size:var(--co-3);border-bottom:1px solid var(--vien2)}
.loc-nhom{display:flex;align-items:center;gap:var(--k-1);flex-wrap:wrap}
.loc-nhan{font-size:var(--co-1);color:var(--mo);text-transform:uppercase;letter-spacing:.04em;
  font-weight:600;margin-right:2px}
.loc-nut{appearance:none;border:1px solid var(--vien);background:var(--giay);border-radius:99px;
  padding:3px 11px;font-size:var(--co-2);cursor:pointer;color:var(--muc2);font-family:inherit}
.loc-nut:hover{border-color:var(--nhat)}
.loc-nut[aria-pressed="true"]{border-color:var(--nhan);color:var(--nhan);
  background:var(--nhan-nhat);font-weight:600}
.o-tim{border:1px solid var(--vien);border-radius:var(--bo-2);padding:4px 10px;
  font-size:var(--co-3);font-family:inherit;width:200px;color:var(--muc);background:var(--giay)}
.o-tim:focus{border-color:var(--nhan);outline:none}
select.o-tim{width:auto;cursor:pointer}
.dem-loc{margin-left:auto;font-size:var(--co-2);color:var(--mo);font-variant-numeric:tabular-nums}
.dem-loc b{color:var(--muc)}
.nut-phu{appearance:none;border:1px solid var(--vien);background:var(--giay);
  border-radius:var(--bo-2);padding:4px 11px;font-size:var(--co-2);cursor:pointer;
  color:var(--muc2);font-family:inherit}
.nut-phu:hover{border-color:var(--nhan);color:var(--nhan)}

.the-noi-dung{display:none}
.the-noi-dung.hien{display:block}
.o{background:var(--giay);border:1px solid var(--vien);border-radius:10px;
  padding:var(--k-5);margin-bottom:var(--k-4);box-shadow:var(--bong-1)}
.o h2{margin:0 0 var(--k-3);font-size:20px;font-weight:650;letter-spacing:-.015em;line-height:1.3}
.o .mota{margin:0 0 var(--k-4);color:var(--muc2);font-size:var(--co-3);max-width:76ch;line-height:1.65}
h3{margin:var(--k-6) 0 var(--k-3);padding-top:var(--k-3);font-size:17px;font-weight:640;
  border-top:1px solid var(--vien2)}
h3:first-of-type{border-top:none;padding-top:0}
.khung-bd{background:var(--nen);border:1px solid var(--vien2);border-radius:var(--bo-3);
  padding:var(--k-3) var(--k-4);margin:var(--k-2) 0}
.mo{color:var(--mo)}

table{width:100%;border-collapse:collapse;font-size:var(--co-3)}
th{text-align:left;font-size:var(--co-1);color:var(--mo);font-weight:600;letter-spacing:.03em;
  padding:var(--k-2);border-bottom:1px solid var(--muc2);vertical-align:bottom;line-height:1.35}
th.so{white-space:nowrap}
th.xep{cursor:pointer;user-select:none}
th.xep:hover{color:var(--nhan)}
th.xep[data-chieu="len"]::after{content:'▲';font-size:9px;color:var(--nhan);margin-left:4px}
th.xep[data-chieu="xuong"]::after{content:'▼';font-size:9px;color:var(--nhan);margin-left:4px}
td{padding:var(--k-2);border-bottom:1px solid var(--vien2);vertical-align:top;line-height:1.5}
td.so,th.so{text-align:right;font-variant-numeric:tabular-nums}
tbody tr{transition:background .12s ease}
tbody tr:nth-child(even){background:#FCFCFD}
tbody tr:hover{background:var(--nhan-nhat)}
tr.bam{cursor:pointer}
tr.bam:hover{background:var(--nhan-nhat)}
.ma{font-family:var(--mono);font-size:var(--co-2)}
.tang-xau{color:var(--cap2);font-weight:600}.the-ngoai-ky{display:inline-block;padding:1px 7px;border-radius:99px;background:#FFFBEB;color:#B45309;font-size:11px;font-weight:700;}
/* Số giờ đi kèm tỉ lệ: giờ thô không cho biết nặng nhẹ khi các phòng có
   số giờ đo khác nhau. */
.phu-ty-le{font-size:var(--co-1);color:var(--mo);font-weight:400}
.phu-th{font-weight:400;text-transform:none;letter-spacing:0;color:var(--nhat)}
.the-nho{display:inline-block;font-size:11.5px;padding:1px 6px;border-radius:99px;
  border:1px solid var(--vien);color:var(--muc2);background:var(--giay);font-weight:600;white-space:nowrap}
.the-p1{border-color:var(--cap2);color:var(--cap2)}

.ngan{position:fixed;top:0;right:0;bottom:0;width:min(780px,94vw);background:var(--giay);
  border-left:1px solid var(--vien);box-shadow:-8px 0 28px rgba(17,24,32,.10);
  z-index:60;overflow-y:auto;transform:translateX(100%);transition:transform .18s ease}
.ngan.mo{transform:translateX(0)}
.ngan-dau{position:sticky;top:0;background:var(--giay);border-bottom:1px solid var(--vien);
  padding:var(--k-4) var(--k-5);display:flex;justify-content:space-between;
  align-items:flex-start;gap:var(--k-4);z-index:1}
.ngan-ten{font-size:var(--co-5);font-weight:650}
.ngan-phu{font-size:var(--co-2);color:var(--mo);margin-top:2px;line-height:1.5}
.ngan-than{padding:var(--k-4) var(--k-5) var(--k-6)}
.dong{position:fixed;inset:0;background:rgba(17,24,32,.28);z-index:50;opacity:0;
  pointer-events:none;transition:opacity .18s ease}
.dong.mo{opacity:1;pointer-events:auto}
.nut-dong{appearance:none;border:1px solid var(--vien);background:var(--giay);border-radius:99px;
  width:30px;height:30px;cursor:pointer;font-size:16px;line-height:1;color:var(--muc2);flex:none}
.nut-dong:hover{border-color:var(--cap2);color:var(--cap2)}
.khoi-ct{border:1px solid var(--vien);border-radius:var(--bo-3);padding:var(--k-3) var(--k-4);
  margin-bottom:var(--k-3)}
.khoi-ct-dau{display:flex;justify-content:space-between;align-items:baseline;
  margin-bottom:var(--k-2);gap:var(--k-3)}
.khoi-ct-ten{font-weight:640;font-size:var(--co-4)}
.khoi-ct-so{font-variant-numeric:tabular-nums;font-size:var(--co-5);font-weight:640}
.canh-bao-a{border:1px solid #FCA5A5;border-left:3px solid var(--cap2);background:#FEF8F8;
  border-radius:var(--bo-3);padding:var(--k-3) var(--k-4);margin-bottom:var(--k-3)}
.canh-bao-a .tieu{font-weight:640;font-size:var(--co-3)}
.can-cu{color:var(--muc2);font-size:var(--co-2);margin-top:3px;line-height:1.55}
.lam{color:var(--muc2);font-size:var(--co-2);margin-top:5px;padding-left:var(--k-3);
  border-left:2px solid var(--vien);line-height:1.55}
.dong-so{display:flex;gap:var(--k-4);flex-wrap:wrap;font-size:var(--co-2);color:var(--muc2);
  margin-top:var(--k-2);padding-top:var(--k-2);border-top:1px solid var(--vien2)}
.dong-so b{font-variant-numeric:tabular-nums;color:var(--muc)}

.bieu-do{width:100%;height:auto;display:block}
.spark{display:inline-block;vertical-align:middle}
.svg-truc{font-size:11px;fill:var(--mo)}
.svg-hang{font-size:12px;fill:var(--muc2)}
.svg-hang-nho{font-size:10.5px;fill:var(--muc2);font-family:var(--mono)}
.svg-nhan{font-size:12px;fill:var(--muc);font-weight:600}
.svg-nhan-nguong{font-size:11px;fill:var(--cap2)}
.svg-nhan-gh{font-size:10.5px;fill:var(--nhan)}
.svg-nhan-duoi{font-size:11.5px;fill:var(--c-duoi);font-weight:600}
.svg-nhan-tren{font-size:11.5px;fill:var(--c-tren);font-weight:600}
.svg-o{font-size:9.5px;fill:#7F1D1D}
.svg-o-dam{fill:#fff}
.chu-thich{font-size:var(--co-2);color:var(--mo);margin:var(--k-2) 0 0;line-height:1.55;max-width:76ch}
.cuon-ngang{overflow-x:auto}
${L.CSS_BAN_DO}
.o-bd rect.bam-duoc{cursor:pointer}
.o-bd rect.bam-duoc:hover{stroke:${L.MAU.nhan};stroke-width:1.6}

.luoi-sm{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--k-3) var(--k-4)}
.o-sm{margin:0;padding:var(--k-2) var(--k-3);border:1px solid var(--vien);border-radius:var(--bo-2)}
.o-sm figcaption{display:flex;justify-content:space-between;align-items:baseline;
  font-size:var(--co-2);margin-bottom:var(--k-1)}
.sm-ten{color:var(--muc2)} .sm-so{font-variant-numeric:tabular-nums;font-weight:640}
.sm-xau{color:var(--cap2)}

.hai-huong{display:grid;grid-template-columns:1fr 1fr;gap:var(--k-3);margin:0 0 var(--k-5)}
.hh-o{border:1px solid var(--vien);border-radius:var(--bo-3);padding:var(--k-3) var(--k-4);
  border-left-width:3px}
.hh-duoi{border-left-color:var(--c-duoi);background:#FEF7F7}
.hh-tren{border-left-color:var(--c-tren);background:#FAF8FE}
.hh-ten{font-size:var(--co-2);color:var(--mo);font-weight:600}
.hh-gt{font-size:var(--co-6);font-weight:640;font-variant-numeric:tabular-nums;
  margin:var(--k-1) 0;letter-spacing:-.02em}
.hh-phu{font-size:var(--co-2);color:var(--muc2);line-height:1.5}

.he-thong{border:1px solid var(--vien);border-left:3px solid var(--muc);border-radius:var(--bo-2);
  padding:var(--k-3) var(--k-4);background:var(--nen);font-size:var(--co-3)}
.ht-nhan{font-size:var(--co-1);color:var(--mo);font-weight:600;margin-bottom:var(--k-1);
  text-transform:uppercase;letter-spacing:.04em}
.he-thong p{margin:0;line-height:1.6}
.trong{padding:var(--k-5);text-align:center;color:var(--mo);font-size:var(--co-3)}
.chan{color:var(--mo);font-size:var(--co-2);font-family:var(--mono);padding:var(--k-4) 0;line-height:1.7}
.ve-dau{position:fixed;right:var(--k-5);bottom:var(--k-5);background:var(--giay);
  border:1px solid var(--vien);border-radius:99px;padding:var(--k-2) var(--k-4);
  font-size:var(--co-2);color:var(--muc2);text-decoration:none;
  box-shadow:0 2px 8px rgba(17,24,32,.08);z-index:40}
.ve-dau:hover{border-color:var(--nhan);color:var(--nhan)}

:focus-visible{outline:2px solid var(--nhan);outline-offset:2px;border-radius:var(--bo-1)}
:focus:not(:focus-visible){outline:none}
::selection{background:var(--nhan-nhat)}
.bo-qua{position:absolute;left:-9999px;top:0;background:var(--muc);color:#fff;
  padding:var(--k-2) var(--k-4);border-radius:0 0 var(--bo-2) 0;z-index:99;font-size:var(--co-3)}
.bo-qua:focus{left:0}
@media (prefers-reduced-motion: reduce){
  *{transition:none !important;animation:none !important;scroll-behavior:auto !important}
}
`;

/* ===== 3. PHẦN CHẠY TRONG TRÌNH DUYỆT ==================================
 * Một nguồn trạng thái duy nhất là biến `loc`. Mọi thay đổi gọi `veLai()`.
 * Không để trạng thái nào nằm rải rác trong trang.
 * ===================================================================== */

const JS = String.raw`
(function () {
  var D = DU_LIEU, NG = D.nguong;

  function soVN(v, n) {
    if (v == null || !isFinite(v)) return '—';
    n = n == null ? 1 : n;
    var am = Number(v) < 0, x = Math.abs(Number(v)).toFixed(n).split('.');
    return (am ? '-' : '') + x[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (x[1] ? ',' + x[1] : '');
  }
  function pt(v, n) { return (v == null || !isFinite(v)) ? '—' : soVN(v, n == null ? 1 : n) + '%'; }
  function gio(g) {
    if (g == null) return '—';
    return g < 24 ? soVN(g, g % 1 ? 1 : 0) + ' giờ'
                  : soVN(g, g % 1 ? 1 : 0) + ' giờ (' + soVN(g / 24, 1) + ' ngày)';
  }
  function nn(s) { return String(s || '').slice(8, 10) + '/' + String(s || '').slice(5, 7); }
  function nd(s) { return String(s || '').slice(0, 10).split('-').reverse().join('/'); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  var TEN_CT = { DP: 'Chênh áp', T: 'Nhiệt độ', RH: 'Độ ẩm' };
  var TEN_UT = { P1: 'Mức 1', P2: 'Mức 2', P3: 'Mức 3' };
  var TEN_HUONG = { CAO: 'vượt giới hạn trên', THAP: 'tụt dưới giới hạn dưới' };
  var TEN_KT = { HET_KY: 'còn ngoài giới hạn khi hết kỳ', TRO_LAI: 'đã trở lại trong ngưỡng',
                 MAT_DU_LIEU: 'mất dữ liệu nên không xác định được' };
  var TEN_TT = { CHUA_XU_LY: 'Chưa xử lý', DANG_XU_LY: 'Đang xử lý',
                 DA_KHAC_PHUC: 'Đã khắc phục', DONG_TU_DONG: 'Hệ thống tự đóng' };

  var loc = { khu: 'TAT_CA', ahu: 'TAT_CA', ut: 'TAT_CA', chuaDat: false, tim: '',
              xep: 'tt', chieu: 'len' };

  function locPhong() {
    var t = loc.tim.trim().toLowerCase();
    return D.phong.filter(function (p) {
      if (loc.khu !== 'TAT_CA' && p.khu !== loc.khu) return false;
      if (loc.ahu !== 'TAT_CA' && p.ahu !== loc.ahu) return false;
      if (loc.ut !== 'TAT_CA' && p.ut !== loc.ut) return false;
      if (loc.chuaDat && !(p.tt < NG)) return false;
      if (t && (p.ma + ' ' + p.ten).toLowerCase().indexOf(t) === -1) return false;
      return true;
    }).sort(function (a, b) {
      var k = loc.xep, va = a[k], vb = b[k];
      if (typeof va === 'string') {
        var r = String(va).localeCompare(String(vb), 'vi');
        return loc.chieu === 'len' ? r : -r;
      }
      va = va == null ? -1 : va; vb = vb == null ? -1 : vb;
      return loc.chieu === 'len' ? va - vb : vb - va;
    });
  }

  function dat(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }

  // Chỉ số trên đầu tính lại theo ĐÚNG bộ lọc đang bật, không phải luôn là
  // số toàn nhà máy. Dùng TRUNG VỊ chứ không lấy trung bình cộng các tỉ lệ,
  // vì mỗi phòng có số giờ đo khác nhau.
  function veChiSo(ds) {
    var gn = 0, datN = 0, tong = ds.length, maSet = {};
    ds.forEach(function (p) { gn += p.gn; if (p.tt >= NG) datN++; maSet[p.ma] = 1; });
    var soA = D.capA.filter(function (v) { return maSet[v.ma]; }).length;
    var tt = ds.map(function (p) { return p.tt; }).filter(function (v) { return v != null; })
               .sort(function (a, b) { return a - b; });
    var tv = tt.length ? (tt.length % 2 ? tt[(tt.length - 1) / 2]
              : (tt[tt.length / 2 - 1] + tt[tt.length / 2]) / 2) : null;
    var toanBo = loc.khu === 'TAT_CA' && loc.ahu === 'TAT_CA' && loc.ut === 'TAT_CA'
                 && !loc.chuaDat && !loc.tim;
    dat('cs-tt', pt(tv));
    dat('cs-nhan', toanBo ? 'toàn nhà máy' : 'phạm vi đang lọc');
    dat('cs-gn', soVN(gn, 0));
    dat('cs-a', String(soA));
    dat('cs-dat', datN + '/' + tong);
    var e = document.getElementById('cs-tt');
    if (e) e.classList.toggle('xau', tv != null && tv < NG);
  }

  var COT = [
    { k: 'ma',  t: 'Mã phòng' }, { k: 'ten', t: 'Tên phòng' },
    { k: 'khu', t: 'Khu' }, { k: 'ahu', t: 'Cụm' }, { k: 'ut', t: 'Ưu tiên' },
    { k: 'tt',  t: 'Thời gian trong ngưỡng %', so: 1 },
    { k: 'gn',  t: 'Giờ ở mức nghiêm trọng', so: 1 },
    { k: 'dq',  t: 'Thời gian có số đo %', so: 1 }
  ];

  function spark(ch, w, h) {
    w = w || 92; h = h || 22;
    var pts = (ch || []).filter(function (v) { return v != null; });
    if (pts.length < 2) return '<span class="mo">—</span>';
    var x = function (i) { return (i / (pts.length - 1)) * (w - 2) + 1; };
    var y = function (v) { return h - 2 - (Math.max(0, Math.min(100, v)) / 100) * (h - 4); };
    var d = pts.map(function (v, i) {
      return (i ? 'L' : 'M') + Math.round(x(i)) + ' ' + Math.round(y(v)); }).join(' ');
    var c = pts[pts.length - 1];
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '">'
      + '<line x1="1" x2="' + (w - 1) + '" y1="' + Math.round(y(NG)) + '" y2="' + Math.round(y(NG))
      + '" stroke="#9AA6B2" stroke-width="1" stroke-dasharray="2 2"/>'
      + '<path d="' + d + '" fill="none" stroke="#1D4ED8" stroke-width="1.6" stroke-linejoin="round"/>'
      + '<circle cx="' + Math.round(x(pts.length - 1)) + '" cy="' + Math.round(y(c))
      + '" r="2.2" fill="' + (c < NG ? '#DC2626' : '#1D4ED8') + '"/></svg>';
  }

  function veBang(ds) {
    var th = COT.map(function (c) {
      return '<th class="xep' + (c.so ? ' so' : '') + '" data-cot="' + c.k + '"'
        + (loc.xep === c.k ? ' data-chieu="' + loc.chieu + '"' : '')
        + ' tabindex="0" role="button" title="Bấm để xếp theo cột này">' + c.t + '</th>';
    }).join('') + '<th>Diễn biến</th>';
    var tr = ds.map(function (p) {
      return '<tr class="bam" data-ma="' + esc(p.ma) + '" tabindex="0" '
        + 'title="Bấm để mở chi tiết phòng này">'
        + '<td><span class="ma">' + esc(p.ma) + '</span></td>'
        + '<td>' + esc(p.ten) + (p.ut === 'P1' ? ' <span class="the-nho the-p1">Mức 1</span>' : '') + '</td>'
        + '<td>' + esc(p.khu) + '</td><td>' + esc(p.ahu) + '</td>'
        + '<td>' + (TEN_UT[p.ut] || p.ut) + '</td>'
        + '<td class="so' + (p.tt < NG ? ' tang-xau' : '') + '">' + soVN(p.tt) + '</td>'
        + '<td class="so">' + soVN(p.gn, 0) + '</td>'
        + '<td class="so">' + soVN(p.dq) + '</td>'
        + '<td>' + spark(p.ch) + '</td></tr>';
    }).join('');
    return '<div class="cuon-ngang"><table><thead><tr>' + th + '</tr></thead><tbody>'
      + (tr || '<tr><td colspan="9" class="trong">Không phòng nào khớp bộ lọc đang bật.</td></tr>')
      + '</tbody></table></div>';
  }

  // Biểu đồ dải giới hạn, vẽ khi mở chi tiết một phòng
  function veDai(o) {
    var pts = (o.ch || []).filter(function (c) { return c[1] != null; });
    if (pts.length < 2) return '<p class="mo">Không đủ điểm để vẽ.</p>';
    var W = 700, H = 170, Lx = 46, R = 62, T = 12, B = 24;
    var iw = W - Lx - R, ih = H - T - B, lo = Infinity, hi = -Infinity;
    pts.forEach(function (c) {
      [c[1], c[2], c[3]].forEach(function (v) {
        if (v != null && isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      });
    });
    if (o.ghd != null) lo = Math.min(lo, o.ghd);
    if (o.ght != null) hi = Math.max(hi, o.ght);
    var dem = (hi - lo) * 0.12 || 1; lo -= dem; hi += dem;
    var x = function (i) { return Lx + (i / (pts.length - 1)) * iw; };
    var y = function (v) { return T + ih - ((v - lo) / (hi - lo)) * ih; };
    var s = '';
    if (o.ghd != null && o.ght != null) {
      s += '<rect x="' + Lx + '" y="' + y(o.ght).toFixed(1) + '" width="' + iw + '" height="'
        + Math.max(0, y(o.ghd) - y(o.ght)).toFixed(1) + '" fill="#DBEAFE" fill-opacity="0.55"/>'
        + '<text x="' + (W - R + 6) + '" y="' + (y(o.ght) + 4).toFixed(1)
        + '" class="svg-nhan-gh">trên ' + soVN(o.ght) + '</text>'
        + '<text x="' + (W - R + 6) + '" y="' + (y(o.ghd) + 4).toFixed(1)
        + '" class="svg-nhan-gh">dưới ' + soVN(o.ghd) + '</text>';
    }
    var dDai = '';
    pts.forEach(function (c, i) {
      if (c[2] == null || c[3] == null) return;
      dDai += 'M' + x(i).toFixed(1) + ' ' + y(c[3]).toFixed(1) + 'V' + y(c[2]).toFixed(1);
    });
    s += '<path d="' + dDai + '" stroke="#9AA6B2" stroke-width="' + (pts.length > 20 ? 2 : 4)
      + '" stroke-linecap="round" opacity="0.5" fill="none"/>';
    s += '<path d="' + pts.map(function (c, i) {
        return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(c[1]).toFixed(1); }).join(' ')
      + '" fill="none" stroke="#1D4ED8" stroke-width="1.8" stroke-linejoin="round"/>';
    var buoc = Math.max(1, Math.ceil(pts.length / 12));
    pts.forEach(function (c, i) {
      var ngoai = (o.ghd != null && c[1] < o.ghd) || (o.ght != null && c[1] > o.ght);
      s += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(c[1]).toFixed(1) + '" r="'
        + (pts.length > 20 ? 2.4 : 3.6) + '" fill="' + (ngoai ? '#DC2626' : '#1D4ED8')
        + '" stroke="#fff" stroke-width="1.2"><title>' + nn(c[0]) + ': ' + soVN(c[1])
        + ' (' + soVN(c[2]) + '–' + soVN(c[3]) + ')'
        + (c[4] ? ', ' + c[4] + ' giờ nghiêm trọng' : '') + '</title></circle>';
      if (i % buoc === 0 || i === pts.length - 1) {
        s += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 7)
          + '" text-anchor="middle" class="svg-truc">' + nn(c[0]) + '</text>';
      }
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="bieu-do">' + s + '</svg>';
  }

  function moPhong(ma, ngayChon) {
    var p = null;
    D.phong.forEach(function (x) { if (x.ma === ma) p = x; });
    if (!p) return;
    var h = '';

    var ca = D.capA.filter(function (v) { return v.ma === ma; })[0];
    if (ca) {
      h += '<div class="canh-bao-a"><div class="tieu">Phòng này nằm trong danh sách phải xử lý</div>'
        + ca.cc.map(function (x) { return '<div class="can-cu">' + esc(x) + '</div>'; }).join('')
        + ca.viec.map(function (x) { return '<div class="lam">' + esc(x) + '</div>'; }).join('')
        + '</div>';
    }

    if (ngayChon) {
      var dong = '';
      ['DP', 'T', 'RH'].forEach(function (loai) {
        var cb = D.cb[ma + '|' + loai];
        if (!cb) return;
        cb.ch.forEach(function (c) {
          if (c[0] !== ngayChon) return;
          dong += '<tr><td>' + TEN_CT[loai] + '</td><td class="so">' + soVN(c[1]) + '</td>'
            + '<td class="so">' + soVN(c[2]) + '</td><td class="so">' + soVN(c[3]) + '</td>'
            + '<td class="so">' + c[4] + '</td><td class="so">' + c[5] + '</td>'
            + '<td class="so">' + soVN(cb.ghd) + ' – ' + soVN(cb.ght) + '</td></tr>';
        });
      });
      if (dong) {
        h += '<div class="khoi-ct"><div class="khoi-ct-ten">Số đo ngày ' + nd(ngayChon) + '</div>'
          + '<div class="cuon-ngang"><table style="margin-top:8px"><thead><tr><th>Chỉ tiêu</th>'
          + '<th class="so">Trung bình</th><th class="so">Thấp nhất</th><th class="so">Cao nhất</th>'
          + '<th class="so">Giờ nghiêm trọng</th><th class="so">Giờ cảnh báo</th>'
          + '<th class="so">Dải cho phép</th></tr></thead><tbody>' + dong + '</tbody></table></div></div>';
      }
    }

    ['DP', 'T', 'RH'].forEach(function (loai) {
      var cb = D.cb[ma + '|' + loai];
      if (!cb) return;
      var cs = D.chiSo[ma + '|' + loai] || {};
      h += '<div class="khoi-ct"><div class="khoi-ct-dau">'
        + '<div><span class="khoi-ct-ten">' + TEN_CT[loai] + '</span>'
        + '<span class="mo" style="font-size:12px"> · dải cho phép ' + soVN(cb.ghd) + ' – '
        + soVN(cb.ght) + '</span></div>'
        + '<span class="khoi-ct-so' + (cs.tt != null && cs.tt < NG ? ' tang-xau' : '') + '">'
        + pt(cs.tt) + '</span></div>'
        + veDai(cb)
        + '<div class="dong-so">'
        + '<span>Giờ ngoài giới hạn: <b>' + gio(cs.gl) + '</b></span>'
        + (cs.gn ? '<span>Giờ ngoài giới hạn hướng ngược: <b>' + gio(cs.gn) + '</b></span>' : '')
        + '<span>Số đợt ngoài giới hạn: <b>' + (cs.sd == null ? '—' : cs.sd) + '</b></span>'
        + '<span>Đợt dài nhất: <b>' + (cs.dd == null ? '—' : gio(cs.dd)) + '</b></span>'
        + (cs.cl ? '<span class="tang-xau">Còn ngoài giới hạn khi hết kỳ</span>' : '')
        + '</div></div>';
    });

    var sk = D.suKien.filter(function (s) { return s.p === ma; });
    if (sk.length) {
      h += '<h3>Các đợt ngoài giới hạn trong kỳ (' + sk.length + ')</h3><div class="cuon-ngang"><table><thead><tr>'
        + '<th>Chỉ tiêu</th><th>Ra ngoài phía nào</th><th class="so">Thời gian kéo dài</th><th>Từ → đến</th>'
        + '<th class="so">Giá trị xa dải nhất</th><th>Đợt ngoài giới hạn kết thúc thế nào</th></tr></thead><tbody>'
        + sk.map(function (s) {
            return '<tr><td>' + TEN_CT[s.l] + '</td><td>' + (TEN_HUONG[s.h] || s.h) + '</td>'
              + '<td class="so">' + gio(s.g) + '</td>'
              + '<td>' + nd(s.bd) + ' ' + String(s.bd).slice(11, 16) + '<br><span class="mo">→ '
              + nd(s.kt) + ' ' + String(s.kt).slice(11, 16) + '</span></td>'
              + '<td class="so">' + soVN(s.gt) + ' ' + esc(s.dv) + '</td>'
              + '<td>' + (TEN_KT[s.kd] || s.kd) + '</td></tr>';
          }).join('') + '</tbody></table></div>';
    }

    var sc = D.suCo.filter(function (s) { return s.p === ma; });
    if (sc.length) {
      h += '<h3>Sự cố còn mở (' + sc.length + ')</h3><div class="cuon-ngang"><table><thead><tr>'
        + '<th>Số sự cố</th><th>Mức</th><th>Mở từ</th><th class="so">Đã kéo dài</th>'
        + '<th>Trạng thái</th></tr></thead><tbody>'
        + sc.map(function (s) {
            return '<tr><td><span class="ma">' + esc(s.ma) + '</span></td>'
              + '<td>' + (s.mc === 'CRITICAL' ? 'nghiêm trọng' : 'cảnh báo') + '</td>'
              + '<td>' + nd(s.bd)
              + (s.nk ? ' <span class="the-ngoai-ky">ngoài kỳ</span>' : '') + '</td>'
              + '<td class="so">' + gio(s.kd) + '</td>'
              + '<td>' + (TEN_TT[s.tt] || s.tt) + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        + (sc.some(function (s) { return s.nk; })
            ? '<p class="chu-thich">Sự cố đánh dấu <b>ngoài kỳ</b> mở sau ngày chốt kỳ nên '
              + 'không tính vào kết quả kỳ này; số giờ kéo dài đo tới lúc lấy dữ liệu.</p>' : '');
    }

    dat('ngan-ten', p.ma === p.ten || !p.ten ? p.ma : p.ma + ' · ' + p.ten);
    dat('ngan-phu', 'Khu ' + p.khu + ' · cụm ' + p.ahu + ' · ' + (TEN_UT[p.ut] || p.ut)
      + ' · thời gian trong ngưỡng ' + pt(p.tt) + ' · ' + gio(p.gn) + ' ở mức nghiêm trọng');
    document.getElementById('ngan-than').innerHTML = h || '<p class="mo">Không có số liệu chi tiết.</p>';
    document.getElementById('ngan').classList.add('mo');
    document.getElementById('dong').classList.add('mo');
    document.getElementById('nut-dong').focus();
  }
  function dongNgan() {
    document.getElementById('ngan').classList.remove('mo');
    document.getElementById('dong').classList.remove('mo');
  }

  // Xuất đúng phạm vi đang lọc. Dấu chấm phẩy vì máy dùng dấu phẩy làm dấu
  // thập phân; thêm dấu nhận dạng đầu tệp để bảng tính đọc đúng tiếng Việt.
  function xuatCSV(ds) {
    var dau = ['Mã phòng', 'Tên phòng', 'Khu', 'Cụm', 'Mức ưu tiên',
               'Thời gian trong ngưỡng %', 'Giờ ở mức nghiêm trọng', 'Thời gian có số đo %'];
    var dong = ds.map(function (p) {
      return [p.ma, p.ten, p.khu, p.ahu, TEN_UT[p.ut] || p.ut, p.tt, p.gn, p.dq];
    });
    var csv = [dau].concat(dong).map(function (h) {
      return h.map(function (o) {
        var s = String(o == null ? '' : o);
        return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(';');
    }).join('\r\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'phong-' + D.ky + '-' + D.den + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function veLai() {
    var ds = locPhong();
    veChiSo(ds);
    var b = document.getElementById('bang-phong');
    if (b) b.innerHTML = veBang(ds);
    var e = document.getElementById('dem-loc');
    if (e) e.innerHTML = 'đang xem <b>' + ds.length + '</b>/' + D.phong.length + ' phòng';
    [].slice.call(document.querySelectorAll('[data-loc]')).forEach(function (n) {
      n.setAttribute('aria-pressed', String(loc[n.dataset.loc] === n.dataset.gt));
    });
    var cd = document.getElementById('nut-chua-dat');
    if (cd) cd.setAttribute('aria-pressed', String(loc.chuaDat));
  }

  document.addEventListener('click', function (e) {
    var n = e.target.closest('[data-loc]');
    if (n) { loc[n.dataset.loc] = n.dataset.gt; veLai(); return; }
    if (e.target.closest('#nut-chua-dat')) { loc.chuaDat = !loc.chuaDat; veLai(); return; }
    if (e.target.closest('#nut-xoa-loc')) {
      loc.khu = 'TAT_CA'; loc.ahu = 'TAT_CA'; loc.ut = 'TAT_CA';
      loc.chuaDat = false; loc.tim = '';
      document.getElementById('o-tim').value = '';
      document.getElementById('chon-ahu').value = 'TAT_CA';
      veLai(); return;
    }
    if (e.target.closest('#nut-csv')) { xuatCSV(locPhong()); return; }
    var th = e.target.closest('th.xep');
    if (th) {
      if (loc.xep === th.dataset.cot) loc.chieu = loc.chieu === 'len' ? 'xuong' : 'len';
      else { loc.xep = th.dataset.cot; loc.chieu = 'len'; }
      veLai(); return;
    }
    var tr = e.target.closest('tr.bam');
    if (tr) { moPhong(tr.dataset.ma); return; }
    var o = e.target.closest('rect.bam-duoc');
    if (o) { moPhong(o.getAttribute('data-ma'), o.getAttribute('data-ngay')); return; }
    if (e.target.closest('#nut-dong') || e.target.id === 'dong') { dongNgan(); return; }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { dongNgan(); return; }
    if (e.key === 'Enter' || e.key === ' ') {
      var n = e.target.closest && (e.target.closest('th.xep') || e.target.closest('tr.bam'));
      if (n) { e.preventDefault(); n.click(); }
    }
  });

  var oTim = document.getElementById('o-tim');
  if (oTim) oTim.addEventListener('input', function () { loc.tim = this.value; veLai(); });
  var cAhu = document.getElementById('chon-ahu');
  if (cAhu) cAhu.addEventListener('change', function () { loc.ahu = this.value; veLai(); });

  var nutThe = [].slice.call(document.querySelectorAll('.the-nut'));
  var noiDung = [].slice.call(document.querySelectorAll('.the-noi-dung'));
  function chonThe(nut, dayFocus) {
    nutThe.forEach(function (n) {
      var la = n === nut;
      n.setAttribute('aria-selected', String(la)); n.tabIndex = la ? 0 : -1;
    });
    noiDung.forEach(function (o) { o.classList.toggle('hien', o.id === nut.dataset.the); });
    if (dayFocus) nut.focus();
    var giam = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: giam ? 'auto' : 'smooth' });
  }
  nutThe.forEach(function (nut, i) {
    nut.tabIndex = i === 0 ? 0 : -1;
    nut.addEventListener('click', function () { chonThe(nut, false); });
    nut.addEventListener('keydown', function (e) {
      var b = { ArrowRight: 1, ArrowLeft: -1, Home: 'dau', End: 'cuoi' }[e.key];
      if (b === undefined) return;
      e.preventDefault();
      var j = b === 'dau' ? 0 : b === 'cuoi' ? nutThe.length - 1
            : (i + b + nutThe.length) % nutThe.length;
      chonThe(nutThe[j], true);
    });
  });

  veLai();
})();
`;

/* ===== 4. RÁP TRANG ===================================================== */

function rapDashboard(d, duBao, cfg) {
  const c = cfg || {};
  const k = d.kpi_ky_nay || {};
  const cap = L.phanCap(d);
  const cay = L.dungCay(d);
  const chuoi = (d.chuoi_ngay && d.chuoi_ngay.total) || [];
  const ngays = chuoi.map((x) => x.ngay);
  const ctDP = L.tongHopChiTieu(d, 'DP');
  const ctT = L.tongHopChiTieu(d, 'T');
  const ctRH = L.tongHopChiTieu(d, 'RH');
  const ht = cap.heThong;
  const tenKy = dich(L.TEN_KY, String(d.ky).toUpperCase(), String(d.ky).toLowerCase());
  const nhung = duLieuNhung(d);

  const khus = cay.map((x) => x.khu);
  const ahus = [];
  cay.forEach((x) => x.cum.forEach((cc) => { if (ahus.indexOf(cc.ahu) === -1) ahus.push(cc.ahu); }));

  function mucChiTieu(ct) {
    if (!ct.so_phong_do) {
      return '<div class="o"><h2>' + esc(ct.ten_day_du) + '</h2><p class="mo">Kỳ này không có phòng nào đo '
        + esc(String(ct.ten).toLowerCase()) + '.</p></div>';
    }
    const capCT = L.gomChiTieuTheoCap(ct);
    const hh = ct.hai_huong || {};
    const xep = ct.xep_hang.slice()
      .sort((a, b) => (b.gio_lech_tong || 0) - (a.gio_lech_tong || 0)).slice(0, 15);
    return '<div class="o"><h2>' + esc(ct.ten_day_du) + '</h2>'
      + '<p class="mota">' + esc(ct.y_nghia) + '</p>'
      + (hh.nguoc
          ? '<div class="hai-huong">'
            + '<div class="hh-o hh-duoi"><div class="hh-ten">'
            +   esc(hh.chinh.ngan === 'tụt dưới' ? hh.chinh.ten : hh.nguoc.ten) + '</div>'
            +   '<div class="hh-gt">' + L.gioTyLe(ct.tong_gio_duoi, ct.tong_gio_do) + '</div>'
            +   '<div class="hh-phu">' + ct.so_phong_lech_duoi + '/' + ct.so_phong_do + ' phòng · '
            +   esc(hh.chinh.ngan === 'tụt dưới' ? hh.chinh.he_qua : hh.nguoc.he_qua) + '</div></div>'
            + '<div class="hh-o hh-tren"><div class="hh-ten">'
            +   esc(hh.chinh.ngan === 'vượt trên' ? hh.chinh.ten : hh.nguoc.ten) + '</div>'
            +   '<div class="hh-gt">' + L.gioTyLe(ct.tong_gio_tren, ct.tong_gio_do) + '</div>'
            +   '<div class="hh-phu">' + ct.so_phong_lech_tren + '/' + ct.so_phong_do + ' phòng · '
            +   esc(hh.chinh.ngan === 'vượt trên' ? hh.chinh.he_qua : hh.nguoc.he_qua) + '</div></div>'
            + '</div>'
          : '')
      + '<h3>So sánh các khu</h3>'
      + '<p class="mota">So bằng <b>tỉ lệ</b> thời gian ngoài giới hạn của từng nhóm, không bằng số giờ cộng dồn: '
      + 'nhóm đông phòng luôn nhiều giờ hơn dù chất lượng có khi còn tốt hơn. Mẫu số là thời gian có '
      + 'số đo của chính nhóm đó; số giờ cộng dồn xem khi rê chuột.</p>'
      + (hh.nguoc
          ? L.svgThanhHaiChieu(capCT.khu.map((x) => Object.assign({ nhan: 'Khu ' + x.khu }, x)),
              'nhan', 'tong_gio_duoi', 'tong_gio_tren')
          : L.svgSoSanhCap(capCT.khu.map((x) => Object.assign({ nhan: 'Khu ' + x.khu }, x)), 'nhan'))
      + '<h3>So sánh các cụm xử lý không khí</h3>'
      + (hh.nguoc
          ? L.svgThanhHaiChieu(capCT.cum.slice(0, 10), 'nhan', 'tong_gio_duoi', 'tong_gio_tren')
          : L.svgSoSanhCap(capCT.cum.slice(0, 10), 'nhan'))
      + '<h3>Xếp hạng phòng ra ngoài giới hạn nhiều nhất</h3>'
      + L.svgThanhXepHang(xep, hh.nguoc ? 'gio_lech_tong' : 'gio_lech', 'giờ', true)
      + '<p class="chu-thich">Muốn xem chuỗi ngày và các đợt ngoài giới hạn của riêng một phòng thì sang thẻ '
      + '“Tra cứu phòng” rồi bấm vào phòng đó.</p></div>';
  }

  // Bản đồ phòng × ngày: mỗi ô bấm được để mở đúng ngày đó của đúng phòng đó
  function banDoBamDuoc(phongs, ds) {
    if (!phongs.length || !ds.length) return '';
    const oW = ds.length > 15 ? 17 : 30, oH = 15, Lx = 122, T = 20;
    const W = Lx + ds.length * oW + 8, H = T + phongs.length * oH + 6;
    const buoc = Math.max(1, Math.ceil(ds.length / 16));
    let s = '';
    ds.forEach((n, j) => {
      if (j % buoc === 0 || j === ds.length - 1) {
        s += '<text x="' + (Lx + j * oW + oW / 2) + '" y="' + (T - 7)
          + '" text-anchor="middle" class="svg-truc">' + ngayNgan(n) + '</text>';
      }
    });
    phongs.forEach((p, i) => {
      const y = T + i * oH;
      s += '<text x="' + (Lx - 6) + '" y="' + (y + oH - 4) + '" text-anchor="end" class="svg-hang-nho">'
        + esc(p.ma_phong) + (p.muc_uu_tien === 'P1' ? ' ◆' : '') + '</text>';
      const map = {};
      (p.chuoi || []).forEach((cc) => { map[cc.ngay] = cc.ty_le; });
      ds.forEach((n, j) => {
        const v = map[n];
        const lop = v == null ? 'k0' : v >= NGUONG_HANH_DONG ? 'k1'
                  : v >= 50 ? 'k2' : v >= 20 ? 'k3' : 'k4';
        s += '<rect x="' + (Lx + j * oW) + '" y="' + y + '" width="' + (oW - 2) + '" height="' + (oH - 2)
          + '" class="' + lop + ' bam-duoc" data-ma="' + esc(p.ma_phong) + '" data-ngay="' + esc(n) + '">'
          + '<title>' + esc(p.ma_phong) + ' ' + ngayNgan(n) + ': '
          + (v == null ? 'không có số đo' : phanTram(v, 0))
          + ' — bấm để xem số đo ngày này</title></rect>';
      });
    });
    return '<div class="cuon-ngang o-bd"><svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W
      + '" height="' + H + '" class="bieu-do">' + s + '</svg></div>';
  }

  const phongBanDo = (d.tat_ca_phong || [])
    .filter((p) => p.muc_uu_tien === 'P1' || p.muc_uu_tien === 'P2' || p.ty_le_tuan_thu < NGUONG_HANH_DONG)
    .sort((a, b) => a.ty_le_tuan_thu - b.ty_le_tuan_thu).slice(0, 30);

  const THE = [
    { id: 'the-tong-quan', ten: 'Tổng quan' },
    { id: 'the-tra-cuu',   ten: 'Tra cứu phòng' },
    { id: 'the-chenh-ap',  ten: 'Chênh áp' },
    { id: 'the-nhiet',     ten: 'Nhiệt độ' },
    { id: 'the-am',        ten: 'Độ ẩm' },
    { id: 'the-dot-lech',  ten: 'Đợt ngoài giới hạn' },
    { id: 'the-cay',       ten: 'Khu · cụm · phòng' }
  ];

  const hangDotLech = ['DP', 'T', 'RH'].map((loai) => {
    const ct = L.tongHopChiTieu(d, loai);
    return ct.su_kien.map((s) => ''
      + '<tr class="bam" data-ma="' + esc(s.ma_phong) + '" tabindex="0">'
      + '<td><span class="ma">' + esc(s.ma_phong) + '</span><br><span class="mo">'
      +   esc(s.ten_phong) + '</span></td>'
      + '<td>' + esc(dich(L.TEN_CHI_TIEU, s.loai_cam_bien)) + '</td>'
      + '<td>' + esc(s.khu_vuc) + ' · ' + esc(s.ahu) + '</td>'
      + '<td>' + esc(dich(L.TEN_HUONG, s.huong)) + '</td>'
      + '<td class="so">' + gioDoc(s.so_gio) + '</td>'
      + '<td>' + ngayDai(s.bat_dau) + ' ' + gioPhut(s.bat_dau) + '<br><span class="mo">→ '
      +   ngayDai(s.ket_thuc) + ' ' + gioPhut(s.ket_thuc) + '</span></td>'
      + '<td class="so">' + soVN(s.huong === 'CAO' ? s.gia_tri_max : s.gia_tri_min, 1)
      +   ' ' + esc(s.don_vi) + '</td>'
      + '<td>' + esc(dich(L.TEN_KET_THUC, s.ket_thuc_do)) + '</td></tr>');
  }).reduce((a, b) => a.concat(b), []).join('');

  return '<!doctype html>\n<html lang="vi"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>' + esc(c.tieu_de || 'Bảng theo dõi môi trường phòng sạch') + '</title>'
    + '<style>' + CSS + '</style></head><body>'
    + '<a class="bo-qua" href="#the-tong-quan">Bỏ qua phần đầu, vào thẳng nội dung</a>'
    + '<div class="khung">'

    + '<div class="dinh"><div class="dinh-tren"><div>'
    + '<h1>' + esc(c.tieu_de || 'Bảng theo dõi môi trường phòng sạch') + '</h1>'
    + '<div class="phu">' + esc(c.don_vi || 'Hệ quản lý toà nhà') + ' · báo cáo ' + esc(tenKy)
    + ' · ' + ngayDai(d.tu_ngay) + ' → ' + ngayDai(d.den_ngay) + ' · ' + (k.so_ngay_co_du_lieu || 0)
    + ' ngày có số đo</div></div>'
    + '<div class="chi-so-nhanh">'
    + '<div class="csn csn-chinh"><div class="gt" id="cs-tt">—</div>'
    +   '<div class="ten">trung vị thời gian trong ngưỡng · <span id="cs-nhan">toàn nhà máy</span></div></div>'
    + '<div class="csn"><div class="gt" id="cs-gn">—</div>'
    +   '<div class="ten">giờ ở mức nghiêm trọng</div></div>'
    + '<div class="csn"><div class="gt" id="cs-a">—</div>'
    +   '<div class="ten">phòng phải xử lý</div></div>'
    + '<div class="csn"><div class="gt" id="cs-dat">—</div>'
    +   '<div class="ten">phòng đạt ngưỡng</div></div>'
    + '</div></div>'
    + '<div class="thanh-the" role="tablist">'
    + THE.map((t, i) => '<button class="the-nut" role="tab" data-the="' + t.id + '" aria-selected="'
        + (i === 0 ? 'true' : 'false') + '">' + esc(t.ten) + '</button>').join('')
    + '</div></div>'

    + '<div class="loc">'
    + '<span class="loc-nhom"><span class="loc-nhan">Khu</span>'
    +   '<button class="loc-nut" data-loc="khu" data-gt="TAT_CA" aria-pressed="true">Tất cả</button>'
    +   khus.map((x) => '<button class="loc-nut" data-loc="khu" data-gt="' + esc(x)
          + '" aria-pressed="false">' + esc(x) + '</button>').join('') + '</span>'
    + '<span class="loc-nhom"><span class="loc-nhan">Ưu tiên</span>'
    +   '<button class="loc-nut" data-loc="ut" data-gt="TAT_CA" aria-pressed="true">Tất cả</button>'
    +   ['P1', 'P2', 'P3'].map((x) => '<button class="loc-nut" data-loc="ut" data-gt="' + x
          + '" aria-pressed="false">' + dich(L.TEN_UU_TIEN_NGAN, x) + '</button>').join('') + '</span>'
    + '<select class="o-tim" id="chon-ahu" aria-label="Lọc theo cụm xử lý không khí">'
    +   '<option value="TAT_CA">Tất cả cụm</option>'
    +   ahus.map((x) => '<option value="' + esc(x) + '">' + esc(x) + '</option>').join('') + '</select>'
    + '<button class="loc-nut" id="nut-chua-dat" aria-pressed="false">Chỉ phòng chưa đạt</button>'
    + '<input class="o-tim" id="o-tim" type="search" placeholder="Tìm mã hoặc tên phòng…" '
    +   'aria-label="Tìm phòng theo mã hoặc tên">'
    + '<button class="nut-phu" id="nut-xoa-loc">Bỏ lọc</button>'
    + '<button class="nut-phu" id="nut-csv">Tải bảng (.csv)</button>'
    + '<span class="dem-loc" id="dem-loc"></span>'
    + '</div>'

    + '<main>'

    + '<div class="the-noi-dung hien" id="the-tong-quan" role="tabpanel" tabindex="0">'
    + '<div class="o"><h2>Thời gian trong ngưỡng theo ngày · toàn nhà máy</h2>'
    + '<p class="mota">Đường đậm là tỉ lệ thời gian số đo nằm trong ngưỡng mỗi ngày. Vạch đỏ đứt là '
    + 'ngưỡng hành động ' + NGUONG_HANH_DONG + '%; vùng hồng là phần còn thiếu so với ngưỡng đó.</p>'
    + '<div class="khung-bd">' + L.svgDuongNgay(chuoi, 'Thời gian trong ngưỡng theo ngày') + '</div></div>'
    + ((duBao || {}).chuoi && duBao.chuoi.length >= 3
        ? '<div class="o"><h2>Xu hướng dài</h2>'
          + '<p class="mota">' + duBao.chuoi.length + ' ngày đã đo nối tiếp phần ngoại suy 7 ngày. '
          + 'Đường liền là số đã đo, đường đứt là phần ngoại suy.</p>'
          + '<div class="khung-bd">' + L.svgXuHuongDai(duBao.chuoi, duBao.du_bao) + '</div></div>'
        : '')
    + (ht ? '<div class="o"><div class="he-thong"><div class="ht-nhan">Mức độ tin cậy của số đo</div>'
        + '<p><b>' + esc(ht.ket_luan) + '.</b> '
        + (ht.do_phu_pct != null ? 'Thu được ' + phanTram(ht.do_phu_pct) + ' số giờ so với kỳ vọng, còn '
            + soVN(ht.gio_rong || 0, 0) + ' giờ không có số đo. ' : '')
        + soVN(ht.tong_ngoai_le, 0) + ' lượt trục trặc khi lấy dữ liệu.</p></div></div>' : '')
    + '<div class="o"><h2>Bản đồ thời gian trong ngưỡng theo phòng và ngày</h2>'
    + '<p class="mota">Ô trắng là ngày đạt ngưỡng. Chỉ ngày dưới ngưỡng mới tô màu, càng đậm càng nặng. '
    + '<b>Bấm vào một ô để xem số đo của đúng phòng đó trong đúng ngày đó.</b></p>'
    + banDoBamDuoc(phongBanDo, ngays) + '</div>'
    + '<div class="o"><h2>So sánh các khu</h2>'
    + L.svgSmallMultiples(cay.map((x) => ({ ten: 'Khu ' + x.khu, ty_le: x.ty_le_tb, chuoi: x.chuoi })),
        'ten', 'ty_le') + '</div>'
    + '</div>'

    + '<div class="the-noi-dung" id="the-tra-cuu" role="tabpanel" tabindex="0">'
    + '<div class="o"><h2>Tra cứu phòng</h2>'
    + '<p class="mota">Dùng thanh lọc phía trên để thu hẹp phạm vi — bốn bộ lọc chồng nhau được. '
    + 'Bấm tiêu đề cột để đổi cách xếp. Bấm một dòng để mở chi tiết phòng đó: chuỗi ngày của cả ba '
    + 'chỉ tiêu kèm dải cho phép, danh sách đợt ngoài giới hạn và sự cố còn mở. Bốn chỉ số trên đầu trang tính '
    + 'lại theo đúng phạm vi đang lọc. Nút “Tải bảng” xuất đúng phạm vi đó ra tệp mở được bằng bảng tính.</p>'
    + '<div id="bang-phong"></div></div></div>'

    + '<div class="the-noi-dung" id="the-chenh-ap" role="tabpanel" tabindex="0">' + mucChiTieu(ctDP) + '</div>'
    + '<div class="the-noi-dung" id="the-nhiet" role="tabpanel" tabindex="0">' + mucChiTieu(ctT) + '</div>'
    + '<div class="the-noi-dung" id="the-am" role="tabpanel" tabindex="0">' + mucChiTieu(ctRH) + '</div>'

    + '<div class="the-noi-dung" id="the-dot-lech" role="tabpanel" tabindex="0"><div class="o">'
    + '<h2>Các đợt ngoài giới hạn kéo dài trong kỳ</h2>'
    + '<p class="mota">Mỗi dòng là một đợt số đo ra ngoài dải cho phép liên tục từ '
    + L.DOT_LECH_DANG_KE + ' giờ trở lên. Bấm một dòng để mở chi tiết phòng.</p>'
    + '<div class="cuon-ngang"><table><thead><tr><th>Phòng</th><th>Chỉ tiêu</th><th>Khu · cụm</th>'
    + '<th>Ra ngoài phía nào</th><th class="so">Thời gian kéo dài</th><th>Từ → đến</th>'
    + '<th class="so">Giá trị xa dải nhất</th><th>Đợt ngoài giới hạn kết thúc thế nào</th></tr></thead><tbody>'
    + (hangDotLech || '<tr><td colspan="8" class="trong">Kỳ này không có đợt ngoài giới hạn nào đủ dài.</td></tr>')
    + '</tbody></table></div></div></div>'

    + '<div class="the-noi-dung" id="the-cay" role="tabpanel" tabindex="0">'
    + '<div class="o"><h2>Toàn nhà máy → khu → cụm xử lý không khí → phòng</h2>'
    + '<p class="mota">Xếp từ kém nhất lên, để thấy vấn đề nằm ở một phòng riêng lẻ hay ở cả cụm.</p></div>'
    + cay.map((k2) => '<div class="o">'
        + '<h2>Khu ' + esc(k2.khu) + ' <span class="mo" style="font-weight:400;font-size:13px">— '
        + phanTram(k2.ty_le_tb) + ' trong ngưỡng · ' + k2.so_phong_dat + '/' + k2.so_phong
        + ' phòng đạt · ' + L.gioTyLe(k2.gio_nghiem_trong, k2.gio_do) + ' ở mức nghiêm trọng</span></h2>'
        + '<div class="cuon-ngang"><table><thead><tr><th>Cụm</th>'
        + '<th class="so">Thời gian trong ngưỡng</th><th class="so">Phòng đạt</th>'
        + '<th class="so">Giờ ở mức nghiêm trọng</th><th>Diễn biến</th></tr></thead><tbody>'
        + k2.cum.map((cc) => '<tr><td>' + esc(cc.ahu) + '</td>'
            + '<td class="so' + (cc.ty_le_tb < NGUONG_HANH_DONG ? ' tang-xau' : '') + '">'
            +   phanTram(cc.ty_le_tb) + '</td>'
            + '<td class="so">' + cc.so_phong_dat + '/' + cc.so_phong + '</td>'
            + '<td class="so">' + L.gioTyLe(cc.gio_nghiem_trong, cc.gio_do) + '</td>'
            + '<td>' + L.svgSpark(cc.chuoi, 92, 20) + '</td></tr>').join('')
        + '</tbody></table></div></div>').join('')
    + '</div>'

    + '</main>'

    + '<div class="dong" id="dong"></div>'
    + '<aside class="ngan" id="ngan" role="dialog" aria-modal="true" aria-labelledby="ngan-ten">'
    + '<div class="ngan-dau"><div><div class="ngan-ten" id="ngan-ten"></div>'
    + '<div class="ngan-phu" id="ngan-phu"></div></div>'
    + '<button class="nut-dong" id="nut-dong" aria-label="Đóng chi tiết phòng">×</button></div>'
    + '<div class="ngan-than" id="ngan-than"></div></aside>'

    + '<a class="ve-dau" href="#the-tong-quan">↑ Về đầu</a>'
    + '<footer class="chan">Nguồn số liệu: ' + esc(d.nguon || 'rpc_bao_cao_tong_hop') + '(' + esc(d.ky)
    + ', ' + esc(d.tu_ngay) + ', ' + esc(d.den_ngay) + ') · lập lúc '
    + esc(String(d.tao_luc).slice(0, 19).replace('T', ' '))
    + '<br>Dùng chung số liệu, từ ngữ và luật xếp hạng với bản in. Số liệu nhúng sẵn trong tệp nên '
    + 'mở được không cần mạng; vì thế tệp nặng, nên để trên Drive và gửi đường dẫn thay vì đính kèm thư.'
    + '</footer>'

    + '</div>'
    + '<script>var DU_LIEU = ' + JSON.stringify(nhung) + ';</script>'
    + '<script>' + JS + '</script></body></html>';
}

module.exports = { rapDashboard: rapDashboard, duLieuNhung: duLieuNhung };

});
__dinh_nghia("email.node", function (module, require) {
'use strict';
/* ===========================================================================
 * THÂN EMAIL BÁO CÁO
 *
 * Đây là thứ người nhận thấy ĐẦU TIÊN, và với nhiều người là thứ DUY NHẤT họ
 * đọc. Nó phải trả lời trọn ba câu ngay màn hình đầu: kỳ này có đạt không ·
 * phải xử lý gì · ai làm.
 *
 * RÀNG BUỘC CỦA HÒM THƯ (khác hẳn trang web):
 *   · Kiểu dáng viết THẲNG vào thẻ. Hòm thư loại bỏ tệp kiểu dáng ngoài, quy
 *     tắc nhập tệp, phông chữ nhúng, và mọi thuộc tính định vị.
 *   · Dựng bằng <table>. Hộp co giãn bị cắt phần lớn thuộc tính con nên không
 *     dùng được; lưới thì không hỗ trợ.
 *   · Không ảnh, không đồ hoạ vector — hòm thư chặn ảnh mặc định.
 *   · Khối <style> chỉ dùng cho câu truy vấn phương tiện (màn hình hẹp). Mọi
 *     thứ quyết định hình thức vẫn phải nằm trong thuộc tính style.
 *
 * KÍCH THƯỚC VÀ CHỮ theo chuẩn đọc thư hiện nay:
 *   · khung 600px — bề rộng an toàn cho mọi hòm thư
 *   · thân bài 16px, dãn dòng 1,6 — dưới 16px là bắt người đọc nheo mắt
 *   · tiêu đề thư 26px, con số dẫn dắt 44px — chênh đủ để mắt biết nhìn đâu trước
 *
 * Từ ngữ, cách viết số và luật xếp hạng lấy từ bao-cao-loi.js — ba đầu ra của
 * cùng một kỳ mà nói hai giọng thì tệ hơn là chưa sửa gì.
 * ========================================================================= */

const L = require('./bao-cao-loi.js');
const { esc, soVN, phanTram, ngayDai, gioDoc, dich, NGUONG_HANH_DONG } = L;

/* ===== Bảng màu: hai màu chính, một màu cảnh báo, còn lại là mực và nền =====
 * Viết thẳng giá trị vì biến CSS không dùng được trong hòm thư.
 * ===================================================================== */
const M = {
  muc:   '#0F172A',
  muc2:  '#3E4A5B',
  mo:    '#6B7686',
  vien:  '#E3E8EF',
  vien2: '#EFF2F6',
  giay:  '#FFFFFF',
  nen:   '#F7F9FB',
  ngoai: '#EDF0F4',
  dam:   '#0F172A',
  nhan:  '#1D4ED8',
  nhanN: '#EFF4FF',
  do:    '#DC2626',   // dùng cho nền đậm và viền
  doChu: '#B91C1C',   // dùng cho CHỮ trên nền đỏ nhạt — #DC2626 chỉ đạt 4,41:1, chưa đủ
  doN:   '#FEF2F2',
  tim:   '#7C3AED',
  timN:  '#F8F5FF',
  vang:  '#B45309',   // chữ cảnh báo — 5,9:1 trên nền #FFFBEB
  vangN: '#FFFBEB',
  luc:   '#15803D',
  lucN:  '#F0FDF4'
};

const F = "-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif";

/* Thang khoảng cách. Trước đây có tới mười bốn giá trị đệm khác nhau nên các
 * khối không thẳng hàng nhau; nay chỉ dùng bảy giá trị này.
 *
 * QUY TẮC MÉP — thứ quyết định trang có thẳng hay không:
 *   · Hàng ngoài cùng đệm LE_NGANG hai bên. Đó là đường dọc chuẩn của cả thư.
 *   · Bảng KHÔNG viền: ô đầu bỏ đệm trái, ô cuối bỏ đệm phải, để chữ trong bảng
 *     thẳng đúng đường dọc đó.
 *   · Thẻ CÓ viền: viền chính là mép, bên trong đệm đều LE_THE.
 */
const K = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32 };
const LE_NGANG = K[7];   // 32px — lề trái phải của mọi hàng
const LE_DOC   = K[6];   // 24px — lề trên dưới của mọi hàng
const LE_THE   = K[5];   // 20px — đệm bên trong thẻ có viền
const LE_O     = K[3];   // 12px — đệm dọc trong ô bảng
const KHE      = K[4];   // 16px — khe giữa hai thẻ nằm cạnh nhau

/* ===== Mảnh dựng sẵn ==================================================== */

function hang(noiDung, nen) {
  return '<tr><td class="pad" style="background:' + (nen || M.giay) + ';border-left:1px solid '
    + M.vien + ';border-right:1px solid ' + M.vien + ';padding:' + LE_DOC + 'px ' + LE_NGANG
    + 'px;">' + noiDung + '</td></tr>';
}

/* Thư chỉ so ba khu với nhau. Chi tiết tới từng cụm xử lý không khí để trong
 * báo cáo đính kèm — đưa hết vào thư thì vừa dài vừa quá cỡ Gmail cắt thư.
 * Khu ra ngoài giới hạn nhiều nhất xếp trước. */
function xepKhu(ds) {
  const nang = function (x) {
    if (!x.tong_gio_do) return 0;
    return ((x.tong_gio_duoi || 0) + (x.tong_gio_tren || 0) || (x.tong_gio_lech || 0))
      / x.tong_gio_do;
  };
  return (ds || []).slice().sort(function (a, b) { return nang(b) - nang(a); });
}

function nhanMuc(chu, mau) {
  return '<div style="font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:'
    + (mau || M.mo) + ';font-weight:700;margin:0 0 ' + KHE + 'px;">' + esc(chu) + '</div>';
}

const KE = '<div style="height:1px;background:' + M.vien2 + ';margin:24px 0;"></div>';
const DEM = '<td class="dem" width="' + KHE + '" style="width:' + KHE
  + 'px;font-size:0;line-height:0;">&nbsp;</td>';

function oChiSo(nhan, gt, phu, mauGt, phu2) {
  return '<td width="50%" style="padding:' + LE_THE + 'px;background:' + M.nen + ';border:1px solid '
    + M.vien + ';border-radius:10px;vertical-align:top;">'
    + '<div style="font-size:13px;color:' + M.mo + ';font-weight:600;line-height:1.4;">'
    + esc(nhan) + '</div>'
    + '<div style="font-size:26px;font-weight:700;color:' + (mauGt || M.muc)
    + ';line-height:1.2;margin:6px 0 4px;letter-spacing:-.02em;">' + gt + '</div>'
    + '<div style="font-size:14px;color:' + M.muc2 + ';line-height:1.5;">' + phu + '</div>'
    + (phu2 ? '<div style="font-size:13px;color:' + M.mo + ';line-height:1.5;margin-top:'
        + K[1] + 'px;">' + phu2 + '</div>' : '')
    + '</td>';
}

/* ===== Biểu đồ vẽ bằng chính bảng HTML =================================
 * Hòm thư không vẽ được đồ hoạ vector, còn ảnh thì bị chặn mặc định. Cách duy
 * nhất chạy được ở mọi hòm thư — kể cả Outlook dùng bộ dựng của Word — là vẽ
 * bằng ô bảng có nền màu và bề rộng theo phần trăm.
 * ===================================================================== */

// Một thanh ngang, có VẠCH NGƯỠNG để nhìn phát biết đạt hay chưa. Rãnh được
// chia thành các ô liền nhau; vạch ngưỡng là một ô rộng 2px màu đậm.
function thanh(pct, mau, nguong, cao) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const h = cao || 12;
  const r = h / 2;
  const o = function (w, bg, lop) {
    if (w <= 0.05) return '';
    return '<td class="o' + (lop || '') + '" width="' + w.toFixed(1) + '%" height="' + h
      + '" style="width:' + w.toFixed(1) + '%;background:' + bg + ';">&nbsp;</td>';
  };
  const vach = function (bg) {
    return '<td class="o" width="2" height="' + h + '" style="width:2px;background:' + bg
      + ';">&nbsp;</td>';
  };
  let ruot = '';
  if (nguong == null || nguong <= 0 || nguong >= 100) {
    ruot = o(p, mau, ' rt') + o(100 - p, M.vien2, ' rp');
  } else if (p <= nguong) {
    // chưa tới ngưỡng: thanh màu · phần trống · vạch ngưỡng · phần trống
    ruot = o(p, mau, ' rt') + o(nguong - p, M.vien2) + vach(M.muc2)
         + o(100 - nguong, M.vien2, ' rp');
  } else {
    // đã vượt ngưỡng: vạch nằm bên trong phần đã tô
    ruot = o(nguong, mau, ' rt') + vach('#ffffff') + o(p - nguong, mau)
         + o(100 - p, M.vien2, ' rp');
  }
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"'
    + ' style="border-collapse:collapse;table-layout:fixed;"><tr>' + ruot + '</tr></table>';
}

// Thanh hai hướng: trục ở giữa, trái là tụt dưới, phải là vượt trên.
function thanhHaiHuong(pDuoi, pTren, max, mauDuoi, mauTren) {
  const m = Math.max(1, max || 100);
  const wD = Math.max(0, Math.min(50, 50 * (pDuoi || 0) / m));
  const wT = Math.max(0, Math.min(50, 50 * (pTren || 0) / m));
  const o = function (w, bg, lop) {
    return w <= 0.05 ? '' : '<td class="o' + (lop || '') + '" width="' + w.toFixed(1)
      + '%" style="width:' + w.toFixed(1) + '%;background:' + bg + ';">&nbsp;</td>';
  };
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"'
    + ' style="border-collapse:collapse;"><tr>'
    + o(50 - wD, M.vien2, ' rt') + o(wD, mauDuoi || M.do)
    + '<td class="o" width="2" style="width:2px;background:' + M.muc2 + ';">&nbsp;</td>'
    + o(wT, mauTren || M.tim) + o(50 - wT, M.vien2, ' rp')
    + '</tr></table>';
}

// Một dòng: tên bên trái, thanh ở giữa, số bên phải
function dongThanh(ten, pct, so, mau, phu, nguong) {
  return '<tr>'
    + '<td width="34%" style="padding:9px 12px 9px 0;vertical-align:middle;">'
    +   '<div style="font-size:15px;font-weight:700;color:' + M.muc + ';line-height:1.35;">'
    +     esc(ten) + '</div>'
    +   (phu ? '<div style="font-size:12px;color:' + M.mo + ';margin-top:2px;line-height:1.4;">'
    +     phu + '</div>' : '')
    + '</td>'
    + '<td style="padding:9px 12px 9px 0;vertical-align:middle;">' + thanh(pct, mau, nguong) + '</td>'
    + '<td width="72" style="width:72px;padding:9px 0;text-align:right;vertical-align:middle;'
    +   'font-size:16px;font-weight:700;color:' + M.muc + ';white-space:nowrap;">' + so + '</td>'
    + '</tr>';
}

// Cột theo ngày — mỗi ngày một cột, cao theo tỉ lệ. Vạch ngưỡng vẽ bằng một
// hàng nền nhạt phía sau, vì hòm thư không cho vẽ đường kẻ tự do.
function cotNgay(chuoi, nguong) {
  const ds = (chuoi || []).filter(function (c) { return c.ty_le != null; });
  if (ds.length < 2) return '';
  const CAO = 68;
  const o = ds.map(function (c, i) {
    const h = Math.max(2, Math.round(CAO * Math.min(100, c.ty_le) / 100));
    const duoi = c.ty_le < nguong;
    // Cột đầu bỏ đệm trái, cột cuối bỏ đệm phải: dải cột trải đúng bề ngang của
    // hàng, không thụt vào 1px so với chữ bên trên.
    // valign="bottom" đủ để đẩy cột xuống đáy, không cần thêm ô đệm phía trên —
    // bỏ ô đệm giúp thư nhẹ đi khoảng 2 KB, đáng kể vì Gmail cắt thư khi quá cỡ.
    return '<td class="n" valign="bottom" height="' + CAO + '" style="padding:0 '
      + (i === ds.length - 1 ? '0' : '1px') + ' 0 ' + (i === 0 ? '0' : '1px') + ';">'
      + '<div class="c" style="height:' + h + 'px;background:' + (duoi ? M.do : M.luc)
      + ';">&nbsp;</div></td>';
  }).join('');
  const buoc = Math.max(1, Math.ceil(ds.length / 8));
  const nhan = ds.map(function (c, i) {
    return '<td style="padding:5px 0 0;text-align:center;font-size:11px;color:' + M.mo + ';">'
      + ((i % buoc === 0 || i === ds.length - 1) ? ngayDai(c.ngay).slice(0, 5) : '') + '</td>';
  }).join('');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"'
    + ' style="border-collapse:collapse;table-layout:fixed;"><tr>' + o + '</tr><tr>' + nhan
    + '</tr></table>'
    + '<div style="font-size:12px;color:' + M.mo + ';margin-top:8px;line-height:1.5;">'
    + 'Mỗi cột là một ngày. Cột đỏ là ngày chưa đạt ' + nguong + '%, cột xanh là ngày đạt.'
    + '</div>';
}

/* ===== Ráp thân email =================================================== */

function rapEmail(d, duBao, cfg) {
  const c = cfg || {};
  const k = d.kpi_ky_nay || {}, kt = d.kpi_ky_truoc || {};
  const cap = L.phanCap(d);
  const ctDP = L.tongHopChiTieu(d, 'DP');
  const ctT = L.tongHopChiTieu(d, 'T');
  const ctRH = L.tongHopChiTieu(d, 'RH');
  const cay = L.dungCay(d);
  const ht = cap.heThong;
  const tenKy = dich(L.TEN_KY, String(d.ky).toUpperCase(), String(d.ky).toLowerCase());
  const gioDoDuoc = (d.do_tin_cay_du_lieu && d.do_tin_cay_du_lieu.gio_co_du_lieu)
    || (ht && ht.gio_co_du_lieu) || 0;
  // Tỉ lệ thời gian nghiêm trọng trên tổng số giờ thực sự đo được của toàn nhà máy.
  const pNghiem = gioDoDuoc ? 100 * (k.so_gio_critical || 0) / gioDoDuoc : null;
  // Kỳ trước không kèm số giờ đo được nên không dựng được tỉ lệ tương ứng để so.
  // Chỉ so được mức tăng giảm của chính số giờ — phải nói rõ là "về số giờ".
  const dGioNghiem = kt.so_gio_critical
    ? 100 * ((k.so_gio_critical || 0) - kt.so_gio_critical) / kt.so_gio_critical : null;
  const dat = (k.ty_le_tuan_thu || 0) >= NGUONG_HANH_DONG && !cap.capA_tong;

  const chuoiNgay = (d.chuoi_ngay && d.chuoi_ngay.total) || [];
  const SO_DONG_THU = 5;
  const dsA = cap.capA_tat_ca.slice(0, SO_DONG_THU);
  const conLai = cap.capA_tong - dsA.length;

  const ketLuan = dat
    ? 'Mức phải đạt là ' + NGUONG_HANH_DONG + '%. Cả nhà máy giữ được số đo trong '
      + 'ngưỡng cho phép suốt kỳ.'
    : 'Mức phải đạt là ' + NGUONG_HANH_DONG + '%. Chưa tới mức đó thì phải khắc phục, '
      + 'không phải chỉ theo dõi tiếp.';

  const dongA = dsA.map(function (v, i) {
    return '<tr><td style="padding:0 0 16px;">'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
      + '<td width="36" style="width:36px;vertical-align:top;padding-top:2px;">'
      +   '<div style="width:26px;height:26px;background:' + M.do + ';color:#ffffff;border-radius:99px;'
      +   'font-size:13px;font-weight:700;text-align:center;line-height:26px;">A' + (i + 1) + '</div></td>'
      + '<td style="vertical-align:top;">'
      +   '<div style="font-size:16px;font-weight:700;color:' + M.muc + ';line-height:1.45;">'
      +     esc(L.tenPhongGon(v.ma_phong, v.ten))
      +     (v.uu_tien === 'P1'
           ? ' <span style="font-size:12px;font-weight:700;color:' + M.doChu + ';background:' + M.doN
             + ';border-radius:99px;padding:2px 8px;white-space:nowrap;">Mức 1</span>' : '')
      +   '</div>'
      +   '<div style="font-size:14px;color:' + M.muc2 + ';margin-top:5px;line-height:1.6;">'
      +     esc(v.can_cu[0]) + '</div>'
      +   '<div style="font-size:14px;color:' + M.muc2 + ';margin-top:8px;padding:9px 13px;'
      +     'background:' + M.nen + ';border-left:3px solid ' + M.vien + ';border-radius:0 6px 6px 0;'
      +     'line-height:1.6;">' + esc(v.viec[0]) + '</div>'
      + '</td></tr></table></td></tr>';
  }).join('');

  /* ===== Khối một chỉ tiêu ==============================================
   * Cùng một thiết kế cho cả ba chỉ tiêu: thẻ tổng ở trên, thanh theo khu ở
   * dưới, chỉ hiện phần trăm chứ không hiện số giờ.
   *   · Chỉ tiêu có HAI phía (chênh áp, độ ẩm): hai thẻ và thanh hai hướng.
   *   · Nhiệt độ: truy vấn đã gộp sẵn hai phía nên chỉ có một thẻ, một thanh.
   * Màu ĐỎ luôn là phía nguy hiểm của chính chỉ tiêu đó — chênh áp là tụt
   * dưới, độ ẩm là vượt trên. Không cố định đỏ ở bên trái.
   * ================================================================== */

  function theHuong(ten, pct, soPhong, tongPhong, heQua, mau, nen, gio) {
    const dangKe = pct >= 0.05;
    return '<td width="49%" style="padding:' + LE_THE + 'px;background:' + nen
      + ';border-radius:10px;border-left:4px solid ' + mau + ';vertical-align:top;">'
      + '<div style="font-size:13px;color:' + M.muc2 + ';font-weight:700;">' + esc(ten) + '</div>'
      + '<div style="font-size:24px;font-weight:700;color:' + M.muc + ';margin:6px 0 4px;'
      +   'letter-spacing:-.02em;">' + phanTram(pct) + '</div>'
      + '<div style="font-size:13px;color:' + M.muc2 + ';line-height:1.5;">'
      + (dangKe
          ? soPhong + '/' + tongPhong + ' phòng · ' + heQua
          : ((gio || 0) < 0.05
              ? 'không ghi nhận giờ nào trong kỳ'
              : 'hầu như không có — cả kỳ ' + soVN(gio, 1) + ' giờ'))
      + '</div></td>';
  }

  // Thang của thanh: lấy tròn chục trên giá trị lớn nhất, tối thiểu 20%.
  function thangKhu(dsKhu, hai) {
    const lon = dsKhu.reduce(function (t, x) {
      if (!x.tong_gio_do) return t;
      const a = 100 * (hai ? (x.tong_gio_duoi || 0) : (x.tong_gio_lech || 0)) / x.tong_gio_do;
      const b = hai ? 100 * (x.tong_gio_tren || 0) / x.tong_gio_do : 0;
      return Math.max(t, a, b);
    }, 0);
    return Math.max(20, Math.ceil(lon / 10) * 10);
  }

  function khoiChiTieu(ct, tenNgan) {
    if (!ct.so_phong_do || !ct.hai_huong) return '';
    const hh = ct.hai_huong;
    const dsKhu = xepKhu(L.gomChiTieuTheoCap(ct).khu);
    if (!dsKhu.length) return '';
    const hai = !!hh.nguoc;
    // Phía nguy hiểm nằm bên nào của thang đo vật lý.
    const chinhLaDuoi = hh.chinh.ngan === 'tụt dưới';
    const mauChinh = M.do, mauNguoc = M.tim;
    const mauDuoi = hai ? (chinhLaDuoi ? mauChinh : mauNguoc) : mauChinh;
    const mauTren = hai ? (chinhLaDuoi ? mauNguoc : mauChinh) : mauChinh;
    const nenChinh = M.doN, nenNguoc = M.timN;

    const gioChinh = ct.tong_gio_lech || 0;
    const gioNguoc = hai
      ? (chinhLaDuoi ? (ct.tong_gio_tren || 0) : (ct.tong_gio_duoi || 0)) : 0;
    const pC = ct.tong_gio_do ? 100 * gioChinh / ct.tong_gio_do : 0;
    const pN = ct.tong_gio_do ? 100 * gioNguoc / ct.tong_gio_do : 0;
    const phongChinh = (chinhLaDuoi ? ct.so_phong_lech_duoi : ct.so_phong_lech_tren);
    const phongNguoc = (chinhLaDuoi ? ct.so_phong_lech_tren : ct.so_phong_lech_duoi);

    const the = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"'
      + ' class="co"><tr>'
      + theHuong(hh.chinh.ten, pC, phongChinh == null ? ct.so_phong_do : phongChinh,
          ct.so_phong_do, hh.chinh.he_qua, mauChinh, nenChinh, gioChinh)
      + (hai
          ? DEM + theHuong(hh.nguoc.ten, pN, phongNguoc == null ? ct.so_phong_do : phongNguoc,
              ct.so_phong_do, hh.nguoc.he_qua, mauNguoc, nenNguoc, gioNguoc)
          : '')
      + '</tr></table>';

    const thang = thangKhu(dsKhu, hai);
    const chuThich = hai
      ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
        + '<td style="font-size:12px;color:' + mauDuoi + ';font-weight:700;">← tụt dưới</td>'
        + '<td style="font-size:12px;color:' + mauTren + ';font-weight:700;text-align:right;">'
        + 'vượt trên →</td></tr></table>'
      : '';

    const hang = bang(dsKhu.map(function (x) {
      const pd = x.tong_gio_do ? 100 * (x.tong_gio_duoi || 0) / x.tong_gio_do : 0;
      const pt = x.tong_gio_do ? 100 * (x.tong_gio_tren || 0) / x.tong_gio_do : 0;
      const p1 = x.tong_gio_do ? 100 * (x.tong_gio_lech || 0) / x.tong_gio_do : 0;
      return '<tr>'
        + '<td width="30%" style="padding:8px 12px 8px 0;vertical-align:middle;">'
        +   '<div style="font-size:15px;font-weight:700;color:' + M.muc + ';line-height:1.35;">'
        +   'Khu ' + esc(x.khu) + '</div>'
        +   '<div style="font-size:12px;color:' + M.mo + ';margin-top:2px;line-height:1.4;">'
        +   x.so_phong_dat + '/' + x.so_phong + ' phòng đạt ' + tenNgan + '</div></td>'
        + '<td style="padding:8px 12px 8px 0;vertical-align:middle;">'
        +   (hai ? thanhHaiHuong(pd, pt, thang, mauDuoi, mauTren)
                 : thanh(Math.min(100, 100 * p1 / thang), mauChinh))
        + '</td>'
        + '<td width="' + (hai ? 120 : 72) + '" style="width:' + (hai ? 120 : 72)
        +   'px;padding:8px 0;text-align:right;vertical-align:middle;font-size:13px;'
        +   'white-space:nowrap;">'
        +   (hai
              ? '<span style="color:' + (mauDuoi === M.do ? M.doChu : mauDuoi)
                + ';font-weight:700;">' + phanTram(pd) + '</span>'
                + '<span style="color:' + M.mo + ';"> · </span>'
                + '<span style="color:' + (mauTren === M.do ? M.doChu : mauTren)
                + ';font-weight:700;">' + phanTram(pt) + '</span>'
              : '<span style="color:' + M.doChu + ';font-weight:700;">' + phanTram(p1)
                + '</span>')
        + '</td></tr>';
    }).join(''));

    return the + '<div style="margin-top:16px;">' + chuThich + hang
      + '<div style="font-size:12px;color:' + M.mo + ';margin-top:8px;line-height:1.5;">'
      + (hai
          ? 'Trục ở giữa; thanh sang trái là tụt dưới giới hạn dưới, sang phải là vượt trên '
            + 'giới hạn trên. Màu đỏ là phía nguy hiểm của chỉ tiêu này. '
          : 'Nhiệt độ được truy vấn gộp sẵn cả hai phía nên không tách được. ')
      + 'Thanh vẽ theo thang 0–' + thang + '%, tỉ lệ tính trên giờ có số đo của chính khu đó. '
      + 'Chi tiết tới từng cụm xử lý không khí và từng phòng nằm trong báo cáo đính kèm.</div>'
      + '</div>';
  }

  const khoiDP = khoiChiTieu(ctDP, 'chênh áp');

  function dongNhom(ten, so, phu, mauSo) {
    return '<tr>'
      + '<td style="padding:12px 0;border-bottom:1px solid ' + M.vien2 + ';vertical-align:top;">'
      +   '<div style="font-size:15px;font-weight:700;color:' + M.muc + ';line-height:1.4;">'
      +     esc(ten) + '</div>'
      +   (phu ? '<div style="font-size:13px;color:' + M.mo + ';margin-top:3px;line-height:1.5;">'
      +     phu + '</div>' : '')
      + '</td>'
      + '<td style="padding:12px 0 12px 14px;border-bottom:1px solid ' + M.vien2 + ';text-align:right;'
      +   'vertical-align:top;white-space:nowrap;font-size:18px;font-weight:700;color:'
      +   (mauSo || M.muc) + ';letter-spacing:-.01em;">' + so + '</td></tr>';
  }
  // Khai báo bằng function để dùng được ở mọi chỗ trong hàm, kể cả phía trên.
  function bang(dong) {
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"'
      + ' style="border-collapse:collapse;">' + dong + '</table>';
  }

  const pht = ((c.nhan_dinh || {}).phat_hien || []).filter(function (f) {
    return f && f.quan_sat && f.can_xac_minh && f.ai_lam;
  }).slice(0, 2);
  const khoiNhanDinh = pht.length
    ? pht.map(function (f, i) {
        return '<div style="' + (i ? 'margin-top:20px;padding-top:20px;border-top:1px solid '
          + M.vien2 + ';' : '') + '">'
          + '<div style="font-size:16px;font-weight:700;color:' + M.muc + ';line-height:1.45;">'
          +   esc(L.vietLai(f.tieu_de || 'Phát hiện')) + '</div>'
          + '<div style="font-size:14px;color:' + M.muc2 + ';margin-top:7px;line-height:1.65;">'
          +   esc(L.vietLai(f.quan_sat)) + '</div>'
          // Giả thuyết của máy viết nhận định: hiện thẳng trong thư, dán nhãn rõ
          // là đề xuất — nền vàng để không lẫn với phần việc phải làm bên dưới.
          + (f.gia_thuyet
              ? '<div style="font-size:14px;color:' + M.muc2 + ';margin-top:10px;padding:11px 14px;'
                + 'background:' + M.vangN + ';border-radius:8px;line-height:1.6;">'
                + '<b style="color:' + M.vang + '">AI đề xuất hướng nghi (giả thuyết):</b> '
                + esc(L.vietLai(f.gia_thuyet)) + '</div>'
              : '')
          + '<div style="font-size:14px;color:' + M.muc2 + ';margin-top:10px;padding:11px 14px;'
          +   'background:' + M.nhanN + ';border-radius:8px;line-height:1.6;">'
          +   '<b style="color:' + M.muc + '">Cần xác minh:</b> ' + esc(L.vietLai(f.can_xac_minh))
          +   '<div style="margin-top:6px;"><b>' + esc(L.vietLai(f.ai_lam)) + '</b>'
          +   (f.han ? ' · hạn ' + esc(f.han) : '') + '</div></div></div>';
      }).join('')
      + '<div style="font-size:13px;color:' + M.mo + ';margin-top:14px;line-height:1.55;">'
      + 'Phần "AI đề xuất" là giả thuyết do máy viết nhận định nêu ra để định hướng kiểm tra — '
      + 'hệ thống không có dữ liệu lệnh công việc hay hành động khắc phục nên không kết luận '
      + 'nguyên nhân. Chỉ phần "Cần xác minh" là việc giao cho các bộ phận.</div>'
    : '';

  const db = duBao || {};
  const cuoiDB = (db.du_bao || []).slice(-1)[0] || {};
  /* Sự cố mở sau ngày chốt kỳ: vẫn đang treo nên phải báo, nhưng không phải
   * kết quả của kỳ này. Số giờ kéo dài cũng đo tới lúc lập báo cáo. */
  const dsNgoaiKy = cap.suCoNgoaiKy || [];
  const khoiNgoaiKy = dsNgoaiKy.length
    ? '<div style="margin-top:' + K[4] + 'px;padding:' + K[3] + 'px ' + K[4] + 'px;background:'
      + M.vangN + ';border-left:4px solid ' + M.vang + ';border-radius:0 8px 8px 0;">'
      + '<div style="font-size:13px;font-weight:700;color:' + M.vang + ';">Ngoài kỳ báo cáo</div>'
      + '<div style="font-size:14px;color:' + M.muc2 + ';margin-top:5px;line-height:1.6;">'
      + dsNgoaiKy.length + ' sự cố mở sau ngày chốt kỳ ' + ngayDai(d.den_ngay)
      + ' và tới lúc lập báo cáo vẫn chưa xử lý: '
      + dsNgoaiKy.map(function (x) {
          return esc(x.phong) + ' (số ' + x.ma_su_co + ', mở ' + ngayDai(x.bat_dau) + ', đã '
            + soVN(x.keo_dai_gio, 0) + ' giờ)';
        }).join('; ')
      + '. Không tính vào kết quả kỳ này — sẽ vào báo cáo kỳ sau.</div></div>'
    : '';

  /* Nhiệt độ và độ ẩm dùng đúng thiết kế của chênh áp. Độ ẩm có hai phía thật
   * (vượt trên là phía nguy hiểm), nhiệt độ thì truy vấn đã gộp sẵn. */
  function tieuDePhu(ten, ct) {
    return '<div style="font-size:15px;font-weight:700;color:' + M.muc + ';margin:0 0 ' + K[3]
      + 'px;">' + ten + ' <span style="font-weight:400;font-size:13px;color:' + M.mo + ';">— '
      + ct.so_phong_do + ' phòng đo, ' + ct.so_phong_dat_trong_bang + ' phòng đạt</span></div>';
  }

  const khoiNhiet = ctT.so_phong_do
    ? tieuDePhu('Nhiệt độ', ctT) + khoiChiTieu(ctT, 'nhiệt độ') : '';
  const khoiAm = ctRH.so_phong_do
    ? '<div style="margin-top:' + K[6] + 'px;">' + tieuDePhu('Độ ẩm', ctRH)
      + khoiChiTieu(ctRH, 'độ ẩm') + '</div>' : '';
  const khoiNhietAm = khoiNhiet + khoiAm;

  const khoiDuBao = db.du_bao_dang_tin
    ? '<div style="font-size:15px;color:' + M.muc + ';line-height:1.65;">Xu hướng <b>'
      + esc(db.huong === 'cai_thien' ? 'đang cải thiện' : db.huong === 'xau_di' ? 'đang xấu đi' : 'đi ngang')
      + '</b>. Nếu giữ nguyên đà này, sau 7 ngày nữa thời gian trong ngưỡng vào khoảng '
      + '<b>' + phanTram(cuoiDB.gia_tri) + '</b>, có thể dao động trong khoảng '
      + phanTram(cuoiDB.canh_duoi) + ' đến ' + phanTram(cuoiDB.canh_tren) + '.</div>'
      + '<div style="font-size:13px;color:' + M.mo + ';margin-top:8px;line-height:1.55;">'
      + 'Đây là phép ngoại suy từ số liệu đã có, không phải cam kết.</div>'
    : '<div style="font-size:15px;color:' + M.muc2 + ';line-height:1.65;">Số liệu dao động quá bất '
      + 'thường nên chưa đủ tin cậy để nêu con số dự báo.</div>';

  // Kỳ tháng có tới gần hai trăm sự cố; liệt kê từng vé là vô nghĩa với người
  // quản lý. Cái họ cần là: phát sinh bao nhiêu, đóng được bao nhiêu, còn tồn
  // bao nhiêu, và mất bao lâu để khắc phục. Kỳ tuần ít vé nên không cần khối này.
  const sc = d.su_co || {};
  const laThang = String(d.ky).toUpperCase() !== 'TUAN';
  const tonDau = sc.mo_ky_truoc, tonCuoi = sc.dang_mo;
  const khoiSuCo = (laThang && sc.mo_trong_ky != null)
    ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="co"><tr>'
      + oChiSo('Sự cố phát sinh trong kỳ', soVN(sc.mo_trong_ky, 0),
          'trung bình ' + soVN(sc.mo_trong_ky / Math.max(1, k.so_ngay_co_du_lieu), 1) + ' vé mỗi ngày')
      + DEM
      + oChiSo('Đã đóng trong kỳ', soVN(sc.dong_trong_ky, 0),
          (sc.dong_trong_ky >= sc.mo_trong_ky
            ? 'đóng kịp số phát sinh' : 'ít hơn số phát sinh '
              + soVN(sc.mo_trong_ky - sc.dong_trong_ky, 0) + ' vé'),
          sc.dong_trong_ky >= sc.mo_trong_ky ? M.luc : M.doChu)
      + '</tr><tr><td colspan="3" style="height:12px;font-size:0;">&nbsp;</td></tr><tr>'
      + oChiSo('Còn tồn cuối kỳ', soVN(tonCuoi, 0),
          'vé chưa đóng tại thời điểm chốt kỳ', tonCuoi > 0 ? M.doChu : M.luc)
      + DEM
      + oChiSo('Thời gian khắc phục trung bình', soVN(sc.mttr_gio, 1) + ' giờ',
          'tính trên các vé đã đóng trong kỳ')
      + '</tr></table>'
      + '<div style="font-size:13px;color:' + M.mo + ';margin-top:12px;line-height:1.55;">'
      + 'Danh sách vé còn tồn nằm trong tệp đính kèm. Con số ở đây là toàn kỳ, không phải '
      + 'tại thời điểm gửi thư.</div>'
    : '';

  // Bảng tổng hợp — một chỗ gom cả kỳ, để người đọc không phải ghép số từ
  // nhiều khối rời rạc. Hàng tiêu đề nền đậm, hàng chẵn nền nhạt cho dễ dò.
  function oB(n, canPhai, dam, mau, dau, cuoi) {
    return '<td class="d' + (dau ? ' dl' : '') + (cuoi ? ' dr' : '') + (canPhai ? ' dp' : '')
      + '" style="' + (dam ? 'font-weight:700;' : '') + 'color:' + (mau || M.muc) + ';">'
      + n + '</td>';
  }
  function thB(n, canPhai, dau, cuoi) {
    return '<th class="h' + (dau ? ' dl' : '') + (cuoi ? ' dr' : '') + (canPhai ? ' dp' : '')
      + '">' + n + '</th>';
  }

  // huong: chữ trong bảng, phải ngắn để vừa cột.
  // huongDe: cùng nghĩa nhưng viết như lời nói, dùng trong câu đánh giá bên dưới.
  const bangChiTieu = [
    { ct: ctDP, ten: 'Chênh áp',  huong: 'tụt dưới giới hạn',
      huongDe: 'áp thấp hơn mức cho phép',      huongNgan: 'thấp hơn mức cho phép' },
    { ct: ctT,  ten: 'Nhiệt độ',  huong: 'ra ngoài cả hai phía',
      huongDe: 'nhiệt độ ra ngoài mức cho phép', huongNgan: 'ra ngoài mức cho phép' },
    { ct: ctRH, ten: 'Độ ẩm',     huong: 'vượt giới hạn trên',
      huongDe: 'độ ẩm cao hơn mức cho phép',    huongNgan: 'cao hơn mức cho phép' }
  ].filter(function (x) { return x.ct.so_phong_do; });

  const khoiBangTH =
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"'
    + ' style="border-collapse:collapse;"><thead><tr>'
    + thB('Chỉ tiêu', false, true) + thB('Phòng đo', true) + thB('Phòng đạt', true)
    + thB('Ngoài giới hạn<br>phía nguy hiểm', true)
    + thB('Hướng nguy hiểm', false, false, true)
    + '</tr></thead><tbody>'
    + bangChiTieu.map(function (x, i) {
        const nen = i % 2 ? ' background:' + M.nen + ';' : '';
        const p = x.ct.tong_gio_do ? 100 * x.ct.tong_gio_lech / x.ct.tong_gio_do : 0;
        const chuaDat = x.ct.so_phong_dat_trong_bang < x.ct.so_phong_do;
        return '<tr style="' + nen + '">'
          + oB(x.ten, false, true, null, true) + oB(soVN(x.ct.so_phong_do, 0), true)
          + oB(x.ct.so_phong_dat_trong_bang + '/' + x.ct.so_phong_do, true, true,
               chuaDat ? M.doChu : M.luc)
          + oB(phanTram(p), true, true, p > 20 ? M.doChu : M.muc)
          + oB(x.huong, false, false, M.muc2, false, true) + '</tr>';
      }).join('')
    + '<tr style="background:' + M.muc + ';">'
    +   '<td colspan="5" style="padding:' + LE_O + 'px ' + K[3] + 'px;font-size:13px;color:#C7D2E0;'
    +   'line-height:1.5;">'
    +   'Mỗi chỉ tiêu tính riêng, không cộng chung: mẫu số là số giờ đo được của chính chỉ '
    +   'tiêu đó. Phòng đạt là phòng có từ ' + NGUONG_HANH_DONG + '% thời gian trở lên nằm '
    +   'trong ngưỡng. Cột "Ngoài giới hạn phía nguy hiểm" chỉ đếm một phía'
    +   (ctDP.tong_gio_do && ctDP.tong_gio_tren != null
        ? '; riêng chênh áp còn ' + phanTram(100 * ctDP.tong_gio_tren / ctDP.tong_gio_do)
          + ' thời gian áp cao quá mức, xem mục chênh áp bên dưới'
        : '') + '.'
    +   '</td></tr></tbody></table>';

  const khoiBangKhu =
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"'
    + ' style="border-collapse:collapse;"><thead><tr>'
    + thB('Khu', false, true) + thB('Phòng', true) + thB('Phòng đạt', true)
    + thB('Trong ngưỡng', true) + thB('Giờ nghiêm trọng', true)
    + thB('Phải xử lý', true, false, true)
    + '</tr></thead><tbody>'
    + cay.map(function (x, i) {
        const dsK = cap.capA_tat_ca.filter(function (v) { return v.khu === x.khu; });
        const nen = i % 2 ? ' background:' + M.nen + ';' : '';
        const duoi = x.ty_le_tb != null && x.ty_le_tb < NGUONG_HANH_DONG;
        return '<tr style="' + nen + '">'
          + oB('Khu ' + esc(x.khu), false, true, null, true) + oB(soVN(x.so_phong, 0), true)
          + oB(x.so_phong_dat + '/' + x.so_phong, true, true, duoi ? M.doChu : M.luc)
          + oB(phanTram(x.ty_le_tb), true, true, duoi ? M.doChu : M.luc)
          + oB(soVN(x.gio_nghiem_trong, 0), true)
          + oB(String(dsK.length), true, true, dsK.length ? M.doChu : M.luc, false, true) + '</tr>';
      }).join('')
    + '<tr style="background:' + M.nen + ';border-top:2px solid ' + M.muc2 + ';">'
    +   oB('Toàn nhà máy', false, true, null, true)
    +   oB(soVN(k.tong_phong_co_du_lieu, 0), true, true)
    +   oB((k.tong_phong_co_du_lieu - k.so_phong_khong_dat) + '/' + k.tong_phong_co_du_lieu, true, true)
    +   oB(phanTram(k.ty_le_tuan_thu), true, true,
           k.ty_le_tuan_thu < NGUONG_HANH_DONG ? M.doChu : M.luc)
    +   oB(soVN(k.so_gio_critical, 0), true, true)
    +   oB(String(cap.capA_tong), true, true, cap.capA_tong ? M.doChu : M.luc, false, true)
    + '</tr></tbody></table>';

  /* ===== Đánh giá kết quả tổng quát ====================================
   * Bảng ở trên là số liệu; khối này trả lời câu "vậy kết quả kỳ này ra sao".
   * Dựng thành bảng chứ không phải đoạn văn: người đọc quét mắt theo cột
   * Trạng thái là nắm được ngay, chưa cần đọc cột cuối. Mọi câu rút thẳng từ
   * số liệu, không có câu nào do mô hình ngôn ngữ sinh ra.
   * ================================================================== */

  const MUC_DG = {
    dat:      { chu: 'Đạt',          nen: M.lucN,  mau: M.luc },
    theo_doi: { chu: 'Cần theo dõi', nen: M.vangN, mau: M.vang },
    kem:      { chu: 'Chưa đạt',     nen: M.doN,   mau: M.doChu }
  };
  function mucTheoTyLe(tyLe) {
    if (tyLe == null) return 'theo_doi';
    if (tyLe >= NGUONG_HANH_DONG) return 'dat';
    return tyLe >= NGUONG_HANH_DONG - 10 ? 'theo_doi' : 'kem';
  }

  const dg = [{
    muc: mucTheoTyLe(k.ty_le_tuan_thu),
    nhan: 'Mức tuân thủ chung',
    kq: phanTram(k.ty_le_tuan_thu),
    cau: 'Phải đạt ' + NGUONG_HANH_DONG + '%.'
       + (kt.ty_le_tuan_thu != null ? ' Kỳ trước ' + phanTram(kt.ty_le_tuan_thu) + '.' : '')
  }];

  const xauNhat = bangChiTieu.map(function (x) {
    return { ten: x.ten, huongNgan: x.huongNgan, ct: x.ct,
             p: x.ct.tong_gio_do ? 100 * x.ct.tong_gio_lech / x.ct.tong_gio_do : 0 };
  }).sort(function (a, b) { return b.p - a.p; })[0];
  if (xauNhat) {
    dg.push({
      muc: xauNhat.p > 20 ? 'kem' : (xauNhat.p > 10 ? 'theo_doi' : 'dat'),
      nhan: 'Chỉ tiêu kém nhất',
      kq: xauNhat.ten,
      cau: phanTram(xauNhat.p) + ' thời gian ' + xauNhat.huongNgan + '. Chỉ '
         + xauNhat.ct.so_phong_dat_trong_bang + '/' + xauNhat.ct.so_phong_do + ' phòng đạt.'
    });
  }

  const khuXep = cay.slice().sort(function (a, b) { return (a.ty_le_tb || 0) - (b.ty_le_tb || 0); });
  if (khuXep.length) {
    const kem = khuXep[0], tot = khuXep[khuXep.length - 1];
    dg.push({
      muc: mucTheoTyLe(kem.ty_le_tb),
      nhan: 'Khu kém nhất',
      kq: 'Khu ' + esc(kem.khu),
      cau: phanTram(kem.ty_le_tb) + ' thời gian trong ngưỡng, ' + kem.so_phong_dat + '/'
         + kem.so_phong + ' phòng đạt.'
         + (khuXep.length > 1 && tot.khu !== kem.khu
             ? ' Tốt nhất là khu ' + esc(tot.khu) + ' với ' + phanTram(tot.ty_le_tb) + '.' : '')
    });
  }

  if (ctDP.so_phong_do && ctDP.hai_huong && ctDP.hai_huong.nguoc && ctDP.tong_gio_do) {
    const pD = 100 * ctDP.tong_gio_duoi / ctDP.tong_gio_do;
    const pT = 100 * ctDP.tong_gio_tren / ctDP.tong_gio_do;
    dg.push({
      muc: (pD + pT) > 20 ? 'kem' : ((pD + pT) > 10 ? 'theo_doi' : 'dat'),
      nhan: 'Chênh áp',
      kq: 'Cả hai phía',
      cau: 'Thấp quá mức ' + phanTram(pD) + ' thời gian (' + ctDP.so_phong_lech_duoi
         + ' phòng), cao quá mức ' + phanTram(pT) + ' (' + ctDP.so_phong_lech_tren + ' phòng).'
    });
  }

  const tcE = d.do_tin_cay_du_lieu || ht || {};
  if (tcE.do_phu_pct != null) {
    dg.push({
      muc: tcE.do_phu_pct >= 99 ? 'dat' : (tcE.do_phu_pct >= 95 ? 'theo_doi' : 'kem'),
      nhan: 'Độ tin cậy số đo',
      kq: phanTram(tcE.do_phu_pct),
      cau: 'Thiếu ' + soVN(tcE.gio_rong || 0, 0) + ' giờ so với dự kiến. Số ở trên chỉ đúng '
         + 'trong phần đo được.'
    });
  }

  function theTrangThai(m) {
    return '<table role="presentation" cellpadding="0" cellspacing="0"><tr>'
      + '<td style="padding:3px 9px;background:' + m.nen + ';border-radius:99px;color:' + m.mau
      + ';font-size:12px;font-weight:700;white-space:nowrap;">' + m.chu + '</td></tr></table>';
  }

  const khoiDanhGia =
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"'
    + ' style="border-collapse:collapse;"><thead><tr>'
    + thB('Hạng mục', false, true) + thB('Kết quả') + thB('Trạng thái')
    + thB('Ý chính', false, false, true)
    + '</tr></thead><tbody>'
    + dg.map(function (x, i) {
        const nen = i % 2 ? ' style="background:' + M.nen + ';"' : '';
        return '<tr' + nen + '>'
          + oB(esc(x.nhan), false, true, null, true)
          + oB(x.kq, false, true, MUC_DG[x.muc].mau)
          + oB(theTrangThai(MUC_DG[x.muc]))
          + oB(esc(x.cau), false, false, M.muc2, false, true)
          + '</tr>';
      }).join('')
    + '</tbody></table>';

  const nut = c.link_dashboard
    ? '<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;">'
      + '<tr><td style="background:' + M.nhan + ';border-radius:8px;">'
      + '<a href="' + esc(c.link_dashboard) + '" style="display:inline-block;padding:14px 26px;'
      + 'font-family:' + F + ';font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">'
      + 'Mở bảng tra cứu &nbsp;→</a></td></tr></table>'
    : '';

  return nen('<!doctype html>\n<html lang="vi"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<meta name="color-scheme" content="light only">'
    + '<title>' + esc(c.tieu_de_email || ('Báo cáo ' + tenKy)) + '</title>'
    /* Khối kiểu dáng CHỈ dùng cho màn hình hẹp; mọi thứ khác viết thẳng vào thẻ. */
    + '<style>'
    + '.o{height:12px;font-size:0;line-height:0;}'
    + '.rt{border-radius:6px 0 0 6px;}.rp{border-radius:0 6px 6px 0;}'
    + '.c{border-radius:2px 2px 0 0;font-size:0;line-height:0;}'
    + '.n{height:68px;}'
    // Ô bảng: phần bất biến vào lớp. Hòm thư nào bỏ <style> thì chỉ mất đệm và
    // đường kẻ ngang — chữ và số vẫn đọc được.
    // Lớp gốc khai TRƯỚC, lớp phụ khai SAU — cùng độ ưu tiên thì lớp khai sau
    // thắng, nên .dp mà đứng trước .h là mất căn phải của tiêu đề cột.
    + '.d{padding:12px;border-bottom:1px solid ' + M.vien2 + ';font-size:14px;'
    + 'vertical-align:top;line-height:1.45;}'
    + '.h{padding:12px;background:' + M.muc + ';color:#ffffff;font-size:12px;font-weight:700;'
    + 'letter-spacing:.04em;white-space:nowrap;text-align:left;}'
    + '.dl{padding-left:0;}.dr{padding-right:0;}.dp{text-align:right;white-space:nowrap;}'
    + '@media only screen and (max-width:660px){'
    + '.co td{display:block !important;width:100% !important;}'
    + '.dem{display:none !important;}'
    + '.pad{padding:20px 18px !important;}'
    + '.solon{font-size:38px !important;}}</style>'
    + '</head><body style="margin:0;padding:0;background:' + M.ngoai + ';">'

    + '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">'
    + (dat ? 'Trong kiểm soát' : cap.capA_tong + ' phòng cần xử lý') + ' · '
    + phanTram(k.ty_le_tuan_thu) + ' thời gian trong ngưỡng · ' + esc(ketLuan.slice(0, 90)) + '</div>'

    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:'
    + M.ngoai + ';"><tr><td align="center" style="padding:28px 12px;">'
    /* Bề rộng: chuẩn an toàn của thư điện tử là 600–640px, trên 650px có hòm thư
       bắt đầu sinh thanh cuộn ngang. Nhưng thư này là CHỮ chứ không phải ảnh nên
       không cần khoá cứng như thư quảng cáo. Chọn 720px — rộng hơn chuẩn để màn
       hình lớn đỡ trống trải, vẫn dưới ngưỡng gây cuộn ngang ở phần lớn hòm thư.
       Nền ngoài trải rộng toàn màn hình nên nhìn không bị bó vào một cột hẹp.
       Dòng chữ dài quá 90 ký tự thì mắt khó bắt dòng, nên rộng hơn nữa cũng
       không giúp đọc dễ hơn. */
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"'
    + ' style="width:100%;max-width:720px;font-family:' + F + ';color:' + M.muc + ';">'

    /* ── Dải đầu thư ── */
    + '<tr><td class="pad" style="background:' + M.dam + ';border-radius:14px 14px 0 0;padding:26px 32px;">'
    + '<div style="font-size:12px;letter-spacing:.11em;text-transform:uppercase;color:#93A4B8;'
    + 'font-weight:700;">Giám sát môi trường phòng sạch</div>'
    + '<div style="font-size:26px;line-height:1.3;color:#ffffff;font-weight:700;margin-top:8px;'
    + 'letter-spacing:-.02em;">Báo cáo ' + esc(tenKy) + '</div>'
    + '<div style="font-size:14px;color:#B7C4D4;margin-top:6px;line-height:1.5;">'
    + ngayDai(d.tu_ngay) + ' → ' + ngayDai(d.den_ngay) + ' · ' + (k.so_ngay_co_du_lieu || 0)
    + ' ngày có số đo · lập lúc ' + esc(c.tao_luc || ngayDai(d.tao_luc)) + '</div></td></tr>'

    /* ── Con số dẫn dắt + kết luận ── */
    + '<tr><td class="pad" style="background:' + (dat ? M.lucN : M.doN) + ';border-left:1px solid '
    + M.vien + ';border-right:1px solid ' + M.vien + ';padding:' + LE_DOC + 'px ' + LE_NGANG + 'px;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="co"><tr>'
    + '<td width="44%" style="vertical-align:top;">'
    +   '<div class="solon" style="font-size:44px;line-height:1;font-weight:800;letter-spacing:-.04em;'
    +     'color:' + (dat ? M.luc : M.doChu) + ';">' + phanTram(k.ty_le_tuan_thu) + '</div>'
    +   '<div style="font-size:14px;color:' + M.muc2 + ';margin-top:10px;line-height:1.45;">'
    +     'thời gian số đo nằm trong ngưỡng cho phép</div>'
    +   (kt.ty_le_tuan_thu != null
    ?   '<div style="font-size:14px;color:' + M.muc2 + ';margin-top:6px;">Kỳ trước '
        + phanTram(kt.ty_le_tuan_thu) + ', kỳ này '
        + (k.ty_le_tuan_thu > kt.ty_le_tuan_thu ? 'khá hơn' : 'kém hơn') + '.</div>'
    :   '') + '</td>'
    + DEM
    + '<td style="vertical-align:top;">'
    +   '<div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;'
    +     'color:' + (dat ? M.luc : M.doChu) + ';">'
    +     (dat ? 'Trong kiểm soát' : 'Cần hành động') + '</div>'
    +   '<div style="font-size:16px;color:' + M.muc + ';margin-top:8px;line-height:1.6;">'
    +     esc(ketLuan) + '</div>'
    + '</td></tr></table></td></tr>'

    /* ── Hai chỉ số phụ ── */
    + hang('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="co"><tr>'
        + oChiSo('Thời gian ở mức nghiêm trọng',
            pNghiem != null ? phanTram(pNghiem) : soVN(k.so_gio_critical || 0, 0) + ' giờ',
            // Dòng này chỉ nói lại con số lớn bằng lời, không thêm số mới.
            pNghiem == null ? ''
              : (Math.round(pNghiem) < 1
                  ? 'Gần như không có giờ nào ở mức nghiêm trọng.'
                  : 'Cứ 100 giờ đo được thì có ' + Math.round(pNghiem)
                    + ' giờ ở mức nghiêm trọng.'),
            (k.so_gio_critical || 0) > 0 ? M.do : M.muc,
            'Cả kỳ ' + soVN(k.so_gio_critical || 0, 0) + ' giờ trong '
              + soVN(gioDoDuoc, 0) + ' giờ đo được.'
              + (kt.so_gio_critical != null
                  ? ' Kỳ trước ' + soVN(kt.so_gio_critical, 0) + ' giờ, kỳ này '
                    + ((k.so_gio_critical || 0) < kt.so_gio_critical ? 'ít hơn' : 'nhiều hơn') + '.'
                  : ''))
        + DEM
        + oChiSo('Phòng phải xử lý', soVN(cap.capA_tong, 0) + ' phòng',
            k.tong_phong_co_du_lieu
              ? cap.capA_tong + ' trong ' + k.tong_phong_co_du_lieu + ' phòng có số đo, tức '
                + phanTram(100 * cap.capA_tong / k.tong_phong_co_du_lieu) + '.'
              : '',
            cap.capA_tong ? M.do : M.muc,
            'Nếu chỉ xét riêng ngưỡng ' + NGUONG_HANH_DONG + '% thì có '
              + (k.so_phong_khong_dat || 0) + ' phòng chưa đạt.')
        + '</tr></table>')

    /* ── Đánh giá kết quả tổng quát ── */
    + hang(nhanMuc('Đánh giá kết quả tổng quát') + khoiDanhGia, M.nen)

    /* ── Việc phải xử lý ── */
    + hang(nhanMuc('Việc phải xử lý trong kỳ này', M.do)
        + (dongA
            ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + dongA + '</table>'
              + (conLai > 0
                  ? '<div style="font-size:14px;color:' + M.mo + ';padding-top:2px;">Còn ' + conLai
                    + ' phòng nữa cùng mức, xem đầy đủ trong tệp đính kèm.</div>' : '')
            : '<div style="font-size:15px;color:' + M.muc2 + ';">Kỳ này không có phòng nào phải xử lý ngay.</div>')
        + (cap.suCoNgoaiKy && cap.suCoNgoaiKy.length ? khoiNgoaiKy : ''))

    /* ── Diễn biến theo ngày, vẽ bằng cột ── */
    + (chuoiNgay.length >= 2
        ? hang(nhanMuc('Diễn biến theo ngày') + cotNgay(chuoiNgay, NGUONG_HANH_DONG))
        : '')

    /* ── Bảng tổng hợp cả kỳ ── */
    + hang(nhanMuc('Tổng hợp cả kỳ · ba chỉ tiêu') + khoiBangTH)
    + hang(nhanMuc('Tổng hợp cả kỳ · ba khu') + khoiBangKhu)

    /* ── Chênh áp ── */
    + (khoiDP ? hang(nhanMuc('Chênh áp — chỉ tiêu trọng tâm') + khoiDP) : '')

    /* ── Nhiệt độ và độ ẩm theo khu ── */
    + (khoiNhietAm ? hang(nhanMuc('Nhiệt độ và độ ẩm theo khu') + khoiNhietAm) : '')

    /* ── Xử lý sự cố trong kỳ (chỉ kỳ tháng) ── */
    + (khoiSuCo ? hang(nhanMuc('Xử lý sự cố trong kỳ') + khoiSuCo) : '')

    /* ── Xấu đi so kỳ trước ── */
    + (cap.capB.length
        ? hang(nhanMuc('Xấu đi rõ so với kỳ trước')
            + bang(cap.capB.slice(0, 4).map(function (x) {
                return dongThanh(L.tenPhongGon(x.ma_phong, x.ten_phong), x.tuan_thu_ky_nay,
                  phanTram(x.tuan_thu_ky_nay), M.do,
                  'kỳ trước ' + phanTram(x.tuan_thu_ky_truoc), NGUONG_HANH_DONG);
              }).join(''))
            + (cap.capB.length > 4
                ? '<div style="font-size:14px;color:' + M.mo + ';margin-top:10px;">Còn '
                  + (cap.capB.length - 4) + ' phòng nữa trong tệp đính kèm.</div>' : ''))
        : '')

    /* ── Nhận định ── */
    + (khoiNhanDinh ? hang(nhanMuc('Nhận định') + khoiNhanDinh) : '')

    /* ── Dự báo ── */
    + hang(nhanMuc('Dự báo kỳ sau') + khoiDuBao)

    /* ── Độ tin cậy số đo ── */
    + (ht
        ? hang('<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
            + '<td style="padding:' + LE_THE + 'px;background:' + M.nen + ';border-radius:10px;'
            +   'border-left:4px solid ' + M.muc2 + ';">'
            +   '<div style="font-size:13px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;'
            +     'color:' + M.mo + ';">Mức độ tin cậy của số đo</div>'
            +   '<div style="font-size:15px;color:' + M.muc + ';margin-top:7px;line-height:1.65;">'
            +   '<b>' + esc(ht.ket_luan) + '.</b> Ghi nhận ' + soVN(ht.tong_ngoai_le, 0)
            +   ' lượt trục trặc khi lấy dữ liệu.'
            +   (ht.viec ? ' ' + esc(ht.viec) : '') + '</div></td></tr></table>')
        : '')

    /* ── Xem đầy đủ ở đâu ── */
    + hang(nhanMuc('Xem đầy đủ ở đâu')
        + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="co"><tr>'
        + '<td width="49%" style="padding:' + LE_THE + 'px;background:' + M.nen + ';border:1px solid '
        +   M.vien + ';border-radius:10px;vertical-align:top;">'
        +   '<div style="font-size:13px;color:' + M.mo + ';font-weight:700;">Đính kèm thư</div>'
        +   '<div style="font-size:16px;font-weight:700;color:' + M.muc + ';margin:6px 0 5px;">'
        +     (c.co_pdf ? 'Bản in (PDF)' : 'Bản in (HTML)') + '</div>'
        +   '<div style="font-size:13px;color:' + M.muc2 + ';line-height:1.55;">'
        +     'Kết luận, việc phải xử lý, phân tích từng chỉ tiêu và ô ký duyệt. Bản lưu hồ sơ chất lượng.'
        +   '</div></td>'
        + DEM
        + '<td width="49%" style="padding:' + LE_THE + 'px;background:' + M.nhanN + ';border:1px solid #C7DAFE;'
        +   'border-radius:10px;vertical-align:top;">'
        +   '<div style="font-size:13px;color:' + M.nhan + ';font-weight:700;">Xem trên Drive</div>'
        +   '<div style="font-size:16px;font-weight:700;color:' + M.muc + ';margin:6px 0 5px;">'
        +     'Bảng tra cứu</div>'
        +   '<div style="font-size:13px;color:' + M.muc2 + ';line-height:1.55;">'
        +     'Lọc theo khu, cụm và mức ưu tiên; bấm một phòng để xem số đo từng ngày. '
        +     'Mở thẳng trong trình duyệt, không phải tải về.</div></td></tr></table>'
        + nut)

    /* ── Chân thư ── */
    + '<tr><td class="pad" style="background:' + M.nen + ';border:1px solid ' + M.vien + ';'
    + 'border-radius:0 0 14px 14px;padding:' + LE_DOC + 'px ' + LE_NGANG + 'px;font-size:13px;color:' + M.mo + ';line-height:1.7;">'
    + 'Nguồn số liệu: ' + esc(d.nguon || 'rpc_bao_cao_tong_hop') + '(' + esc(d.ky) + ', '
    + esc(d.tu_ngay) + ', ' + esc(d.den_ngay) + ') · mã lần chạy ' + esc(c.ma_lan_chay || '—')
    + (c.link_drive ? '<br>Thư mục lưu báo cáo: <a href="' + esc(c.link_drive) + '" style="color:'
        + M.nhan + ';">mở trên Drive</a>' : '')
    + '<br>Việc phân loại mức ưu tiên xử lý do luật cố định trong bộ ráp báo cáo, không do máy viết '
    + 'nhận định quyết định. Thư tự động — không trả lời vào địa chỉ này.'
    + '</td></tr>'

    + '</table></td></tr></table></body></html>');
}

function rapEmailGoc(d, duBao, cfg) { return rapEmail(d, duBao, cfg); }

/* Gmail cắt thư vượt quá cỡ rồi hiện dòng "Message clipped" kèm liên kết xem
 * tiếp — người đọc mất hẳn phần cuối. Ngưỡng trên máy tính khoảng 102 KB, trên
 * ứng dụng di động thấp hơn nhiều và không nhất quán. Thư này viết kiểu dáng
 * thẳng vào từng thẻ nên phình rất nhanh, vì vậy nén lại trước khi trả về:
 * bỏ khoảng trắng giữa các thẻ và trong thuộc tính kiểu dáng. Không đụng tới
 * chữ mà người đọc nhìn thấy. */
function nen(h) {
  return h
    .replace(/>\s+</g, '><')                    // khoảng trắng giữa hai thẻ
    .replace(/style="([^"]*)"/g, function (m, v) {
      return 'style="' + v.replace(/\s*;\s*/g, ';').replace(/:\s+/g, ':').trim() + '"';
    })
    .replace(/\s{2,}/g, ' ');                    // khoảng trắng lặp còn sót
}

module.exports = { rapEmail: rapEmail };

});

  var L = __require('bao-cao-loi');
  var R = __require('rap-bao-cao.node');
  var D = __require('dashboard.node');
  var E = __require('email.node');

  /* Một cửa duy nhất cho node n8n: nhận dữ liệu kỳ + dự báo + cấu hình,
   * trả cả ba đầu ra cùng phần tóm tắt cho tiêu đề thư. */
  function rapTatCa(d, duBao, cfg) {
    cfg = cfg || {};
    var nhanDinh = cfg.nhan_dinh || null;
    var cauHinh = Object.assign({}, cfg, { nhan_dinh: nhanDinh });
    var cap = L.phanCap(d);
    var k = d.kpi_ky_nay || {};
    return {
      bao_cao_html: R.rapBaoCao(d, duBao, cauHinh),
      dashboard_html: D.rapDashboard(d, duBao, cauHinh),
      email_html: E.rapEmail(d, duBao, cauHinh),
      tom_tat: {
        ty_le_tuan_thu: k.ty_le_tuan_thu,
        so_phong_xu_ly: cap.capA_tong,
        so_gio_nghiem_trong: k.so_gio_critical,
        su_co_ngoai_ky: (cap.suCoNgoaiKy || []).length
      }
    };
  }

  return { rapTatCa: rapTatCa, locPhatHien: R.locPhatHien,
           L: L, rapBaoCao: R.rapBaoCao, rapDashboard: D.rapDashboard, rapEmail: E.rapEmail };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = BO_RAP;
