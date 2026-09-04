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

// Một phòng, hai thanh so sánh kỳ trước / kỳ này trên cùng thang 0–100%, cùng vạch
// ngưỡng. Số đứng ngay bên phải thanh của nó nên không cần chú thích "kỳ trước x%".
function dongSoSanh(ten, truoc, nay, khu) {
  const thanhNho = function (nhan, pct, mau, mauChu, dam) {
    return '<tr>'
      + '<td width="64" style="width:64px;padding:2px 8px 2px 0;font-size:12px;color:' + M.mo
      +   ';white-space:nowrap;vertical-align:middle;">' + nhan + '</td>'
      + '<td style="padding:2px 0;vertical-align:middle;">' + thanh(pct, mau, NGUONG_HANH_DONG, 10) + '</td>'
      + '<td width="56" style="width:56px;padding:2px 0 2px 8px;text-align:right;vertical-align:middle;'
      +   'font-size:' + (dam ? 15 : 13) + 'px;font-weight:700;color:' + mauChu + ';white-space:nowrap;">'
      +   (pct == null ? '—' : phanTram(pct)) + '</td>'
      + '</tr>';
  };
  return '<tr>'
    + '<td width="30%" style="padding:10px 12px 10px 0;vertical-align:middle;border-bottom:1px solid '
    +   M.vien2 + ';">'
    +   '<div style="font-size:15px;font-weight:700;color:' + M.muc + ';line-height:1.35;">' + esc(ten) + '</div>'
    +   (khu ? '<div style="font-size:12px;color:' + M.mo + ';margin-top:2px;">Khu ' + esc(khu) + '</div>' : '')
    + '</td>'
    + '<td style="padding:8px 0;vertical-align:middle;border-bottom:1px solid ' + M.vien2 + ';">'
    +   '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">'
    +   thanhNho('kỳ trước', truoc, '#9AA6B5', M.muc2, false)
    +   thanhNho('kỳ này', nay, M.do, M.doChu, true)
    +   '</table>'
    + '</td>'
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
    // Chữ đỏ trên nền trắng dùng tông đậm hơn thanh (#DC2626 chỉ đạt 4,41:1).
    const mauDuoiChu = mauDuoi === M.do ? M.doChu : mauDuoi;
    const mauTrenChu = mauTren === M.do ? M.doChu : mauTren;

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
    // Chú thích là dòng đầu của chính bảng khu, chiếm đúng ba cột "số trái · thanh · số phải",
    // để mũi tên nằm ngay trên phía thanh sẽ mọc ra. Trước đây nó là bảng riêng trải hết
    // bề ngang nên mũi tên lệch khỏi thanh.
    const chuThich = hai
      ? '<tr><td width="26%"></td><td colspan="3" style="padding:0 0 4px;">'
        + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
        + '<td style="font-size:12px;color:' + mauDuoiChu + ';font-weight:700;">'
        +   '← tụt dưới giới hạn dưới</td>'
        + '<td style="font-size:12px;color:' + mauTrenChu + ';font-weight:700;text-align:right;">'
        +   'vượt trên giới hạn trên →</td></tr></table></td></tr>'
      : '';

    // Mỗi khu một dòng: tên · SỐ TRÁI · thanh hai hướng · SỐ PHẢI. Hai con số đứng đúng
    // bên thanh của nó, cùng màu với thanh — người đọc không phải dò xem "39,3% · 23,6%"
    // số nào thuộc phía nào (góp ý 04/09/2026).
    const hang = bang(chuThich + dsKhu.map(function (x) {
      const pd = x.tong_gio_do ? 100 * (x.tong_gio_duoi || 0) / x.tong_gio_do : 0;
      const pt = x.tong_gio_do ? 100 * (x.tong_gio_tren || 0) / x.tong_gio_do : 0;
      const p1 = x.tong_gio_do ? 100 * (x.tong_gio_lech || 0) / x.tong_gio_do : 0;
      const oSo = function (chu, mau, benTrai) {
        return '<td width="56" style="width:56px;padding:8px ' + (benTrai ? '6px 8px 0' : '0 8px 6px')
          + ';text-align:' + (benTrai ? 'right' : 'left') + ';vertical-align:middle;'
          + 'font-size:13px;font-weight:700;white-space:nowrap;color:' + mau + ';">' + chu + '</td>';
      };
      return '<tr>'
        + '<td width="26%" style="padding:8px 12px 8px 0;vertical-align:middle;">'
        +   '<div style="font-size:15px;font-weight:700;color:' + M.muc + ';line-height:1.35;">'
        +   'Khu ' + esc(x.khu) + '</div>'
        +   '<div style="font-size:12px;color:' + M.mo + ';margin-top:2px;line-height:1.4;">'
        +   x.so_phong_dat + '/' + x.so_phong + ' phòng đạt ' + tenNgan + '</div></td>'
        + (hai
            ? oSo(phanTram(pd), mauDuoiChu, true)
              + '<td style="padding:8px 0;vertical-align:middle;">'
              +   thanhHaiHuong(pd, pt, thang, mauDuoi, mauTren) + '</td>'
              + oSo(phanTram(pt), mauTrenChu, false)
            : '<td style="padding:8px 12px 8px 0;vertical-align:middle;">'
              +   thanh(Math.min(100, 100 * p1 / thang), mauChinh) + '</td>'
              + '<td width="72" style="width:72px;padding:8px 0;text-align:right;vertical-align:middle;'
              +   'font-size:13px;white-space:nowrap;color:' + M.doChu + ';font-weight:700;">'
              +   phanTram(p1) + '</td>')
        + '</tr>';
    }).join(''));

    return the + '<div style="margin-top:16px;">' + hang
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

  // Ô "Ngoài giới hạn": tỉ lệ to, số giờ nhỏ bên dưới. Không có giờ đo thì ghi "—".
  function oGioNgoai(pct, gio) {
    return (pct == null ? '—' : phanTram(pct))
      + '<div style="font-size:12px;font-weight:400;color:' + M.mo + ';line-height:1.3;">'
      + soVN(gio || 0, 0) + ' giờ</div>';
  }

  const khoiBangKhu =
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"'
    + ' style="border-collapse:collapse;"><thead><tr>'
    + thB('Khu', false, true) + thB('Phòng đạt', true)
    + thB('Trong ngưỡng', true) + thB('Ngoài giới hạn', true)
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
          + oB(oGioNgoai(pNgoai, x.gio_nghiem_trong), true, true,
               pNgoai != null && pNgoai > 20 ? M.doChu : M.muc)
          + oB(dsK.length + '/' + x.so_phong, true, true, dsK.length ? M.doChu : M.luc, false, true)
          + '</tr>';
      }).join('')
    + '<tr style="background:' + M.nen + ';border-top:2px solid ' + M.muc2 + ';">'
    +   oB('Toàn nhà máy', false, true, null, true)
    +   oB((k.tong_phong_co_du_lieu - k.so_phong_khong_dat) + '/' + k.tong_phong_co_du_lieu, true, true)
    +   oB(phanTram(k.ty_le_tuan_thu), true, true,
           k.ty_le_tuan_thu < NGUONG_HANH_DONG ? M.doChu : M.luc)
    +   oB(oGioNgoai(pNghiem, k.so_gio_critical), true, true,
           pNghiem != null && pNghiem > 20 ? M.doChu : M.muc)
    +   oB(cap.capA_tong + '/' + k.tong_phong_co_du_lieu, true, true,
           cap.capA_tong ? M.doChu : M.luc, false, true)
    + '</tr>'
    + '<tr style="background:' + M.muc + ';">'
    +   '<td colspan="5" style="padding:' + LE_O + 'px ' + K[3] + 'px;font-size:13px;color:#C7D2E0;'
    +   'line-height:1.55;">'
    +   '<b style="color:#ffffff;">Trong ngưỡng</b>: phần thời gian số đo nằm trong dải cho phép, '
    +   'tính trên giờ đo được của khu. '
    +   '<b style="color:#ffffff;">Ngoài giới hạn</b>: phần thời gian số đo vượt giới hạn hành động; '
    +   'số giờ ghi nhỏ bên dưới. '
    +   '<b style="color:#ffffff;">Phòng phải xử lý</b>: phòng có sự cố mở quá hạn, hoặc thời gian '
    +   'trong ngưỡng thiếu hụt so với mức ' + NGUONG_HANH_DONG + '%, hoặc từ ' + L.GIO_NGHIEM_TRONG_A
    +   ' giờ trở lên ngoài giới hạn — danh sách ở mục "Việc phải xử lý".'
    +   '</td></tr></tbody></table>';

  /* ===== So với bốn kỳ trước ===========================================
   * Người đọc muốn biết có tiến bộ hay không (góp ý 04/09/2026). Bảng 5 dòng,
   * cũ → mới, cột toàn nhà máy và từng khu; mỗi số kèm mũi tên so với kỳ liền
   * trước; câu kết luận rút thẳng từ dãy số.
   * ================================================================== */
  const lichSu = L.chuanHoaLichSu(d);
  const khoiLichSu = (function () {
    if (!lichSu) return '';
    const dsKhu = ['C1', 'C4', 'Q2'].filter(function (k) {
      return lichSu.some(function (x) { return x.khu && x.khu[k] != null; });
    });
    const xh = L.xuHuongLichSu(lichSu);
    const mauSo = function (v) {
      return v == null ? M.mo : (v >= NGUONG_HANH_DONG ? M.luc : (v >= NGUONG_HANH_DONG - 10 ? M.vang : M.doChu));
    };
    const o = function (v, truoc, dam) {
      const muiTen = (v != null && truoc != null && v !== truoc)
        ? '<span style="font-size:11px;color:' + (v > truoc ? M.luc : M.doChu) + ';"> '
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
        + o(x.ty_le, tr ? tr.ty_le : null, true)
        + dsKhu.map(function (k) {
            return o(x.khu[k] == null ? null : Number(x.khu[k]), tr && tr.khu[k] != null ? Number(tr.khu[k]) : null, false);
          }).join('')
        + '</tr>';
    }).join('');
    return '<div style="font-size:15px;color:' + M.muc2 + ';line-height:1.6;margin:-4px 0 12px;">'
      +   'Tỉ lệ <b>thời gian trong ngưỡng</b> của năm kỳ gần nhất, càng cao càng tốt; mức phải đạt '
      +   NGUONG_HANH_DONG + '%. Mũi tên so với kỳ liền trước.</div>'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">'
      + '<thead><tr>' + thB('Kỳ', false, true) + thB('Toàn nhà máy', true)
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
    + '<title>' + esc(c.tieu_de_email || ('Báo cáo ' + nhanKy)) + '</title>'
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
        + oChiSo('Thời gian ngoài giới hạn',
            pNghiem != null ? phanTram(pNghiem) : soVN(k.so_gio_critical || 0, 0) + ' giờ',
            // Dòng này chỉ nói lại con số lớn bằng lời, không thêm số mới.
            pNghiem == null ? ''
              : (Math.round(pNghiem) < 1
                  ? 'Gần như không có giờ nào ngoài giới hạn.'
                  : 'Cứ 100 giờ đo được thì có ' + Math.round(pNghiem)
                    + ' giờ ngoài giới hạn.'),
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

    /* ── Xấu đi so kỳ trước ──
     * Bản cũ mỗi phòng một thanh + chữ nhỏ "kỳ trước 67,7%" — người đọc không biết
     * con số là gì và giảm từ đâu xuống đâu (góp ý 04/09/2026). Nay: câu dẫn nói rõ
     * tiêu chí, mỗi phòng HAI thanh cùng thang (xám = kỳ trước, đỏ = kỳ này) có vạch
     * 80%, số đứng cạnh thanh của nó. */
    + (cap.capB.length
        ? hang(nhanMuc('Xấu đi rõ so với kỳ trước')
            + '<div style="font-size:15px;color:' + M.muc2 + ';line-height:1.6;margin:-4px 0 12px;">'
            +   'Phòng có <b>thời gian trong ngưỡng</b> kỳ này thấp hơn kỳ trước từ '
            +   L.SUT_GIAM_CAP_B + ' phần trăm trở lên. Thanh xám là kỳ trước, thanh đỏ là kỳ này; '
            +   'vạch đứng là mức phải đạt ' + NGUONG_HANH_DONG + '%.</div>'
            + bang(cap.capB.slice(0, 4).map(function (x) {
                return dongSoSanh(L.tenPhongGon(x.ma_phong, x.ten_phong),
                  x.tuan_thu_ky_truoc, x.tuan_thu_ky_nay, x.khu_vuc);
              }).join(''))
            + (cap.capB.length > 4
                ? '<div style="font-size:14px;color:' + M.mo + ';margin-top:10px;">Còn '
                  + (cap.capB.length - 4) + ' phòng nữa, xem đầy đủ trong tệp đính kèm.</div>' : ''))
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
