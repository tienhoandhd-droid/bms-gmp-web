'use strict';
/* ===========================================================================
 * THÂN EMAIL BÁO CÁO
 *
 * Các khối theo câu hỏi của người xử lý hệ thống (09/11/2026): kết luận · phòng theo dõi
 * so với kỳ trước (tăng/giảm, khu nào) · cảnh báo và tác động · ai làm gì · bộ phận có
 * phản hồi không · xem thêm. Số mục đánh tự động, khối thiếu dữ liệu thì bỏ. Mỗi con số chỉ nêu một lần; phân tích
 * đầy đủ nằm trong bản in đính kèm.
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
 * Từ ngữ, cách viết số và luật xếp hạng lấy từ bao-cao-loi.js — ba đầu ra của
 * cùng một kỳ mà nói hai giọng thì tệ hơn là chưa sửa gì.
 * ========================================================================= */

const L = require('./bao-cao-loi.js');
const PTD = require('./chenh-ap-phong-theo-doi.js');
const PH = require('./phan-hoi-bo-phan.js');
const BDP = require('./bien-dong-phong-theo-doi.js');
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

/* Thang tỷ lệ vàng (mỗi bậc gấp khoảng 1,618 lần bậc trước).
 *   · Khoảng cách theo dãy Fibonacci: 3, 5, 8, 13, 21, 34.
 *   · Chữ: 13 (bảng, ghi chú), 21 (tiêu đề mục), 34 (số chính); 16 là bậc trung gian cho câu kết luận.
 *   · Bố cục hai cột 62/38, xuống một cột trên điện thoại.
 * Quy tắc mép: hàng ngoài cùng đệm LE_NGANG hai bên; bảng không viền, ô đầu bỏ đệm trái,
 * ô cuối bỏ đệm phải, để chữ trong bảng thẳng đường dọc đó. */
const K = { 1: 3, 2: 5, 3: 8, 4: 13, 5: 21, 6: 34 };
const CO = { nho: 13, than: 16, muc: 21, lon: 34 };
const LE_NGANG = K[6];
const LE_DOC = K[5];
const BANG = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">';

/* ===== Mảnh dựng sẵn ==================================================== */

function hang(noiDung, nen) {
  return '<tr><td class="pad" style="background:' + (nen || M.giay) + ';border-left:1px solid '
    + M.vien + ';border-right:1px solid ' + M.vien + ';padding:' + LE_DOC + 'px ' + LE_NGANG
    + 'px;">' + noiDung + '</td></tr>';
}

function tieuDeMuc(chu) {
  return '<div style="font-size:' + CO.muc + 'px;font-weight:700;color:' + M.dam + ';line-height:1.3;margin:0 0 ' + K[4] + 'px;">' + esc(chu) + '</div>';
}

function tieuDeNho(chu) {
  return '<div style="font-size:' + CO.nho + 'px;font-weight:700;color:' + M.dam + ';line-height:1.4;margin:0 0 ' + K[2] + 'px;">' + chu + '</div>';
}

function ghiChu(html) {
  return '<div style="font-size:' + CO.nho + 'px;color:' + M.muc2 + ';line-height:1.6;margin:' + K[3] + 'px 0 0;">' + html + '</div>';
}

/* Hai cột 62/38. Thiếu một bên thì bên còn lại chiếm cả hàng. */
function haiCot(trai, phai) {
  if (!trai || !phai) return trai || phai || '';
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
    + '<td class="cot" width="62%" style="width:62%;vertical-align:top;padding:0 ' + K[5] + 'px 0 0;">' + trai + '</td>'
    + '<td class="cot" width="38%" style="width:38%;vertical-align:top;padding:0;">' + phai + '</td></tr></table>';
}

function chiSo(nhan, gt, phu, mau) {
  return '<div style="padding:' + K[3] + 'px 0;border-bottom:1px solid ' + M.vien + ';">'
    + '<div style="font-size:' + CO.nho + 'px;color:' + M.muc2 + ';font-weight:600;line-height:1.4;">' + esc(nhan) + '</div>'
    + '<div style="font-size:' + CO.muc + 'px;font-weight:700;color:' + (mau || M.muc) + ';line-height:1.3;">' + gt + '</div>'
    + '<div style="font-size:' + CO.nho + 'px;color:' + M.mo + ';line-height:1.5;">' + phu + '</div></div>';
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
  // Bản riêng khu (fan-out theo người nhận): dữ liệu d đã là của khu đó, nên dòng tổng gọi là "Cả khu X".
  const khuBC = c.khu ? String(c.khu).toUpperCase() : null;
  const tenTong = khuBC ? 'Cả khu ' + khuBC : 'Toàn nhà máy';
  const k = d.kpi_ky_nay || {}, kt = d.kpi_ky_truoc || {};
  const cap = L.phanCap(d);
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
  const tdTD = PTD.tongHop(d, khuBC);
  const tdBD = BDP.tongHop(d, khuBC);   // phòng theo dõi so với kỳ liền trước (09/11/2026)
  const hoaDau = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
  const ttTD = PTD.tomTat(tdTD);

  function oB(n, canPhai, dam, mau, dau, cuoi) {
    return '<td class="d' + (dau ? ' dl' : '') + (cuoi ? ' dr' : '') + (canPhai ? ' dp' : '')
      + '" style="' + (dam ? 'font-weight:700;' : '') + 'color:' + (mau || M.muc) + ';">' + n + '</td>';
  }
  function thB(n, canPhai, dau, cuoi) {
    return '<th class="h' + (dau ? ' dl' : '') + (cuoi ? ' dr' : '') + (canPhai ? ' dp' : '') + '">' + n + '</th>';
  }
  const mauTyLe = function (v) { return v != null && v < NGUONG_HANH_DONG ? M.doChu : M.muc; };
  const nhoMo = function (chu) { return '<div style="font-size:' + CO.nho + 'px;font-weight:400;color:' + M.mo + ';line-height:1.4;">' + chu + '</div>'; };


  /* ===== 1. Kết luận: mọi câu rút thẳng từ số liệu, không do mô hình ngôn ngữ sinh ra ===== */
  const soSanhKyTruoc = kt.ty_le_tuan_thu != null
    ? (k.ty_le_tuan_thu > kt.ty_le_tuan_thu ? ', tăng so với ' : k.ty_le_tuan_thu < kt.ty_le_tuan_thu ? ', giảm so với ' : ', bằng ')
      + 'kỳ trước (' + phanTram(kt.ty_le_tuan_thu) + ')'
    : '';
  const chuoiNgay = ((d.chuoi_ngay || {}).total || []).filter(function (x) { return x.ty_le != null; });
  const cauTheoNgay = function (ds) {
    const soDat = ds.filter(function (x) { return Number(x.ty_le) >= NGUONG_HANH_DONG; }).length;
    const thap = ds.reduce(function (a, x) { return Number(x.ty_le) < Number(a.ty_le) ? x : a; });
    const cao = ds.reduce(function (a, x) { return Number(x.ty_le) > Number(a.ty_le) ? x : a; });
    return '<b>' + soDat + '/' + ds.length + ' ngày đạt mức yêu cầu.</b> Thấp nhất ' + ngayDai(thap.ngay).slice(0, 5) + ' (' + phanTram(thap.ty_le)
      + '), cao nhất ' + ngayDai(cao.ngay).slice(0, 5) + ' (' + phanTram(cao.ty_le) + ').';
  };
  const tcE = d.do_tin_cay_du_lieu || ht || {};
  const db = duBao || {};
  const cuoiDB = (db.du_bao || []).slice(-1)[0] || {};
  const khoiKetLuan = haiCot(
    '<div style="font-size:' + CO.than + 'px;font-weight:700;color:' + (dat ? M.luc : M.doChu) + ';">' + (dat ? 'Đạt' : 'Chưa đạt') + '</div>'
    + '<div style="font-size:' + CO.lon + 'px;font-weight:700;line-height:1.3;color:' + mauTyLe(k.ty_le_tuan_thu) + ';">' + phanTram(k.ty_le_tuan_thu) + '</div>'
    + '<div style="font-size:' + CO.than + 'px;line-height:1.6;color:' + M.muc + ';">Tỷ lệ đạt toàn bộ chỉ tiêu (chênh áp, nhiệt độ, độ ẩm) của '
    + (khuBC ? 'khu ' + esc(khuBC) : 'toàn nhà máy') + ', mức yêu cầu ' + NGUONG_HANH_DONG + '%' + soSanhKyTruoc + '.</div>'
    + (chuoiNgay.length >= 2 ? ghiChu(cauTheoNgay(chuoiNgay)) : '')
    + (tcE.do_phu_pct != null ? ghiChu('Số đo có đủ ' + phanTram(tcE.do_phu_pct) + ' số giờ dự kiến'
        + ((tcE.gio_rong || 0) > 0 ? ', thiếu ' + soVN(tcE.gio_rong, 0) + ' giờ.' : '.')) : '')
    + (db.du_bao_dang_tin ? ghiChu('Ngoại suy 7 ngày tới: khoảng ' + phanTram(cuoiDB.gia_tri) + ' (từ ' + phanTram(cuoiDB.canh_duoi) + ' đến ' + phanTram(cuoiDB.canh_tren) + '), không phải cam kết.') : ''),
    (ttTD ? chiSo('Chênh áp tại ' + ttTD.so_phong + ' phòng theo dõi', phanTram(ttTD.ty_le),
        (tdBD && tdBD.tat_ca.v_truoc != null ? hoaDau(tdBD.ten_ky_truoc) + ' ' + phanTram(tdBD.tat_ca.v_truoc) + ' (' + BDP.chuChenh(tdBD.tat_ca.chenh) + ') · ' : '')
        + ttTD.phong_dat + '/' + ttTD.so_phong + ' phòng đạt · ' + ttTD.so_uu_tien + ' phòng dưới ' + ttTD.nguong_uu_tien + '%',
        ttTD.ty_le < ttTD.nguong_dat ? M.doChu : null) : '')
    + chiSo('Phòng phải xử lý', soVN(cap.capA_tong, 0) + '/' + soVN(k.tong_phong_co_du_lieu || 0, 0),
        'Có ' + (k.so_phong_khong_dat || 0) + ' phòng chưa đạt', cap.capA_tong ? M.doChu : null)
    // 09/11/2026: chỉ ghi %, không ghi số giờ (người dùng yêu cầu). Không so kỳ trước vì kỳ trước
    // không có tổng số giờ có số đo để tính cùng mẫu số; suy từ oos_rate_pct ra mẫu số khác hẳn.
    + chiSo('Giờ vượt giới hạn hành động', pNghiem != null ? phanTram(pNghiem) : '—',
        'trên tổng số giờ có số đo')
  );

  /* ===== 2. Phòng theo dõi so với kỳ liền trước (yêu cầu 09/11/2026) =====
   * Người xử lý hệ thống cần biết: ở đâu tốt / tăng, ở đâu kém / giảm (phòng nào, khu nào).
   * Mục "Ở đâu kém" cũ (toàn bộ chỉ tiêu theo khu, cụm xử lý không khí, thời gian ra ngoài
   * giới hạn) chuyển hẳn sang bản in theo duyệt của người dùng, để thư ngắn. */
  const mauChenh = function (x) { return x.xu_huong === 'tang' ? M.luc : x.xu_huong === 'giam' ? M.doChu : M.muc2; };
  const tenPhong = function (p, coKhu) {
    return '<b>' + esc(p.ma) + '</b>' + (p.ten ? '&nbsp;<span style="color:' + M.muc2 + ';">' + esc(p.ten) + '</span>' : '')
      + (coKhu && !khuBC ? nhoMo('Khu ' + esc(p.khu)) : '');
  };
  const chenhGon = function (c) { return '<span style="white-space:nowrap;">' + BDP.chuChenh(c) + '</span>'; };
  const dsTen = function (ds) {
    return ds.map(function (p) { return esc(p.ma) + ' ' + phanTram(p.v); }).join(' · ');
  };
  let khoiBienDong = '';
  if (tdBD) {
    const kn = hoaDau(tdBD.ten_ky_nay), kt2 = hoaDau(tdBD.ten_ky_truoc);
    const bangKhu = khuBC ? '' : tieuDeNho('Theo khu') + BANG + '<thead><tr>' + thB('Khu', false, true) + thB(kn, true)
      + thB(kt2, true) + thB('Thay đổi', true, false, true) + '</tr></thead><tbody>'
      + tdBD.khu.concat([Object.assign({ khu: null }, tdBD.tat_ca)]).map(function (x) {
          const tong = x.khu == null;
          return '<tr' + (tong ? ' style="background:' + M.nen + ';"' : '') + '>'
            + oB((tong ? 'Tất cả' : 'Khu ' + esc(x.khu)) + nhoMo(x.so_phong + '&nbsp;phòng · ' + x.so_tang + ' tăng, ' + x.so_giam + ' giảm'), false, true, null, true)
            + oB(phanTram(x.v), true, true, mauTyLe(x.v)) + oB(x.v_truoc == null ? '—' : phanTram(x.v_truoc), true, false, M.muc2)
            + oB(chenhGon(x.chenh), true, true, mauChenh(x), false, true) + '</tr>';
        }).join('') + '</tbody></table>';
    const bangTang = tieuDeNho('Tốt lên nhiều nhất')
      + (tdBD.tang.length
        ? BANG + '<thead><tr>' + thB('Phòng', false, true) + thB(kn, true) + thB('Thay đổi', true, false, true) + '</tr></thead><tbody>'
          + tdBD.tang.slice(0, 3).map(function (p) {
              return '<tr>' + oB(tenPhong(p, true), false, false, null, true) + oB(phanTram(p.v), true, true, mauTyLe(p.v))
                + oB(chenhGon(p.chenh), true, true, M.luc, false, true) + '</tr>';
            }).join('') + '</tbody></table>'
        : ghiChu('Không phòng nào tăng từ ' + tdBD.nguong + ' điểm trở lên.'))
      + ghiChu('<b>Cao nhất ' + tdBD.ten_ky_nay + ':</b> ' + dsTen(tdBD.cao_nhat) + '.');
    const SO_GIAM = 5;
    const bangGiam = tieuDeNho('Kém đi nhiều nhất')
      + (tdBD.giam.length
        ? BANG + '<thead><tr>' + thB('Phòng · cảnh báo ' + tdBD.ten_ky_nay, false, true) + thB(kn, true) + thB(kt2, true) + thB('Thay đổi', true, false, true)
          + '</tr></thead><tbody>'
          + tdBD.giam.slice(0, SO_GIAM).map(function (p) {
              const khongTD = !!(p.canh_bao && !p.canh_bao.co_tac_dong);
              // Cảnh báo nằm ngay dưới tên phòng: bảng bốn cột vẫn đọc được trên điện thoại.
              const dongCB = tdBD.co_canh_bao
                ? '<div style="margin-top:' + K[1] + 'px;font-size:' + CO.nho + 'px;line-height:1.4;color:' + (khongTD ? M.doChu : M.muc2) + ';' + (khongTD ? 'font-weight:700;' : '') + '">'
                  + esc(BDP.chuCanhBao(p.canh_bao)) + '</div>' : '';
              return '<tr>' + oB(tenPhong(p, true) + dongCB, false, false, null, true) + oB(phanTram(p.v), true, true, mauTyLe(p.v))
                + oB(phanTram(p.v_truoc), true, false, M.muc2) + oB(chenhGon(p.chenh), true, true, M.doChu, false, true) + '</tr>';
            }).join('') + '</tbody></table>'
          + (tdBD.giam.length > SO_GIAM ? ghiChu('Còn ' + (tdBD.giam.length - SO_GIAM) + ' phòng giảm khác trong bản in.') : '')
        : ghiChu('Không phòng nào giảm từ ' + tdBD.nguong + ' điểm trở lên.'))
      + ghiChu('<b>Thấp nhất ' + tdBD.ten_ky_nay + ':</b> ' + dsTen(tdBD.thap_nhat) + '.')
      + (tdBD.giam_khong_tac_dong.length
        ? ghiChu('<b style="color:' + M.doChu + ';">' + tdBD.giam_khong_tac_dong.length + ' phòng giảm có cảnh báo nhưng không bộ phận nào thao tác:</b> '
          + tdBD.giam_khong_tac_dong.map(function (p) { return esc(p.ma); }).join(', ') + '.')
        : '');
    khoiBienDong = '<div style="font-size:' + CO.than + 'px;line-height:1.6;color:' + M.muc + ';margin-bottom:' + K[4] + 'px;">' + BDP.cauDan(tdBD) + '</div>'
      + haiCot(bangKhu, bangTang) + '<div style="margin-top:' + K[5] + 'px;">' + bangGiam + '</div>'
      + ghiChu('<span style="color:' + M.mo + ';">Tỷ lệ điểm đo chênh áp đạt của các phòng theo dõi. Thay đổi tính bằng điểm phần trăm; chênh dưới '
        + tdBD.nguong + ' điểm ghi "không đổi". Theo khu, cụm xử lý không khí và từng chỉ tiêu xem trong bản in.</span>');
  }

  /* ===== 3. Cảnh báo và tác động tại phòng theo dõi ===================== */
  const SO_CANH_BAO = 8;
  const khoiCanhBao = tdBD && tdBD.co_canh_bao
    ? '<div style="font-size:' + CO.than + 'px;line-height:1.6;color:' + M.muc + ';margin-bottom:' + K[3] + 'px;">' + BDP.cauCanhBao(tdBD) + '</div>'
      + (tdBD.canh_bao.length
        ? BANG + '<thead><tr>' + thB('Phòng', false, true) + thB('Cảnh báo', true) + thB('Thao tác · kết quả')
          + thB('Tỷ lệ đạt', true, false, true) + '</tr></thead><tbody>'
          + tdBD.canh_bao.slice(0, SO_CANH_BAO).map(function (p) {
              const cb = p.canh_bao, khongTD = !cb.co_tac_dong;
              const bp = cb.bo_phan.map(function (r) { return ({ IPC: 'IPC', MEP: 'Cơ điện', QA: 'QA' })[r] || r; }).join(', ');
              return '<tr>' + oB(tenPhong(p, true), false, false, null, true) + oB(soVN(cb.so_su_co, 0), true, true)
                + oB((khongTD ? 'Không bộ phận nào' : esc(bp || 'Có') + ' ' + cb.co_tac_dong + '/' + cb.so_su_co) + nhoMo(esc(BDP.chuKetQua(cb))),
                    false, khongTD, khongTD ? M.doChu : M.muc)
                + oB(phanTram(p.v) + nhoMo(BDP.chuChenh(p.chenh)), true, true, mauTyLe(p.v), false, true) + '</tr>';
            }).join('') + '</tbody></table>'
          + (tdBD.canh_bao.length > SO_CANH_BAO ? ghiChu('Còn ' + (tdBD.canh_bao.length - SO_CANH_BAO) + ' phòng có cảnh báo khác trong bản in.') : '')
        : '')
      + ghiChu('<span style="color:' + M.mo + ';">Cảnh báo: sự cố của phòng được gửi thư trong giờ làm việc. Thao tác: IPC, Cơ điện hoặc QA bấm xử lý sau thư đầu; Trực hồ sơ lô chỉ điều phối nên không tính. "Tự về đạt" không có nghĩa bộ phận đã xử lý.</span>')
    : '';

  /* ===== Ai làm gì: mỗi bộ phận một dòng (yêu cầu 09/11/2026: ngắn gọn, đúng vai) =====
   * Phân vai người dùng chốt: IPC kiểm tra, xác minh tình trạng thực tế của phòng (cửa đóng mở);
   * Cơ điện điều chỉnh chênh áp phòng; Trực hồ sơ lô điều phối chung. Thư chỉ nêu ai làm gì
   * ở phòng nào; câu việc đầy đủ từng phòng (luật phân cấp) nằm trong bản in.
   * Phòng lấy từ: các phòng phải xử lý ưu tiên nhất + phòng theo dõi có chênh áp dưới ngưỡng. */
  const SO_DONG_THU = 5;
  const dsA = cap.capA_tat_ca.slice(0, SO_DONG_THU);
  const conLai = cap.capA_tong - dsA.length;
  const dsUuTien = (tdTD ? tdTD.uu_tien : []).filter(function (p) {
    return !dsA.some(function (v) { return v.ma_phong === p.ma; });
  });
  const dsPhongGoc = d.tat_ca_phong || [];
  const dongViec = dsA.concat(dsUuTien.map(function (p) {
    const v = cap.capA_tat_ca.find(function (x) { return x.ma_phong === p.ma; });
    if (v) return v;
    const g = dsPhongGoc.find(function (x) { return x.ma_phong === p.ma; }) || {};
    return { ma_phong: p.ma, ahu: g.ahu, su_co_qua_han: 0 };
  }));
  const maPhong = function (ma, nhan) {
    return '<span style="white-space:nowrap;"><b>' + esc(ma) + '</b>' + (nhan ? '&nbsp;<span style="color:' + M.doChu + ';">(' + nhan + ')</span>' : '') + '</span>';
  };
  // Cơ điện: gom phòng theo cụm xử lý không khí, vì điều chỉnh chênh áp thường làm ở cụm.
  const theoCum = {}, thuTuCum = [];
  dongViec.forEach(function (v) {
    const cum = v.ahu && v.ahu !== '—' ? v.ahu : 'Chưa rõ cụm';
    if (!theoCum[cum]) { theoCum[cum] = []; thuTuCum.push(cum); }
    theoCum[cum].push(v.ma_phong);
  });
  thuTuCum.sort(function (x, y) { return theoCum[y].length - theoCum[x].length || x.localeCompare(y, 'vi', { numeric: true }); });
  const quaHan = dongViec.filter(function (v) { return v.su_co_qua_han > 0; });
  const BP = function (ten) { return '<b style="color:' + M.dam + ';">' + ten + '</b>'; };
  const hangViec = [
    [BP('IPC') + nhoMo('Xác minh tình trạng thực tế của phòng: cửa đóng mở, thao tác trong khung giờ ngoài giới hạn.'),
      dongViec.map(function (v) { return maPhong(v.ma_phong); }).join(', ')],
    [BP('Cơ điện') + nhoMo('Điều chỉnh chênh áp phòng; kiểm cụm xử lý không khí: lọc, van gió, cài đặt chênh áp.'),
      thuTuCum.map(function (c) {
        return '<span style="white-space:nowrap;color:' + M.muc2 + ';">' + esc(c) + ':</span>&nbsp;' + theoCum[c].map(function (m) { return maPhong(m); }).join(', ');
      }).join('<br>')],
    [BP('Trực hồ sơ lô') + nhoMo(quaHan.length
        ? 'Điều phối chung; đôn đốc đóng sự cố đang mở.'
        : 'Điều phối chung các việc trên.'),
      quaHan.length ? quaHan.map(function (v) { return maPhong(v.ma_phong, soVN(v.su_co_qua_han, 0) + '&nbsp;giờ mở'); }).join(', ') : '—']
  ];
  const khoiViec = dongViec.length
    ? BANG + '<thead><tr>' + thB('Bộ phận · việc', false, true) + thB('Phòng', false, false, true) + '</tr></thead><tbody>'
      + hangViec.map(function (h) {
          return '<tr>' + oB(h[0], false, false, M.muc, true).replace('class="d', 'width="45%" class="d') + oB(h[1], false, false, M.muc, false, true) + '</tr>';
        }).join('') + '</tbody></table>'
    : '';
  const dsNgoaiKy = cap.suCoNgoaiKy || [];
  const khoiNgoaiKy = dsNgoaiKy.length
    ? ghiChu('<b>' + dsNgoaiKy.length + ' sự cố mở sau ngày chốt kỳ, tính vào kỳ sau:</b> '
      + dsNgoaiKy.map(function (x) { return esc(x.phong) + ' (' + soVN(x.keo_dai_gio, 0) + '&nbsp;giờ)'; }).join(', ') + '.')
    : '';
  const pht = ((c.nhan_dinh || {}).phat_hien || []).filter(function (f) {
    return f && f.quan_sat
      // Nhận định chỉ nhắc lại tỷ lệ chung thì đã có ở Kết luận, bỏ để khỏi lặp.
      && String(chuAI(f.quan_sat)).indexOf(phanTram(k.ty_le_tuan_thu)) < 0;
  }).slice(0, 2);
  // 09/11/2026: chỉ nêu cảnh báo (tiêu đề + quan sát từ số liệu). Không in phần "Xác minh"
  // (can_xac_minh, ai_lam, hạn) vì AI tự đoán nguyên nhân và giao việc — người dùng yêu cầu bỏ.
  const khoiNhanDinh = pht.length
    ? '<div style="margin-top:' + K[5] + 'px;">' + tieuDeNho('Cảnh báo thêm (AI tổng hợp từ số liệu, chưa kiểm chứng)')
      + pht.map(function (f) {
          return '<div style="font-size:' + CO.nho + 'px;color:' + M.muc2 + ';line-height:1.6;margin-top:' + K[2] + 'px;"><b style="color:' + M.muc + ';">' + esc(chuAI(f.tieu_de || 'Cảnh báo')) + '.</b> '
            + esc(chuAI(f.quan_sat)).replace(/\.$/, '') + '.</div>';
        }).join('') + '</div>'
    : '';

  /* ===== 4. Bộ phận có phản hồi không ================================== */
  const sc = d.su_co || {};
  // dang_mo là sự cố đang mở LÚC LẬP BÁO CÁO: tách sự cố mở trong kỳ khỏi sự cố mở sau ngày chốt kỳ.
  const soMoTrongKy = Math.max(0, (sc.dang_mo || 0) - dsNgoaiKy.length);
  // Chia cho số ngày của kỳ (sự cố vẫn phát sinh ngày mất dữ liệu), không chia cho số ngày có số đo.
  const soNgayKy = (d.tu_ngay && d.den_ngay)
    ? Math.max(1, Math.round((Date.parse(String(d.den_ngay).slice(0, 10)) - Date.parse(String(d.tu_ngay).slice(0, 10))) / 86400000) + 1)
    : Math.max(1, k.so_ngay_co_du_lieu || 1);
  const khoiPhanHoi = PH.htmlThu(PH.tongHop(d));
  const khoiSuCo = sc.mo_trong_ky != null
    ? tieuDeNho('Sự cố trong kỳ') + BANG + '<tbody>'
      + [['Phát sinh', soVN(sc.mo_trong_ky, 0) + nhoMo(soVN(sc.mo_trong_ky / soNgayKy, 1) + ' sự cố mỗi ngày')],
         ['Đã đóng', soVN(sc.dong_trong_ky, 0)],
         ['Còn mở', soVN(soMoTrongKy, 0)],
         ['Khắc phục trung bình', soVN(sc.mttr_gio, 1) + '&nbsp;giờ']
      ].map(function (x) { return '<tr>' + oB(x[0], false, false, M.muc2, true) + oB(x[1], true, true, null, false, true) + '</tr>'; }).join('')
      + '</tbody></table>'
    : '';

  /* ===== 5. Xem thêm: định nghĩa đầy đủ nằm trong bản in =============== */
  const cachDoc = [
    ['Tỷ lệ đạt toàn bộ chỉ tiêu', 'phần thời gian số đo nằm trong giới hạn, gộp chênh áp, nhiệt độ và độ ẩm của mọi phòng.'],
    ['Tỷ lệ đạt chênh áp', 'tổng điểm đo đạt chia tổng điểm đo của cả nhóm, tính cả hai phía giới hạn; khác phạm vi nên không so trực tiếp với tỷ lệ trên.'],
    ['Phòng phải xử lý', 'phòng trúng quy tắc phân cấp cố định, không do AI quyết định; phòng chưa đạt chưa chắc phải xử lý. Quy tắc đầy đủ xem trong bản in.']
  ];
  const lienKet = function (url, chu) {
    return '<a href="' + esc(url) + '" style="color:' + M.dam + ';font-weight:700;">' + chu + '</a>';
  };
  let soMuc = 0;
  const muc = function (ten) { soMuc += 1; return tieuDeMuc(soMuc + '. ' + ten); };
  const dsLienKet = ['<b>' + (c.co_pdf ? 'Bản in PDF' : 'Bản in') + ' đính kèm thư</b>: đủ phân tích từng chỉ tiêu, từng phòng và ô ký duyệt']
    .concat(c.link_dashboard ? [lienKet(c.link_dashboard, 'Bảng tra cứu') + ': lọc theo khu, cụm, xem từng ngày'] : [])
    .concat(c.link_drive ? [lienKet(c.link_drive, 'Thư mục lưu báo cáo')] : []);

  return nen('<!doctype html>\n<html lang="vi"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<meta name="color-scheme" content="light only">'
    + '<title>' + esc(c.tieu_de_email || ('Báo cáo ' + nhanKy)) + '</title>'
    /* Khối kiểu dáng CHỈ dùng cho ô bảng và màn hình hẹp; mọi thứ khác viết thẳng vào thẻ.
     * Lớp gốc khai TRƯỚC, lớp phụ khai SAU, nếu không .dp sẽ mất căn phải ở tiêu đề cột. */
    + '<style>'
    + '.d{padding:' + K[3] + 'px;border-bottom:1px solid ' + M.vien + ';font-size:' + CO.nho + 'px;vertical-align:top;line-height:1.45;}'
    + '.h{padding:' + K[2] + 'px ' + K[3] + 'px;color:' + M.muc2 + ';font-size:' + CO.nho + 'px;font-weight:600;text-align:left;vertical-align:bottom;border-bottom:1px solid ' + M.muc2 + ';}'
    + '.dl{padding-left:0;}.dr{padding-right:0;}.dp{text-align:right;}'
    + '@media only screen and (max-width:660px){'
    + '.cot{display:block !important;width:auto !important;padding:0 0 ' + K[5] + 'px !important;}'
    + '.pad{padding:' + K[5] + 'px ' + K[4] + 'px !important;}'
    + '.d,.h{padding-left:' + K[2] + 'px !important;padding-right:' + K[2] + 'px !important;}'
    + '.dl{padding-left:0 !important;}.dr{padding-right:0 !important;}}</style>'
    + '</head><body style="margin:0;padding:0;background:' + M.ngoai + ';">'

    + '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">'
    + (dat ? 'Đạt' : 'Chưa đạt') + ' · tỷ lệ đạt toàn bộ chỉ tiêu ' + phanTram(k.ty_le_tuan_thu) + ' · '
    + cap.capA_tong + ' phòng phải xử lý</div>'

    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:'
    + M.ngoai + ';"><tr><td align="center" class="ngoai" style="padding:' + K[5] + 'px ' + K[3] + 'px;">'
    /* Khung tối đa 987px (số Fibonacci, gần mức 1000px đã góp ý 04/09/2026 vì cột chữ bị bó trên máy tính). */
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"'
    + ' style="width:100%;max-width:987px;font-family:' + F + ';color:' + M.muc + ';">'

    + '<tr><td class="pad" style="background:' + M.dam + ';padding:' + LE_DOC + 'px ' + LE_NGANG + 'px;">'
    + '<div style="font-size:' + CO.muc + 'px;line-height:1.3;color:#ffffff;font-weight:700;">Báo cáo môi trường phòng sạch</div>'
    + '<div style="font-size:' + CO.nho + 'px;color:#DCE4EE;margin-top:' + K[2] + 'px;line-height:1.5;">' + esc(nhanKy) + ' · '
    + ngayDai(d.tu_ngay) + ' – ' + ngayDai(d.den_ngay) + ' · ' + esc(khuBC ? 'Khu ' + khuBC : 'Toàn nhà máy') + '</div></td></tr>'

    + hang(muc('Kết luận') + khoiKetLuan)

    + (khoiBienDong ? hang(muc('Phòng theo dõi so với ' + tdBD.ten_ky_truoc) + khoiBienDong) : '')

    + (khoiCanhBao ? hang(muc('Cảnh báo và tác động tại phòng theo dõi') + khoiCanhBao) : '')

    + hang(muc('Ai làm gì')
        + (dongViec.length
            ? '<div style="font-size:' + CO.than + 'px;line-height:1.6;color:' + M.muc + ';margin-bottom:' + K[3] + 'px;"><b>' + cap.capA_tong + ' phòng phải xử lý.</b> Việc cho '
              + dsA.length + ' phòng ưu tiên nhất' + (dsUuTien.length ? ' và ' + dsUuTien.length + ' phòng theo dõi dưới ' + ttTD.nguong_uu_tien + '%' : '')
              + (conLai > 0 ? '; còn lại trong bản in.' : '.') + '</div>' + khoiViec
            : '<div style="font-size:' + CO.than + 'px;line-height:1.6;color:' + M.muc + ';">Kỳ này không có phòng nào phải xử lý ngay.</div>')
        + khoiNgoaiKy + khoiNhanDinh)

    + ((khoiPhanHoi || khoiSuCo) ? hang(muc('Bộ phận có phản hồi không') + haiCot(khoiPhanHoi, khoiSuCo)) : '')

    + '<tr><td class="pad" style="background:' + M.nen + ';border:1px solid ' + M.vien + ';padding:' + LE_DOC + 'px ' + LE_NGANG + 'px;">'
    + muc('Xem thêm')
    + dsLienKet.map(function (x) { return '<div style="font-size:' + CO.nho + 'px;color:' + M.muc2 + ';line-height:1.6;">' + x + '</div>'; }).join('')
    + cachDoc.map(function (x) { return ghiChu('<b>' + x[0] + ':</b> ' + x[1]); }).join('')
    + '<div style="font-size:' + CO.nho + 'px;color:' + M.mo + ';line-height:1.6;margin-top:' + K[4] + 'px;">Lập ngày ' + esc(c.tao_luc || ngayDai(d.tao_luc))
    + ' · ' + (k.so_ngay_co_du_lieu || 0) + ' ngày có số đo · mã lần chạy ' + esc(c.ma_lan_chay || '—')
    + '. Thư tự động, vui lòng không trả lời.</div></td></tr>'

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
