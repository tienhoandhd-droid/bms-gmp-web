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

const BD = require('./bieu-do-thu.js');
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
      con_mo: Number(r.con_mo) || 0,
      ph: r.ph_tu_ve_dat == null ? null : { khac_phuc: Number(r.ph_khac_phuc) || 0, tu_ve_dat: Number(r.ph_tu_ve_dat) || 0,
        dong_khac: Number(r.ph_dong_khac) || 0, con_mo: Number(r.ph_con_mo) || 0 }
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
    co_thu_cu: !!ky[0].has_legacy,
    sau_phan_hoi: ky[0].sau_phan_hoi || null,
    chi_tiet: Array.isArray(ky[0].chi_tiet) ? ky[0].chi_tiet : []
  };
}

function chuChenh(h) {
  if (h.ty_le == null) return '—';
  if (h.chenh == null) return 'kỳ trước không có mẫu';
  const c = Math.round(h.chenh * 10) / 10;
  if (c === 0) return 'không đổi';
  return '<span style="white-space:nowrap;">' + (c > 0 ? '+' : '−') + so1(Math.abs(c)) + ' điểm %</span>';
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

const HANH_DONG = {
  ipc_nhan_viec: 'IPC nhận kiểm tra', ipc_bao_co_dien: 'IPC chuyển Cơ điện', ipc_binh_thuong: 'IPC xác nhận bình thường',
  ipc_da_khac_phuc: 'IPC báo đã khắc phục', mep_tiep_nhan: 'Cơ điện tiếp nhận', mep_cho_xu_ly: 'Cơ điện chờ xử lý',
  mep_khong_xu_ly_duoc: 'Cơ điện báo không xử lý được', mep_xu_ly_xong: 'Cơ điện báo xử lý xong',
  qa_nhan_ra_soat: 'QA nhận rà soát', qa_da_khac_phuc: 'QA báo đã khắc phục', qa_mo_lai: 'QA mở lại'
};
const KET_QUA = { khac_phuc: 'Bộ phận ghi nhận đã khắc phục', tu_ve_dat: 'Tự về đạt, hệ thống đóng', dong_khac: 'Đóng cách khác', con_mo: 'Còn mở lúc chốt kỳ' };
const SO_DONG_CHI_TIET = 8;

function bang(dau, hang) {
  const TDT = 'padding:8px;background:' + NEN + ';border-bottom:1px solid ' + MUC2 + ';font-size:12px;font-weight:600;color:' + MUC2 + ';vertical-align:bottom;';
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><tr>'
    + dau.map(function (x, i) {
      return '<th class="h ' + (i === 0 ? 'dl' : 'dp') + (i === dau.length - 1 ? ' dr' : '') + '" style="' + TDT + 'text-align:' + (i === 0 ? 'left;padding-left:0' : 'right') + ';">' + x + '</th>';
    }).join('') + '</tr>'
    + hang.map(function (r) {
      const O = 'padding:9px 8px;border-bottom:1px solid #E3E8EF;font-size:14px;color:' + MUC + ';vertical-align:top;' + (r.dam ? 'font-weight:700;background:' + NEN + ';' : '');
      return '<tr>' + r.o.map(function (x, i) {
        return '<td class="d ' + (i === 0 ? 'dl' : 'dp') + (i === r.o.length - 1 ? ' dr' : '') + '" style="' + O + 'text-align:' + (i === 0 ? 'left;padding-left:0;font-weight:600' : 'right') + ';">' + x + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</table>';
}
function tieuDeNho(chu) {
  return '<div style="margin:16px 0 6px;font-size:15px;font-weight:700;color:' + MUC + ';">' + chu + '</div>';
}

/* Trả lời "có phản hồi thì có khắc phục được không": so sự cố có và không có phản hồi của bên xử lý.
 * Chỉ nêu số quan sát, không kết luận nguyên nhân: số mẫu nhỏ và sự cố tự về đạt không chứng minh phản hồi có tác dụng. */
function khoiSauPhanHoi(t) {
  const sp = t.sau_phan_hoi;
  if (!sp || !sp.co || !sp.khong) return '';
  const so = function (x) { return Number(x) || 0; };
  const cau = so(sp.co.tong)
    ? 'Trong <b>' + so(sp.co.tong) + ' sự cố</b> có IPC, Cơ điện hoặc QA phản hồi: <b>' + so(sp.co.khac_phuc) + '</b> được bộ phận ghi nhận đã khắc phục, <b>'
      + so(sp.co.tu_ve_dat) + '</b> tự về đạt, <b>' + so(sp.co.dong_khac) + '</b> đóng cách khác, <b>' + so(sp.co.con_mo) + '</b> còn mở lúc chốt kỳ.'
    : 'Kỳ này không có sự cố nào được IPC, Cơ điện hoặc QA phản hồi.';
  const dong = function (ten, x) { return { o: [ten, so(x.tong), so(x.khac_phuc), so(x.tu_ve_dat), so(x.dong_khac), so(x.con_mo)] }; };
  const ct = t.chi_tiet.slice(0, SO_DONG_CHI_TIET);
  return tieuDeNho('Có phản hồi thì sự cố có được khắc phục không?')
    + '<p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:' + MUC2 + ';">' + cau + '</p>'
    + bang(['Nhóm sự cố', 'Số sự cố', 'Bộ phận khắc phục', 'Tự về đạt', 'Đóng cách khác', 'Còn mở'],
        [dong('Có phản hồi', sp.co), dong('Không có phản hồi', sp.khong)])
    + (ct.length
      ? tieuDeNho('Các sự cố đã có phản hồi')
        + bang(['Phòng · sự cố', 'Phản hồi', 'Kết quả'], ct.map(function (c) {
          return { o: [esc(c.ma_phong) + ' <span style="font-weight:400;color:' + MO + ';white-space:nowrap;">số ' + esc(c.ma_su_co) + '</span>',
            esc(HANH_DONG[c.hanh_dong] || c.hanh_dong),
            esc(KET_QUA[c.ket_qua] || c.ket_qua) + (c.gio_den_dong != null
              ? '<div style="font-size:12px;color:' + MO + ';">đóng sau ' + so1(c.gio_den_dong) + ' giờ từ thư đầu</div>' : '')] };
        }))
        + (t.chi_tiet.length > ct.length ? '<div style="font-size:13px;color:' + MO + ';margin-top:6px;">Còn ' + (t.chi_tiet.length - ct.length) + ' sự cố nữa có phản hồi.</div>' : '')
      : '')
    + '<div style="font-size:13px;color:' + MO + ';margin-top:8px;line-height:1.5;">Đây là số quan sát, chưa đủ để kết luận phản hồi làm sự cố hết: số mẫu nhỏ, và sự cố tự về đạt có thể do nguyên nhân khác.</div>';
}

/* Bản rút gọn cho thư: tỷ lệ phản hồi, rồi kết quả sau phản hồi. Định nghĩa nằm ở "Cách đọc số liệu" cuối thư. */
function htmlThu(t) {
  if (!t) return '';
  return tieuDeNho('Tỷ lệ phản hồi')
    + bang(['Bộ phận', 'Đã phản hồi / cần phản hồi', 'Tỷ lệ', 'So với kỳ trước'], t.hang.map(function (h) {
      return { o: [esc(h.ten), h.da + '/' + h.can, '<b>' + (h.ty_le == null ? 'không có mẫu' : so1(h.ty_le) + '%') + '</b>'
        + '<div style="margin-top:4px;min-width:60px;">' + BD.thanh(h.ty_le, { cao: 6 }) + '</div>', chuChenh(h)] };
    }))
    + khoiSauPhanHoi(t);
}

/* Định nghĩa đưa vào "Cách đọc số liệu" cuối thư. */
function ghiChuThu(t) {
  if (!t) return [];
  const ds = [
    ['Tỷ lệ phản hồi', 'số sự cố bộ phận đã thao tác trên số sự cố bộ phận được gửi thư trong giờ làm việc, trước lúc chốt kỳ.'],
    ['Có phản hồi', 'IPC, Cơ điện hoặc QA đã thao tác; Trực hồ sơ lô chỉ nhắc và điều phối nên không tính vào nhóm này.'],
    ['Bộ phận khắc phục', 'bộ phận tự bấm "đã khắc phục" hoặc "xử lý xong", hệ thống không kiểm chứng việc đã làm. Trực hồ sơ lô chỉ điều phối nên không áp dụng.'],
    ['Tự về đạt', 'số liệu trở lại trong giới hạn đủ 2 giờ liên tục và hệ thống tự đóng; không có nghĩa bộ phận đã xử lý.']
  ];
  if (t.co_thu_cu) ds.push(['Thư định dạng cũ', 'chỉ tính khi xác minh được liên kết thao tác trong thư.']);
  return ds;
}

function html(t) {
  if (!t) return '';
  return '<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:' + MUC2 + ';">' + loiChinh(t) + '</p>'
    + bangPhanHoi(t) + bangKetQua(t) + khoiSauPhanHoi(t) + ghiChu(t);
}

module.exports = { tongHop: tongHop, html: html, htmlThu: htmlThu, ghiChuThu: ghiChuThu };
