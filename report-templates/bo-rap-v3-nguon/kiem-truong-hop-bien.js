'use strict';
/* Kiểm các trường hợp biên: báo cáo phải không vỡ khi dữ liệu thiếu hoặc rỗng.
   Chạy: node kiem-truong-hop-bien.js  */
const { rapBaoCao } = require('./rap-bao-cao.node.js');
const { rapDashboard } = require('./dashboard.node.js');
const goc = require('./du-lieu-thang-2026-08.json');
const db  = require('./du-lieu-du-bao-thang-2026-08.json');

const TH = [
  ['kỳ hoàn hảo — không phòng nào phải xử lý', function (d) {
    d.tat_ca_phong.forEach(function (p) { p.ty_le_tuan_thu = 99.5; p.so_gio_critical = 0; });
    d.su_co.danh_sach_dang_mo = []; d.phong_xau_bat_thuong = [];
    d.do_tin_cay_du_lieu.ket_luan = 'DAY_DU'; d.do_tin_cay_du_lieu.tong_ngoai_le = 0;
    d.ngoai_le = { tong_so: 0, theo_loai: [] };
    Object.keys(d.chi_so_cam_bien).forEach(function (l) {
      d.chi_so_cam_bien[l].top_phong.forEach(function (r) {
        r.ty_le_trong_nguong = 99; r.gio_lech = 0; r.gio_lech_nguoc = 0; });
    });
    d.su_kien_vuot_nguong.danh_sach = [];
  }],
  ['không có phòng nào có dữ liệu', function (d) {
    d.tat_ca_phong = []; d.chuoi_ngay.total = []; d.xu_huong.theo_khu = []; d.xu_huong.theo_ahu = [];
    Object.keys(d.chi_so_cam_bien).forEach(function (l) { d.chi_so_cam_bien[l].top_phong = []; });
    d.chuoi_cam_bien = {}; d.su_kien_vuot_nguong.danh_sach = []; d.phong_xau_bat_thuong = [];
    d.su_co.danh_sach_dang_mo = [];
  }],
  ['thiếu hẳn các khối dữ liệu mới', function (d) {
    delete d.chi_so_cam_bien; delete d.chuoi_cam_bien; delete d.su_kien_vuot_nguong;
    delete d.do_tin_cay_du_lieu;
  }],
  ['dự báo không đủ tin cậy', function (d, f) { f.du_bao_dang_tin = false; f.r2 = 0.02; }],
  ['nhận định rỗng hoàn toàn', function () {}, { phat_hien: [] }]
];

let loi = 0;
TH.forEach(function (t) {
  const d = JSON.parse(JSON.stringify(goc)), f = JSON.parse(JSON.stringify(db));
  t[1](d, f);
  const cfg = { tieu_de: 'Kiểm biên', nhan_dinh: t[2] || { phat_hien: [] } };
  let ghi = '';
  try {
    const a = rapBaoCao(d, f, cfg), b = rapDashboard(d, f, cfg);
    // Chỉ soi phần người đọc nhìn thấy: mã JavaScript có chứa chữ "undefined"
    // như một từ khoá của ngôn ngữ, không phải giá trị lỗi lọt ra trang.
    const chuNhin = function (h) {
      return h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
    };
    const ta = chuNhin(a), tb = chuNhin(b);
    const xau = ['undefined', 'NaN', '[object Object]', '>—%', '—%<'].filter(function (w) {
      return ta.indexOf(w) !== -1 || tb.indexOf(w) !== -1; });
    ghi = xau.length ? 'CÓ GIÁ TRỊ LỖI: ' + xau.join(',') : 'ok (' + Math.round(a.length / 1024) + '/'
        + Math.round(b.length / 1024) + ' KB)';
    if (xau.length) loi++;
  } catch (e) { ghi = 'NGOẠI LỆ: ' + e.message; loi++; }
  console.log('  ' + (ghi.slice(0, 2) === 'ok' ? '✓' : '✗') + ' ' + t[0].padEnd(44) + ghi);
});
console.log(loi ? '\n' + loi + ' trường hợp hỏng' : '\nTất cả trường hợp biên đều dựng được trang.');
