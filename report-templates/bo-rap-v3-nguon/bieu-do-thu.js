'use strict';
/* ===========================================================================
 * BIỂU ĐỒ TRONG THƯ, VẼ BẰNG Ô BẢNG HTML
 *
 * Bản in dùng đồ hoạ vector, nhưng hòm thư không vẽ được loại đó một cách tin cậy, còn
 * ảnh thì bị chặn mặc định. Ô bảng có nền màu và kích thước rõ ràng là cách hiển
 * thị được ở mọi hòm thư (yêu cầu 31/10/2026: đưa biểu đồ của bản in vào thư).
 * Mỗi hình đều có số ghi trực tiếp, nên không phụ thuộc vào màu.
 * ======================================================================== */

const MAU = {
  chinh: '#17324D',        // một chuỗi số: một màu
  ranh: '#E9EDF2',
  vach: '#33475B',
  duoi: '#DC2626',         // tụt dưới giới hạn, cùng màu với bản in
  tren: '#7C3AED',         // vượt trên giới hạn; cặp màu đã qua kiểm tra mù màu
  dat: '#15803D',
  chuaDat: '#C2362F',
  thieu: '#FBE3E1',        // phần còn thiếu so với mức yêu cầu
  thieuChu: '#7F1D1D',
  mo: '#6B7686',
  chu: '#33475B'
};

function kep(v, a, b) { return Math.max(a, Math.min(b, v)); }
function so1(v) { return (Math.round(Number(v) * 10) / 10).toFixed(1).replace('.', ','); }

// Viết gọn bằng thuộc tính của ô (width, height, bgcolor): mọi hòm thư đều hiểu, và mỗi hình
// tiết kiệm nhiều dung lượng. Gmail cắt thư vượt khoảng 102 KB nên phần này phải nhẹ.
function o(w, mau, cao) {
  if (w <= 0.05) return '';
  return '<td width="' + Math.round(w * 10) / 10 + '%" height="' + cao + '" bgcolor="' + mau + '" style="font-size:0"></td>';
}
function vach(mau, cao) {
  return '<td width="2" height="' + cao + '" bgcolor="' + mau + '" style="font-size:0"></td>';
}
function khung(ruot) {
  return '<table width="100%" cellpadding="0" cellspacing="0"><tr>' + ruot + '</tr></table>';
}

/* Thanh ngang 0–100%. Có nguong thì thêm vạch mức yêu cầu. Không có số (null) thì chỉ còn rãnh, không vẽ thành 0%. */
function thanh(pct, opt) {
  const c = opt || {}, cao = c.cao || 8, mau = c.mau || MAU.chinh;
  if (pct == null || !Number.isFinite(Number(pct))) return khung(o(100, MAU.ranh, cao));
  const p = kep(Number(pct), 0, 100), n = c.nguong;
  if (n == null) return khung(o(p, mau, cao) + o(100 - p, MAU.ranh, cao));
  if (p <= n) return khung(o(p, mau, cao) + o(n - p, MAU.ranh, cao) + vach(MAU.vach, cao) + o(100 - n, MAU.ranh, cao));
  return khung(o(n, mau, cao) + vach('#FFFFFF', cao) + o(p - n, mau, cao) + o(100 - p, MAU.ranh, cao));
}

/* Thanh hai chiều: trục ở giữa, trái tụt dưới, phải vượt trên, chung một thang. */
function thanhHaiChieu(pDuoi, pTren, thang) {
  const m = Math.max(1, thang || 100), cao = 12;
  const wD = kep(50 * (Number(pDuoi) || 0) / m, 0, 50), wT = kep(50 * (Number(pTren) || 0) / m, 0, 50);
  return khung(o(50 - wD, MAU.ranh, cao) + o(wD, MAU.duoi, cao) + vach(MAU.vach, cao) + o(wT, MAU.tren, cao) + o(50 - wT, MAU.ranh, cao));
}

/* Thang chung: tròn chục trên giá trị lớn nhất, tối thiểu 20%. */
function thangChung(ds) {
  const lon = ds.reduce(function (t, x) {
    return x.gio_do ? Math.max(t, 100 * (x.gio_duoi || 0) / x.gio_do, 100 * (x.gio_tren || 0) / x.gio_do) : t;
  }, 0);
  return Math.max(20, Math.ceil(lon / 10) * 10);
}

/* Bảng thanh hai chiều. ds: [{ ten, phu, gio_do, gio_duoi, gio_tren }]. Hàng không có giờ đo thì ghi "—". */
function bangHaiChieu(ds, thang) {
  if (!ds.length) return '';
  const oSo = function (chu, trai) {
    return '<td width="50" align="' + (trai ? 'right' : 'left') + '" class="hcs" style="font-size:13px;font-weight:600;">' + chu + '</td>';
  };
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">'
    + ds.map(function (x) {
      const co = x.gio_do > 0;
      const d = co ? 100 * (x.gio_duoi || 0) / x.gio_do : null, t = co ? 100 * (x.gio_tren || 0) / x.gio_do : null;
      return '<tr><td width="27%" class="hct" style="font-size:14px;font-weight:600;">' + x.ten
        + (x.phu ? '<div style="font-size:12px;font-weight:400;color:' + MAU.mo + ';">' + x.phu + '</div>' : '') + '</td>'
        + oSo(co ? so1(d) + '%' : '—', true)
        + '<td class="hcb">' + thanhHaiChieu(d, t, thang) + '</td>'
        + oSo(co ? so1(t) + '%' : '—', false) + '</tr>';
    }).join('') + '</table>';
}

/* Chú thích hai phía, dùng một lần cho cả nhóm hình. */
function chuThichHaiChieu() {
  const m = function (mau) { return '<span style="color:' + mau + ';font-size:14px;">■</span>'; };
  return '<div style="font-size:13px;color:' + MAU.chu + ';line-height:1.5;margin:0 0 8px;">' + m(MAU.duoi)
    + ' Tụt dưới giới hạn dưới &nbsp;&nbsp; ' + m(MAU.tren) + ' Vượt trên giới hạn trên</div>';
}

/* Biểu đồ cột 0–100% có trục, vạch mức yêu cầu và phần thiếu tô nền nhạt.
 * Cột dưới mức yêu cầu màu đỏ, đạt màu lục; chú thích và số ghi trực tiếp nên không phụ thuộc vào màu.
 * ds: [{ nhan, v }]; v null là không có số đo, để trống. */
function cot(ds, nguong, opt) {
  const c = opt || {}, CAO = c.cao || 150;
  if (!ds || ds.length < 2) return '';
  const yN = Math.round(CAO * nguong / 100);
  const it = ds.length <= 8;
  const cao = function (h, mau, noi) {
    return ' height="' + h + '"' + (mau ? ' bgcolor="' + mau + '"' : '') + ' style="font-size:' + (noi ? '12px;font-weight:700;color:' + MAU.thieuChu + ';text-align:center;vertical-align:bottom;padding-bottom:3px' : '0') + '"';
  };
  const le = '<td width="14%" style="font-size:0"></td>';
  const trong = function (h, noi) { return h <= 0 ? '' : '<tr><td colspan="3"' + cao(h) + '></td></tr>'; };
  const ke = '<tr><td colspan="3"' + cao(2, MAU.vach) + '></td></tr>';
  const giua = function (h, mau, noi) { return h <= 0 ? '' : '<tr>' + le + '<td width="72%"' + cao(h, mau, noi) + '>' + (noi || '') + '</td>' + le + '</tr>'; };
  const vs = ds.map(function (x) { return x.v; }).filter(function (v) { return v != null; });
  const min = vs.length ? Math.min.apply(null, vs) : null;
  let daGhiMin = false;
  const buoc = Math.max(1, Math.ceil(ds.length / 8));
  const cotTd = ds.map(function (x) {
    const h = x.v == null ? 0 : kep(Math.round(CAO * x.v / 100), 2, CAO);
    const dat = x.v != null && x.v >= nguong;
    const mau = dat ? MAU.dat : MAU.chuaDat;
    // Ít cột thì ghi số ngay trong phần thiếu; không đủ chỗ thì ghi ở hàng dưới.
    const coCho = it && x.v != null && !dat && yN - h >= 20;
    x.daGhi = coCho;
    const ruot = x.v == null
      ? trong(CAO - yN - 2) + ke + trong(yN)
      : dat
        ? trong(CAO - h) + giua(h - yN - 2, mau) + ke + giua(yN, mau)
        : trong(CAO - yN - 2) + ke + giua(yN - h, MAU.thieu, coCho ? so1(x.v) : '') + giua(h, mau);
    return '<td valign="bottom" style="vertical-align:bottom;"' + (x.v == null ? '' : ' title="' + x.nhan + ': ' + so1(x.v) + '%"') + '>'
      + '<table width="100%" cellpadding="0" cellspacing="0">' + ruot + '</table></td>';
  }).join('');
  const nhan = ds.map(function (x, i) {
    const cuoi = i === ds.length - 1;
    const laMin = x.v != null && x.v === min && !daGhiMin;
    if (laMin) daGhiMin = true;
    const ghiSo = x.v != null && !x.daGhi && (it || i === 0 || cuoi || laMin);
    const ghiNgay = it || i % buoc === 0 || cuoi;
    return '<td style="padding:4px 0 0;text-align:center;font-size:11px;line-height:1.35;color:' + MAU.mo + ';vertical-align:top;">'
      + (ghiSo ? '<b style="color:#0F172A;font-size:12px;">' + so1(x.v) + '</b><br>' : '')
      + (ghiNgay ? x.nhan : '') + '</td>';
  }).join('');
  const truc = function (chu, h, canh) {
    return '<tr><td height="' + h + '" align="right" style="font-size:11px;line-height:12px;color:' + MAU.mo + ';vertical-align:' + canh + ';padding-right:4px;white-space:nowrap;">' + chu + '</td></tr>';
  };
  const hTren = Math.max(12, CAO - yN - 7);
  const m = function (mau) { return '<span style="color:' + mau + ';font-size:13px;">■</span> '; };
  return '<table width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;">'
    + '<tr><td width="30" valign="bottom" style="width:30px;vertical-align:bottom;"><table width="100%" cellpadding="0" cellspacing="0">'
    + truc('100', hTren, 'top') + truc('<b>' + nguong + '</b>', 14, 'middle') + truc('0', CAO - hTren - 14, 'bottom') + '</table></td>'
    + cotTd + '</tr><tr><td></td>' + nhan + '</tr></table>'
    + '<div style="font-size:12px;color:' + MAU.chu + ';margin-top:6px;line-height:1.5;">' + m(MAU.chuaDat) + 'Chưa đạt &nbsp; ' + m(MAU.dat) + 'Đạt &nbsp; '
    + m(MAU.thieu) + 'Phần còn thiếu so với mức yêu cầu ' + nguong + '% (đường ngang). Đơn vị %.</div>';
}

module.exports = { thanh: thanh, thanhHaiChieu: thanhHaiChieu, thangChung: thangChung, bangHaiChieu: bangHaiChieu, chuThichHaiChieu: chuThichHaiChieu, cot: cot };
