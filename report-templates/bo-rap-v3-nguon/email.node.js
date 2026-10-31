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
 *   · Không ảnh, không đồ hoạ vector — hòm thư chặn ảnh mặc định. Biểu đồ vẽ bằng ô bảng (bieu-do-thu.js).
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
const PTD = require('./chenh-ap-phong-theo-doi.js');
const PH = require('./phan-hoi-bo-phan.js');
const BD = require('./bieu-do-thu.js');
const { esc, soVN, phanTram, ngayDai, dich, NGUONG_HANH_DONG } = L;

/* ===== Bảng màu: một màu chính, đỏ và lục cho kết quả, còn lại là mực và nền =====
 * Viết thẳng giá trị vì biến CSS không dùng được trong hòm thư.
 * ===================================================================== */
const M = {
  muc:   '#0F172A',
  muc2:  '#3E4A5B',
  mo:    '#6B7686',
  vien:  '#E3E8EF',
  giay:  '#FFFFFF',
  nen:   '#F7F9FB',
  ngoai: '#EDF0F4',
  dam:   '#17324D',   // màu chính duy nhất: dải đầu thư, tiêu đề mục
  doChu: '#B91C1C',   // đỏ chỉ dành cho số chưa đạt và mũi tên giảm
  luc:   '#15803D'
};

const F = "-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif";

/* Thang khoảng cách. Trước đây có tới mười bốn giá trị đệm khác nhau nên các
 * khối không thẳng hàng nhau; nay chỉ dùng bảy giá trị này.
 *
 * QUY TẮC MÉP — thứ quyết định trang có thẳng hay không:
 *   · Hàng ngoài cùng đệm LE_NGANG hai bên. Đó là đường dọc chuẩn của cả thư.
 *   · Bảng KHÔNG viền: ô đầu bỏ đệm trái, ô cuối bỏ đệm phải, để chữ trong bảng
 *     thẳng đúng đường dọc đó.
 */
const K = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32 };
const LE_NGANG = K[7];   // 32px — lề trái phải của mọi hàng
const LE_DOC   = K[6];   // 24px — lề trên dưới của mọi hàng
const KHE      = K[4];   // 16px — khe giữa hai thẻ nằm cạnh nhau

/* ===== Mảnh dựng sẵn ==================================================== */

function hang(noiDung, nen) {
  return '<tr><td class="pad" style="background:' + (nen || M.giay) + ';border-left:1px solid '
    + M.vien + ';border-right:1px solid ' + M.vien + ';padding:' + LE_DOC + 'px ' + LE_NGANG
    + 'px;">' + noiDung + '</td></tr>';
}

/* Một kiểu tiêu đề mục duy nhất. Không viết hoa toàn bộ: chữ Việt hoa có dấu khó đọc. */
function tieuDeMuc(chu) {
  return '<div style="font-size:18px;font-weight:700;color:' + M.dam + ';line-height:1.35;margin:0 0 '
    + K[3] + 'px;padding-bottom:' + K[2] + 'px;border-bottom:2px solid ' + M.dam + ';">' + esc(chu) + '</div>';
}

function tieuDeNho(chu, phu) {
  return '<div style="font-size:15px;font-weight:700;color:' + M.dam + ';line-height:1.4;margin:0 0 ' + K[2] + 'px;">' + chu
    + (phu ? ' <span style="font-size:13px;font-weight:400;color:' + M.mo + ';white-space:nowrap;">· ' + esc(phu) + '</span>' : '') + '</div>';
}

function doan(html) {
  return '<div style="font-size:15px;color:' + M.muc2 + ';line-height:1.6;margin:0 0 ' + K[3] + 'px;">' + html + '</div>';
}

const DEM = '<td class="dem" width="' + KHE + '" style="width:' + KHE
  + 'px;font-size:0;line-height:0;">&nbsp;</td>';

function oChiSo(nhan, gt, phu, mauGt) {
  return '<td width="33%" class="the" style="padding:' + K[4] + 'px;background:' + M.nen + ';border-top:3px solid '
    + (mauGt || M.dam) + ';vertical-align:top;">'
    + '<div style="font-size:13px;color:' + M.muc2 + ';font-weight:600;line-height:1.4;">' + esc(nhan) + '</div>'
    + '<div class="so" style="font-size:28px;font-weight:700;color:' + (mauGt || M.muc)
    + ';line-height:1.2;margin:6px 0 4px;">' + gt + '</div>'
    + '<div style="font-size:13px;color:' + M.mo + ';line-height:1.5;">' + phu + '</div></td>';
}

/* Máy viết nhận định có lúc ghi "51,23%": đưa về một chữ số lẻ như mọi số khác trong thư. */
function chuAI(s) {
  return L.vietLai(s)
    .replace(/(\d+),(\d{2,})(?=\s*%)/g, function (m, a, b) {
      const v = Number(a + '.' + b);
      // 99,99% không được làm tròn thành 100,0%: đọc vậy là cả kỳ, trong khi vẫn còn điểm đo khác.
      return soVN(v < 100 && Math.round(v * 10) / 10 >= 100 ? 99.9 : v, 1);
    });
}

/* ===== Ráp thân email =================================================== */

function rapEmail(d, duBao, cfg) {
  const c = cfg || {};
  // Bản riêng khu (fan-out theo người nhận): dữ liệu d đã là của khu đó, nên dòng "Toàn nhà máy"
  // phải gọi là "Cả khu X", bảng ba khu bỏ đi (chỉ còn một khu), bảng lịch sử chỉ giữ cột khu đó.
  const khuBC = c.khu ? String(c.khu).toUpperCase() : null;
  const tenTong = khuBC ? 'Cả khu ' + khuBC : 'Toàn nhà máy';
  const k = d.kpi_ky_nay || {}, kt = d.kpi_ky_truoc || {};
  const cap = L.phanCap(d);
  const ctDP = L.tongHopChiTieu(d, 'DP');
  const ctT = L.tongHopChiTieu(d, 'T');
  const ctRH = L.tongHopChiTieu(d, 'RH');
  const cay = L.dungCay(d);
  const ht = cap.heThong;
  const maKy = String(d.ky).toUpperCase();
  const nhanKy = (maKy === 'TUAN' || maKy === 'THANG' || maKy === 'QUY') && d.tu_ngay
    ? PTD.nhanKy({ loai: maKy, tu: d.tu_ngay, den: d.den_ngay }).ten
    : dich(L.TEN_KY, maKy, String(d.ky).toLowerCase());
  const gioDoDuoc = (d.do_tin_cay_du_lieu && d.do_tin_cay_du_lieu.gio_co_du_lieu)
    || (ht && ht.gio_co_du_lieu) || 0;
  // Tỷ lệ giờ vượt giới hạn hành động trên tổng số giờ thực sự đo được.
  const pNghiem = gioDoDuoc ? 100 * (k.so_gio_critical || 0) / gioDoDuoc : null;
  const dat = (k.ty_le_tuan_thu || 0) >= NGUONG_HANH_DONG && !cap.capA_tong;

  function oB(n, canPhai, dam, mau, dau, cuoi) {
    return '<td class="d' + (dau ? ' dl' : '') + (cuoi ? ' dr' : '') + (canPhai ? ' dp' : '')
      + '" style="' + (dam ? 'font-weight:700;' : '') + 'color:' + (mau || M.muc) + ';">'
      + n + '</td>';
  }
  function thB(n, canPhai, dau, cuoi) {
    return '<th class="h' + (dau ? ' dl' : '') + (cuoi ? ' dr' : '') + (canPhai ? ' dp' : '')
      + '">' + n + '</th>';
  }

  const mauTyLe = function (v) { return v != null && v < NGUONG_HANH_DONG ? M.doChu : M.muc; };

  /* ===== Kết luận ======================================================
   * Mọi câu rút thẳng từ số liệu, không có câu nào do mô hình ngôn ngữ sinh ra.
   * ================================================================== */
  const soSanhKyTruoc = kt.ty_le_tuan_thu != null
    ? (k.ty_le_tuan_thu > kt.ty_le_tuan_thu ? ', tăng so với ' : k.ty_le_tuan_thu < kt.ty_le_tuan_thu ? ', giảm so với ' : ', bằng ')
      + phanTram(kt.ty_le_tuan_thu) + ' của kỳ trước'
    : '';
  const cauKetLuan = (dat ? '<b style="color:' + M.luc + ';">Đạt.</b> ' : '<b style="color:' + M.doChu + ';">Chưa đạt.</b> ')
    + 'Tỷ lệ đạt toàn bộ chỉ tiêu của ' + (khuBC ? 'khu ' + esc(khuBC) : 'toàn nhà máy') + ' là <b>' + phanTram(k.ty_le_tuan_thu) + '</b>, '
    + ((k.ty_le_tuan_thu || 0) >= NGUONG_HANH_DONG ? 'không thấp hơn' : 'thấp hơn') + ' mức yêu cầu '
    + NGUONG_HANH_DONG + '%' + soSanhKyTruoc + '.';

  const bangChiTieu = [
    { ct: ctDP, ten: 'chênh áp', huongNgan: 'thấp hơn mức cho phép' },
    { ct: ctT,  ten: 'nhiệt độ', huongNgan: 'ra ngoài mức cho phép' },
    { ct: ctRH, ten: 'độ ẩm',    huongNgan: 'cao hơn mức cho phép' }
  ].filter(function (x) { return x.ct.so_phong_do; });

  const diemChuY = [];
  const xauNhat = bangChiTieu.map(function (x) {
    return { ten: x.ten, huongNgan: x.huongNgan, ct: x.ct,
             p: x.ct.tong_gio_do ? 100 * x.ct.tong_gio_lech / x.ct.tong_gio_do : 0 };
  }).sort(function (a, b) { return b.p - a.p; })[0];
  if (xauNhat) {
    diemChuY.push(['Chỉ tiêu kém nhất', xauNhat.ten.charAt(0).toUpperCase() + xauNhat.ten.slice(1) + ': ' + phanTram(xauNhat.p)
      + ' thời gian ' + xauNhat.huongNgan + ', ' + xauNhat.ct.so_phong_dat_trong_bang + '/' + xauNhat.ct.so_phong_do + ' phòng đạt.']);
  }
  // Khu không có số liệu (null) không phải khu 0% — đẩy xuống cuối (rà soát 04/09/2026)
  const khuXep = cay.slice().sort(function (a, b) {
    return (a.ty_le_tb == null ? 999 : a.ty_le_tb) - (b.ty_le_tb == null ? 999 : b.ty_le_tb);
  });
  if (!khuBC && khuXep.length > 1) {
    const kem = khuXep[0], tot = khuXep[khuXep.length - 1];
    diemChuY.push(['Theo khu', 'Thấp nhất là khu ' + esc(kem.khu) + ' (' + phanTram(kem.ty_le_tb) + '), cao nhất là khu '
      + esc(tot.khu) + ' (' + phanTram(tot.ty_le_tb) + ').']);
  }
  const tcE = d.do_tin_cay_du_lieu || ht || {};
  if (tcE.do_phu_pct != null) {
    diemChuY.push(['Độ đầy đủ số đo', phanTram(tcE.do_phu_pct) + ' số giờ dự kiến'
      + ((tcE.gio_rong || 0) > 0 ? ', thiếu ' + soVN(tcE.gio_rong, 0) + ' giờ.' : ', không thiếu giờ nào.')]);
  }
  const khoiDiemChuY = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="co" style="margin-top:' + K[4] + 'px;border-collapse:collapse;">'
    + diemChuY.map(function (x) {
      return '<tr><td width="150" style="width:150px;padding:6px 12px 6px 0;font-size:14px;font-weight:600;color:' + M.muc + ';vertical-align:top;">' + x[0] + '</td>'
        + '<td style="padding:6px 0;font-size:14px;color:' + M.muc2 + ';line-height:1.5;vertical-align:top;">' + x[1] + '</td></tr>';
    }).join('') + '</table>';

  /* Phần 2 của Kết luận: chỉ chênh áp, chỉ phòng theo dõi. Tách riêng để không lẫn với tỷ lệ toàn bộ chỉ tiêu. */
  const ttTD = PTD.tomTat(PTD.tongHop(d, khuBC));
  const khoiKetLuanTheoDoi = ttTD
    ? '<div style="margin-top:' + K[6] + 'px;padding-top:' + K[5] + 'px;border-top:1px solid ' + M.vien + ';">'
      + tieuDeNho('2. Chỉ riêng chênh áp tại phòng theo dõi', ttTD.so_phong + ' phòng đang được cảnh báo')
      + '<div style="font-size:16px;color:' + M.muc + ';line-height:1.6;margin-bottom:' + K[4] + 'px;">'
      + (ttTD.ty_le >= ttTD.nguong_dat ? '<b style="color:' + M.luc + ';">Đạt.</b> ' : '<b style="color:' + M.doChu + ';">Chưa đạt.</b> ')
      + 'Tỷ lệ đạt chênh áp là <b>' + phanTram(ttTD.ty_le) + '</b>, ' + (ttTD.ty_le >= ttTD.nguong_dat ? 'không thấp hơn' : 'thấp hơn') + ' mức yêu cầu ' + ttTD.nguong_dat + '%'
      + (ttTD.chenh == null ? '' : ', ' + (ttTD.chenh === 0 ? 'không đổi' : (ttTD.chenh > 0 ? 'tăng ' : 'giảm ') + soVN(Math.abs(ttTD.chenh), 1) + ' điểm %')
        + ' so với ' + esc(ttTD.ten_ky_truoc) + ' (' + phanTram(ttTD.ty_le_truoc) + ')') + '.</div>'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="co"><tr>'
      + oChiSo('Tỷ lệ đạt chênh áp', phanTram(ttTD.ty_le),
          'Yêu cầu ' + ttTD.nguong_dat + '%' + (ttTD.ty_le_con_lai != null ? ' · ' + ttTD.so_con_lai + ' phòng còn lại đạt ' + phanTram(ttTD.ty_le_con_lai) : ''),
          ttTD.ty_le < ttTD.nguong_dat ? M.doChu : null)
      + DEM
      + oChiSo('Phòng đạt từ ' + ttTD.nguong_dat + '%', ttTD.phong_dat + '/' + ttTD.so_phong, 'Tính riêng chênh áp')
      + DEM
      + oChiSo('Phòng dưới ' + ttTD.nguong_uu_tien + '%', String(ttTD.so_uu_tien), 'Cần ưu tiên kiểm tra', ttTD.so_uu_tien ? M.doChu : null)
      + '</tr></table>'
      // Bản toàn nhà máy mới cần dòng này; bản riêng một khu đã là số của khu đó.
      + (ttTD.theo_khu.length > 1
        ? '<div style="margin-top:' + K[4] + 'px;font-size:13px;font-weight:600;color:' + M.muc2 + ';">Theo khu vực · tỷ lệ đạt chênh áp</div>'
          + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;border-collapse:collapse;"><tr>'
          + ttTD.theo_khu.map(function (x) {
            return '<td width="' + Math.floor(100 / ttTD.theo_khu.length) + '%" style="padding:8px 6px 8px 0;border-top:1px solid ' + M.vien + ';vertical-align:top;">'
              + '<div style="font-size:14px;font-weight:700;color:' + M.muc + ';">' + esc(x.khu) + '</div>'
              + '<div style="font-size:18px;font-weight:700;line-height:1.4;color:' + (x.ty_le >= ttTD.nguong_dat ? M.luc : M.doChu) + ';">' + phanTram(x.ty_le) + '</div>'
              + '<div style="font-size:12px;color:' + M.mo + ';">' + x.phong_dat + '/' + x.so_phong + ' phòng đạt</div></td>';
          }).join('') + '</tr></table>'
        : '')
      + '</div>'
    : '';

  /* ===== Biểu đồ theo ngày và hai chiều (lấy từ bản in, yêu cầu 31/10/2026) ===== */
  const chuoiNgay = ((d.chuoi_ngay || {}).total || []).filter(function (c) { return c.ty_le != null; });
  // Kỳ dài hơn 14 ngày: mỗi cột là trung bình 7 ngày, để hình đọc được và thư không vượt ngưỡng Gmail cắt.
  const cotTheoNgay = function (ds) {
    if (ds.length <= 14) return ds.map(function (c) { return { nhan: ngayDai(c.ngay).slice(0, 5), v: Number(c.ty_le) }; });
    const ra = [];
    for (let i = 0; i < ds.length; i += 7) {
      const nhom = ds.slice(i, i + 7);
      ra.push({ nhan: ngayDai(nhom[0].ngay).slice(0, 5), v: nhom.reduce(function (t, c) { return t + Number(c.ty_le); }, 0) / nhom.length });
    }
    return ra;
  };
  // Câu chốt tính trên từng ngày thật, kể cả khi hình đã gộp 7 ngày.
  const cauTheoNgay = function (ds) {
    const soDat = ds.filter(function (c) { return Number(c.ty_le) >= NGUONG_HANH_DONG; }).length;
    const thap = ds.reduce(function (a, c) { return Number(c.ty_le) < Number(a.ty_le) ? c : a; });
    const cao = ds.reduce(function (a, c) { return Number(c.ty_le) > Number(a.ty_le) ? c : a; });
    return '<b style="color:' + M.muc + ';">' + soDat + '/' + ds.length + ' ngày đạt mức yêu cầu ' + NGUONG_HANH_DONG + '%.</b> '
      + 'Thấp nhất ' + ngayDai(thap.ngay).slice(0, 5) + ' (' + phanTram(thap.ty_le) + '), cao nhất ' + ngayDai(cao.ngay).slice(0, 5) + ' (' + phanTram(cao.ty_le) + ').';
  };
  const khoiTheoNgay = chuoiNgay.length >= 2
    ? '<div style="margin-top:' + K[5] + 'px;">' + tieuDeNho(chuoiNgay.length > 14 ? 'Tỷ lệ đạt toàn bộ chỉ tiêu, trung bình mỗi 7 ngày' : 'Tỷ lệ đạt toàn bộ chỉ tiêu theo ngày')
      + doan(cauTheoNgay(chuoiNgay))
      + BD.cot(cotTheoNgay(chuoiNgay), NGUONG_HANH_DONG) + '</div>'
    : '';
  const haiChieu = [[ctDP, 'Chênh áp'], [ctT, 'Nhiệt độ'], [ctRH, 'Độ ẩm']].filter(function (x) { return x[0].so_phong_do; }).map(function (x) {
    const g = L.gomChiTieuTheoCap(x[0]);
    const dong = function (r, ten) {
      return { ten: esc(ten), phu: r.so_phong_dat + '/' + r.so_phong + ' phòng đạt', gio_do: r.tong_gio_do, gio_duoi: r.tong_gio_duoi, gio_tren: r.tong_gio_tren };
    };
    // Giữ thứ tự khu cố định để ba hình đọc cùng một cách; hàng cũng theo khu khi là bản riêng.
    return { ten: x[1], so: x[0].so_phong_do,
      khu: g.khu.filter(function (r) { return !khuBC || r.khu === khuBC; }).slice().sort(function (a, b) { return String(a.khu).localeCompare(String(b.khu)); })
        .map(function (r) { return dong(r, 'Khu ' + r.khu); }),
      cum: (g.cum || []).filter(function (r) { return !khuBC || r.khu === khuBC; }).map(function (r) { return dong(r, r.ahu); }) };
  });
  const thangHC = BD.thangChung(haiChieu.reduce(function (t, x) { return t.concat(x.khu, x.cum); }, []));
  const khoiHaiChieu = haiChieu.some(function (x) { return x.khu.length; })
    ? doan('Phần thời gian ra ngoài giới hạn, tách theo hai phía. Các hình dùng chung một thang nên so sánh được với nhau.')
      + BD.chuThichHaiChieu()
      + haiChieu.map(function (x) {
          return '<div style="margin-top:' + K[4] + 'px;">' + tieuDeNho(x.ten, x.so + ' phòng có đo') + BD.bangHaiChieu(x.khu, thangHC) + '</div>';
        }).join('')
      + (haiChieu[0].cum.length
          ? '<div style="margin-top:' + K[5] + 'px;">' + tieuDeNho('Chênh áp theo cụm xử lý không khí', haiChieu[0].cum.length + ' cụm') + BD.bangHaiChieu(haiChieu[0].cum, thangHC) + '</div>' : '')
    : '';

  /* ===== Việc phải xử lý =================================================
   * Nhiều phòng cùng một cụm xử lý không khí có chung một việc: gom lại để mỗi việc
   * nêu một lần, dưới đó là các phòng liên quan.
   * ================================================================== */
  const SO_DONG_THU = 5;
  const dsA = cap.capA_tat_ca.slice(0, SO_DONG_THU);
  const conLai = cap.capA_tong - dsA.length;
  const nhomViec = [];
  dsA.forEach(function (v, i) {
    const viec = v.viec[0];
    let n = nhomViec.find(function (x) { return x.viec === viec; });
    if (!n) { n = { viec: viec, ahu: v.ahu, ds: [] }; nhomViec.push(n); }
    n.ds.push({ v: v, so: i + 1 });
  });
  // "Cơ điện kiểm cụm AHU02: lọc... IPC khoanh vùng..." → "Cơ điện: kiểm lọc... · IPC: khoanh vùng...".
  // Bỏ tên cụm để các cụm cùng việc chỉ phải ghi một lần. Câu không theo mẫu thì giữ nguyên chữ.
  const chuViec = function (viec) {
    return String(viec).split(/\.\s+/).map(function (c) { return c.replace(/\.$/, '').trim(); }).filter(Boolean).map(function (c) {
      const m = c.match(/^(Cơ điện|IPC|QA|Trực hồ sơ lô|Trực)\s+(.+)$/);
      return m ? '<b style="color:' + M.dam + ';">' + esc(m[1]) + ':</b> ' + esc(m[2].replace(/^kiểm cụm [^:]+:\s*/, 'kiểm ')) : esc(c);
    }).join(' · ');
  };
  const nhomChu = [];
  nhomViec.forEach(function (n) {
    const chu = chuViec(n.viec);
    const x = nhomChu.find(function (y) { return y.chu === chu; });
    if (x) x.ahu.push(n.ahu); else nhomChu.push({ chu: chu, ahu: [n.ahu] });
  });
  const khoiViec = dsA.length
    ? nhomChu.map(function (n) {
        return '<div style="font-size:14px;color:' + M.muc + ';line-height:1.5;margin-bottom:' + K[2] + 'px;">'
          + (nhomChu.length > 1 ? esc(n.ahu.join(', ')) + ' — ' : '') + n.chu + '</div>';
      }).join('')
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:' + K[3] + 'px;"><thead><tr>'
      + thB('Phòng', false, true) + thB('Cụm', false) + thB('Tỷ lệ đạt toàn bộ chỉ tiêu', true) + thB('Giờ vượt giới hạn hành động', true, false, true)
      + '</tr></thead><tbody>'
      + dsA.map(function (v) {
        return '<tr>'
          + oB('<b>' + esc(v.ma_phong) + '</b>'
            + (v.su_co_qua_han ? '<div style="font-size:12px;color:' + M.doChu + ';white-space:nowrap;">Sự cố mở ' + soVN(v.su_co_qua_han, 0) + ' giờ</div>' : ''), false, false, null, true)
          + oB(v.ahu && v.ahu !== '—' ? '<span style="white-space:nowrap;">' + esc(v.ahu) + '</span>' : '—', false)
          + oB(v.tuan_thu == null ? '—' : phanTram(v.tuan_thu), true, true, mauTyLe(v.tuan_thu))
          + oB(soVN(v.gio_nghiem_trong || 0, 0) + '&nbsp;giờ', true, false, null, false, true)
          + '</tr>';
      }).join('') + '</tbody></table>'
    : '';

  /* Sự cố mở sau ngày chốt kỳ: vẫn đang treo nên phải báo, nhưng không phải
   * kết quả của kỳ này. Số giờ kéo dài cũng đo tới lúc lập báo cáo. */
  const dsNgoaiKy = cap.suCoNgoaiKy || [];
  const khoiNgoaiKy = dsNgoaiKy.length
    ? '<div style="margin-top:' + K[4] + 'px;font-size:14px;color:' + M.muc2 + ';line-height:1.5;"><b style="color:' + M.muc + ';">'
      + dsNgoaiKy.length + ' sự cố mở sau ngày chốt kỳ, đang chờ xử lý:</b> '
      + dsNgoaiKy.map(function (x) { return esc(x.phong) + ' (' + soVN(x.keo_dai_gio, 0) + '&nbsp;giờ)'; }).join(', ')
      + '. Tính vào kỳ sau.</div>'
    : '';

  /* ===== Nhận định ===================================================== */
  const pht = ((c.nhan_dinh || {}).phat_hien || []).filter(function (f) {
    return f && f.quan_sat && f.can_xac_minh && f.ai_lam;
  }).slice(0, 2);
  const khoiNhanDinh = pht.length
    ? pht.map(function (f, i) {
        const dong = function (nhan, chu) {
          return '<div style="font-size:14px;color:' + M.muc2 + ';margin-top:6px;line-height:1.6;"><b style="color:' + M.muc + ';">'
            + nhan + ':</b> ' + chu + '</div>';
        };
        return '<div style="' + (i ? 'margin-top:' + K[5] + 'px;' : '') + '">'
          + '<div style="font-size:15px;font-weight:700;color:' + M.muc + ';line-height:1.45;">'
          +   esc(chuAI(f.tieu_de || 'Phát hiện')) + '</div>'
          + '<div style="font-size:14px;color:' + M.muc2 + ';margin-top:4px;line-height:1.6;">' + esc(chuAI(f.quan_sat)) + '</div>'
          + (f.gia_thuyet ? dong('Giả thuyết của AI, chưa kiểm chứng', esc(chuAI(f.gia_thuyet))) : '')
          + dong('Cần xác minh', esc(chuAI(f.can_xac_minh)))
          + dong('Bộ phận chủ trì', esc(chuAI(f.ai_lam)) + (f.han ? ' · hạn ' + esc(f.han) : ''))
          + '</div>';
      }).join('')
    : '';

  const db = duBao || {};
  const cuoiDB = (db.du_bao || []).slice(-1)[0] || {};
  const khoiDuBao = db.du_bao_dang_tin
    ? doan('Xu hướng <b>'
      + esc(db.huong === 'cai_thien' ? 'đang cải thiện' : db.huong === 'xau_di' ? 'đang xấu đi' : 'đi ngang')
      + '</b>. Nếu giữ nguyên đà này, sau 7 ngày nữa tỷ lệ đạt toàn bộ chỉ tiêu vào khoảng '
      + '<b>' + phanTram(cuoiDB.gia_tri) + '</b>, có thể dao động từ '
      + phanTram(cuoiDB.canh_duoi) + ' đến ' + phanTram(cuoiDB.canh_tren)
      + '. Đây là phép ngoại suy từ số liệu đã có, không phải cam kết.')
    : doan('Chưa nêu con số dự báo vì số liệu dao động quá thất thường, không đủ tin cậy.');

  // Kỳ tháng có tới gần hai trăm sự cố; liệt kê từng sự cố là vô nghĩa với người
  // quản lý. Cái họ cần là: phát sinh bao nhiêu, đóng được bao nhiêu, còn mở
  // bao nhiêu, và mất bao lâu để khắc phục. Kỳ tuần ít sự cố nên không cần khối này.
  const sc = d.su_co || {};
  const laThang = maKy !== 'TUAN';
  // dang_mo là sự cố đang mở LÚC LẬP BÁO CÁO, không phải tồn cuối kỳ: kỳ 08 chạy ngày 03/09 thì cả
  // bốn sự cố đều mở từ tháng 09. Tách sự cố mở trong kỳ khỏi sự cố mở sau ngày chốt kỳ (rà soát 04/09/2026).
  const soNgoaiKyMo = dsNgoaiKy.length;
  const soMoTrongKy = Math.max(0, (sc.dang_mo || 0) - soNgoaiKyMo);
  // Chia cho số ngày của kỳ (sự cố vẫn phát sinh ngày mất dữ liệu), không chia cho số ngày có số đo (rà soát 04/09/2026)
  const soNgayKy = (d.tu_ngay && d.den_ngay)
    ? Math.max(1, Math.round((Date.parse(String(d.den_ngay).slice(0, 10)) - Date.parse(String(d.tu_ngay).slice(0, 10))) / 86400000) + 1)
    : Math.max(1, k.so_ngay_co_du_lieu || 1);
  // Chênh áp tại các phòng theo dõi trọng điểm, ba kỳ — thư chỉ hiện phần tổng hợp,
  // bảng từng phòng nằm trong bản in (yêu cầu 21/10/2026).
  const khoiPhongTheoDoi = PTD.htmlThuGon(PTD.tongHop(d, khuBC));
  // Phản hồi và kết quả khắc phục của các bộ phận (yêu cầu 31/10/2026).
  const tdPhanHoi = PH.tongHop(d);
  const khoiPhanHoi = PH.htmlThu(tdPhanHoi);

  const khoiSuCo = (laThang && sc.mo_trong_ky != null)
    ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tbody>'
      + [['Sự cố phát sinh trong kỳ', soVN(sc.mo_trong_ky, 0) + ' (trung bình ' + soVN(sc.mo_trong_ky / soNgayKy, 1) + ' sự cố mỗi ngày)'],
         ['Đã đóng trong kỳ', soVN(sc.dong_trong_ky, 0)
           + (sc.dong_trong_ky >= sc.mo_trong_ky ? ' (đóng kịp số phát sinh)' : ' (ít hơn số phát sinh ' + soVN(sc.mo_trong_ky - sc.dong_trong_ky, 0) + ')')],
         ['Mở trong kỳ, còn mở lúc lập báo cáo', soVN(soMoTrongKy, 0)],
         ['Thời gian khắc phục trung bình', soVN(sc.mttr_gio, 1) + '&nbsp;giờ, tính trên các sự cố đã đóng trong kỳ']
      ].map(function (x) { return '<tr>' + oB(x[0], false, true, null, true) + oB(x[1], false, false, M.muc2, false, true) + '</tr>'; }).join('')
      + '</tbody></table>'
    : '';

  /* ===== Bảng theo khu ================================================= */
  // Số giờ cộng dồn của một khu không so được với khu khác (mỗi khu số phòng khác nhau),
  // nên ghi kèm tỷ lệ trên giờ đo được của chính khu.
  function oGioVuot(gio, pct) {
    // &nbsp; để số không tách khỏi đơn vị khi ô được phép xuống dòng (rà soát 04/09/2026)
    return soVN(gio || 0, 0) + '&nbsp;giờ'
      + '<div style="font-size:12px;color:' + M.mo + ';line-height:1.3;">'
      + (pct == null ? '—' : phanTram(pct) + '&nbsp;số&nbsp;giờ') + '</div>';
  }
  const khoiBangKhu =
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"'
    + ' style="border-collapse:collapse;"><thead><tr>'
    + thB('Khu', false, true) + thB('Tỷ lệ đạt toàn bộ chỉ tiêu', true) + thB('Phòng đạt', true)
    + thB('Phòng phải xử lý', true) + thB('Giờ vượt giới hạn hành động', true, false, true)
    + '</tr></thead><tbody>'
    + cay.map(function (x) {
        const dsK = cap.capA_tat_ca.filter(function (v) { return v.khu === x.khu; });
        const pNgoai = x.gio_do ? 100 * (x.gio_nghiem_trong || 0) / x.gio_do : null;
        return '<tr>'
          + oB('Khu ' + esc(x.khu), false, true, null, true)
          + oB(phanTram(x.ty_le_tb) + '<div style="margin-top:4px;">' + BD.thanh(x.ty_le_tb, { nguong: NGUONG_HANH_DONG, cao: 6 }) + '</div>', true, true, mauTyLe(x.ty_le_tb))
          + oB(x.so_phong_dat + '/' + x.so_phong, true)
          + oB(dsK.length + '/' + x.so_phong, true)
          + oB(oGioVuot(x.gio_nghiem_trong, pNgoai), true, false, null, false, true)
          + '</tr>';
      }).join('')
    + '<tr style="background:' + M.nen + ';">'
    +   oB(tenTong, false, true, null, true)
    +   oB(phanTram(k.ty_le_tuan_thu) + '<div style="margin-top:4px;">' + BD.thanh(k.ty_le_tuan_thu, { nguong: NGUONG_HANH_DONG, cao: 6 }) + '</div>', true, true, mauTyLe(k.ty_le_tuan_thu))
    +   oB((k.tong_phong_co_du_lieu - k.so_phong_khong_dat) + '/' + k.tong_phong_co_du_lieu, true, true)
    +   oB(cap.capA_tong + '/' + k.tong_phong_co_du_lieu, true, true)
    +   oB(oGioVuot(k.so_gio_critical, pNghiem), true, true, null, false, true)
    + '</tr></tbody></table>';

  /* ===== So với bốn kỳ trước ===========================================
   * Bảng 5 dòng, cũ → mới, cột toàn nhà máy và từng khu; mỗi số kèm mũi tên so với
   * kỳ liền trước; câu kết luận rút thẳng từ dãy số. Màu chỉ nằm ở mũi tên.
   * ================================================================== */
  const lichSu = L.chuanHoaLichSu(d);
  const khoiLichSu = (function () {
    if (!lichSu) return '';
    const dsKhu = (khuBC ? [khuBC] : ['C1', 'C4', 'Q2']).filter(function (k) {
      return lichSu.some(function (x) { return x.khu && x.khu[k] != null; });
    });
    // Bản khu: cột toàn nhà máy bỏ đi (số của cả nhà máy không thuộc bản khu), kết luận tính
    // trên dãy của chính khu đó.
    const coTong = !khuBC;
    const dayKetLuan = khuBC
      ? lichSu.map(function (x) { return Object.assign({}, x, { ty_le: x.khu && x.khu[khuBC] != null ? Number(x.khu[khuBC]) : null }); })
      : lichSu;
    const xh = L.xuHuongLichSu(dayKetLuan);
    const o = function (v, truoc, dam, cuoi) {
      const muiTen = (v != null && truoc != null && v !== truoc)
        ? '<span style="font-size:11px;color:' + (v > truoc ? M.luc : M.doChu) + ';">&nbsp;'
          + (v > truoc ? '▲' : '▼') + '</span>' : '';
      return '<td class="d dp' + (cuoi ? ' dr' : '') + '" style="font-weight:' + (dam ? 700 : 400) + ';color:' + (v == null ? M.mo : M.muc)
        + ';white-space:nowrap;">' + (v == null ? '—' : phanTram(v)) + muiTen + '</td>';
    };
    // Thư chỉ giữ kỳ cũ nhất, kỳ trước và kỳ này; đủ năm kỳ nằm trong bản in.
    const n = lichSu.length;
    const cotKy = n >= 3 ? [lichSu[0], lichSu[n - 2], lichSu[n - 1]] : lichSu;
    const layKhu = function (x, k) { return k == null ? x.ty_le : (x.khu && x.khu[k] != null ? Number(x.khu[k]) : null); };
    const hangKhu = (coTong ? [null] : []).concat(dsKhu);
    const dong = hangKhu.map(function (k, h) {
      return '<tr style="' + (k == null ? 'background:' + M.nen + ';' : '') + '">'
        + '<td class="d dl" style="font-weight:' + (k == null ? 700 : 400) + ';color:' + M.muc + ';">' + (k == null ? 'Toàn nhà máy' : 'Khu ' + esc(k)) + '</td>'
        + cotKy.map(function (x, i) {
            const moi = i === cotKy.length - 1;
            return o(layKhu(x, k), moi && cotKy.length > 1 ? layKhu(cotKy[i - 1], k) : null, moi, moi);
          }).join('')
        + '</tr>';
    }).join('');
    if (!hangKhu.length) return '';
    return (xh ? doan('<b style="color:' + M.muc + ';">' + esc(xh.chu) + '</b>') : '')
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">'
      + '<thead><tr>' + thB('Phạm vi', false, true)
      + cotKy.map(function (x, i) { return thB(i === cotKy.length - 1 ? 'Kỳ này<br><span style="font-weight:400;">' + esc(x.nhan) + '</span>' : esc(x.nhan), true, false, i === cotKy.length - 1); }).join('')
      + '</tr></thead><tbody>' + dong + '</tbody></table>'
      + (cotKy.some(function (x) { return x.ty_le == null; })
          ? '<div style="font-size:13px;color:' + M.mo + ';margin-top:6px;">Kỳ ghi "—" là kỳ chưa có số liệu trong hệ thống.</div>' : '');
  })();

  /* ===== Cách đọc số liệu: mọi định nghĩa gom một chỗ ở cuối thư ======= */
  const cachDoc = [
    ['Tỷ lệ đạt toàn bộ chỉ tiêu', 'phần thời gian số đo nằm trong giới hạn, gộp chênh áp, nhiệt độ và độ ẩm của mọi phòng. Mức yêu cầu ' + NGUONG_HANH_DONG + '%.'],
    ['Tỷ lệ đạt chênh áp', 'chỉ tính cảm biến chênh áp: tổng điểm đo đạt chia tổng điểm đo của cả nhóm, cả hai phía giới hạn đều tính. Hai tỷ lệ này khác phạm vi nên không so trực tiếp với nhau.'],
    ['Phòng đạt', 'phòng có tỷ lệ đạt toàn bộ chỉ tiêu từ ' + NGUONG_HANH_DONG + '% trở lên.'],
    ['Phòng phải xử lý', 'phòng có sự cố nghiêm trọng mở quá ' + L.GIO_SU_CO_CAP_A + ' giờ (phòng mức 1 hoặc mức 2), hoặc phòng mức 1 có tỷ lệ đạt toàn bộ chỉ tiêu dưới '
      + NGUONG_HANH_DONG + '%, hoặc phòng mức khác có từ ' + L.TI_LE_GIO_VUOT_A + '% số giờ vượt giới hạn hành động. Vì vậy phòng chưa đạt chưa chắc đã là phòng phải xử lý.'],
    ['Giờ vượt giới hạn hành động', 'số giờ cảm biến có lúc vượt giới hạn hành động, chỉ vài phút vẫn tính trọn giờ; là số giờ nên không cộng với các tỷ lệ.']
  ].concat(PH.ghiChuThu(tdPhanHoi));
  if (pht.length) {
    cachDoc.push(['Nhận định', 'giả thuyết do AI nêu để định hướng kiểm tra, không phải kết luận nguyên nhân. Việc phân loại phòng phải xử lý do quy tắc cố định, không do AI quyết định.']);
  }
  const khoiCachDoc = cachDoc.map(function (x) {
    return '<div style="font-size:13px;color:' + M.mo + ';line-height:1.6;margin-top:4px;"><b style="color:' + M.muc2 + ';">' + x[0] + ':</b> ' + x[1] + '</div>';
  }).join('');

  const lienKet = function (url, chu) {
    return '<a href="' + esc(url) + '" style="color:' + M.dam + ';font-weight:700;">' + chu + '</a>';
  };

  return nen('<!doctype html>\n<html lang="vi"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<meta name="color-scheme" content="light only">'
    + '<title>' + esc(c.tieu_de_email || ('Báo cáo ' + nhanKy)) + '</title>'
    /* Khối kiểu dáng CHỈ dùng cho màn hình hẹp; mọi thứ khác viết thẳng vào thẻ. */
    + '<style>'
    // Ô bảng: phần bất biến vào lớp. Hòm thư nào bỏ <style> thì chỉ mất đệm và
    // đường kẻ ngang — chữ và số vẫn đọc được.
    // Lớp gốc khai TRƯỚC, lớp phụ khai SAU — cùng độ ưu tiên thì lớp khai sau
    // thắng, nên .dp mà đứng trước .h là mất căn phải của tiêu đề cột.
    + '.d{padding:10px 8px;border-bottom:1px solid ' + M.vien + ';font-size:14px;'
    + 'vertical-align:top;line-height:1.45;}'
    + '.h{padding:8px;background:' + M.nen + ';color:' + M.muc2 + ';font-size:12px;font-weight:600;'
    + 'text-align:left;vertical-align:bottom;border-bottom:1px solid ' + M.muc2 + ';}'
    + '.dl{padding-left:0;}.dr{padding-right:0;}.dp{text-align:right;}'
    + '.hct{padding:6px 6px 6px 0;color:#0F172A;line-height:1.3;}.hcs{padding:6px;color:#33475B;white-space:nowrap;}.hcb{padding:6px 0;}'
    + '@media only screen and (max-width:660px){'
    + '.co td{display:block !important;width:auto !important;}'
    + '.dem{display:none !important;}'
    + '.pad{padding:18px 14px !important;}'
    + '.d,.h{padding-left:4px !important;padding-right:4px !important;font-size:13px !important;}'
    + '.h{font-size:11px !important;}'
    + '.dl{padding-left:0 !important;}.dr{padding-right:0 !important;}'
    // Ba ô số xếp dọc trên điện thoại: thu gọn để phần Kết luận không chiếm mấy màn hình.
    + '.co .the{padding:8px 12px !important;margin-bottom:6px;border-top-width:2px !important;}'
    + '.so{font-size:22px !important;margin:2px 0 !important;}}</style>'
    + '</head><body style="margin:0;padding:0;background:' + M.ngoai + ';">'

    + '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">'
    + (dat ? 'Đạt' : 'Chưa đạt') + ' · tỷ lệ đạt toàn bộ chỉ tiêu ' + phanTram(k.ty_le_tuan_thu) + ' · '
    + cap.capA_tong + ' phòng phải xử lý</div>'

    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:'
    + M.ngoai + ';"><tr><td align="center" class="ngoai" style="padding:24px 8px;">'
    /* Bề rộng tối đa 1000px theo góp ý 04/09/2026 (cột chữ bị bó khi xem trên máy tính).
       Dưới 660px khung co theo màn hình (xem @media). */
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"'
    + ' style="width:100%;max-width:1000px;font-family:' + F + ';color:' + M.muc + ';">'

    /* ── Dải đầu thư ── */
    + '<tr><td class="pad" style="background:' + M.dam + ';padding:' + LE_DOC + 'px ' + LE_NGANG + 'px;">'
    + '<div style="font-size:22px;line-height:1.3;color:#ffffff;font-weight:700;">Báo cáo môi trường phòng sạch</div>'
    + '<div style="font-size:15px;color:#DCE4EE;margin-top:6px;line-height:1.5;">' + esc(nhanKy) + ' · '
    + ngayDai(d.tu_ngay) + ' – ' + ngayDai(d.den_ngay) + ' · ' + esc(khuBC ? 'Khu ' + khuBC : 'Toàn nhà máy') + '</div></td></tr>'

    /* ── Kết luận ── */
    + hang(tieuDeMuc('Kết luận')
        + tieuDeNho('1. Toàn bộ chỉ tiêu: chênh áp, nhiệt độ, độ ẩm', (k.tong_phong_co_du_lieu || 0) + ' phòng có số đo')
        + '<div style="font-size:16px;color:' + M.muc + ';line-height:1.6;margin-bottom:' + K[4] + 'px;">' + cauKetLuan + '</div>'
        + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="co"><tr>'
        + oChiSo('Tỷ lệ đạt toàn bộ chỉ tiêu', phanTram(k.ty_le_tuan_thu),
            'Yêu cầu ' + NGUONG_HANH_DONG + '%' + (kt.ty_le_tuan_thu != null ? ' · kỳ trước ' + phanTram(kt.ty_le_tuan_thu) : ''),
            (k.ty_le_tuan_thu || 0) < NGUONG_HANH_DONG ? M.doChu : null)
        + DEM
        + oChiSo('Phòng phải xử lý', soVN(cap.capA_tong, 0) + '/' + soVN(k.tong_phong_co_du_lieu || 0, 0),
            'Trong số phòng có số đo · có ' + (k.so_phong_khong_dat || 0) + ' phòng chưa đạt',
            cap.capA_tong ? M.doChu : null)
        + DEM
        + oChiSo('Giờ vượt giới hạn hành động', soVN(k.so_gio_critical || 0, 0),
            (pNghiem != null ? phanTram(pNghiem) + ' số giờ có số đo' : '')
              + (kt.so_gio_critical != null ? ' · kỳ trước ' + soVN(kt.so_gio_critical, 0) : '')
              + ((k.so_gio_warning || 0) > 0 ? ' · ' + soVN(k.so_gio_warning, 0) + ' giờ ở mức cảnh báo' : ''))
        + '</tr></table>'
        + khoiTheoNgay + khoiDiemChuY + khoiKetLuanTheoDoi)

    /* ── Việc phải xử lý ── */
    + hang(tieuDeMuc('Việc phải xử lý')
        + (khoiViec
            ? doan('<b style="color:' + M.muc + ';">' + cap.capA_tong + ' phòng phải xử lý.</b> Dưới đây là ' + dsA.length + ' phòng ưu tiên nhất'
                + (conLai > 0 ? '; ' + conLai + ' phòng còn lại xem trong bản in đính kèm.' : '.'))
              + khoiViec
            : doan('Kỳ này không có phòng nào phải xử lý ngay.'))
        + khoiNgoaiKy)

    /* ── So với bốn kỳ trước ── */
    + (khoiLichSu ? hang(tieuDeMuc('Xu hướng tỷ lệ đạt toàn bộ chỉ tiêu') + khoiLichSu) : '')

    /* Thư chỉ giữ phần TỔNG HỢP (yêu cầu 21/10/2026). Diễn biến theo ngày, bảng ba chỉ
     * tiêu, phân tích chênh áp / nhiệt độ / độ ẩm theo khu, danh sách phòng xấu đi và
     * mức tin cậy số đo nằm trong bản in đính kèm (mục 1, 3–7). */

    /* ── Theo khu ── */
    + (khuBC ? '' : hang(tieuDeMuc('Kết quả theo khu · toàn bộ chỉ tiêu') + khoiBangKhu))

    /* ── Không đạt theo hai phía ── */
    + (khoiHaiChieu ? hang(tieuDeMuc('Ra ngoài giới hạn theo từng chỉ tiêu') + khoiHaiChieu) : '')

    /* ── Chênh áp tại các phòng theo dõi trọng điểm, ba kỳ ── */
    + (khoiPhongTheoDoi ? hang(tieuDeMuc('Chỉ riêng chênh áp · các phòng theo dõi') + khoiPhongTheoDoi) : '')

    /* ── Phản hồi và kết quả khắc phục của các bộ phận ── */
    + (khoiPhanHoi ? hang(tieuDeMuc('Phản hồi và khắc phục của các bộ phận') + khoiPhanHoi) : '')

    /* ── Xử lý sự cố trong kỳ (chỉ kỳ tháng) ── */
    + (khoiSuCo ? hang(tieuDeMuc('Xử lý sự cố trong kỳ') + khoiSuCo) : '')

    /* ── Nhận định ── */
    + (khoiNhanDinh ? hang(tieuDeMuc('Nhận định') + doan('Các tỷ lệ trong mục này tính trên toàn bộ chỉ tiêu.') + khoiNhanDinh) : '')

    /* ── Dự báo ── */
    + hang(tieuDeMuc('Dự báo kỳ sau') + khoiDuBao)

    /* ── Xem đầy đủ và cách đọc ── */
    + hang(tieuDeMuc('Xem đầy đủ')
        + doan('<b style="color:' + M.muc + ';">' + (c.co_pdf ? 'Bản in PDF' : 'Bản in') + ' đính kèm thư:</b> kết luận, việc phải xử lý, phân tích từng chỉ tiêu và ô ký duyệt; dùng làm bản lưu hồ sơ chất lượng.')
        + (c.link_dashboard
            ? doan(lienKet(c.link_dashboard, 'Mở bảng tra cứu') + ': lọc theo khu, cụm và mức ưu tiên, xem số đo từng ngày của từng phòng.') : '')
        + (c.link_drive ? doan(lienKet(c.link_drive, 'Mở thư mục lưu báo cáo') + ' trên Drive.') : ''))

    + '<tr><td class="pad" style="background:' + M.nen + ';border:1px solid ' + M.vien + ';padding:' + LE_DOC + 'px ' + LE_NGANG + 'px;">'
    + '<div style="font-size:14px;font-weight:700;color:' + M.muc + ';">Cách đọc số liệu</div>' + khoiCachDoc
    + '<div style="font-size:12px;color:' + M.mo + ';line-height:1.6;margin-top:' + K[3] + 'px;">Lập ngày ' + esc(c.tao_luc || ngayDai(d.tao_luc))
    + ' · ' + (k.so_ngay_co_du_lieu || 0) + ' ngày có số đo · mã lần chạy ' + esc(c.ma_lan_chay || '—')
    + '. Thư tự động, vui lòng không trả lời vào địa chỉ này.</div></td></tr>'

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
