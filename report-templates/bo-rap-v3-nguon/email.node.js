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
const PTD = require('./chenh-ap-phong-theo-doi.js');
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
  const tenKy = dich(L.TEN_KY, String(d.ky).toUpperCase(), String(d.ky).toLowerCase());
  // Nhãn kỳ ở dòng đầu thư để nhận diện ngay: "tháng 08/2026", "tuần 36/2026"...
  // n8n truyền sẵn cfg.nhan_ky; chạy thử tại chỗ không có thì suy từ ngày cuối kỳ
  // (tháng, quý) hoặc ghi hai mốc ngày (tuần, kỳ tuỳ chọn).
  const nhanKy = c.nhan_ky || (function () {
    const den = String(d.den_ngay || ''), nam = den.slice(0, 4), thang = den.slice(5, 7);
    const ma = String(d.ky || '').toUpperCase();
    if (ma === 'THANG' && nam && thang) return 'tháng ' + thang + '/' + nam;
    if (ma === 'QUY' && nam && thang) return 'quý ' + Math.ceil(Number(thang) / 3) + '/' + nam;
    return tenKy + ' ' + ngayDai(d.tu_ngay) + ' – ' + ngayDai(d.den_ngay);
  })();
  const gioDoDuoc = (d.do_tin_cay_du_lieu && d.do_tin_cay_du_lieu.gio_co_du_lieu)
    || (ht && ht.gio_co_du_lieu) || 0;
  // Tỉ lệ thời gian ngoài giới hạn trên tổng số giờ thực sự đo được của toàn nhà máy.
  const pNghiem = gioDoDuoc ? 100 * (k.so_gio_critical || 0) / gioDoDuoc : null;
  // "Trong ngưỡng" (ty_le_tuan_thu) tính theo PHÚT: 100 trừ trung bình tỉ lệ phút ngoài dải của
  // từng giờ cảm biến. Phần bù của nó là "ngoài dải" — hai số này cộng đúng 100%. Còn
  // so_gio_critical là SỐ GIỜ cảm biến bị dán nhãn nghiêm trọng (vượt giới hạn hành động dù chỉ
  // vài phút) — đơn vị khác, không cộng với tỉ lệ theo phút (góp ý 04/09/2026).
  const pNgoaiDai = k.ty_le_tuan_thu == null ? null : Math.max(0, 100 - Number(k.ty_le_tuan_thu));
  // Kỳ trước không kèm số giờ đo được nên không dựng được tỉ lệ tương ứng để so.
  // Chỉ so được mức tăng giảm của chính số giờ — phải nói rõ là "về số giờ".
  const dGioNghiem = kt.so_gio_critical
    ? 100 * ((k.so_gio_critical || 0) - kt.so_gio_critical) / kt.so_gio_critical : null;
  const dat = (k.ty_le_tuan_thu || 0) >= NGUONG_HANH_DONG && !cap.capA_tong;

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
          return esc(x.phong) + ' (số ' + x.ma_su_co + ', mở ' + L.gioVietNam(x.bat_dau, true) + ', đã '   // ngày VN (rà soát 04/09/2026)
            + soVN(x.keo_dai_gio, 0) + ' giờ)';
        }).join('; ')
      + '. Không tính vào kết quả kỳ này — sẽ vào báo cáo kỳ sau.</div></div>'
    : '';

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
  // dang_mo là vé đang mở LÚC LẬP BÁO CÁO, không phải tồn cuối kỳ: kỳ 08 chạy ngày 03/09 thì cả
  // bốn vé đều mở từ tháng 09. Tách vé mở trong kỳ khỏi vé mở sau ngày chốt kỳ (rà soát 04/09/2026).
  const soNgoaiKyMo = (cap.suCoNgoaiKy || []).length;
  const soMoTrongKy = Math.max(0, (sc.dang_mo || 0) - soNgoaiKyMo);
  // Chia cho số ngày của kỳ (vé vẫn phát sinh ngày mất dữ liệu), không chia cho số ngày có số đo (rà soát 04/09/2026)
  const soNgayKy = (d.tu_ngay && d.den_ngay)
    ? Math.max(1, Math.round((Date.parse(String(d.den_ngay).slice(0, 10)) - Date.parse(String(d.tu_ngay).slice(0, 10))) / 86400000) + 1)
    : Math.max(1, k.so_ngay_co_du_lieu || 1);
  // Chênh áp tại các phòng theo dõi trọng điểm, ba kỳ — thư chỉ hiện phần tổng hợp,
  // bảng từng phòng nằm trong bản in (yêu cầu 21/10/2026).
  const khoiPhongTheoDoi = PTD.htmlThu(PTD.tongHop(d, khuBC));

  const khoiSuCo = (laThang && sc.mo_trong_ky != null)
    ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="co"><tr>'
      + oChiSo('Sự cố phát sinh trong kỳ', soVN(sc.mo_trong_ky, 0),
          'trung bình ' + soVN(sc.mo_trong_ky / soNgayKy, 1) + ' vé mỗi ngày của kỳ (' + soNgayKy + ' ngày)')
      + DEM
      + oChiSo('Đã đóng trong kỳ', soVN(sc.dong_trong_ky, 0),
          (sc.dong_trong_ky >= sc.mo_trong_ky
            ? 'đóng kịp số phát sinh' : 'ít hơn số phát sinh '
              + soVN(sc.mo_trong_ky - sc.dong_trong_ky, 0) + ' vé'),
          sc.dong_trong_ky >= sc.mo_trong_ky ? M.luc : M.doChu)
      + '</tr><tr><td colspan="3" style="height:12px;font-size:0;">&nbsp;</td></tr><tr>'
      // Không còn ô "Còn tồn cuối kỳ": số đó không có trong dữ liệu (rà soát 04/09/2026)
      + (soMoTrongKy
          ? oChiSo('Còn mở lúc lập báo cáo', soVN(soMoTrongKy, 0),
              'vé mở trong kỳ, tới lúc lập báo cáo vẫn chưa đóng', M.doChu)
          : oChiSo('Vé mở trong kỳ còn treo', '0',
              'không có vé nào mở trong kỳ mà tới lúc lập báo cáo vẫn chưa đóng', M.luc))
      + DEM
      + oChiSo('Thời gian khắc phục trung bình', soVN(sc.mttr_gio, 1) + '&nbsp;giờ',
          'tính trên các vé đã đóng trong kỳ')
      + '</tr></table>'
      + '<div style="font-size:13px;color:' + M.mo + ';margin-top:12px;line-height:1.55;">'
      + (soNgoaiKyMo
          ? soNgoaiKyMo + ' sự cố đang mở lúc lập báo cáo, đều mở sau ngày chốt kỳ — không thuộc kỳ này. '
          : '')
      + 'Số phát sinh và đã đóng là của cả kỳ; số còn mở đo tại lúc lập báo cáo.</div>'
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

  // Ô "Giờ vượt giới hạn hành động": số giờ to, tỉ lệ trên số giờ có số đo ghi nhỏ bên dưới —
  // ghi rõ "số giờ" để không ai cộng nó với tỉ lệ theo phút ở hai cột bên trái.
  function oGioVuot(gio, pct) {
    // &nbsp; để số không tách khỏi đơn vị khi ô được phép xuống dòng (rà soát 04/09/2026)
    return soVN(gio || 0, 0) + '&nbsp;giờ'
      + '<div style="font-size:12px;font-weight:400;color:' + M.mo + ';line-height:1.3;">'
      + (pct == null ? '—' : phanTram(pct) + '&nbsp;số&nbsp;giờ') + '</div>';
  }

  const khoiBangKhu =
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"'
    + ' style="border-collapse:collapse;"><thead><tr>'
    + thB('Khu', false, true) + thB('Phòng đạt', true)
    + thB('Trong ngưỡng', true) + thB('Ngoài dải', true) + thB('Giờ vượt giới hạn hành động', true)
    + thB('Phòng phải xử lý', true, false, true)
    + '</tr></thead><tbody>'
    // Số giờ cộng dồn của một khu không so được với khu khác (mỗi khu số phòng khác nhau),
    // nên con số chính là TỈ LỆ trên giờ đo được của chính khu; số giờ chỉ ghi nhỏ bên dưới
    // để đối chiếu với bản in. Cột cuối ghi n/tổng cho rõ đó là số PHÒNG (góp ý 04/09/2026).
    + cay.map(function (x, i) {
        const dsK = cap.capA_tat_ca.filter(function (v) { return v.khu === x.khu; });
        const nen = i % 2 ? ' background:' + M.nen + ';' : '';
        const duoi = x.ty_le_tb != null && x.ty_le_tb < NGUONG_HANH_DONG;
        const pNgoai = x.gio_do ? 100 * (x.gio_nghiem_trong || 0) / x.gio_do : null;
        return '<tr style="' + nen + '">'
          + oB('Khu ' + esc(x.khu), false, true, null, true)
          + oB(x.so_phong_dat + '/' + x.so_phong, true, true, duoi ? M.doChu : M.luc)
          + oB(phanTram(x.ty_le_tb), true, true, duoi ? M.doChu : M.luc)
          + oB(x.ty_le_tb == null ? '—' : phanTram(100 - x.ty_le_tb), true, true, duoi ? M.doChu : M.luc)
          + oB(oGioVuot(x.gio_nghiem_trong, pNgoai), true, false,
               pNgoai != null && pNgoai > 20 ? M.doChu : M.muc)
          + oB(dsK.length + '/' + x.so_phong, true, true, dsK.length ? M.doChu : M.luc, false, true)
          + '</tr>';
      }).join('')
    + '<tr style="background:' + M.nen + ';border-top:2px solid ' + M.muc2 + ';">'
    +   oB(tenTong, false, true, null, true)
    +   oB((k.tong_phong_co_du_lieu - k.so_phong_khong_dat) + '/' + k.tong_phong_co_du_lieu, true, true)
    +   oB(phanTram(k.ty_le_tuan_thu), true, true,
           k.ty_le_tuan_thu < NGUONG_HANH_DONG ? M.doChu : M.luc)
    +   oB(pNgoaiDai == null ? '—' : phanTram(pNgoaiDai), true, true,
           k.ty_le_tuan_thu < NGUONG_HANH_DONG ? M.doChu : M.luc)
    +   oB(oGioVuot(k.so_gio_critical, pNghiem), true, false,
           pNghiem != null && pNghiem > 20 ? M.doChu : M.muc)
    +   oB(cap.capA_tong + '/' + k.tong_phong_co_du_lieu, true, true,
           cap.capA_tong ? M.doChu : M.luc, false, true)
    + '</tr>'
    + '<tr style="background:' + M.muc + ';">'
    +   '<td colspan="6" style="padding:' + LE_O + 'px ' + K[3] + 'px;font-size:13px;color:#C7D2E0;'
    +   'line-height:1.55;">'
    +   '<b style="color:#ffffff;">Trong ngưỡng</b> và <b style="color:#ffffff;">Ngoài dải</b>: phần '
    +   'thời gian (tính theo phút) số đo nằm trong hoặc ra ngoài dải cho phép — hai cột cộng đúng 100%. '
    +   '<b style="color:#ffffff;">Giờ vượt giới hạn hành động</b>: số giờ cảm biến có lúc vượt giới hạn '
    +   'hành động (một giờ chỉ vượt vài phút vẫn tính trọn giờ), cộng dồn các phòng trong khu; tỉ lệ nhỏ '
    +   'bên dưới tính trên số giờ có số đo — đơn vị khác hai cột trước nên không cộng với nhau. '
    +   '<b style="color:#ffffff;">Phòng phải xử lý</b>: phòng có sự cố mở quá hạn, hoặc thời gian '
    // Luật A3 nay theo tỉ lệ trên giờ có số đo của phòng (rà soát 04/09/2026, đợt 2)
    +   'trong ngưỡng thiếu hụt so với mức ' + NGUONG_HANH_DONG + '%, hoặc từ ' + L.TI_LE_GIO_VUOT_A
    +   '% số giờ có số đo trở lên vượt giới hạn hành động — danh sách ở mục "Việc phải xử lý".'
    +   '</td></tr></tbody></table>';

  /* ===== So với bốn kỳ trước ===========================================
   * Người đọc muốn biết có tiến bộ hay không (góp ý 04/09/2026). Bảng 5 dòng,
   * cũ → mới, cột toàn nhà máy và từng khu; mỗi số kèm mũi tên so với kỳ liền
   * trước; câu kết luận rút thẳng từ dãy số.
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
    const mauSo = function (v) {
      return v == null ? M.mo : (v >= NGUONG_HANH_DONG ? M.luc : (v >= NGUONG_HANH_DONG - 10 ? M.vang : M.doChu));
    };
    const o = function (v, truoc, dam) {
      const muiTen = (v != null && truoc != null && v !== truoc)
        ? '<span style="font-size:11px;color:' + (v > truoc ? M.luc : M.doChu) + ';">&nbsp;'
          + (v > truoc ? '▲' : '▼') + '</span>' : '';
      return '<td class="d dp" style="font-weight:' + (dam ? 700 : 500) + ';color:' + mauSo(v)
        + ';white-space:nowrap;">' + (v == null ? '—' : phanTram(v)) + muiTen + '</td>';
    };
    const dong = lichSu.map(function (x, i) {
      const tr = i > 0 ? lichSu[i - 1] : null;
      return '<tr style="' + (x.la_ky_nay ? 'background:' + M.nen + ';' : '') + '">'
        + '<td class="d dl" style="font-weight:' + (x.la_ky_nay ? 700 : 500) + ';color:' + M.muc
        +   ';white-space:nowrap;">' + esc(x.nhan) + (x.la_ky_nay ? ' <span style="font-size:11px;color:'
        +   M.mo + ';">kỳ này</span>' : '') + '</td>'
        + (coTong ? o(x.ty_le, tr ? tr.ty_le : null, true) : '')
        + dsKhu.map(function (k) {
            return o(x.khu[k] == null ? null : Number(x.khu[k]), tr && tr.khu[k] != null ? Number(tr.khu[k]) : null, !coTong);
          }).join('')
        + '</tr>';
    }).join('');
    if (!coTong && !dsKhu.length) return '';
    return '<div style="font-size:15px;color:' + M.muc2 + ';line-height:1.6;margin:-4px 0 12px;">'
      +   'Tỉ lệ <b>thời gian trong ngưỡng</b> của năm kỳ gần nhất, càng cao càng tốt; mức phải đạt '
      +   NGUONG_HANH_DONG + '%. Mũi tên so với kỳ liền trước.</div>'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">'
      + '<thead><tr>' + thB('Kỳ', false, true) + (coTong ? thB('Toàn nhà máy', true, false, !dsKhu.length) : '')
      + dsKhu.map(function (k, i) { return thB('Khu ' + k, true, false, i === dsKhu.length - 1); }).join('')
      + '</tr></thead><tbody>' + dong + '</tbody></table>'
      + (xh ? '<div style="font-size:15px;font-weight:700;color:' + (xh.huong === 'tot' ? M.luc : (xh.huong === 'xau' ? M.doChu : M.muc2))
          + ';margin-top:10px;line-height:1.5;">' + esc(xh.chu) + '</div>' : '')
      + (lichSu.some(function (x) { return x.ty_le == null; })
          ? '<div style="font-size:13px;color:' + M.mo + ';margin-top:6px;">Kỳ ghi "—" là kỳ chưa có số liệu trong hệ thống.</div>' : '');
  })();

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

  // Khu không có số liệu (null) không phải khu 0% — đẩy xuống cuối (rà soát 04/09/2026)
  const khuXep = cay.slice().sort(function (a, b) {
    return (a.ty_le_tb == null ? 999 : a.ty_le_tb) - (b.ty_le_tb == null ? 999 : b.ty_le_tb);
  });
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
    ? '<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;">'
      + '<tr><td style="background:' + M.nhan + ';border-radius:8px;">'
      + '<a href="' + esc(c.link_dashboard) + '" style="display:inline-block;padding:14px 26px;'
      + 'font-family:' + F + ';font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">'
      + 'Mở bảng tra cứu &nbsp;→</a></td></tr></table>'
    : '';

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
    + '.d{padding:12px;border-bottom:1px solid ' + M.vien2 + ';font-size:14px;'
    + 'vertical-align:top;line-height:1.45;}'
    // Tiêu đề cột và ô số ĐƯỢC xuống dòng: sáu cột nowrap trên màn 360px là bảng tràn khung.
    // Số và đơn vị nối bằng &nbsp; nên không bị tách (rà soát 04/09/2026).
    + '.h{padding:12px;background:' + M.muc + ';color:#ffffff;font-size:12px;font-weight:700;'
    + 'letter-spacing:.04em;text-align:left;}'
    + '.dl{padding-left:0;}.dr{padding-right:0;}.dp{text-align:right;}'
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
    /* Bề rộng: chuẩn an toàn của thư điện tử là 600–640px; bản đầu chọn 720px.
       Người dùng xem trên máy tính thấy cột chữ bị bó ở giữa màn hình (góp ý
       04/09/2026) nên nới lên 1000px: bảng và biểu đồ thoáng hơn, đoạn văn vẫn đọc
       được. Không trải hết màn hình vì dòng chữ quá dài khó bắt dòng kế, và Gmail
       máy tính tự giới hạn khung đọc nên 100% cũng không rộng hơn bao nhiêu.
       Điện thoại không đổi: dưới 660px khung co theo màn hình (xem @media). */
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"'
    + ' style="width:100%;max-width:1000px;font-family:' + F + ';color:' + M.muc + ';">'

    /* ── Dải đầu thư ── */
    + '<tr><td class="pad" style="background:' + M.dam + ';border-radius:14px 14px 0 0;padding:26px 32px;">'
    + '<div style="font-size:12px;letter-spacing:.11em;text-transform:uppercase;color:#93A4B8;'
    + 'font-weight:700;">Giám sát môi trường phòng sạch</div>'
    + '<div style="font-size:26px;line-height:1.3;color:#ffffff;font-weight:700;margin-top:8px;'
    + 'letter-spacing:-.02em;">Báo cáo ' + esc(nhanKy) + '</div>'
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
        + oChiSo('Thời gian ngoài dải cho phép',
            pNgoaiDai != null ? phanTram(pNgoaiDai) : '—',
            // Dòng này chỉ nói lại con số lớn bằng lời, không thêm số mới.
            pNgoaiDai == null ? ''
              : (Math.round(pNgoaiDai) < 1
                  ? 'Gần như toàn bộ thời gian đo nằm trong dải cho phép.'
                  : 'Cứ 100 phút đo được thì có ' + Math.round(pNgoaiDai)
                    + ' phút ngoài dải. Cộng với ' + phanTram(k.ty_le_tuan_thu) + ' trong ngưỡng là đủ 100%.'),
            pNgoaiDai != null && pNgoaiDai > 100 - NGUONG_HANH_DONG ? M.do : M.muc,
            // Giờ dán nhãn không phải tập con của số phút ngoài dải — không nói "trong đó" (rà soát 04/09/2026)
            'Tính riêng theo giờ: ' + soVN(k.so_gio_critical || 0, 0) + ' giờ cảm biến có lúc vượt giới hạn hành động'
              + (pNghiem != null ? ' (' + phanTram(pNghiem) + ' số giờ có số đo)' : '')
              + ((k.so_gio_warning || 0) > 0 ? ' và ' + soVN(k.so_gio_warning, 0) + ' giờ ở mức cảnh báo' : '') + '.'
              + (kt.so_gio_critical != null
                  ? ' Kỳ trước ' + soVN(kt.so_gio_critical, 0) + ' giờ vượt giới hạn, kỳ này '
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

    /* ── So với bốn kỳ trước ── */
    + (khoiLichSu ? hang(nhanMuc('So với bốn kỳ trước') + khoiLichSu) : '')

    /* ── Việc phải xử lý ── */
    + hang(nhanMuc('Việc phải xử lý trong kỳ này', M.do)
        + (dongA
            ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + dongA + '</table>'
              + (conLai > 0
                  ? '<div style="font-size:14px;color:' + M.mo + ';padding-top:2px;">Còn ' + conLai
                    + ' phòng nữa cùng mức, xem đầy đủ trong tệp đính kèm.</div>' : '')
            : '<div style="font-size:15px;color:' + M.muc2 + ';">Kỳ này không có phòng nào phải xử lý ngay.</div>')
        + (cap.suCoNgoaiKy && cap.suCoNgoaiKy.length ? khoiNgoaiKy : ''))

    /* Thư chỉ giữ phần TỔNG HỢP (yêu cầu 21/10/2026). Diễn biến theo ngày, bảng ba chỉ
     * tiêu, phân tích chênh áp / nhiệt độ / độ ẩm theo khu, danh sách phòng xấu đi và
     * mức tin cậy số đo nằm trong bản in đính kèm (mục 1, 3–7). */

    /* ── Tổng hợp cả kỳ theo ba khu ── */
    + (khuBC ? '' : hang(nhanMuc('Tổng hợp cả kỳ · ba khu') + khoiBangKhu))

    /* ── Chênh áp tại các phòng theo dõi trọng điểm, ba kỳ ── */
    + (khoiPhongTheoDoi ? hang(nhanMuc('Chênh áp tại các phòng theo dõi trọng điểm') + khoiPhongTheoDoi) : '')

    /* ── Xử lý sự cố trong kỳ (chỉ kỳ tháng) ── */
    + (khoiSuCo ? hang(nhanMuc('Xử lý sự cố trong kỳ') + khoiSuCo) : '')

    /* ── Nhận định ── */
    + (khoiNhanDinh ? hang(nhanMuc('Nhận định') + khoiNhanDinh) : '')

    /* ── Dự báo ── */
    + hang(nhanMuc('Dự báo kỳ sau') + khoiDuBao)

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
        +     'Mở thẳng trong trình duyệt, không phải tải về.</div>'
        // Nút đặt ngay trong ô "Xem trên Drive" cho đúng chỗ (góp ý 04/09/2026), không để rời bên dưới.
        +     nut + '</td></tr></table>')

    /* ── Chân thư ── */
    + '<tr><td class="pad" style="background:' + M.nen + ';border:1px solid ' + M.vien + ';'
    + 'border-radius:0 0 14px 14px;padding:' + LE_DOC + 'px ' + LE_NGANG + 'px;font-size:13px;color:' + M.mo + ';line-height:1.7;">'
    + 'Nguồn số liệu: ' + esc(d.nguon || 'rpc_bao_cao_tong_hop') + ' (' + esc(d.ky) + ', '
    + ngayDai(d.tu_ngay) + ' – ' + ngayDai(d.den_ngay) + ') · mã lần chạy ' + esc(c.ma_lan_chay || '—')   // rà soát 04/09/2026
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
