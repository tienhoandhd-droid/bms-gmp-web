'use strict';
/* ===========================================================================
 * CHÊNH ÁP TẠI CÁC PHÒNG THEO DÕI TRỌNG ĐIỂM — BA KỲ
 *
 * Yêu cầu người dùng 20–21/10/2026: số liệu "toàn khu" trong báo cáo tính chung
 * cả những phòng không thuộc diện theo dõi, nên cần thêm một mục chỉ tính các
 * phòng đang được cảnh báo chênh áp, so ba kỳ:
 *   · báo cáo tuần : tuần này · tháng lịch trước · quý lịch trước
 *   · báo cáo tháng: tháng này · hai tháng liền trước
 *   · báo cáo quý  : quý này · hai quý liền trước
 *
 * Phạm vi phòng KHÔNG gõ cứng: lấy theo cấu hình cảnh báo đang chạy
 * (cau_hinh.canh_bao_khu_vuc, canh_bao_muc_uu_tien), để báo cáo và cảnh báo
 * luôn nói về cùng một nhóm phòng.
 *
 * 29/10/2026: thêm pham_vi.phong — danh sách mã phòng lấy bằng chính hàm
 * trong_pham_vi_canh_bao(ma_phong, muc_uu_tien, 'DP') của hệ cảnh báo. Có danh sách
 * này thì lọc theo nó (bắt được cả phòng đặc cách canh_bao_bat_buoc, ví dụ 7 phòng
 * Mức 3 của Q2); không có (dữ liệu cũ) thì quay về lọc khu × mức như trước.
 *
 * Dữ liệu vào: d.dp_phong_theo_doi do node Supabase của WF5 dựng —
 *   { pham_vi: { khu: 'C1,Q2', muc: 'P1,P2', phong: ['C1.R11', ...] },
 *     ky: [ { loai: 'TUAN'|'THANG'|'QUY', tu: 'yyyy-mm-dd', den: 'yyyy-mm-dd',
 *             dp: rpc_chi_so_cam_bien(tu, den, NULL, 200)->'DP' }, ... ] }
 * Thiếu khối này (dữ liệu cũ) thì mục không hiện — báo cáo vẫn dựng bình thường.
 *
 * 29/10/2026 (lần 2): bảng tổng hợp thêm nhóm "phòng còn lại" — các phòng có cảm biến
 * chênh áp nhưng không thuộc diện theo dõi — để so tỷ lệ đạt / không đạt hai nhóm theo
 * từng khu và toàn nhà máy. Bản riêng một khu chỉ tính phòng còn lại của khu đó.
 *
 * 29/10/2026 (lần 3): người dùng chốt MỘT chỉ tiêu — tỷ lệ điểm đo đạt = tổng số điểm đo
 * chênh áp nằm trong giới hạn / tổng số điểm đo ghi được của các phòng trong nhóm (cộng
 * dồn điểm, không lấy trung bình theo phòng). Số điểm lấy từ ky[i].diem do WF5 dựng:
 *   diem: { 'C1.R11': [điểm ghi, điểm đạt], ... }   (du_lieu_gio: diem_hop_le, diem_oos)
 * Dữ liệu cũ không có diem: quay về tỷ lệ theo giờ của từng phòng, mỗi phòng một phiếu.
 *
 * Hai đầu ra:
 *   · htmlThu    — chỉ phần tổng hợp: khung "cần ưu tiên kiểm tra" và bảng theo khu.
 *   · htmlBanIn  — thêm bảng chi tiết từng phòng.
 * Cả hai viết kiểu dáng thẳng vào thẻ nên dùng chung được cho thư và bản in.
 * ========================================================================= */

const BD = require('./bieu-do-thu.js');
const NGUONG_DAT = 80;          // tô màu từng phòng: từ mức này trở lên là xanh — cùng NGUONG_HANH_DONG của bộ ráp
const NGUONG_UU_TIEN = 50;      // tỷ lệ điểm đo đạt của phòng dưới mức này: đưa vào khung "Cần ưu tiên kiểm tra"
const TEN_MUC = { P1: 'Mức 1', P2: 'Mức 2', P3: 'Mức 3' };
const SO_LA_MA = ['', 'I', 'II', 'III', 'IV'];

const MAU = {
  dat: { nen: '#E6F4EA', chu: '#1E6B3A', vach: '#2E8B57' },
  vua: { nen: '#FFF3DF', chu: '#8A4B00', vach: '#E08A00' },
  kem: { nen: '#FDE8E8', chu: '#A11A1A', vach: '#D33A3A' }
};
const MUC = '#1F2D3D', MUC2 = '#33475B', MO = '#6B7686', VIEN = '#E3E8EF', NEN = '#F7F9FB', XANH = '#1F4E79';

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function phanTram(v) { return (Math.round(Number(v) * 10) / 10).toFixed(1).replace('.', ',') + '%'; }
function so(v) { return String(Math.round(Number(v) * 10) / 10).replace('.', ','); }
function soNguyen(v) { return String(Math.round(Number(v))).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function tachDs(v) {
  return String(v == null ? '' : v).replace(/[[\]"{}]/g, '').split(',')
    .map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean);
}
function mauCua(v) { return v >= NGUONG_DAT ? MAU.dat : v >= NGUONG_UU_TIEN ? MAU.vua : MAU.kem; }

/* ----- Nhãn kỳ: "Tuần 41/2026", "Tháng 9/2026", "Quý III/2026" + dòng ngày ----- */
function ngayISO(s) { const p = String(s).slice(0, 10).split('-'); return { y: +p[0], m: +p[1], d: +p[2] }; }
function ddmm(x) { return String(x.d).padStart(2, '0') + '/' + String(x.m).padStart(2, '0'); }
function tuanISO(x) {
  const t = new Date(Date.UTC(x.y, x.m - 1, x.d));
  const thu = (t.getUTCDay() + 6) % 7;                  // thứ Hai = 0
  t.setUTCDate(t.getUTCDate() - thu + 3);               // thứ Năm của tuần đó
  const nam = t.getUTCFullYear();
  const dau = new Date(Date.UTC(nam, 0, 4));
  return { so: 1 + Math.round(((t - dau) / 86400000 - 3 + ((dau.getUTCDay() + 6) % 7)) / 7), nam: nam };
}
function nhanKy(k) {
  const tu = ngayISO(k.tu), den = ngayISO(k.den);
  const ngay = ddmm(tu) + ' – ' + ddmm(den);
  if (k.loai === 'THANG') return { ten: 'Tháng ' + tu.m + '/' + tu.y, ngay: ngay };
  if (k.loai === 'QUY') return { ten: 'Quý ' + SO_LA_MA[Math.ceil(tu.m / 3)] + '/' + tu.y, ngay: ngay };
  const w = tuanISO(tu);
  return { ten: 'Tuần ' + w.so + '/' + w.nam, ngay: ngay };
}

/* Hướng ra ngoài giới hạn: gio_lech là giờ thấp hơn giới hạn dưới (hướng nguy hiểm
 * của chênh áp), gio_lech_nguoc là giờ cao hơn giới hạn trên. */
function huong(c) {
  const lon = Math.max(c.duoi, c.tren), nho = Math.min(c.duoi, c.tren);
  if (lon <= 0) return '';
  if (nho >= lon / 3) return { ky_hieu: '↕', chu: 'ra ngoài cả hai phía giới hạn' };
  return c.duoi >= c.tren ? { ky_hieu: '↓', chu: 'thấp hơn giới hạn dưới' }
                          : { ky_hieu: '↑', chu: 'cao hơn giới hạn trên' };
}

/* ===== Gom số liệu ======================================================== */
function tongHop(d, khuBaoCao) {
  const goc = d && d.dp_phong_theo_doi;
  if (!goc || !Array.isArray(goc.ky) || !goc.ky.length) return null;
  const khuCB = tachDs((goc.pham_vi || {}).khu);
  const mucCB = tachDs((goc.pham_vi || {}).muc);
  const dsPhong = Array.isArray((goc.pham_vi || {}).phong) ? goc.pham_vi.phong.map(String) : null;
  if (!khuCB.length || (!mucCB.length && !dsPhong)) throw new Error('CHENH_AP_PHONG_THEO_DOI: thiếu cấu hình phạm vi cảnh báo');
  // Bản riêng một khu: chỉ giữ khu đó; khu nằm ngoài phạm vi cảnh báo thì không có mục này.
  const khuDung = khuBaoCao ? khuCB.filter(function (k) { return k === String(khuBaoCao).toUpperCase(); }) : khuCB;
  if (!khuDung.length) return null;

  const ky = goc.ky.map(function (k, i) {
    return Object.assign({ khoa: 'k' + i }, nhanKy(k),
      { loai: k.loai, tu: k.tu, den: k.den, dp: k.dp || {}, diem: k.diem || null });
  });
  const coDiem = ky.every(function (k) { return k.diem; });
  const phong = {}, tong = {}, conLai = {};
  // Mỗi nhóm cộng dồn: so = số phòng, ghi = điểm đo ghi được, dat = điểm đo trong giới hạn.
  const cong = function (bang, g, khoa, c) {
    const t = (bang[g] = bang[g] || {});
    const x = (t[khoa] = t[khoa] || { so: 0, ghi: 0, dat: 0 });
    x.so++; x.ghi += c.ghi; x.dat += c.dat;
  };
  ky.forEach(function (k) {
    (k.dp.top_phong || []).forEach(function (r) {
      const khu = String(r.khu_vuc || '').toUpperCase(), muc = String(r.muc_uu_tien || '').toUpperCase();
      if (khuBaoCao && khu !== String(khuBaoCao).toUpperCase()) return;
      const theoMuc = mucCB.indexOf(muc) >= 0;
      let c;
      if (coDiem) {
        const dm = k.diem[r.ma_phong];
        if (!Array.isArray(dm) || !(Number(dm[0]) > 0) || !(Number(dm[1]) >= 0) || Number(dm[1]) > Number(dm[0])) {
          throw new Error('CHENH_AP_PHONG_THEO_DOI: thiếu hoặc sai số điểm đo của ' + r.ma_phong + ' kỳ ' + k.loai);
        }
        c = { ghi: Number(dm[0]), dat: Number(dm[1]) };
      } else {
        const tl = Number(r.ty_le_trong_nguong);
        if (!Number.isFinite(tl)) throw new Error('CHENH_AP_PHONG_THEO_DOI: tỷ lệ không hợp lệ ' + r.ma_phong);
        c = { ghi: 1, dat: tl / 100 };          // dữ liệu cũ: mỗi phòng một phiếu
      }
      const v = 100 * c.dat / c.ghi;
      if (khuDung.indexOf(khu) < 0 || !(dsPhong ? dsPhong.indexOf(String(r.ma_phong)) >= 0 : theoMuc)) {
        // Phòng có cảm biến chênh áp nhưng không thuộc diện theo dõi.
        [khu, 'TAT_CA'].forEach(function (g) { cong(conLai, g, k.khoa, c); });
        return;
      }
      const p = phong[r.ma_phong] || (phong[r.ma_phong] = {
        ma: r.ma_phong, ten: r.ten_phong, khu: khu, muc: TEN_MUC[muc] || muc, dac_cach: !theoMuc,
        gioi_han: String(r.gioi_han || '').split('–').map(function (x) { return so(x.trim()); }).join(' – ')
          + (k.dp.don_vi ? ' ' + k.dp.don_vi : ''),
        ky: {} });
      p.ky[k.khoa] = { v: v, duoi: Number(r.gio_lech) || 0, tren: Number(r.gio_lech_nguoc) || 0 };
      [khu, 'TAT_CA'].forEach(function (g) { cong(tong, g, k.khoa, c); });
    });
  });
  const ds = Object.keys(phong).map(function (m) { return phong[m]; });
  if (!ds.length) return null;
  const k0 = ky[0].khoa;
  const diem = function (p) { return p.ky[k0] ? p.ky[k0].v : 999; };
  ds.sort(function (a, b) {
    return khuDung.indexOf(a.khu) - khuDung.indexOf(b.khu) || diem(a) - diem(b)
      || String(a.ma).localeCompare(String(b.ma), 'vi', { numeric: true });
  });
  const khu = khuDung.filter(function (k) { return tong[k]; });
  // Khu chỉ có phòng còn lại (ngoài phạm vi cảnh báo) xếp sau, theo thứ tự chữ.
  const khuBang = khu.concat(Object.keys(conLai).filter(function (k) {
    return k !== 'TAT_CA' && khu.indexOf(k) < 0;
  }).sort());
  return {
    ky: ky, khu: khu, khu_bang: khuBang, phong: ds, tong: tong, con_lai: conLai,
    toan_nha_may: !khuBaoCao, co_diem: coDiem,
    muc: mucCB.map(function (m) { return TEN_MUC[m] || m; }),
    so_dac_cach: ds.filter(function (p) { return p.dac_cach; }).length,
    uu_tien: ds.filter(function (p) { return p.ky[k0] && p.ky[k0].v < NGUONG_UU_TIEN; })
      .sort(function (a, b) { return a.ky[k0].v - b.ky[k0].v; })
  };
}

/* ===== Mảnh dựng chung ====================================================
 * Bố cục: phạm vi → chỉ tiêu → nhận xét chính → 1. toàn nhà máy → 2. theo khu và ba kỳ
 *   → 3. phòng cần ưu tiên → ghi chú; bản in thêm 4. chi tiết từng phòng.
 * Một chỉ tiêu duy nhất: tỷ lệ điểm đo đạt (yêu cầu 29/10/2026). */
const XANH_DAT = MAU.dat.vach, HONG_KDAT = '#EBA3A3';

function noiKhu(ds) { return ds.length > 1 ? ds.slice(0, -1).join(', ') + ' và ' + ds[ds.length - 1] : ds[0]; }
function thuong(k) { return k.ten.charAt(0).toLowerCase() + k.ten.slice(1); }
function nhomChinh(t) { return t.toan_nha_may ? 'TAT_CA' : t.khu_bang[0]; }
function lay(bang, g, khoa) { return ((bang || {})[g] || {})[khoa] || null; }
function tyLe(x) { return x && x.ghi > 0 ? 100 * x.dat / x.ghi : null; }
function soPhongNhom(t, bang, g) {
  return t.ky.reduce(function (m, k) { return Math.max(m, (lay(bang, g, k.khoa) || {}).so || 0); }, 0);
}
/* "122.027 / 221.760 điểm" — chỉ khi có số điểm thật. */
function soDiem(t, x) { return t.co_diem ? soNguyen(x.dat) + ' / ' + soNguyen(x.ghi) + ' điểm' : x.so + ' phòng'; }

/* Thanh ngang đạt / không đạt theo tỷ lệ điểm đo, dựng bằng bảng lồng cho mọi hộp thư. */
function thanh(x, cao) {
  const v = tyLe(x);
  if (v == null) return '';
  const p = Math.round(v);
  const o = function (w, mau) {
    return w > 0 ? '<td width="' + w + '%" style="background:' + mau + ';height:' + cao + 'px;font-size:0;line-height:0;">&nbsp;</td>' : '';
  };
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><tr>'
    + o(p, XANH_DAT) + o(100 - p, HONG_KDAT) + '</tr></table>';
}

function tieuDePhan(so, chu, phu) {
  return '<div style="margin:22px 0 10px;padding-bottom:5px;border-bottom:2px solid ' + XANH + ';">'
    + '<span style="font-size:15px;font-weight:700;color:' + XANH + ';">' + so + '. ' + chu + '</span>'
    + (phu ? ' <span style="font-size:12px;color:' + MO + ';">' + phu + '</span>' : '') + '</div>';
}

/* Phạm vi: hai nhóm phòng được so. */
function loiDan(t) {
  const g = nhomChinh(t), soCL = soPhongNhom(t, t.con_lai, g);
  return '<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:' + MUC2 + ';">'
    + 'So hai nhóm phòng có cảm biến chênh áp. <b>Phòng theo dõi</b> (' + t.phong.length + ' phòng): '
    + t.muc.join(' và ').toLowerCase() + ' tại khu ' + noiKhu(t.khu)
    + (t.so_dac_cach ? ' và ' + t.so_dac_cach + ' phòng mức thấp hơn được đặc cách' : '')
    + ', đúng nhóm đang được cảnh báo. '
    + (soCL ? '<b>Phòng còn lại</b> (' + soCL + ' phòng): không thuộc diện theo dõi.'
            : 'Không có phòng nào ngoài diện theo dõi.')
    + '</p>';
}

/* Chỉ tiêu: định nghĩa ngay đầu mục. */
function chiTieu(t) {
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 14px;'
    + 'border:1px solid ' + VIEN + ';border-radius:6px;background:' + NEN + ';"><tr><td style="padding:10px 14px;'
    + 'font-size:13px;line-height:1.6;color:' + MUC2 + ';">'
    + '<b style="color:' + MUC + ';">Chỉ tiêu: Tỷ lệ điểm đo đạt</b><br>'
    + (t.co_diem
        ? 'Tổng số điểm đo chênh áp nằm trong giới hạn chia cho tổng số điểm đo ghi được của các phòng trong nhóm '
          + '(mỗi cảm biến ghi khoảng một điểm mỗi phút). Phần còn lại là <b>tỷ lệ không đạt</b>.'
        : 'Trung bình tỷ lệ thời gian chênh áp nằm trong giới hạn của các phòng trong nhóm (dữ liệu kỳ này chưa có số điểm đo).')
    + '</td></tr></table>';
}

/* Nhận xét chính: câu kết luận rút từ số liệu. */
function diemChinh(t) {
  const g = nhomChinh(t), k0 = t.ky[0], k1 = t.ky[1];
  const a = lay(t.tong, g, k0.khoa), b = lay(t.con_lai, g, k0.khoa);
  if (!a) return '';
  const cau = [];
  cau.push('Phòng theo dõi: <b>' + phanTram(tyLe(a)) + '</b> điểm đo đạt, không đạt ' + phanTram(100 - tyLe(a))
    + (t.co_diem ? ' (' + soNguyen(a.dat) + ' trên ' + soNguyen(a.ghi) + ' điểm).' : '.'));
  if (b) {
    cau.push('Phòng còn lại: <b>' + phanTram(tyLe(b)) + '</b> điểm đo đạt, không đạt ' + phanTram(100 - tyLe(b))
      + (t.co_diem ? ' (' + soNguyen(b.dat) + ' trên ' + soNguyen(b.ghi) + ' điểm).' : '.'));
  }
  const a1 = k1 ? lay(t.tong, g, k1.khoa) : null;
  if (a1) {
    const lech = tyLe(a) - tyLe(a1);
    cau.push('So với ' + esc(thuong(k1)) + ' (' + phanTram(tyLe(a1)) + '), phòng theo dõi '
      + (Math.abs(lech) < 0.05 ? 'không đổi.' : (lech > 0 ? 'tăng ' : 'giảm ') + so(Math.abs(lech)) + ' điểm %.'));
  }
  if (t.toan_nha_may && t.khu.length > 1) {
    const xep = t.khu.map(function (k) { return { khu: k, v: tyLe(lay(t.tong, k, k0.khoa)) }; })
      .filter(function (x) { return x.v != null; }).sort(function (x, y) { return y.v - x.v; });
    if (xep.length > 1 && xep[0].v !== xep[xep.length - 1].v) {
      cau.push('Theo khu, phòng theo dõi đạt cao nhất ở khu ' + esc(xep[0].khu) + ' (' + phanTram(xep[0].v)
        + '), thấp nhất ở khu ' + esc(xep[xep.length - 1].khu) + ' (' + phanTram(xep[xep.length - 1].v) + ').');
    }
  }
  if (t.uu_tien.length) {
    cau.push('<b>' + t.uu_tien.length + ' phòng theo dõi</b> có tỷ lệ điểm đo đạt dưới ' + NGUONG_UU_TIEN
      + '%, cần ưu tiên kiểm tra (phần 3).');
  }
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 6px;'
    + 'background:#F4F8FC;border-left:4px solid ' + XANH + ';border-radius:6px;"><tr><td style="padding:10px 16px;">'
    + '<div style="font-size:14px;font-weight:700;color:' + XANH + ';margin-bottom:4px;">Nhận xét chính · ' + esc(thuong(k0))
    + ' <span style="font-weight:400;color:' + MO + ';font-size:12px;">(' + esc(k0.ngay) + ')</span></div>'
    + cau.map(function (c) {
      return '<div style="font-size:14px;line-height:1.6;color:' + MUC2 + ';padding:1px 0;">• ' + c + '</div>';
    }).join('')
    + '</td></tr></table>';
}

/* Phần 1 — toàn nhà máy (hoặc khu của bản riêng), kỳ này: mỗi nhóm một cột. */
function bangKyNay(t) {
  const g = nhomChinh(t), k0 = t.ky[0];
  const nhom = [['Phòng theo dõi', t.tong], ['Phòng còn lại', t.con_lai]]
    .filter(function (n) { return soPhongNhom(t, n[1], g); });
  const O = 'padding:12px 12px;vertical-align:top;';
  const o = function (x) {
    if (!x) return '<td style="' + O + 'color:#9AA7B3;">—</td>';
    const v = tyLe(x);
    return '<td style="' + O + '">'
      + '<div style="font-size:12px;color:' + MO + ';margin-bottom:2px;">Tỷ lệ điểm đo đạt</div>'
      + '<div style="font-size:28px;font-weight:700;color:' + MUC + ';line-height:1.1;">' + phanTram(v) + '</div>'
      + '<div style="margin:8px 0 5px;">' + thanh(x, 10) + '</div>'
      + '<div style="font-size:12px;color:' + MUC2 + ';"><span style="color:' + XANH_DAT + ';">■</span> Đạt ' + phanTram(v)
      + ' &nbsp; <span style="color:' + HONG_KDAT + ';">■</span> Không đạt ' + phanTram(100 - v) + '</div>'
      + (t.co_diem ? '<div style="font-size:12px;color:' + MO + ';margin-top:4px;">' + soNguyen(x.dat) + ' / '
        + soNguyen(x.ghi) + ' điểm đo đạt</div>' : '')
      + '</td>';
  };
  return tieuDePhan(1, t.toan_nha_may ? 'Toàn nhà máy' : 'Khu ' + esc(g), esc(thuong(k0)) + ' (' + esc(k0.ngay) + ')')
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border:1px solid #D9E1E8;">'
    + '<tr>' + nhom.map(function (n) {
      return '<th align="left" width="' + Math.floor(100 / nhom.length) + '%" style="' + TH + 'text-align:left;padding-left:12px;">' + n[0]
        + ' <span style="font-weight:400;color:#7A8A99;">· ' + soPhongNhom(t, n[1], g) + ' phòng</span></th>';
    }).join('') + '</tr>'
    + '<tr>' + nhom.map(function (n) { return o(lay(n[1], g, k0.khoa)); }).join('') + '</tr>'
    + '</table>';
}

/* Phần 2 — theo khu và qua ba kỳ: mỗi ô là tỷ lệ điểm đo đạt kèm thanh và tỷ lệ không đạt. */
function bangTongHop(t) {
  const O = 'padding:8px 6px;border-bottom:1px solid ' + VIEN + ';vertical-align:top;';
  const oKy = function (x) {
    if (!x) return '<td align="center" style="' + O + 'color:#9AA7B3;">—</td>';
    const v = tyLe(x);
    return '<td style="' + O + '">'
      + '<div style="font-size:15px;font-weight:700;color:' + MUC + ';margin-bottom:3px;">' + phanTram(v) + '</div>'
      + thanh(x, 5)
      + '<div style="font-size:11px;color:' + MO + ';margin-top:3px;white-space:nowrap;">không đạt ' + phanTram(100 - v) + '</div></td>';
  };
  const khoiKhu = function (nhanKhu, g, nen) {
    const nhom = [['Theo dõi', t.tong], ['Còn lại', t.con_lai]].filter(function (n) { return soPhongNhom(t, n[1], g); });
    return nhom.map(function (n, i) {
      return '<tr' + (nen ? ' style="background:' + NEN + ';"' : '') + '>'
        + (i === 0 ? '<td rowspan="' + nhom.length + '" style="' + O + 'font-size:13px;font-weight:700;color:' + MUC
          + ';border-right:1px solid ' + VIEN + ';">' + nhanKhu + '</td>' : '')
        + '<td style="' + O + 'font-size:12px;color:' + MUC2 + ';">' + n[0]
        + '<div style="font-size:11px;color:' + MO + ';">' + soPhongNhom(t, n[1], g) + ' phòng</div></td>'
        + t.ky.map(function (k) { return oKy(lay(n[1], g, k.khoa)); }).join('') + '</tr>';
    }).join('');
  };
  return tieuDePhan(2, t.toan_nha_may ? 'Theo khu vực, qua ba kỳ' : 'Qua ba kỳ', 'tỷ lệ điểm đo đạt')
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border:1px solid #D9E1E8;">'
    + '<tr><th align="left" style="' + TH + 'text-align:left;">Khu</th><th align="left" style="' + TH + 'text-align:left;">Nhóm</th>'
    + t.ky.map(function (k) {
      return '<th align="left" style="' + TH + 'text-align:left;">' + esc(k.ten)
        + '<br><span style="font-weight:400;color:#7A8A99;">' + esc(k.ngay) + '</span></th>';
    }).join('') + '</tr>'
    + t.khu_bang.map(function (khu) { return khoiKhu('Khu ' + esc(khu), khu, false); }).join('')
    + (t.toan_nha_may && t.khu_bang.length > 1 ? khoiKhu('Toàn nhà máy', 'TAT_CA', true) : '')
    + '</table>';
}

/* Ghi chú: những điều cần biết để đọc đúng số liệu. */
function ghiChu() {
  const dong = [
    ['Cách cộng', 'cộng dồn điểm đo của mọi phòng trong nhóm rồi mới chia, nên phòng có nhiều điểm đo hơn ảnh hưởng nhiều hơn.'],
    ['Hai phía giới hạn', 'điểm đo thấp hơn giới hạn dưới hay cao hơn giới hạn trên đều tính là không đạt.'],
    ['Ba kỳ', 'tuần, tháng và quý dài ngắn khác nhau; kỳ dài làm mịn dao động, nên dùng để xem xu hướng.'],
    ['Dữ liệu', 'chỉ tính điểm đo hợp lệ; khoảng thời gian mất dữ liệu không được tính.']
  ];
  return '<div style="margin-top:16px;padding:10px 14px;background:' + NEN + ';border-radius:6px;font-size:12px;line-height:1.6;color:#4A5D70;">'
    + '<b style="color:' + MUC2 + ';">Ghi chú</b>'
    + dong.map(function (d) { return '<div><b>' + d[0] + ':</b> ' + d[1] + '</div>'; }).join('') + '</div>';
}

function hopUuTien(t) {
  if (!t.uu_tien.length) return '';
  const k0 = t.ky[0];
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px;'
    + 'background:#FFF6F6;border:1px solid #F3C9C9;border-left:4px solid ' + MAU.kem.vach + ';border-radius:6px;">'
    + '<tr><td style="padding:12px 14px;">'
    + '<div style="font-size:14px;font-weight:700;color:' + MAU.kem.chu + ';margin-bottom:6px;">' + t.uu_tien.length
    + ' phòng theo dõi có tỷ lệ điểm đo đạt dưới ' + NGUONG_UU_TIEN + '% trong '
    + esc(thuong(k0)) + '</div>'
    + t.uu_tien.map(function (p) {
      const h = huong(p.ky[k0.khoa]);
      return '<div style="font-size:14px;color:' + MUC2 + ';padding:2px 0;line-height:1.5;"><b>' + esc(p.ma) + '</b> '
        + esc(p.ten) + ' — <b style="color:' + MAU.kem.chu + ';">' + phanTram(p.ky[k0.khoa].v) + '</b>'
        + (h ? ', ' + (h.ky_hieu === '↕' ? '' : 'chủ yếu ') + esc(h.chu) : '') + '</div>';
    }).join('')
    + '</td></tr></table>';
}

const TH = 'padding:10px 6px;background:#F3F6F9;border-bottom:1px solid #D9E1E8;font-size:12px;color:#4A5D70;font-weight:600;';
function dauCot(t, cot1) {
  return '<tr><th align="left" style="' + TH + 'text-align:left;">' + cot1 + '</th>'
    + t.ky.map(function (k) {
      return '<th align="center" style="' + TH + 'text-align:center;">' + esc(k.ten)
        + '<br><span style="font-weight:400;color:#7A8A99;">' + esc(k.ngay) + '</span></th>';
    }).join('') + '</tr>';
}

function chuGiai() {
  return '<div style="margin:0 0 10px;font-size:12px;line-height:1.8;color:#4A5D70;">'
    + [['dat', 'Từ ' + NGUONG_DAT + '% điểm đo đạt trở lên'], ['vua', 'Từ ' + NGUONG_UU_TIEN + '% đến dưới ' + NGUONG_DAT + '%'],
       ['kem', 'Dưới ' + NGUONG_UU_TIEN + '%']].map(function (x) {
      return '<span style="display:inline-block;margin-right:14px;white-space:nowrap;"><span style="display:inline-block;'
        + 'width:10px;height:10px;border-radius:2px;background:' + MAU[x[0]].vach + ';vertical-align:middle;"></span>&nbsp;' + x[1] + '</span>';
    }).join('') + '</div>';
}

function bangChiTiet(t) {
  const oPhong = function (c) {
    if (!c) return '<td align="center" style="padding:10px 4px;border-bottom:1px solid #EEF1F4;color:#9AA7B3;">—</td>';
    const m = mauCua(c.v), cao = c.v >= NGUONG_DAT, h = huong(c);
    return '<td align="center" style="padding:10px 4px;border-bottom:1px solid #EEF1F4;vertical-align:top;">'
      + '<div style="display:inline-block;min-width:52px;padding:3px 6px;border-radius:12px;background:' + m.nen
      + ';color:' + m.chu + ';font-size:13px;font-weight:700;">' + phanTram(c.v) + '</div>'
      // Chỉ ghi hướng lệch cho phòng dưới ngưỡng tô xanh; không dán nhãn "đạt" cho từng phòng
      // vì mục chỉ dùng một chỉ tiêu là tỷ lệ điểm đo đạt.
      + (cao ? '' : '<div style="font-size:11px;color:#5D6F80;margin-top:4px;line-height:1.35;">'
               + (h ? h.ky_hieu + ' ' + esc(h.chu) : '') + '</div>')
      + '</td>';
  };
  let than = '';
  t.khu.forEach(function (khu) {
    const ds = t.phong.filter(function (p) { return p.khu === khu; });
    than += '<tr><td colspan="' + (t.ky.length + 1) + '" style="padding:14px 8px 8px;border-bottom:2px solid ' + XANH
      + ';font-size:13px;font-weight:700;color:' + XANH + ';letter-spacing:.03em;">KHU ' + esc(khu)
      + ' <span style="font-weight:400;color:#7A8A99;letter-spacing:0;">· ' + ds.length + ' phòng theo dõi</span></td></tr>';
    than += ds.map(function (p) {
      return '<tr><td style="padding:10px 8px;border-bottom:1px solid #EEF1F4;vertical-align:top;">'
        + '<div style="font-size:13px;color:' + MUC + ';"><b>' + esc(p.ma) + '</b></div>'
        + '<div style="font-size:13px;color:' + MUC2 + ';">' + esc(p.ten) + '</div>'
        + '<div style="font-size:11px;color:#7A8A99;margin-top:2px;">' + esc(p.muc) + (p.dac_cach ? ' · đặc cách theo dõi' : '') + ' · giới hạn ' + esc(p.gioi_han) + '</div></td>'
        + t.ky.map(function (k) { return oPhong(p.ky[k.khoa]); }).join('') + '</tr>';
    }).join('');
  });
  return chuGiai()
    + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">'
    + dauCot(t, 'Phòng') + than + '</table>'
    + '<div style="margin-top:14px;padding:12px 14px;background:' + NEN + ';border-radius:6px;font-size:12px;line-height:1.6;color:#4A5D70;">'
    + '<div style="margin-bottom:4px;"><b>Hướng ra ngoài giới hạn:</b> với phòng dưới ' + NGUONG_DAT + '%, dòng chữ nhỏ cho biết chênh áp chủ yếu '
    + 'thấp hơn giới hạn dưới (↓), cao hơn giới hạn trên (↑) hay ra ngoài cả hai phía (↕). Chênh áp thấp hơn giới hạn dưới '
    + 'là hướng có nguy cơ nhiễm chéo, cần ưu tiên kiểm tra.</div>'
    + '<div><b>Thứ tự:</b> xếp theo khu vực; trong mỗi khu, phòng có tỷ lệ kỳ này thấp nhất đứng trước. '
    + 'Dấu “—” nghĩa là phòng không có dữ liệu đo trong kỳ đó.</div></div>';
}

/* ===== Hai đầu ra ========================================================= */
function phanChung(t) {
  return loiDan(t) + chiTieu(t) + diemChinh(t) + bangKyNay(t) + bangTongHop(t)
    + (t.uu_tien.length ? tieuDePhan(3, 'Phòng theo dõi cần ưu tiên kiểm tra') + hopUuTien(t) : '');
}

function htmlThu(t) {
  if (!t) return '';
  return phanChung(t) + ghiChu()
    + '<div style="font-size:13px;color:' + MO + ';margin-top:10px;">Tỷ lệ từng phòng và hướng ra ngoài giới hạn: '
    + 'xem bảng chi tiết trong bản in đính kèm.</div>';
}

/* Số tóm tắt cho phần Kết luận của thư. */
function tomTat(t) {
  if (!t) return null;
  const g = nhomChinh(t), k0 = t.ky[0], k1 = t.ky[1];
  const v = tyLe(lay(t.tong, g, k0.khoa));
  const vTruoc = k1 ? tyLe(lay(t.tong, g, k1.khoa)) : null;
  const cl = lay(t.con_lai, g, k0.khoa);
  return {
    ty_le: v, so_phong: t.phong.length,
    phong_dat: t.phong.filter(function (p) { return p.ky[k0.khoa] && p.ky[k0.khoa].v >= NGUONG_DAT; }).length,
    so_uu_tien: t.uu_tien.length, nguong_uu_tien: NGUONG_UU_TIEN, nguong_dat: NGUONG_DAT,
    ty_le_truoc: vTruoc, ten_ky_truoc: k1 ? thuong(k1) : null,
    chenh: vTruoc == null ? null : Math.round((v - vTruoc) * 10) / 10,
    ty_le_con_lai: cl ? tyLe(cl) : null, so_con_lai: soPhongNhom(t, t.con_lai, g),
    theo_khu: t.khu.map(function (k) {
      const ds = t.phong.filter(function (p) { return p.khu === k && p.ky[k0.khoa]; });
      return {
        khu: k, ty_le: tyLe(lay(t.tong, k, k0.khoa)), so_phong: ds.length,
        phong_dat: ds.filter(function (p) { return p.ky[k0.khoa].v >= NGUONG_DAT; }).length
      };
    }).filter(function (x) { return x.ty_le != null; })
  };
}

/* Bản rút gọn cho thư: một câu chính, một bảng ba kỳ, danh sách phòng ưu tiên; chi tiết nằm trong bản in. */
function htmlThuGon(t) {
  if (!t) return '';
  const g = nhomChinh(t), k0 = t.ky[0], k1 = t.ky[1];
  const cau = '<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:' + MUC2 + ';">'
    + 'Mục này <b>chỉ nói về chênh áp</b>. <b>Phòng theo dõi</b> là các phòng đang được cảnh báo chênh áp; phòng còn lại đưa vào để so sánh.</p>';
  const TDT = 'padding:8px;background:' + NEN + ';border-bottom:1px solid ' + MUC2 + ';font-size:12px;font-weight:600;color:' + MUC2 + ';vertical-align:bottom;';
  const O = 'padding:9px 8px;border-bottom:1px solid ' + VIEN + ';font-size:14px;color:' + MUC + ';vertical-align:top;';
  const dong = function (ten, bang, nhom, dam) {
    const n = soPhongNhom(t, bang, nhom);
    if (!n) return '';
    const s = dam ? 'font-weight:700;background:' + NEN + ';' : '';
    return '<tr><td style="' + O + s + 'padding-left:0;">' + ten + ' <span style="font-size:12px;font-weight:400;color:' + MO + ';white-space:nowrap;">' + n + ' phòng</span></td>'
      + t.ky.map(function (k, i) {
        const x = lay(bang, nhom, k.khoa);
        return '<td class="d dp' + (i === t.ky.length - 1 ? ' dr' : '') + '" style="' + O + s + 'text-align:right;' + (i === 0 ? 'font-weight:700;' : '') + '">' + (x ? phanTram(tyLe(x))
          // Chỉ kỳ này có thanh: ba kỳ đều có thanh thì thư quá nặng.
          + (i === 0 ? '<div style="margin-top:4px;">' + BD.thanh(tyLe(x), { nguong: NGUONG_DAT, cao: 5 }) + '</div>' : '') : '—') + '</td>';
      }).join('') + '</tr>';
  };
  const bang = '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><tr>'
    + '<th class="h dl" style="' + TDT + 'text-align:left;padding-left:0;">Tỷ lệ đạt chênh áp theo nhóm phòng</th>'
    + t.ky.map(function (k, i) {
      return '<th class="h dp' + (i === t.ky.length - 1 ? ' dr' : '') + '" style="' + TDT + 'text-align:right;">' + esc(k.ten)
        + '<br><span style="font-weight:400;">' + esc(k.ngay) + '</span></th>';
    }).join('') + '</tr>'
    + t.khu_bang.map(function (khu) {
      return dong('Khu ' + esc(khu) + ' · theo dõi', t.tong, khu) + dong('Khu ' + esc(khu) + ' · còn lại', t.con_lai, khu);
    }).join('')
    + (t.toan_nha_may && t.khu_bang.length > 1
      ? dong('Toàn nhà máy · theo dõi', t.tong, 'TAT_CA', true) + dong('Toàn nhà máy · còn lại', t.con_lai, 'TAT_CA', true) : '')
    + '</table>';
  const uu = t.uu_tien.length
    ? '<div style="margin-top:14px;font-size:14px;font-weight:700;color:' + MUC + ';">' + t.uu_tien.length
      + ' phòng theo dõi có tỷ lệ đạt chênh áp dưới ' + NGUONG_UU_TIEN + '%, cần ưu tiên kiểm tra</div>'
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:4px;">'
      + t.uu_tien.map(function (p) {
        const h = huong(p.ky[k0.khoa]);
        return '<tr><td style="padding:6px 8px 6px 0;font-size:14px;color:' + MUC2 + ';line-height:1.35;vertical-align:top;"><b>' + esc(p.ma) + '</b> ' + esc(p.ten)
          + (h ? '<div style="font-size:12px;color:' + MO + ';">' + (h.ky_hieu === '↕' ? '' : 'chủ yếu ') + esc(h.chu) + '</div>' : '') + '</td>'
          + '<td width="26%" style="width:26%;padding:10px 8px 6px 0;vertical-align:top;">' + BD.thanh(p.ky[k0.khoa].v, { nguong: NGUONG_DAT, cao: 8 }) + '</td>'
          + '<td width="46" style="width:46px;padding:6px 0;text-align:right;font-size:14px;font-weight:700;color:' + MAU.kem.chu + ';white-space:nowrap;vertical-align:top;">' + phanTram(p.ky[k0.khoa].v) + '</td></tr>';
      }).join('') + '</table>'
    : '';
  return cau + bang + uu + '<div style="font-size:13px;color:' + MO + ';margin-top:10px;">Tỷ lệ từng phòng xem trong bản in đính kèm.</div>';
}

function htmlBanIn(t) {
  if (!t) return '';
  return phanChung(t)
    + tieuDePhan(t.uu_tien.length ? 4 : 3, 'Chi tiết từng phòng theo dõi', 'tỷ lệ điểm đo đạt của từng phòng')
    + bangChiTiet(t) + ghiChu();
}

module.exports = { tongHop: tongHop, htmlThu: htmlThu, htmlThuGon: htmlThuGon, tomTat: tomTat, htmlBanIn: htmlBanIn, nhanKy: nhanKy, NGUONG_DAT: NGUONG_DAT };
