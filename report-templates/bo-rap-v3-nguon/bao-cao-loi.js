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
const GIO_NGHIEM_TRONG_A = 100;  // số giờ ngoài giới hạn trong kỳ đưa phòng lên cấp A
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
// Không quy đổi ra ngày: phần lớn số giờ trong báo cáo là CỘNG DỒN của nhiều phòng
// (57 phòng × 31 ngày), "535,9 ngày" trong một báo cáo tháng chỉ gây hiểu lầm
// (góp ý 04/09/2026). Chỗ nào là giờ cộng dồn thì câu chữ bên cạnh phải nói rõ.
function gioDoc(g) {
  if (g == null || !isFinite(g)) return '—';
  const n = Number(g);
  return soVN(n, n % 1 ? 1 : 0) + ' giờ';
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
              + gioDoc(p.so_gio_critical) + ' vượt giới hạn hành động.',
        viec: 'Cơ điện kiểm cụm ' + (p.ahu || 'xử lý không khí liên quan')
            + ': lọc, van gió, cài đặt chênh áp. Giám sát trong quá trình khoanh vùng khung giờ ngoài giới hạn.',
        nguon: 'tat_ca_phong (mức ưu tiên 1)'
      });
    });

  // A3. Phòng ngoài mức 1 nhưng số giờ ngoài giới hạn quá cao
  (d.tat_ca_phong || [])
    .filter((p) => p.muc_uu_tien !== 'P1' && p.so_gio_critical >= GIO_NGHIEM_TRONG_A)
    .forEach((p) => {
      ghi(p.ma_phong, {
        loai: 'Nhiều giờ vượt giới hạn hành động',
        can_cu: 'Trong ngưỡng ' + phanTram(p.ty_le_tuan_thu) + '. '
              + (lechDuoiDP[p.ma_phong] != null
                  ? 'Chênh áp tụt dưới giới hạn ' + phanTram(lechDuoiDP[p.ma_phong])
                    + ' thời gian, đây là hướng gây nhiễm chéo. ' : '')
              + gioDoc(p.so_gio_critical) + ' vượt giới hạn hành động.',
        viec: 'Cơ điện kiểm cụm ' + (p.ahu || 'xử lý không khí liên quan')
            + '. Giám sát trong quá trình đối chiếu lịch sản xuất xem có trùng ca không.',
        nguon: 'tat_ca_phong (số giờ ngoài giới hạn)'
      });
    });

  // Xếp hạng theo THỨ TỰ TỪ ĐIỂN — giải thích được bằng một câu khi bị hỏi:
  //   mức ưu tiên phòng → có sự cố quá hạn → thiếu hụt so ngưỡng → số giờ ngoài giới hạn
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
         + (c.ngh ? ', ' + c.ngh + 'h vượt giới hạn hành động' : '')
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
  // Bố cục cột cố định: [tên] [số trái] [thanh trái | thanh phải] [số phải] [phòng đạt].
  // Trước đây số đặt ngay sau đầu thanh nên thanh dài là số đè lên cột "phòng đạt"
  // (góp ý 04/09/2026). Nay số nằm trong cột riêng, thanh chỉ chạy trong vùng của nó.
  const W = 780, hangCao = 26, Lx = 150, colSo = 50, R = coSoPhong ? 196 : 8, T = 22;
  const H = T + ds.length * hangCao + 8;
  const nua = Math.floor((W - Lx - 2 * colSo - R) / 2);
  const giua = Lx + colSo + nua;
  const max = Math.max.apply(null, ds.map((r) => Math.max(gt(r, khoaDuoi), gt(r, khoaTren)))) || 1;
  const rong = (v) => Math.max(0, (v / max) * (nua - 4));

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
            + '<text x="' + (Lx + colSo - 8) + '" y="' + (cy + 16)
            + '" text-anchor="end" class="svg-nhan">' + viet(d, gioD) + '</text>' : '')
      + (t > 0
          ? '<rect x="' + giua + '" y="' + (cy + 5) + '" width="' + so(rong(t), 1)
            + '" height="13" rx="2" fill="' + MAU.lechTren + '"/>'
            + '<text x="' + (giua + nua + 8) + '" y="' + (cy + 16) + '" class="svg-nhan">'
            + viet(t, gioT) + '</text>' : '')
      + (coSoPhong && r.so_phong != null
          ? '<text x="' + W + '" y="' + (cy + 16) + '" text-anchor="end" class="svg-hang">'
            + r.so_phong_dat + '/' + r.so_phong + ' đạt'
            + (r.so_con_lech ? ' · ' + r.so_con_lech + ' ngoài giới hạn' : '') + '</text>'
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

/* ===== So với bốn kỳ trước =================================================
 * d.lich_su_ky do node Supabase của WF5 v3 cấp: 5 phần tử thu_tu 0..4 (0 = kỳ này),
 * mỗi phần tử { tu, den, tong: { ty_le, so_ngay }, khu: { C1: ty_le, ... } }.
 * Tính đúng như hàm tổng hợp tính "thời gian trong ngưỡng" của kỳ (trung bình
 * kpi_ngay_scope), nên con số kỳ này ở bảng trùng con số dẫn đầu thư.
 * Thiếu khối này (dữ liệu cũ, chạy thử tại chỗ) → trả null, khối tự ẩn.
 * ======================================================================= */
function nhanKyNgan(ky, tu, den) {
  const ma = String(ky || '').toUpperCase();
  const s = String(den || ''), nam = s.slice(0, 4), thang = s.slice(5, 7);
  if (ma === 'THANG' && nam) return 'tháng ' + thang + '/' + nam;
  if (ma === 'QUY' && nam) return 'quý ' + Math.ceil(Number(thang) / 3) + '/' + nam;
  return ngayNgan(tu) + ' – ' + ngayNgan(den);
}
function chuanHoaLichSu(d) {
  const ds = Array.isArray(d.lich_su_ky) ? d.lich_su_ky : null;
  if (!ds || !ds.length) return null;
  const ra = ds.map(function (x) {
    const tong = x.tong || {};
    return {
      thu_tu: Number(x.thu_tu) || 0, tu: x.tu, den: x.den,
      nhan: nhanKyNgan(d.ky, x.tu, x.den),
      ty_le: tong.ty_le == null ? null : Number(tong.ty_le),
      so_ngay: tong.so_ngay == null ? null : Number(tong.so_ngay),
      khu: x.khu || {}
    };
  }).sort(function (a, b) { return b.thu_tu - a.thu_tu; });   // cũ → mới
  ra.forEach(function (x, i) { x.la_ky_nay = i === ra.length - 1; });
  return ra;
}
// Một câu kết luận rút thẳng từ dãy số, không do máy viết.
function xuHuongLichSu(ds) {
  if (!ds) return null;
  const co = ds.filter(function (x) { return x.ty_le != null; });
  const nay = ds[ds.length - 1];
  if (nay.ty_le == null || co.length < 2) return { chu: 'Chưa đủ kỳ có số liệu để so sánh.', huong: 'khong' };
  const truoc = co.slice(0, -1).map(function (x) { return x.ty_le; });
  const tb = truoc.reduce(function (t, v) { return t + v; }, 0) / truoc.length;
  const caoNhat = nay.ty_le >= Math.max.apply(null, truoc);
  const thapNhat = nay.ty_le <= Math.min.apply(null, truoc);
  let lienTiep = 0;
  for (let i = co.length - 1; i > 0 && co[i].ty_le > co[i - 1].ty_le; i--) lienTiep++;
  let lienTiepGiam = 0;
  for (let i = co.length - 1; i > 0 && co[i].ty_le < co[i - 1].ty_le; i--) lienTiepGiam++;
  if (caoNhat && lienTiep >= 2) return { chu: 'Tốt lên ' + lienTiep + ' kỳ liên tiếp; kỳ này cao nhất trong ' + co.length + ' kỳ.', huong: 'tot' };
  if (caoNhat) return { chu: 'Kỳ này cao nhất trong ' + co.length + ' kỳ có số liệu.', huong: 'tot' };
  if (thapNhat && lienTiepGiam >= 2) return { chu: 'Xấu đi ' + lienTiepGiam + ' kỳ liên tiếp; kỳ này thấp nhất trong ' + co.length + ' kỳ.', huong: 'xau' };
  if (thapNhat) return { chu: 'Kỳ này thấp nhất trong ' + co.length + ' kỳ có số liệu.', huong: 'xau' };
  if (nay.ty_le > tb) return { chu: 'Kỳ này (' + phanTram(nay.ty_le) + ') cao hơn trung bình các kỳ trước (' + phanTram(tb) + '), nhưng chưa phải cao nhất.', huong: 'tot' };
  return { chu: 'Kỳ này (' + phanTram(nay.ty_le) + ') thấp hơn trung bình các kỳ trước (' + phanTram(tb) + ').', huong: 'xau' };
}

module.exports = {
  nhanKyNgan: nhanKyNgan, chuanHoaLichSu: chuanHoaLichSu, xuHuongLichSu: xuHuongLichSu,
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
