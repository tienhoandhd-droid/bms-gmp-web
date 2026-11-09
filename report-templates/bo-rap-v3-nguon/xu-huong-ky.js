'use strict';
/* ===========================================================================
 * XU HƯỚNG TUẦN VÀ XU HƯỚNG THÁNG CHO THƯ / BẢN IN THÁNG, QUÝ
 *
 * Yêu cầu người dùng 09/11/2026: báo cáo tháng và quý dùng form của báo cáo tuần,
 * thêm dữ liệu xu hướng tuần và xu hướng tháng để biết tình trạng chi tiết.
 * Chốt: xu hướng tháng lấy 3 tháng (thư tháng: tháng này + 2 tháng trước;
 * thư quý: 3 tháng của quý). Thư tuần không có mục này.
 *
 * Dữ liệu vào: d.xu_huong_chi_tiet do node Supabase của WF5 cấp (chỉ cho THANG, QUY):
 *   { phong_khu: { 'C1.R11': 'C1', ... }      — phòng theo dõi chênh áp và khu của phòng
 *     tuan:  [ đoạn ],  thang: [ đoạn ] }      — xếp cũ → mới
 *   đoạn = { tu, den, tong: { ty_le, so_ngay }, khu: { C1: ty_le, ... },
 *            diem: { 'C1.R11': [điểm ghi, điểm đạt] } }
 * Tuần là thứ Hai → Chủ nhật, cắt theo ngày đầu/cuối kỳ (tuần đầu, tuần cuối có thể ít ngày).
 *
 * Hai chỉ tiêu, cùng cách tính với phần còn lại của báo cáo:
 *   · Tỷ lệ đạt toàn bộ chỉ tiêu: trung bình tỷ lệ đạt theo ngày (kpi_ngay_scope),
 *     cùng cách tính số dẫn đầu thư và bảng "So với bốn kỳ trước".
 *   · Chênh áp phòng theo dõi: tổng điểm đo đạt / tổng điểm đo ghi (cùng chenh-ap-phong-theo-doi.js).
 * Thay đổi = đoạn này − đoạn liền trước, điểm %; dưới 2 điểm ghi "không đổi" (bien-dong-phong-theo-doi.js).
 * Thiếu khối dữ liệu thì tongHop trả null, thư và bản in bỏ mục, không vỡ.
 * ========================================================================= */

const BDP = require('./bien-dong-phong-theo-doi.js');
const PTD = require('./chenh-ap-phong-theo-doi.js');
const L = require('./bao-cao-loi.js');
const BDT = require('./bieu-do-thu.js');

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function so1(v) { return (Math.round(Number(v) * 10) / 10).toFixed(1).replace('.', ','); }
function phanTram(v) { return v == null ? '—' : so1(v) + '%'; }
function soHoacNull(v) { return v == null || !Number.isFinite(Number(v)) ? null : Number(v); }
function soNgayGiua(tu, den) { return Math.round((Date.parse(den) - Date.parse(tu)) / 86400000) + 1; }
function ngayThang(s) { return String(s).slice(8, 10) + '/' + String(s).slice(5, 7); }

/* Nhãn ngắn cho vừa màn hình điện thoại: tuần "05–11/10" (cùng tháng) hoặc "27/07–02/08",
 * tháng "10/2026" (cột đã có tiêu đề "Tháng"). */
function nhanDoan(loai, x) {
  if (loai === 'thang') return String(x.tu).slice(5, 7) + '/' + String(x.tu).slice(0, 4);
  const cungThang = String(x.tu).slice(0, 7) === String(x.den).slice(0, 7);
  return (cungThang ? String(x.tu).slice(8, 10) : ngayThang(x.tu)) + '–' + ngayThang(x.den);
}

function docDiem(dm, ma, nhan) {
  if (dm == null) return null;
  if (!Array.isArray(dm) || !(Number(dm[0]) > 0) || !(Number(dm[1]) >= 0) || Number(dm[1]) > Number(dm[0])) {
    throw new Error('XU_HUONG_KY: sai số điểm đo của ' + ma + ' (' + nhan + ')');
  }
  return { ghi: Number(dm[0]), dat: Number(dm[1]) };
}

function chuanHoa(loai, ds, phongTD, khuBC) {
  const ra = (Array.isArray(ds) ? ds : []).map(function (x) {
    const nhan = nhanDoan(loai, x);
    const tong = x.tong || {};
    const khu = {};
    Object.keys(x.khu || {}).forEach(function (k) { khu[k] = soHoacNull(x.khu[k]); });
    const phong = {};
    const dp = { ghi: 0, dat: 0 };
    phongTD.forEach(function (ma) {
      const dm = docDiem((x.diem || {})[ma], ma, nhan);
      phong[ma] = dm ? 100 * dm.dat / dm.ghi : null;
      if (dm) { dp.ghi += dm.ghi; dp.dat += dm.dat; }
    });
    return {
      tu: x.tu, den: x.den, nhan: nhan,
      so_ngay_ky: soNgayGiua(x.tu, x.den),
      so_ngay: Number(tong.so_ngay) || 0,
      // Bản riêng một khu: chỉ tiêu dẫn đầu là của khu đó, không phải của toàn nhà máy.
      tl: khuBC ? soHoacNull(khu[khuBC]) : soHoacNull(tong.ty_le),
      khu: khu,
      dp: dp.ghi > 0 ? 100 * dp.dat / dp.ghi : null,
      phong: phong
    };
  });
  return ra;
}

/* Phòng theo dõi đổi nhiều nhất giữa đoạn đầu và đoạn cuối có số (để chỉ ra chỗ cụ thể). */
function bienDongPhong(ds, phongTD, phongKhu) {
  return phongTD.map(function (ma) {
    const co = ds.filter(function (x) { return x.phong[ma] != null; });
    if (co.length < 2) return null;
    const dau = co[0], cuoi = co[co.length - 1];
    const chenh = cuoi.phong[ma] - dau.phong[ma];
    return { ma: ma, khu: phongKhu[ma], dau: dau.phong[ma], cuoi: cuoi.phong[ma],
      nhan_dau: dau.nhan, nhan_cuoi: cuoi.nhan, chenh: chenh, xu_huong: BDP.xuHuong(chenh) };
  }).filter(Boolean);
}

/* ===== Đánh giá khách quan cả dãy (yêu cầu 09/11/2026, lần 2) ==========
 * Người dùng: bảng dọc khó nhìn tổng quát, chưa đánh giá khách quan được tương quan giữa
 * các tuần / tháng. Mỗi chỉ tiêu được đánh giá bằng số, không bằng cảm nhận:
 *   · trung bình kỳ, thấp nhất – cao nhất (biên độ dao động);
 *   · xu hướng = độ dốc đường hồi quy tuyến tính (bình phương nhỏ nhất) qua mọi điểm,
 *     đơn vị điểm % / tuần (hoặc / tháng). Mức thay đổi cả kỳ = độ dốc × số bước; nhỏ hơn
 *     ngưỡng 2 điểm là "đi ngang", để một tuần cao/thấp bất thường không thành xu hướng;
 *   · mỗi tuần lệch bao nhiêu so với trung bình kỳ của chính chỉ tiêu đó.
 * Mọi tuần nặng như nhau, kể cả tuần cắt ngắn ở đầu/cuối kỳ (ghi rõ trong chú thích). */
/* Nhãn cột biểu đồ: ngày đầu tuần "06/07", hoặc tháng "07/26". */
function nhanCot(loai, x) {
  return loai === 'thang' ? String(x.tu).slice(5, 7) + '/' + String(x.tu).slice(2, 4) : ngayThang(x.tu);
}
function giaTri(x, ma) {
  if (ma === 'tl') return x.tl;
  if (ma === 'dp') return x.dp;
  return x.khu[ma.slice(4)] == null ? null : x.khu[ma.slice(4)];
}
function danhGia(ds, ct) {
  const diem = [];
  ds.forEach(function (x, i) { const v = giaTri(x, ct.ma); if (v != null) diem.push({ i: i, v: v, nhan: x.nhan }); });
  const n = diem.length;
  if (!n) return null;
  const tb = diem.reduce(function (s, p) { return s + p.v; }, 0) / n;
  const thap = diem.reduce(function (a, p) { return p.v < a.v ? p : a; });
  const cao = diem.reduce(function (a, p) { return p.v > a.v ? p : a; });
  let doc = null, tongDoi = null, huong = null;
  if (n >= 3) {
    const ti = diem.reduce(function (s, p) { return s + p.i; }, 0) / n;
    const tu = diem.reduce(function (s, p) { return s + (p.i - ti) * (p.v - tb); }, 0);
    const mau = diem.reduce(function (s, p) { return s + (p.i - ti) * (p.i - ti); }, 0);
    doc = tu / mau;
    tongDoi = doc * (diem[n - 1].i - diem[0].i);
    huong = Math.abs(tongDoi) < BDP.NGUONG_BIEN_DONG ? 'ngang' : (tongDoi > 0 ? 'tang' : 'giam');
  }
  ds.forEach(function (x) {
    const v = giaTri(x, ct.ma);
    x.lech = x.lech || {};
    x.lech[ct.ma] = v == null ? null : v - tb;
  });
  return { ma: ct.ma, ten: ct.ten, nguong: ct.nguong, so_diem: n, tb: tb, thap: thap, cao: cao,
    doc: doc, tong_doi: tongDoi, huong: huong,
    so_dat: diem.filter(function (p) { return p.v >= ct.nguong; }).length };
}
/* "Giảm dần · −1,2 điểm/tuần", "Đi ngang", "Chưa đủ số". */
function chuXuHuong(dg, donVi) {
  if (!dg || dg.huong == null) return 'Chưa đủ 3 ' + donVi + ' có số';
  if (dg.huong === 'ngang') return 'Đi ngang';
  return (dg.huong === 'tang' ? 'Tăng dần' : 'Giảm dần') + ' · ' + (dg.doc > 0 ? '+' : '−') + so1(Math.abs(dg.doc)) + ' điểm/' + donVi;
}
/* Câu tổng quát: chỉ tiêu dẫn đầu trước, rồi gom các chỉ tiêu giảm / tăng. Rút thẳng từ số. */
function cauTongQuat(t, loai) {
  const dsDG = loai === 'thang' ? t.danh_gia_thang : t.danh_gia_tuan;
  const donVi = loai === 'thang' ? 'tháng' : 'tuần';
  const chinh = dsDG[0];
  if (!chinh) return '';
  const tenGon = function (dg) { return dg.ma === 'tl' ? esc(t.ten_tong) : dg.ma === 'dp' ? 'chênh áp phòng theo dõi' : esc(dg.ten); };
  const ra = ['<b>' + tenGon(chinh) + ': ' + chuXuHuong(chinh, donVi).toLowerCase() + '</b>, trung bình ' + phanTram(chinh.tb)
    + ', dao động ' + phanTram(chinh.thap.v) + ' (' + esc(chinh.thap.nhan) + ') đến ' + phanTram(chinh.cao.v) + ' (' + esc(chinh.cao.nhan) + ').'];
  const con = dsDG.slice(1);
  const giam = con.filter(function (x) { return x.huong === 'giam'; });
  const tang = con.filter(function (x) { return x.huong === 'tang'; });
  const ngang = con.filter(function (x) { return x.huong === 'ngang'; });
  const liet = function (a) { return a.map(function (x) { return tenGon(x) + ' (' + (x.doc > 0 ? '+' : '−') + so1(Math.abs(x.doc)) + ')'; }).join(', '); };
  if (giam.length) ra.push('<b>Giảm dần:</b> ' + liet(giam) + '.');
  if (tang.length) ra.push('Tăng dần: ' + liet(tang) + '.');
  if (ngang.length) ra.push('Đi ngang: ' + ngang.map(tenGon).join(', ') + '.');
  return ra.join(' ');
}

function tongHop(d, khuBaoCao) {
  const maKy = String((d && d.ky) || '').toUpperCase();
  const x = d && d.xu_huong_chi_tiet;
  if ((maKy !== 'THANG' && maKy !== 'QUY') || !x || typeof x !== 'object') return null;
  const khuBC = khuBaoCao ? String(khuBaoCao).toUpperCase() : null;
  const phongKhu = x.phong_khu || {};
  const phongTD = Object.keys(phongKhu).filter(function (ma) { return !khuBC || phongKhu[ma] === khuBC; })
    .sort(function (a, b) { return a.localeCompare(b, 'vi', { numeric: true }); });
  const tuan = chuanHoa('tuan', x.tuan, phongTD, khuBC);
  const thang = chuanHoa('thang', x.thang, phongTD, khuBC);
  if (!tuan.length && !thang.length) return null;
  const dsKhu = khuBC ? [] : Array.from(new Set([].concat.apply([], tuan.concat(thang).map(function (s) {
    return Object.keys(s.khu);
  })))).sort();
  const bdTuan = bienDongPhong(tuan, phongTD, phongKhu);
  const tenTong = khuBC ? 'Khu ' + khuBC : 'Toàn nhà máy';
  const chiTieu = [{ ma: 'tl', ten: tenTong, ten_ngan: khuBC ? 'Khu ' + khuBC : 'Toàn NM', nguong: L.NGUONG_HANH_DONG }]
    .concat(dsKhu.map(function (k) { return { ma: 'khu:' + k, ten: 'Khu ' + k, ten_ngan: k, nguong: L.NGUONG_HANH_DONG }; }))
    .concat(phongTD.length ? [{ ma: 'dp', ten: 'Chênh áp phòng theo dõi', ten_ngan: 'Chênh áp', nguong: PTD.NGUONG_DAT }] : []);
  const dgDay = function (ds) { return chiTieu.map(function (ct) { return danhGia(ds, ct); }).filter(Boolean); };
  return {
    chi_tieu: chiTieu,
    danh_gia_tuan: dgDay(tuan), danh_gia_thang: dgDay(thang),
    ma_ky: maKy, khu_bc: khuBC,
    ten_tong: khuBC ? 'Khu ' + khuBC : 'Toàn nhà máy',
    nguong_tl: L.NGUONG_HANH_DONG, nguong_dp: PTD.NGUONG_DAT, nguong_chenh: BDP.NGUONG_BIEN_DONG,
    ds_khu: dsKhu, phong_td: phongTD, phong_khu: phongKhu,
    tuan: tuan, thang: thang,
    phong_giam: bdTuan.filter(function (p) { return p.xu_huong === 'giam'; }).sort(function (a, b) { return a.chenh - b.chenh; }),
    phong_tang: bdTuan.filter(function (p) { return p.xu_huong === 'tang'; }).sort(function (a, b) { return b.chenh - a.chenh; })
  };
}

function hoaDau(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* Câu về phòng: phòng giảm / tăng nhiều nhất từ tuần đầu đến tuần cuối của kỳ. */
function cauPhong(t, soToiDa) {
  const n = soToiDa || 3;
  if (!t.tuan.length) return '';
  const ds = function (a) {
    return a.slice(0, n).map(function (p) {
      return '<span style="white-space:nowrap;">' + esc(p.ma) + '&nbsp;(' + BDP.chuChenh(p.chenh).replace(' điểm', '&nbsp;điểm') + ')</span>';
    }).join(', ');
  };
  const cau = [];
  if (t.phong_giam.length) cau.push('<b>' + t.phong_giam.length + ' phòng theo dõi giảm</b> từ tuần đầu đến tuần cuối kỳ: ' + ds(t.phong_giam)
    + (t.phong_giam.length > n ? '…' : '.'));
  if (t.phong_tang.length) cau.push(t.phong_tang.length + ' phòng tăng: ' + ds(t.phong_tang) + (t.phong_tang.length > n ? '…' : '.'));
  if (!cau.length && t.phong_td.length) cau.push('Không phòng theo dõi nào đổi quá ' + t.nguong_chenh + ' điểm từ tuần đầu đến tuần cuối kỳ.');
  return cau.join(' ');
}

/* Nền ô theo độ lệch so với trung bình kỳ: thang hai phía (xanh trên, đỏ dưới, xám ở giữa),
 * tông rất nhạt để chữ đen vẫn đọc rõ. Số lệch ghi ngay trong ô nên không phụ thuộc màu. */
const MAU_LECH = { tren: '#DBEAFE', duoi: '#FDE2E1', giua: '#F0EFEC', chu: '#0F172A', phu: '#475569' };
function mucLech(lech) {
  if (lech == null) return null;
  if (lech >= BDP.NGUONG_BIEN_DONG) return 'tren';
  if (lech <= -BDP.NGUONG_BIEN_DONG) return 'duoi';
  return 'giua';
}
function chuLech(lech) {
  if (lech == null) return '';
  const m = mucLech(lech);
  return m === 'giua' ? '≈ TB' : (lech > 0 ? '+' : '−') + so1(Math.abs(lech));
}

const GHI_CHU = [
  ['Xu hướng', 'độ dốc đường thẳng khớp nhất (hồi quy tuyến tính) qua mọi tuần hoặc tháng có số; mức thay đổi cả kỳ dưới '
    + BDP.NGUONG_BIEN_DONG + ' điểm ghi "đi ngang". Mọi tuần tính nặng như nhau.'],
  ['Màu ô', 'so với trung bình các tuần (hoặc các tháng) của chính chỉ tiêu đó; mỗi tuần nặng như nhau nên trung bình này có thể khác số dẫn đầu báo cáo (trung bình theo ngày). Màu: xanh là cao hơn từ ' + BDP.NGUONG_BIEN_DONG + ' điểm, đỏ nhạt là thấp hơn từ '
    + BDP.NGUONG_BIEN_DONG + ' điểm, xám là quanh trung bình (≈ TB). Số nhỏ trong ô là độ lệch, đơn vị điểm %.'],
  ['Tuần', 'thứ Hai đến Chủ nhật; tuần đầu và tuần cuối cắt theo ngày đầu, ngày cuối kỳ nên có thể ít hơn 7 ngày.'],
  ['Tỷ lệ đạt toàn bộ chỉ tiêu', 'trung bình tỷ lệ đạt theo ngày của chênh áp, nhiệt độ, độ ẩm; cùng cách tính số dẫn đầu báo cáo.'],
  ['Chênh áp phòng theo dõi', 'tổng điểm đo chênh áp đạt / tổng điểm đo ghi được của các phòng đang theo dõi cảnh báo.']
];

/* ===== Bản in ============================================================ */
function htmlBanIn(t) {
  if (!t) return '';
  const lop = function (v, nguong) { return v == null ? 'mo' : (v >= nguong ? 'ls-tot' : 'ls-xau'); };
  const bangDanhGia = function (loai) {
    const dsDG = loai === 'thang' ? t.danh_gia_thang : t.danh_gia_tuan;
    const donVi = loai === 'thang' ? 'tháng' : 'tuần';
    return '<div class="cuon-ngang"><table><thead><tr><th>Chỉ tiêu</th><th class="so">TB các ' + donVi + '</th><th class="so">Thấp nhất</th>'
      + '<th class="so">Cao nhất</th><th>Xu hướng cả kỳ</th><th class="so">' + hoaDau(donVi) + ' đạt mức yêu cầu</th></tr></thead><tbody>'
      + dsDG.map(function (g) {
          return '<tr><td><b>' + esc(g.ten) + '</b></td><td class="so dam">' + phanTram(g.tb) + '</td>'
            + '<td class="so">' + phanTram(g.thap.v) + ' <span class="mo">' + esc(g.thap.nhan) + '</span></td>'
            + '<td class="so">' + phanTram(g.cao.v) + ' <span class="mo">' + esc(g.cao.nhan) + '</span></td>'
            + '<td class="' + (g.huong === 'giam' ? 'ls-xau' : g.huong === 'tang' ? 'ls-tot' : '') + '">' + chuXuHuong(g, donVi) + '</td>'
            + '<td class="so">' + g.so_dat + '/' + g.so_diem + '</td></tr>';
        }).join('') + '</tbody></table></div>';
  };
  const bangLech = function (loai) {
    const ds = loai === 'thang' ? t.thang : t.tuan;
    const dsDG = loai === 'thang' ? t.danh_gia_thang : t.danh_gia_tuan;
    return '<div class="cuon-ngang"><table><thead><tr><th>' + (loai === 'thang' ? 'Tháng' : 'Tuần') + '</th>'
      + dsDG.map(function (g) { return '<th class="so">' + esc(g.ten) + '</th>'; }).join('') + '</tr></thead><tbody>'
      + ds.map(function (x) {
          const ngan = loai === 'tuan' && x.so_ngay_ky < 7 ? ' <span class="mo">(' + x.so_ngay_ky + ' ngày)</span>' : '';
          return '<tr><td>' + esc(x.nhan) + ngan + '</td>' + dsDG.map(function (g) {
            const v = giaTri(x, g.ma), l = x.lech[g.ma], m = mucLech(l);
            return '<td class="so" style="border:2px solid #fff;' + (m ? 'background:' + MAU_LECH[m] + ';' : '') + 'color:' + MAU_LECH.chu + ';">'
              + phanTram(v) + (m ? ' <span style="font-size:0.85em;color:' + MAU_LECH.phu + ';">' + chuLech(l) + '</span>' : '') + '</td>';
          }).join('') + '</tr>';
        }).join('')
      + '<tr class="dong-nhan"><td>TB các ' + (loai === 'thang' ? 'tháng' : 'tuần') + '</td>' + dsDG.map(function (g) { return '<td class="so">' + phanTram(g.tb) + '</td>'; }).join('') + '</tr>'
      + '</tbody></table></div>';
  };
  // Ma trận phòng × đoạn: ô dưới mức đạt màu đỏ, giảm/tăng từ 2 điểm so với đoạn trước có ▼/▲.
  const maTran = function (loai) {
    const ds = loai === 'thang' ? t.thang : t.tuan;
    if (!ds.length || !t.phong_td.length) return '';
    return '<div class="cuon-ngang"><table><thead><tr><th>Phòng</th><th>Khu</th>'
      + ds.map(function (x) { return '<th class="so">' + esc(x.nhan) + '</th>'; }).join('')
      + '</tr></thead><tbody>'
      + t.phong_td.map(function (ma) {
          return '<tr><td><b>' + esc(ma) + '</b></td><td>' + esc(t.phong_khu[ma] || '') + '</td>'
            + ds.map(function (x, i) {
                const v = x.phong[ma], truoc = i > 0 ? ds[i - 1].phong[ma] : null;
                const h = v != null && truoc != null ? BDP.xuHuong(v - truoc) : null;
                return '<td class="so"><span class="' + lop(v, t.nguong_dp) + '">' + phanTram(v) + '</span>'
                  + (h === 'tang' ? ' <span class="ls-tot">▲</span>' : h === 'giam' ? ' <span class="ls-xau">▼</span>' : '') + '</td>';
              }).join('') + '</tr>';
        }).join('')
      + '</tbody></table></div>';
  };
  const bieuDo = function (loai) {
    const ds = loai === 'thang' ? t.thang : t.tuan;
    return BDT.cot(ds.map(function (x) { return { nhan: nhanCot(loai, x), v: x.tl }; }), t.nguong_tl, { cao: 120 });
  };
  return '<h4>Xu hướng tuần · ' + esc(t.ten_tong) + '</h4>'
    + '<p class="mota">' + cauTongQuat(t, 'tuan') + '</p>'
    + '<div class="khung-bd bd-o">' + bieuDo('tuan') + '</div>'
    + bangDanhGia('tuan') + '<h4>Từng tuần so với trung bình các tuần</h4>' + bangLech('tuan')
    + (t.thang.length ? '<h4>Xu hướng tháng</h4><p class="mota">' + cauTongQuat(t, 'thang') + '</p>' + bangDanhGia('thang') + bangLech('thang') : '')
    + (t.phong_td.length ? '<h4>Chênh áp từng phòng theo dõi theo tuần</h4><p class="mota">' + cauPhong(t, 5) + '</p>' + maTran('tuan') : '')
    + (t.phong_td.length && t.thang.length ? '<h4>Chênh áp từng phòng theo dõi theo tháng</h4>' + maTran('thang') : '')
    + '<p class="mota">' + GHI_CHU.map(function (x) { return '<b>' + x[0] + ':</b> ' + x[1]; }).join('<br>') + '</p>';
}

module.exports = {
  tongHop: tongHop, htmlBanIn: htmlBanIn, cauTongQuat: cauTongQuat, cauPhong: cauPhong,
  chuXuHuong: chuXuHuong, giaTri: giaTri, mucLech: mucLech, chuLech: chuLech, MAU_LECH: MAU_LECH,
  nhanDoan: nhanDoan, nhanCot: nhanCot, GHI_CHU: GHI_CHU
};
