'use strict';
/* ===========================================================================
 * PHÒNG THEO DÕI: BIẾN ĐỘNG SO VỚI KỲ LIỀN TRƯỚC + CẢNH BÁO VÀ TÁC ĐỘNG
 *
 * Yêu cầu người dùng 09/11/2026 (người xử lý hệ thống BMS): đọc thư tuần là biết
 *   · tuần qua phòng theo dõi nào tốt nhất, tỷ lệ đạt tăng;
 *   · phòng nào kém, tỷ lệ đạt giảm, giảm ở phòng nào, khu nào;
 *   · phòng đó có cảnh báo không, có bộ phận nào tác động không.
 *
 * Chỉ tiêu: tỷ lệ điểm đo chênh áp đạt (cùng chỉ tiêu người dùng chốt 29/10/2026,
 * cùng cách tính với chenh-ap-phong-theo-doi.js): tổng điểm đạt / tổng điểm ghi.
 * Mức thay đổi = kỳ này − kỳ liền trước, đơn vị điểm phần trăm. Chênh dưới
 * NGUONG_BIEN_DONG điểm ghi "không đổi" để dao động nhỏ không thành tin tăng/giảm.
 *
 * Dữ liệu vào (node Supabase của WF5):
 *   · d.dp_phong_theo_doi            — phạm vi phòng theo dõi + ky[0].diem của kỳ này
 *   · d.dp_ky_truoc = { tu, den, diem: { 'C1.R11': [điểm ghi, điểm đạt] } } — kỳ liền trước
 *   · d.phan_hoi_khac_phuc.ky[0].theo_phong — mỗi phòng: so_su_co (sự cố được gửi thư
 *     cảnh báo trong giờ làm việc), co_tac_dong (có IPC/Cơ điện/QA thao tác), bo_phan,
 *     khac_phuc / tu_ve_dat / dong_khac / con_mo (migration 20261109a).
 * Thiếu dp_ky_truoc (dữ liệu cũ) thì tongHop trả null, thư bỏ mục này, không vỡ.
 * Thiếu theo_phong thì vẫn có phần biến động, cột cảnh báo ghi "—".
 *
 * Mô-đun chỉ gom số liệu và dựng bản in; thư (email.node.js) tự vẽ bằng mảnh
 * dựng sẵn của nó để cùng kiểu dáng với các mục khác.
 * ========================================================================= */

const PTD = require('./chenh-ap-phong-theo-doi.js');
const NGUONG_BIEN_DONG = 2;     // điểm %, người dùng chốt 09/11/2026
const TEN_BO_PHAN = { IPC: 'IPC', MEP: 'Cơ điện', QA: 'QA', LOT: 'Trực hồ sơ lô' };
const TEN_KY_TRUOC = { TUAN: 'tuần trước', THANG: 'tháng trước', QUY: 'quý trước' };
const TEN_KY_NAY = { TUAN: 'tuần này', THANG: 'tháng này', QUY: 'quý này' };

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function so1(v) { return (Math.round(Number(v) * 10) / 10).toFixed(1).replace('.', ','); }
function phanTram(v) { return v == null ? '—' : so1(v) + '%'; }
function hoaDau(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function tyLe(x) { return x && x.ghi > 0 ? 100 * x.dat / x.ghi : null; }

/* Xếp loại mức thay đổi. null = không so được (kỳ trước không có số đo). */
function xuHuong(chenh) {
  if (chenh == null) return null;
  if (chenh >= NGUONG_BIEN_DONG) return 'tang';
  if (chenh <= -NGUONG_BIEN_DONG) return 'giam';
  return 'giu';
}
/* "+3,2 điểm", "−3,2 điểm", "không đổi", "chưa có số kỳ trước". Dấu trừ là U+2212 cho dễ đọc. */
function chuChenh(chenh) {
  const h = xuHuong(chenh);
  if (h == null) return 'chưa có số kỳ trước';
  if (h === 'giu') return 'không đổi';
  return (chenh > 0 ? '+' : '−') + so1(Math.abs(chenh)) + ' điểm';
}

function docDiem(dm, ma, nhan) {
  if (dm == null) return null;
  if (!Array.isArray(dm) || !(Number(dm[0]) > 0) || !(Number(dm[1]) >= 0) || Number(dm[1]) > Number(dm[0])) {
    throw new Error('BIEN_DONG_PHONG_THEO_DOI: sai số điểm đo của ' + ma + ' (' + nhan + ')');
  }
  return { ghi: Number(dm[0]), dat: Number(dm[1]) };
}

/* Một câu tóm tắt cảnh báo của phòng: "4 cảnh báo · IPC thao tác 1/4". */
function chuCanhBao(cb) {
  if (!cb) return 'Không có cảnh báo';
  const bp = (cb.bo_phan || []).map(function (r) { return TEN_BO_PHAN[r] || r; });
  return cb.so_su_co + ' cảnh báo · ' + (cb.co_tac_dong
    ? (bp.length ? bp.join(', ') : 'Có bộ phận') + ' thao tác ' + cb.co_tac_dong + '/' + cb.so_su_co
    : 'không bộ phận nào thao tác');
}
function chuKetQua(cb) {
  if (!cb) return '—';
  const ds = [];
  if (cb.khac_phuc) ds.push(cb.khac_phuc + ' bộ phận khắc phục');
  if (cb.tu_ve_dat) ds.push(cb.tu_ve_dat + ' tự về đạt');
  if (cb.dong_khac) ds.push(cb.dong_khac + ' đóng cách khác');
  if (cb.con_mo) ds.push(cb.con_mo + ' còn mở');
  return ds.join(' · ') || '—';
}

/* ===== Gom số liệu ======================================================== */
function tongHop(d, khuBaoCao) {
  if (!d || !d.dp_ky_truoc || !d.dp_ky_truoc.diem || !d.dp_phong_theo_doi) return null;
  const td = PTD.tongHop(d, khuBaoCao);
  if (!td || !td.co_diem) return null;
  const maKy = String(d.ky || '').toUpperCase();
  const diemNay = td.ky[0].diem || {};
  const diemTruoc = d.dp_ky_truoc.diem;
  const kyPH = d.phan_hoi_khac_phuc && Array.isArray(d.phan_hoi_khac_phuc.ky) ? d.phan_hoi_khac_phuc.ky[0] : null;
  const coCanhBao = !!(kyPH && Array.isArray(kyPH.theo_phong));
  const cbTheoMa = {};
  (coCanhBao ? kyPH.theo_phong : []).forEach(function (r) {
    cbTheoMa[r.ma_phong] = {
      so_su_co: Number(r.so_su_co) || 0, co_tac_dong: Number(r.co_tac_dong) || 0,
      bo_phan: Array.isArray(r.bo_phan) ? r.bo_phan : [],
      khac_phuc: Number(r.khac_phuc) || 0, tu_ve_dat: Number(r.tu_ve_dat) || 0,
      dong_khac: Number(r.dong_khac) || 0, con_mo: Number(r.con_mo) || 0
    };
  });

  const phong = td.phong.map(function (p) {
    const nay = docDiem(diemNay[p.ma], p.ma, 'kỳ này');
    const truoc = docDiem(diemTruoc[p.ma], p.ma, 'kỳ trước');
    const vNay = tyLe(nay), vTruoc = tyLe(truoc);
    const chenh = vNay != null && vTruoc != null ? vNay - vTruoc : null;
    return { ma: p.ma, ten: p.ten, khu: p.khu, muc: p.muc, nay: nay, truoc: truoc,
      v: vNay, v_truoc: vTruoc, chenh: chenh, xu_huong: xuHuong(chenh),
      canh_bao: cbTheoMa[p.ma] || null };
  }).filter(function (p) { return p.nay; });
  if (!phong.length) return null;

  // Nhóm (khu và tất cả): kỳ trước chỉ cộng phòng có số ở cả hai kỳ, để hai con số so cùng một nhóm phòng.
  const gom = function (ds) {
    const n = { ghi: 0, dat: 0 }, t = { ghi: 0, dat: 0 }, nc = { ghi: 0, dat: 0 };
    ds.forEach(function (p) {
      n.ghi += p.nay.ghi; n.dat += p.nay.dat;
      if (p.truoc) { t.ghi += p.truoc.ghi; t.dat += p.truoc.dat; nc.ghi += p.nay.ghi; nc.dat += p.nay.dat; }
    });
    const v = tyLe(n), vt = tyLe(t), vnc = tyLe(nc);
    const chenh = vnc != null && vt != null ? vnc - vt : null;
    return { so_phong: ds.length, v: v, v_truoc: vt, chenh: chenh, xu_huong: xuHuong(chenh),
      so_tang: ds.filter(function (p) { return p.xu_huong === 'tang'; }).length,
      so_giam: ds.filter(function (p) { return p.xu_huong === 'giam'; }).length };
  };
  const khu = td.khu.map(function (k) {
    return Object.assign({ khu: k }, gom(phong.filter(function (p) { return p.khu === k; })));
  }).filter(function (x) { return x.so_phong; });
  const tatCa = gom(phong);

  const soSanh = phong.filter(function (p) { return p.chenh != null; });
  const tang = soSanh.filter(function (p) { return p.xu_huong === 'tang'; })
    .sort(function (a, b) { return b.chenh - a.chenh; });
  const giam = soSanh.filter(function (p) { return p.xu_huong === 'giam'; })
    .sort(function (a, b) { return a.chenh - b.chenh; });
  const theoTyLe = phong.slice().sort(function (a, b) { return b.v - a.v || String(a.ma).localeCompare(String(b.ma), 'vi', { numeric: true }); });
  // Phòng có cảnh báo: phòng không bộ phận nào thao tác xếp trước, rồi theo số cảnh báo.
  const canhBao = phong.filter(function (p) { return p.canh_bao && p.canh_bao.so_su_co > 0; })
    .sort(function (a, b) {
      return (a.canh_bao.co_tac_dong > 0) - (b.canh_bao.co_tac_dong > 0)
        || b.canh_bao.so_su_co - a.canh_bao.so_su_co
        || String(a.ma).localeCompare(String(b.ma), 'vi', { numeric: true });
    });
  const tongCB = canhBao.reduce(function (s, p) { return s + p.canh_bao.so_su_co; }, 0);
  const tongTD = canhBao.reduce(function (s, p) { return s + p.canh_bao.co_tac_dong; }, 0);

  return {
    ma_ky: maKy,
    ten_ky_nay: TEN_KY_NAY[maKy] || 'kỳ này',
    ten_ky_truoc: TEN_KY_TRUOC[maKy] || 'kỳ trước',
    ky_truoc: { tu: d.dp_ky_truoc.tu, den: d.dp_ky_truoc.den },
    nguong: NGUONG_BIEN_DONG,
    phong: phong, khu: khu, tat_ca: tatCa,
    tang: tang, giam: giam,
    so_giu: soSanh.filter(function (p) { return p.xu_huong === 'giu'; }).length,
    so_chua_so: phong.length - soSanh.length,
    cao_nhat: theoTyLe.slice(0, 3),
    thap_nhat: theoTyLe.slice().reverse().slice(0, 3),
    co_canh_bao: coCanhBao,
    canh_bao: canhBao,
    tong_canh_bao: tongCB, tong_tac_dong: tongTD,
    so_phong_khong_tac_dong: canhBao.filter(function (p) { return !p.canh_bao.co_tac_dong; }).length,
    // Phòng giảm mà không ai thao tác: điều người xử lý hệ thống cần nhìn thấy đầu tiên.
    giam_khong_tac_dong: giam.filter(function (p) { return p.canh_bao && p.canh_bao.so_su_co > 0 && !p.canh_bao.co_tac_dong; })
  };
}

/* Câu dẫn chung cho thư và bản in, rút thẳng từ số liệu. */
function cauDan(t) {
  const a = t.tat_ca;
  const khuGiam = t.khu.filter(function (k) { return k.xu_huong === 'giam'; }).map(function (k) { return 'khu ' + k.khu; });
  const khuTang = t.khu.filter(function (k) { return k.xu_huong === 'tang'; }).map(function (k) { return 'khu ' + k.khu; });
  return '<b>' + a.so_phong + ' phòng theo dõi: ' + phanTram(a.v) + '</b>, ' + t.ten_ky_truoc + ' ' + phanTram(a.v_truoc)
    + ' (' + chuChenh(a.chenh) + '). '
    + t.tang.length + ' phòng tăng, ' + t.giam.length + ' phòng giảm, ' + t.so_giu + ' phòng không đổi'
    + (t.so_chua_so ? ', ' + t.so_chua_so + ' phòng chưa có số ' + t.ten_ky_truoc : '') + '.'
    + (khuGiam.length ? ' Giảm ở ' + khuGiam.join(', ') + '.' : '')
    + (khuTang.length ? ' Tăng ở ' + khuTang.join(', ') + '.' : '');
}

function cauCanhBao(t) {
  if (!t.co_canh_bao) return '';
  if (!t.canh_bao.length) return 'Không phòng theo dõi nào có cảnh báo được gửi thư trong kỳ.';
  return '<b>' + t.canh_bao.length + ' phòng theo dõi có cảnh báo</b>, tổng ' + t.tong_canh_bao + ' sự cố được gửi thư; '
    + t.tong_tac_dong + ' sự cố có IPC, Cơ điện hoặc QA thao tác. '
    + (t.so_phong_khong_tac_dong
      ? '<b>' + t.so_phong_khong_tac_dong + ' phòng không có bộ phận nào thao tác.</b>'
      : 'Phòng nào có cảnh báo cũng có bộ phận thao tác.');
}

const GHI_CHU = [
  ['Tỷ lệ đạt', 'tỷ lệ điểm đo chênh áp đạt = tổng điểm đo trong giới hạn / tổng điểm đo ghi được, tính cả hai phía giới hạn.'],
  ['Thay đổi', 'kỳ này trừ kỳ liền trước, đơn vị điểm phần trăm; chênh dưới ' + NGUONG_BIEN_DONG + ' điểm ghi "không đổi". Số của khu và của cả nhóm chỉ so các phòng có số ở cả hai kỳ.'],
  ['Cảnh báo', 'sự cố của phòng (mọi chỉ tiêu) được gửi thư cảnh báo trong giờ làm việc của kỳ; cùng tập sự cố với tỷ lệ phản hồi.'],
  ['Thao tác', 'IPC, Cơ điện hoặc QA bấm một thao tác trong thư hoặc trên web sau thư đầu tiên. Trực hồ sơ lô chỉ nhắc và điều phối nên không tính. "Tự về đạt" không có nghĩa bộ phận đã xử lý.']
];

/* ===== Bản in: đủ mọi phòng theo dõi ===================================== */
function htmlBanIn(t) {
  if (!t) return '';
  const lop = function (v) { return v == null ? 'mo' : (v >= PTD.NGUONG_DAT ? 'ls-tot' : 'ls-xau'); };
  const oChenh = function (x) {
    const h = x.xu_huong;
    return '<td class="so"><span class="' + (h === 'tang' ? 'ls-tot' : h === 'giam' ? 'ls-xau' : 'mo') + '">' + chuChenh(x.chenh) + '</span></td>';
  };
  const dongKhu = t.khu.concat([Object.assign({ khu: null }, t.tat_ca)]);
  const dsPhong = t.phong.slice().sort(function (a, b) {
    return (a.chenh == null ? 999 : a.chenh) - (b.chenh == null ? 999 : b.chenh)
      || String(a.ma).localeCompare(String(b.ma), 'vi', { numeric: true });
  });
  return '<p class="mota">' + cauDan(t) + '</p>'
    + '<div class="cuon-ngang"><table><thead><tr><th>Khu</th><th class="so">' + esc(hoaDau(t.ten_ky_nay)) + '</th><th class="so">'
    + esc(hoaDau(t.ten_ky_truoc)) + '</th><th class="so">Thay đổi</th><th class="so">Phòng tăng / giảm</th></tr></thead><tbody>'
    + dongKhu.map(function (k) {
        return '<tr' + (k.khu ? '' : ' class="dong-nhan"') + '><td>' + (k.khu ? 'Khu ' + esc(k.khu) : 'Tất cả phòng theo dõi') + ' <span class="mo">(' + k.so_phong + ' phòng)</span></td>'
          + '<td class="so dam"><span class="' + lop(k.v) + '">' + phanTram(k.v) + '</span></td>'
          + '<td class="so">' + phanTram(k.v_truoc) + '</td>' + oChenh(k)
          + '<td class="so">' + k.so_tang + ' / ' + k.so_giam + '</td></tr>';
      }).join('')
    + '</tbody></table></div>'
    + '<h4>Từng phòng theo dõi, giảm nhiều nhất trước</h4>'
    + '<div class="cuon-ngang"><table><thead><tr><th>Phòng</th><th>Khu</th><th class="so">' + esc(hoaDau(t.ten_ky_nay)) + '</th><th class="so">'
    + esc(hoaDau(t.ten_ky_truoc)) + '</th><th class="so">Thay đổi</th><th>Cảnh báo trong kỳ</th><th>Kết quả</th></tr></thead><tbody>'
    + dsPhong.map(function (p) {
        const khongTD = p.canh_bao && p.canh_bao.so_su_co > 0 && !p.canh_bao.co_tac_dong;
        return '<tr><td><b>' + esc(p.ma) + '</b> ' + esc(p.ten || '') + '</td><td>' + esc(p.khu) + '</td>'
          + '<td class="so dam"><span class="' + lop(p.v) + '">' + phanTram(p.v) + '</span></td>'
          + '<td class="so">' + phanTram(p.v_truoc) + '</td>' + oChenh(p)
          + '<td' + (khongTD ? ' class="ls-xau"' : '') + '>' + (t.co_canh_bao ? esc(chuCanhBao(p.canh_bao)) : '—') + '</td>'
          + '<td>' + esc(chuKetQua(p.canh_bao)) + '</td></tr>';
      }).join('')
    + '</tbody></table></div>'
    + (t.co_canh_bao ? '<p class="mota">' + cauCanhBao(t) + '</p>' : '')
    + '<p class="mota">' + GHI_CHU.map(function (x) { return '<b>' + x[0] + ':</b> ' + x[1]; }).join('<br>') + '</p>';
}

module.exports = {
  tongHop: tongHop, htmlBanIn: htmlBanIn, cauDan: cauDan, cauCanhBao: cauCanhBao,
  chuChenh: chuChenh, chuCanhBao: chuCanhBao, chuKetQua: chuKetQua, xuHuong: xuHuong,
  GHI_CHU: GHI_CHU, NGUONG_BIEN_DONG: NGUONG_BIEN_DONG
};
