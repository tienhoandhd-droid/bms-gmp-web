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
 * Hai đầu ra:
 *   · htmlThu    — chỉ phần tổng hợp: khung "cần ưu tiên kiểm tra" và bảng theo khu.
 *   · htmlBanIn  — thêm bảng chi tiết từng phòng.
 * Cả hai viết kiểu dáng thẳng vào thẻ nên dùng chung được cho thư và bản in.
 * ========================================================================= */

const NGUONG_DAT = 80;          // % thời gian trong giới hạn — cùng NGUONG_HANH_DONG của bộ ráp
const NGUONG_UU_TIEN = 50;      // dưới mức này đưa vào khung "Cần ưu tiên kiểm tra"
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
    return Object.assign({ khoa: 'k' + i }, nhanKy(k), { loai: k.loai, tu: k.tu, den: k.den, dp: k.dp || {} });
  });
  const phong = {}, tong = {};
  ky.forEach(function (k) {
    (k.dp.top_phong || []).forEach(function (r) {
      const khu = String(r.khu_vuc || '').toUpperCase(), muc = String(r.muc_uu_tien || '').toUpperCase();
      const theoMuc = mucCB.indexOf(muc) >= 0;
      if (khuDung.indexOf(khu) < 0 || !(dsPhong ? dsPhong.indexOf(String(r.ma_phong)) >= 0 : theoMuc)) return;
      const v = Number(r.ty_le_trong_nguong);
      if (!Number.isFinite(v)) throw new Error('CHENH_AP_PHONG_THEO_DOI: tỷ lệ không hợp lệ ' + r.ma_phong);
      const p = phong[r.ma_phong] || (phong[r.ma_phong] = {
        ma: r.ma_phong, ten: r.ten_phong, khu: khu, muc: TEN_MUC[muc] || muc, dac_cach: !theoMuc,
        gioi_han: String(r.gioi_han || '').split('–').map(function (x) { return so(x.trim()); }).join(' – ')
          + (k.dp.don_vi ? ' ' + k.dp.don_vi : ''),
        ky: {} });
      p.ky[k.khoa] = { v: v, duoi: Number(r.gio_lech) || 0, tren: Number(r.gio_lech_nguoc) || 0 };
      [khu, 'TAT_CA'].forEach(function (g) {
        const t = (tong[g] = tong[g] || {});
        const x = (t[k.khoa] = t[k.khoa] || { so: 0, dat: 0, cong: 0 });
        x.so++; x.cong += v; if (v >= NGUONG_DAT) x.dat++;
      });
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
  return {
    ky: ky, khu: khu, phong: ds, tong: tong, muc: mucCB.map(function (m) { return TEN_MUC[m] || m; }),
    so_dac_cach: ds.filter(function (p) { return p.dac_cach; }).length,
    uu_tien: ds.filter(function (p) { return p.ky[k0] && p.ky[k0].v < NGUONG_UU_TIEN; })
      .sort(function (a, b) { return a.ky[k0].v - b.ky[k0].v; })
  };
}

/* ===== Mảnh dựng chung ==================================================== */
function noiKhu(ds) { return ds.length > 1 ? ds.slice(0, -1).join(', ') + ' và ' + ds[ds.length - 1] : ds[0]; }

function loiDan(t) {
  return '<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:' + MUC2 + ';">'
    + 'Chỉ tính <b>' + t.phong.length + ' phòng theo dõi trọng điểm</b>: phòng có cảm biến chênh áp, '
    + t.muc.join(' và ').toLowerCase() + ' ưu tiên giám sát, tại khu ' + noiKhu(t.khu)
    + (t.so_dac_cach ? ', cùng ' + t.so_dac_cach + ' phòng mức thấp hơn được đặc cách theo dõi' : '')
    + ' — đúng nhóm phòng đang được cảnh báo. '
    + 'Số liệu “toàn khu” ở các phần khác tính chung cả những phòng không thuộc diện theo dõi, '
    + 'nên hai cách tính có thể cho kết quả khác nhau.</p>';
}

function hopUuTien(t) {
  if (!t.uu_tien.length) return '';
  const k0 = t.ky[0];
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px;'
    + 'background:#FFF6F6;border:1px solid #F3C9C9;border-left:4px solid ' + MAU.kem.vach + ';border-radius:6px;">'
    + '<tr><td style="padding:12px 14px;">'
    + '<div style="font-size:14px;font-weight:700;color:' + MAU.kem.chu + ';margin-bottom:6px;">Cần ưu tiên kiểm tra · '
    + esc(k0.ten.charAt(0).toLowerCase() + k0.ten.slice(1)) + ' đạt dưới ' + NGUONG_UU_TIEN + '% thời gian</div>'
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

function bangTongHop(t) {
  const oKy = function (x) {
    if (!x) return '<td align="center" style="padding:12px 4px;border-bottom:1px solid ' + VIEN + ';color:#9AA7B3;">—</td>';
    const tb = x.cong / x.so, m = mauCua(tb);
    return '<td align="center" style="padding:12px 4px;border-bottom:1px solid ' + VIEN + ';vertical-align:top;">'
      + '<div style="font-size:20px;font-weight:700;color:' + (x.dat === x.so ? MAU.dat.chu : MUC) + ';">' + x.dat
      + '<span style="font-size:13px;font-weight:400;color:#7A8A99;">/' + x.so + '</span></div>'
      + '<div style="font-size:11px;color:#7A8A99;">phòng đạt</div>'
      + '<div style="display:inline-block;margin-top:6px;padding:2px 8px;border-radius:10px;background:' + m.nen
      + ';color:' + m.chu + ';font-size:12px;font-weight:600;line-height:1.3;">'
      + '<span style="font-weight:400;font-size:11px;">trung bình</span><br>' + phanTram(tb) + '</div></td>';
  };
  const dong = function (nhan, phu, g, nen) {
    return '<tr' + (nen ? ' style="background:' + NEN + ';"' : '') + '>'
      + '<td style="padding:12px 8px;border-bottom:1px solid ' + VIEN + ';vertical-align:top;">'
      + '<div style="font-size:14px;font-weight:700;color:' + MUC + ';">' + nhan + '</div>'
      + '<div style="font-size:12px;color:#7A8A99;">' + phu + '</div></td>'
      + t.ky.map(function (k) { return oKy((t.tong[g] || {})[k.khoa]); }).join('') + '</tr>';
  };
  const demKhu = function (khu) { return t.phong.filter(function (p) { return p.khu === khu; }).length; };
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" '
    + 'style="border-collapse:collapse;border:1px solid #D9E1E8;">'
    + dauCot(t, 'Khu vực')
    + t.khu.map(function (khu) { return dong('Khu ' + esc(khu), demKhu(khu) + ' phòng theo dõi', khu, false); }).join('')
    + (t.khu.length > 1
        ? dong(t.khu.length === 2 ? 'Cả hai khu' : 'Cả ' + t.khu.length + ' khu', t.phong.length + ' phòng theo dõi', 'TAT_CA', true)
        : '')
    + '</table>'
    + '<div style="font-size:12px;color:' + MO + ';margin-top:6px;line-height:1.5;">Phòng đạt: tỷ lệ thời gian chênh áp trong giới hạn từ '
    + NGUONG_DAT + '% trở lên. Trung bình: trung bình cộng tỷ lệ của các phòng theo dõi trong khu.</div>';
}

function chuGiai() {
  return '<div style="margin:0 0 10px;font-size:12px;line-height:1.8;color:#4A5D70;">'
    + [['dat', 'Đạt: từ ' + NGUONG_DAT + '% trở lên'], ['vua', 'Không đạt: ' + NGUONG_UU_TIEN + '% đến dưới ' + NGUONG_DAT + '%'],
       ['kem', 'Không đạt: dưới ' + NGUONG_UU_TIEN + '%']].map(function (x) {
      return '<span style="display:inline-block;margin-right:14px;white-space:nowrap;"><span style="display:inline-block;'
        + 'width:10px;height:10px;border-radius:2px;background:' + MAU[x[0]].vach + ';vertical-align:middle;"></span>&nbsp;' + x[1] + '</span>';
    }).join('') + '</div>';
}

function bangChiTiet(t) {
  const oPhong = function (c) {
    if (!c) return '<td align="center" style="padding:10px 4px;border-bottom:1px solid #EEF1F4;color:#9AA7B3;">—</td>';
    const m = mauCua(c.v), dat = c.v >= NGUONG_DAT, h = huong(c);
    return '<td align="center" style="padding:10px 4px;border-bottom:1px solid #EEF1F4;vertical-align:top;">'
      + '<div style="display:inline-block;min-width:52px;padding:3px 6px;border-radius:12px;background:' + m.nen
      + ';color:' + m.chu + ';font-size:13px;font-weight:700;">' + phanTram(c.v) + '</div>'
      + (dat ? '<div style="font-size:11px;color:' + MAU.dat.chu + ';margin-top:4px;">✓ đạt</div>'
             : '<div style="font-size:11px;color:#5D6F80;margin-top:4px;line-height:1.35;">'
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
    + '<div style="margin-bottom:4px;"><b>Cách tính:</b> tỷ lệ đạt bằng số giờ chênh áp nằm trong giới hạn cho phép chia cho '
    + 'tổng số giờ có dữ liệu đo trong kỳ. Những giờ không có dữ liệu đo không được tính.</div>'
    + '<div style="margin-bottom:4px;"><b>Hướng ra ngoài giới hạn:</b> với phòng không đạt, dòng chữ nhỏ cho biết chênh áp chủ yếu '
    + 'thấp hơn giới hạn dưới (↓), cao hơn giới hạn trên (↑) hay ra ngoài cả hai phía (↕). Chênh áp thấp hơn giới hạn dưới '
    + 'là hướng có nguy cơ nhiễm chéo, cần ưu tiên kiểm tra.</div>'
    + '<div><b>Thứ tự:</b> xếp theo khu vực; trong mỗi khu, phòng có tỷ lệ kỳ này thấp nhất đứng trước. '
    + 'Dấu “—” nghĩa là phòng không có dữ liệu đo trong kỳ đó.</div></div>';
}

/* ===== Hai đầu ra ========================================================= */
function htmlThu(t) {
  if (!t) return '';
  return loiDan(t) + hopUuTien(t) + bangTongHop(t)
    + '<div style="font-size:13px;color:' + MO + ';margin-top:10px;">Tỷ lệ từng phòng và hướng ra ngoài giới hạn: '
    + 'xem bảng chi tiết trong bản in đính kèm.</div>';
}

function htmlBanIn(t) {
  if (!t) return '';
  // Tiêu đề nhỏ viết thẳng kiểu dáng: bản in đã dùng h3 cho mục con (3.1, 3.2...) nên không thêm h3.
  const tieuDeNho = function (chu) {
    return '<div style="font-size:15px;font-weight:700;color:' + MUC + ';margin:22px 0 10px;">' + chu + '</div>';
  };
  return loiDan(t) + hopUuTien(t)
    + tieuDeNho('Tổng hợp theo khu vực') + bangTongHop(t)
    + tieuDeNho('Chi tiết từng phòng') + bangChiTiet(t);
}

module.exports = { tongHop: tongHop, htmlThu: htmlThu, htmlBanIn: htmlBanIn, NGUONG_DAT: NGUONG_DAT };
