'use strict';
/* ===========================================================================
 * PHẢN HỒI VÀ KẾT QUẢ KHẮC PHỤC CỦA CÁC BỘ PHẬN
 *
 * Yêu cầu người dùng 31/10/2026: đưa tỷ lệ phản hồi của bộ phận và kết quả khắc
 * phục vào báo cáo tuần/tháng/quý. Cùng cách tính với trang "Phản hồi phiếu qua
 * email" trên web.
 *
 * Dữ liệu vào: d.phan_hoi_khac_phuc do hàm SQL bao_cao_phan_hoi_khac_phuc dựng —
 *   { ky: [ kỳ này, kỳ trước ] }, mỗi kỳ { tu, den, rows: [...], su_co: {...}, has_legacy }.
 * Thiếu khối này (dữ liệu cũ) thì mục không hiện — báo cáo vẫn dựng bình thường.
 *
 * Không xếp hạng và không tô màu theo ngưỡng: chưa có chỉ tiêu phản hồi được duyệt.
 * Không có mẫu thì ghi "không có mẫu", không ghi 0%.
 * "Tự về đạt" tách riêng khỏi "khắc phục": đó là hệ thống tự đóng khi số liệu về
 * dải, không phải bằng chứng bộ phận đã xử lý.
 * ======================================================================== */

const TEN_BO_PHAN = { IPC: 'IPC', MEP: 'Cơ điện', LOT: 'Trực hồ sơ lô', QA: 'QA' };
const MUC = '#1F2D3D', MUC2 = '#33475B', MO = '#6B7686', NEN = '#F7F9FB', VIEN = '#D9E1E8';
const TH = 'padding:9px 6px;background:#F3F6F9;border-bottom:1px solid ' + VIEN + ';font-size:12px;color:#4A5D70;font-weight:600;';
const TD = 'padding:9px 6px;border-bottom:1px solid #E3E8EF;font-size:13px;color:' + MUC + ';';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function so1(v) { return (Math.round(Number(v) * 10) / 10).toFixed(1).replace('.', ','); }
function ddmm(s) { const p = String(s).slice(0, 10).split('-'); return p[2] + '/' + p[1]; }
function nhanKy(k) { return ddmm(k.tu) + '–' + ddmm(k.den); }

/* Gộp kỳ này với kỳ trước theo bộ phận. Trả null nếu thiếu dữ liệu. */
function tongHop(d) {
  const khoi = d && d.phan_hoi_khac_phuc;
  const ky = khoi && khoi.ky;
  if (!Array.isArray(ky) || !ky[0] || !Array.isArray(ky[0].rows)) return null;
  const truoc = ky[1] || null;
  const hang = ky[0].rows.map(function (r) {
    const rt = truoc && (truoc.rows || []).find(function (x) { return x.role === r.role; });
    const coMau = Number(r.denominator) > 0 && r.rate_pct != null;
    const coMauTruoc = !!rt && Number(rt.denominator) > 0 && rt.rate_pct != null;
    return {
      role: r.role,
      ten: TEN_BO_PHAN[r.role] || r.role,
      can: Number(r.denominator) || 0,
      da: Number(r.responded) || 0,
      ty_le: coMau ? Number(r.rate_pct) : null,
      ty_le_truoc: coMauTruoc ? Number(rt.rate_pct) : null,
      chenh: coMau && coMauTruoc ? Number(r.rate_pct) - Number(rt.rate_pct) : null,
      khac_phuc: r.khac_phuc == null ? null : Number(r.khac_phuc),
      tu_ve_dat: Number(r.tu_ve_dat) || 0,
      dong_khac: Number(r.dong_khac) || 0,
      con_mo: Number(r.con_mo) || 0
    };
  });
  const sc = ky[0].su_co || {};
  return {
    ky: ky[0],
    ky_truoc: truoc,
    hang: hang,
    su_co: {
      tong: Number(sc.tong) || 0,
      khac_phuc: Number(sc.khac_phuc) || 0,
      tu_ve_dat: Number(sc.tu_ve_dat) || 0,
      dong_khac: Number(sc.dong_khac) || 0,
      con_mo: Number(sc.con_mo) || 0
    },
    co_thu_cu: !!ky[0].has_legacy
  };
}

function chuChenh(h) {
  if (h.ty_le == null) return '—';
  if (h.chenh == null) return 'kỳ trước không có mẫu';
  const c = Math.round(h.chenh * 10) / 10;
  if (c === 0) return 'không đổi';
  return (c > 0 ? '+' : '−') + so1(Math.abs(c)) + ' điểm %';
}

function loiChinh(t) {
  const s = t.su_co;
  if (!s.tong) {
    return 'Trong kỳ ' + nhanKy(t.ky) + ' không có sự cố nào được gửi thư trong giờ làm việc, nên chưa có mẫu để tính.';
  }
  return 'Trong kỳ ' + nhanKy(t.ky) + ' có <b>' + s.tong + ' sự cố</b> được gửi thư trong giờ làm việc: '
    + '<b>' + s.khac_phuc + '</b> được bộ phận ghi nhận đã khắc phục, '
    + '<b>' + s.tu_ve_dat + '</b> tự về đạt và được hệ thống đóng, '
    + '<b>' + s.dong_khac + '</b> đóng theo cách khác, '
    + '<b>' + s.con_mo + '</b> còn mở lúc chốt kỳ.';
}

function bangPhanHoi(t) {
  const hang = t.hang.map(function (h) {
    return '<tr><td style="' + TD + 'font-weight:600;">' + esc(h.ten) + '</td>'
      + '<td style="' + TD + 'text-align:right;">' + h.da + ' / ' + h.can + '</td>'
      + '<td style="' + TD + 'text-align:right;font-weight:700;">' + (h.ty_le == null ? 'không có mẫu' : so1(h.ty_le) + '%') + '</td>'
      + '<td style="' + TD + 'text-align:right;color:' + MUC2 + ';">' + chuChenh(h) + '</td></tr>';
  }).join('');
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border:1px solid ' + VIEN + ';">'
    + '<tr><td style="' + TH + '">Bộ phận</td><td style="' + TH + 'text-align:right;">Đã phản hồi / cần phản hồi</td>'
    + '<td style="' + TH + 'text-align:right;">Tỷ lệ phản hồi</td>'
    + '<td style="' + TH + 'text-align:right;">So với kỳ trước' + (t.ky_truoc ? ' (' + nhanKy(t.ky_truoc) + ')' : '') + '</td></tr>'
    + hang + '</table>';
}

function bangKetQua(t) {
  function dong(ten, kp, tu, khac, mo, dam) {
    const s = TD + 'text-align:right;' + (dam ? 'font-weight:700;background:' + NEN + ';' : '');
    return '<tr><td style="' + TD + 'font-weight:' + (dam ? 700 : 600) + ';' + (dam ? 'background:' + NEN + ';' : '') + '">' + esc(ten) + '</td>'
      + '<td style="' + s + '">' + (kp == null ? 'không áp dụng' : kp) + '</td><td style="' + s + '">' + tu + '</td>'
      + '<td style="' + s + '">' + khac + '</td><td style="' + s + '">' + mo + '</td></tr>';
  }
  const hang = t.hang.map(function (h) { return dong(h.ten, h.khac_phuc, h.tu_ve_dat, h.dong_khac, h.con_mo, false); }).join('');
  const s = t.su_co;
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border:1px solid ' + VIEN + ';margin-top:12px;">'
    + '<tr><td style="' + TH + '">Sự cố bộ phận được báo</td><td style="' + TH + 'text-align:right;">Bộ phận ghi nhận khắc phục</td>'
    + '<td style="' + TH + 'text-align:right;">Tự về đạt</td><td style="' + TH + 'text-align:right;">Đóng cách khác</td>'
    + '<td style="' + TH + 'text-align:right;">Còn mở</td></tr>'
    + hang + dong('Toàn bộ, mỗi sự cố tính một lần', s.khac_phuc, s.tu_ve_dat, s.dong_khac, s.con_mo, true)
    + '</table>';
}

function ghiChu(t) {
  const dong = [
    ['Cần phản hồi', 'mỗi cặp sự cố và bộ phận tính một lần, nếu bộ phận được gửi thư trong giờ làm việc; thư ngoài giờ không tính.'],
    ['Đã phản hồi', 'người của đúng bộ phận thao tác trên web hoặc từ thư, sau thư đầu tiên và trước lúc chốt kỳ.'],
    ['Bộ phận ghi nhận khắc phục', 'bộ phận tự bấm "đã khắc phục" hoặc "xử lý xong"; hệ thống không kiểm chứng việc đã làm. Trực hồ sơ lô chỉ điều phối nên không áp dụng.'],
    ['Tự về đạt', 'số liệu trở lại trong giới hạn đủ 2 giờ liên tục và hệ thống tự đóng; không có nghĩa bộ phận đã xử lý.'],
    ['Cộng theo hàng', 'một sự cố có thể gửi cho nhiều bộ phận, nên không cộng các hàng bộ phận với nhau.']
  ];
  if (t.co_thu_cu) dong.push(['Thư định dạng cũ', 'chỉ tính khi xác minh được liên kết thao tác trong thư.']);
  return '<div style="margin-top:12px;padding:10px 14px;background:' + NEN + ';border-radius:6px;font-size:12px;line-height:1.6;color:#4A5D70;">'
    + '<b style="color:' + MUC2 + ';">Ghi chú</b>'
    + dong.map(function (x) { return '<div><b>' + x[0] + ':</b> ' + x[1] + '</div>'; }).join('') + '</div>';
}

function html(t) {
  if (!t) return '';
  return '<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:' + MUC2 + ';">' + loiChinh(t) + '</p>'
    + bangPhanHoi(t) + bangKetQua(t) + ghiChu(t);
}

module.exports = { tongHop: tongHop, html: html };
