'use strict';
/* Đóng gói bốn tệp thành MỘT tệp tự chứa để dán vào node Code của n8n.
 * Node Code không require() được tệp ngoài, nên mỗi tệp được bọc trong một
 * hàm nhận (module, require) — một CommonJS thu nhỏ. Chạy: node dong-goi.js */
const fs = require('fs');

function boc(ten, duongDan) {
  const code = fs.readFileSync(duongDan, 'utf8');
  return '__dinh_nghia(' + JSON.stringify(ten) + ', function (module, require) {\n'
    + code + '\n});\n';
}

const dau = `'use strict';
/* ============================================================================
 * BỘ RÁP BÁO CÁO BMS — BẢN ĐÓNG GÓI TỰ CHỨA (sinh bởi dong-goi.js, ĐỪNG SỬA TAY)
 * Sửa ở bốn tệp nguồn trong n8n/wf5/bo-cuc-moi-2026-09-03/ rồi chạy lại
 * node dong-goi.js. Cách dùng trong node Code:
 *   const BO_RAP = ... (toàn bộ tệp này) ...
 *   const kq = BO_RAP.rapTatCa(d, duBao, cfg);
 *   // kq.bao_cao_html · kq.dashboard_html · kq.email_html
 * ========================================================================= */
var BO_RAP = (function () {
  var __kho = {}, __san = {};
  function __dinh_nghia(ten, ham) { __kho[ten] = ham; }
  function __require(ten) {
    ten = ten.replace(/^\\.\\//, '').replace(/\\.js$/, '');
    if (__san[ten]) return __san[ten].exports;
    var m = { exports: {} };
    __san[ten] = m;
    __kho[ten](m, __require);
    return m.exports;
  }
`;

const duoi = `
  var L = __require('bao-cao-loi');
  var R = __require('rap-bao-cao.node');
  var D = __require('dashboard.node');
  var E = __require('email.node');

  /* Một cửa duy nhất cho node n8n: nhận dữ liệu kỳ + dự báo + cấu hình,
   * trả cả ba đầu ra cùng phần tóm tắt cho tiêu đề thư. */
  function rapTatCa(d, duBao, cfg) {
    cfg = cfg || {};
    var nhanDinh = cfg.nhan_dinh || null;
    var cauHinh = Object.assign({}, cfg, { nhan_dinh: nhanDinh });
    var cap = L.phanCap(d);
    var k = d.kpi_ky_nay || {};
    return {
      bao_cao_html: R.rapBaoCao(d, duBao, cauHinh),
      dashboard_html: D.rapDashboard(d, duBao, cauHinh),
      email_html: E.rapEmail(d, duBao, cauHinh),
      tom_tat: {
        ty_le_tuan_thu: k.ty_le_tuan_thu,
        so_phong_xu_ly: cap.capA_tong,
        so_gio_nghiem_trong: k.so_gio_critical,
        su_co_ngoai_ky: (cap.suCoNgoaiKy || []).length
      }
    };
  }

  return { rapTatCa: rapTatCa, locPhatHien: R.locPhatHien,
           L: L, rapBaoCao: R.rapBaoCao, rapDashboard: D.rapDashboard, rapEmail: E.rapEmail };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = BO_RAP;
`;

const ra = dau
  + boc('bao-cao-loi', 'bao-cao-loi.js')
  + boc('rap-bao-cao.node', 'rap-bao-cao.node.js')
  + boc('dashboard.node', 'dashboard.node.js')
  + boc('email.node', 'email.node.js')
  + duoi;
fs.writeFileSync('bo-rap-v3.bundle.js', ra, 'utf8');
console.log('bo-rap-v3.bundle.js: ' + Math.round(ra.length / 1024) + ' KB');
