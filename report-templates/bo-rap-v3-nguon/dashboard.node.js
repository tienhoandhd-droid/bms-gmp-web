'use strict';
/* ===========================================================================
 * BẢNG THEO DÕI TƯƠNG TÁC — công cụ tra cứu, không phải bản in chia thẻ
 *
 * Bản in trả lời câu hỏi CỐ ĐỊNH: kỳ này thế nào, phải xử lý gì.
 * Bảng theo dõi phải trả lời câu hỏi người dùng TỰ ĐẶT RA lúc đang xem:
 *   "cho tôi xem riêng phòng mức 1 của cụm AHU C1-3 đang chưa đạt, xếp theo
 *    số giờ ngoài giới hạn, rồi mở phòng nặng nhất ra xem chênh áp ngày nào
 *    tụt và tụt sâu tới đâu"
 * Bản in không làm được vì nó cố định. Đó là lý do bảng này tồn tại.
 *
 * VÌ THẾ KIẾN TRÚC KHÁC HẲN BẢN IN: nhúng DỮ LIỆU rồi dựng giao diện trong
 * trình duyệt, chứ không dựng sẵn HTML. Không nhúng dữ liệu thì không thể tra
 * tới từng ngày của từng phòng.
 *
 * Đổi lại tệp nặng hơn nên để trên Drive và gửi đường dẫn, đừng đính kèm thư.
 *
 * Phần chạy trong trình duyệt giữ ở mức đọc hiểu được: một nguồn trạng thái
 * duy nhất là biến `loc`, mọi thay đổi đều chạy qua `veLai()`.
 * ========================================================================= */

const L = require('./bao-cao-loi.js');
const { esc, so, soVN, phanTram, ngayDai, ngayNgan, gioPhut, gioDoc, delta, dich,
        NGUONG_HANH_DONG } = L;

/* ===== 1. RÚT GỌN DỮ LIỆU ĐỂ NHÚNG =====================================
 * Chỉ giữ trường thực sự dùng, và làm tròn số: chuỗi ngày của 57 phòng × 3
 * chỉ tiêu là hơn năm nghìn điểm, giữ 13 chữ số thập phân thì phình vô ích.
 * ===================================================================== */

const lam = (v, n) => (v == null || !isFinite(v)) ? null : Number(Number(v).toFixed(n == null ? 1 : n));

function duLieuNhung(d) {
  const chuoiCB = L.bocChuoiCamBien(d);
  const ngays = ((d.chuoi_ngay || {}).total || []).map((x) => x.ngay);

  const gioDoPhong = {};
  Object.keys(d.chuoi_cam_bien || {}).forEach(function (kh) {
    const ma = kh.split('|')[0];
    (d.chuoi_cam_bien[kh].chuoi || []).forEach(function (x) {
      gioDoPhong[ma] = (gioDoPhong[ma] || 0) + (x.gio_co_dl || 0);
    });
  });

  const chiSo = {};
  ['DP', 'T', 'RH'].forEach(function (loai) {
    const tp = ((d.chi_so_cam_bien || {})[loai] || {}).top_phong || [];
    tp.forEach(function (r) {
      chiSo[r.ma_phong + '|' + loai] = {
        tt: lam(r.ty_le_trong_nguong), gl: lam(r.gio_lech), gn: lam(r.gio_lech_nguoc),
        sd: r.so_dot, dd: r.dot_dai_nhat, cl: !!r.con_lech_cuoi_ky
      };
    });
  });

  const phong = (d.tat_ca_phong || []).map(function (p) {
    return {
      ma: p.ma_phong, ten: p.ten_phong, khu: p.khu_vuc, ahu: p.ahu || '—',
      ut: p.muc_uu_tien || 'P3',
      tt: lam(p.ty_le_tuan_thu), gn: p.so_gio_critical || 0, dq: lam(p.dq_pct),
      gd: gioDoPhong[p.ma_phong] || 0,
      ch: (p.chuoi || []).map(function (c) { return lam(c.ty_le); })
    };
  });

  // Chuỗi ngày theo từng cảm biến — nguồn cho biểu đồ chi tiết từng phòng.
  // Dùng mảng thay đối tượng: [ngày, trung bình, thấp nhất, cao nhất, giờ ngoài giới hạn, giờ cảnh báo]
  const cb = {};
  ['DP', 'T', 'RH'].forEach(function (loai) {
    Object.keys(chuoiCB[loai] || {}).forEach(function (ma) {
      const v = chuoiCB[loai][ma];
      cb[ma + '|' + loai] = {
        ghd: lam(v.ghd), ght: lam(v.ght),
        ch: (v.chuoi || []).map(function (x) {
          return [x.ngay, lam(x.tb), lam(x.min), lam(x.max), x.ngh || 0, x.cb || 0];
        })
      };
    });
  });

  const suKien = ((d.su_kien_vuot_nguong || {}).danh_sach || []).map(function (s) {
    return { p: s.ma_phong, l: s.loai_cam_bien, h: s.huong, g: lam(s.so_gio),
             bd: s.bat_dau, kt: s.ket_thuc, kd: s.ket_thuc_do,
             gt: lam(s.huong === 'CAO' ? s.gia_tri_max : s.gia_tri_min), dv: s.don_vi };
  });

  const chotKy = d.den_ngay ? String(d.den_ngay).slice(0, 10) : null;
  const suCo = ((d.su_co || {}).danh_sach_dang_mo || []).map(function (s) {
    // bat_dau là UTC: đổi sang ngày Việt Nam trước khi in và khi so với ngày chốt kỳ (rà soát 04/09/2026)
    return { p: s.phong, ma: s.ma_su_co, mc: s.muc_canh_bao, bd: L.gioVietNam(s.bat_dau, true),
             kd: lam(s.keo_dai_gio), tt: s.trang_thai,
             nk: !!(chotKy && s.bat_dau && L.ngayVietNamISO(s.bat_dau) > chotKy) };
  });

  return {
    ky: d.ky, tu: d.tu_ngay, den: d.den_ngay, ngay: ngays, nguong: NGUONG_HANH_DONG,
    // Con số dẫn đầu khi không lọc phải trùng thư và bản in (rà soát 04/09/2026, đợt 2)
    kpiTT: lam((d.kpi_ky_nay || {}).ty_le_tuan_thu),
    tiLeVuotA: L.TI_LE_GIO_VUOT_A,
    phong: phong, cb: cb, chiSo: chiSo, suKien: suKien, suCo: suCo,
    capA: L.phanCap(d).capA_tat_ca.map(function (v) {
      return { ma: v.ma_phong, cc: v.can_cu, viec: v.viec };
    })
  };
}

/* ===== 2. GIAO DIỆN ===================================================== */

const CSS = `
:root{
  --muc:${L.MAU.muc}; --muc2:${L.MAU.muc2}; --mo:${L.MAU.mo}; --nhat:${L.MAU.nhat};
  --vien:${L.MAU.vien}; --vien2:${L.MAU.vien2}; --giay:${L.MAU.giay}; --nen:${L.MAU.nen};
  --nhan:${L.MAU.nhan}; --nhan-nhat:${L.MAU.nhanNhat};
  --cap1:${L.MAU.cap1}; --cap2:${L.MAU.cap2}; --cap3:${L.MAU.cap3};
  --c-duoi:${L.MAU.lechDuoi}; --c-tren:${L.MAU.lechTren};
  /* Cùng thang với bản xem trên màn hình của bản in: thân bài 16px. */
  --co-1:12px; --co-2:13px; --co-3:14px; --co-4:16px; --co-5:18px; --co-6:22px; --co-7:26px;
  --k-1:4px; --k-2:8px; --k-3:12px; --k-4:16px; --k-5:24px; --k-6:32px;
  --bo-1:4px; --bo-2:6px; --bo-3:8px;
  --nen-0:#F4F5F7;
  --bong-1:0 1px 2px rgba(17,24,32,.04);
  --bong-2:0 2px 8px rgba(17,24,32,.06), 0 1px 2px rgba(17,24,32,.04);
  --mono: ui-monospace,'SF Mono','Cascadia Code',Consolas,monospace;
}
*{box-sizing:border-box}
body{margin:0;background:var(--nen-0);color:var(--muc);
  font:var(--co-4)/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Arial,sans-serif}
.khung{max-width:1180px;margin:0 auto;padding:0 var(--k-5) 60px}

.dinh{position:sticky;top:0;z-index:30;background:var(--giay);
  border-bottom:1px solid var(--vien);margin:0 calc(var(--k-5) * -1);padding:0 var(--k-5);
  box-shadow:var(--bong-1)}
.dinh-tren{display:flex;justify-content:space-between;align-items:flex-end;gap:var(--k-5);
  padding:var(--k-4) 0 var(--k-3)}
.dinh h1{margin:0;font-size:var(--co-7);font-weight:640;letter-spacing:-.015em}
.dinh .phu{color:var(--mo);font-size:var(--co-2);margin-top:2px}
.chi-so-nhanh{display:flex;gap:var(--k-5);align-items:flex-end}
.csn{text-align:right}
.csn .gt{font-size:var(--co-5);font-weight:640;font-variant-numeric:tabular-nums;
  line-height:1.1;color:var(--muc2);letter-spacing:-.02em}
.csn .ten{font-size:var(--co-1);color:var(--mo)}
.csn-chinh{padding-right:var(--k-5);border-right:1px solid var(--vien)}
.csn-chinh .gt{font-size:var(--co-7);font-weight:650;color:var(--muc)}
.csn-chinh .ten{color:var(--muc2)}
.csn .xau{color:var(--cap2)}
.thanh-the{display:flex;gap:2px;overflow-x:auto}
.the-nut{appearance:none;border:none;background:none;padding:var(--k-3) var(--k-4);
  font-size:var(--co-3);color:var(--muc2);cursor:pointer;border-bottom:2px solid transparent;
  white-space:nowrap;font-family:inherit}
.the-nut:hover{color:var(--muc)}
.the-nut[aria-selected="true"]{color:var(--nhan);border-bottom-color:var(--nhan);font-weight:600}

.loc{display:flex;flex-wrap:wrap;align-items:center;gap:var(--k-2) var(--k-3);
  padding:var(--k-3) 0;font-size:var(--co-3);border-bottom:1px solid var(--vien2)}
.loc-nhom{display:flex;align-items:center;gap:var(--k-1);flex-wrap:wrap}
.loc-nhan{font-size:var(--co-1);color:var(--mo);text-transform:uppercase;letter-spacing:.04em;
  font-weight:600;margin-right:2px}
.loc-nut{appearance:none;border:1px solid var(--vien);background:var(--giay);border-radius:99px;
  padding:3px 11px;font-size:var(--co-2);cursor:pointer;color:var(--muc2);font-family:inherit}
.loc-nut:hover{border-color:var(--nhat)}
.loc-nut[aria-pressed="true"]{border-color:var(--nhan);color:var(--nhan);
  background:var(--nhan-nhat);font-weight:600}
.o-tim{border:1px solid var(--vien);border-radius:var(--bo-2);padding:4px 10px;
  font-size:var(--co-3);font-family:inherit;width:200px;color:var(--muc);background:var(--giay)}
.o-tim:focus{border-color:var(--nhan);outline:none}
select.o-tim{width:auto;cursor:pointer}
.dem-loc{margin-left:auto;font-size:var(--co-2);color:var(--mo);font-variant-numeric:tabular-nums}
.dem-loc b{color:var(--muc)}
.nut-phu{appearance:none;border:1px solid var(--vien);background:var(--giay);
  border-radius:var(--bo-2);padding:4px 11px;font-size:var(--co-2);cursor:pointer;
  color:var(--muc2);font-family:inherit}
.nut-phu:hover{border-color:var(--nhan);color:var(--nhan)}

.the-noi-dung{display:none}
.the-noi-dung.hien{display:block}
.o{background:var(--giay);border:1px solid var(--vien);border-radius:10px;
  padding:var(--k-5);margin-bottom:var(--k-4);box-shadow:var(--bong-1)}
.o h2{margin:0 0 var(--k-3);font-size:20px;font-weight:650;letter-spacing:-.015em;line-height:1.3}
.o .mota{margin:0 0 var(--k-4);color:var(--muc2);font-size:var(--co-3);max-width:76ch;line-height:1.65}
h3{margin:var(--k-6) 0 var(--k-3);padding-top:var(--k-3);font-size:17px;font-weight:640;
  border-top:1px solid var(--vien2)}
h3:first-of-type{border-top:none;padding-top:0}
.khung-bd{background:var(--nen);border:1px solid var(--vien2);border-radius:var(--bo-3);
  padding:var(--k-3) var(--k-4);margin:var(--k-2) 0}
.mo{color:var(--mo)}

table{width:100%;border-collapse:collapse;font-size:var(--co-3)}
th{text-align:left;font-size:var(--co-1);color:var(--mo);font-weight:600;letter-spacing:.03em;
  padding:var(--k-2);border-bottom:1px solid var(--muc2);vertical-align:bottom;line-height:1.35}
th.so{white-space:nowrap}
th.xep{cursor:pointer;user-select:none}
th.xep:hover{color:var(--nhan)}
th.xep[data-chieu="len"]::after{content:'▲';font-size:9px;color:var(--nhan);margin-left:4px}
th.xep[data-chieu="xuong"]::after{content:'▼';font-size:9px;color:var(--nhan);margin-left:4px}
td{padding:var(--k-2);border-bottom:1px solid var(--vien2);vertical-align:top;line-height:1.5}
td.so,th.so{text-align:right;font-variant-numeric:tabular-nums}
tbody tr{transition:background .12s ease}
tbody tr:nth-child(even){background:#FCFCFD}
tbody tr:hover{background:var(--nhan-nhat)}
tr.bam{cursor:pointer}
tr.bam:hover{background:var(--nhan-nhat)}
.ma{font-family:var(--mono);font-size:var(--co-2)}
.tang-xau{color:var(--cap2);font-weight:600}.the-ngoai-ky{display:inline-block;padding:1px 7px;border-radius:99px;background:#FFFBEB;color:#B45309;font-size:11px;font-weight:700;}
/* Số giờ đi kèm tỉ lệ: giờ thô không cho biết nặng nhẹ khi các phòng có
   số giờ đo khác nhau. */
.phu-ty-le{font-size:var(--co-1);color:var(--mo);font-weight:400}
.phu-th{font-weight:400;text-transform:none;letter-spacing:0;color:var(--nhat)}
.the-nho{display:inline-block;font-size:11.5px;padding:1px 6px;border-radius:99px;
  border:1px solid var(--vien);color:var(--muc2);background:var(--giay);font-weight:600;white-space:nowrap}
.the-p1{border-color:var(--cap2);color:var(--cap2)}

.ngan{position:fixed;top:0;right:0;bottom:0;width:min(780px,94vw);background:var(--giay);
  border-left:1px solid var(--vien);box-shadow:-8px 0 28px rgba(17,24,32,.10);
  z-index:60;overflow-y:auto;transform:translateX(100%);transition:transform .18s ease}
.ngan.mo{transform:translateX(0)}
.ngan-dau{position:sticky;top:0;background:var(--giay);border-bottom:1px solid var(--vien);
  padding:var(--k-4) var(--k-5);display:flex;justify-content:space-between;
  align-items:flex-start;gap:var(--k-4);z-index:1}
.ngan-ten{font-size:var(--co-5);font-weight:650}
.ngan-phu{font-size:var(--co-2);color:var(--mo);margin-top:2px;line-height:1.5}
.ngan-than{padding:var(--k-4) var(--k-5) var(--k-6)}
.dong{position:fixed;inset:0;background:rgba(17,24,32,.28);z-index:50;opacity:0;
  pointer-events:none;transition:opacity .18s ease}
.dong.mo{opacity:1;pointer-events:auto}
.nut-dong{appearance:none;border:1px solid var(--vien);background:var(--giay);border-radius:99px;
  width:30px;height:30px;cursor:pointer;font-size:16px;line-height:1;color:var(--muc2);flex:none}
.nut-dong:hover{border-color:var(--cap2);color:var(--cap2)}
.khoi-ct{border:1px solid var(--vien);border-radius:var(--bo-3);padding:var(--k-3) var(--k-4);
  margin-bottom:var(--k-3)}
.khoi-ct-dau{display:flex;justify-content:space-between;align-items:baseline;
  margin-bottom:var(--k-2);gap:var(--k-3)}
.khoi-ct-ten{font-weight:640;font-size:var(--co-4)}
.khoi-ct-so{font-variant-numeric:tabular-nums;font-size:var(--co-5);font-weight:640}
.canh-bao-a{border:1px solid #FCA5A5;border-left:3px solid var(--cap2);background:#FEF8F8;
  border-radius:var(--bo-3);padding:var(--k-3) var(--k-4);margin-bottom:var(--k-3)}
.canh-bao-a .tieu{font-weight:640;font-size:var(--co-3)}
.can-cu{color:var(--muc2);font-size:var(--co-2);margin-top:3px;line-height:1.55}
.lam{color:var(--muc2);font-size:var(--co-2);margin-top:5px;padding-left:var(--k-3);
  border-left:2px solid var(--vien);line-height:1.55}
.dong-so{display:flex;gap:var(--k-4);flex-wrap:wrap;font-size:var(--co-2);color:var(--muc2);
  margin-top:var(--k-2);padding-top:var(--k-2);border-top:1px solid var(--vien2)}
.dong-so b{font-variant-numeric:tabular-nums;color:var(--muc)}

.bieu-do{width:100%;height:auto;display:block}
.spark{display:inline-block;vertical-align:middle}
.svg-truc{font-size:11px;fill:var(--mo)}
.svg-hang{font-size:12px;fill:var(--muc2)}
.svg-hang-nho{font-size:10.5px;fill:var(--muc2);font-family:var(--mono)}
.svg-nhan{font-size:12px;fill:var(--muc);font-weight:600}
.svg-nhan-nguong{font-size:11px;fill:var(--cap2)}
.svg-nhan-gh{font-size:10.5px;fill:var(--nhan)}
.svg-nhan-duoi{font-size:11.5px;fill:var(--c-duoi);font-weight:600}
.svg-nhan-tren{font-size:11.5px;fill:var(--c-tren);font-weight:600}
.svg-o{font-size:9.5px;fill:#7F1D1D}
.svg-o-dam{fill:#fff}
.chu-thich{font-size:var(--co-2);color:var(--mo);margin:var(--k-2) 0 0;line-height:1.55;max-width:76ch}
.cuon-ngang{overflow-x:auto}
${L.CSS_BAN_DO}
.o-bd rect.bam-duoc{cursor:pointer}
.o-bd rect.bam-duoc:hover{stroke:${L.MAU.nhan};stroke-width:1.6}

.luoi-sm{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--k-3) var(--k-4)}
.o-sm{margin:0;padding:var(--k-2) var(--k-3);border:1px solid var(--vien);border-radius:var(--bo-2)}
.o-sm figcaption{display:flex;justify-content:space-between;align-items:baseline;
  font-size:var(--co-2);margin-bottom:var(--k-1)}
.sm-ten{color:var(--muc2)} .sm-so{font-variant-numeric:tabular-nums;font-weight:640}
.sm-xau{color:var(--cap2)}

.hai-huong{display:grid;grid-template-columns:1fr 1fr;gap:var(--k-3);margin:0 0 var(--k-5)}
.hh-o{border:1px solid var(--vien);border-radius:var(--bo-3);padding:var(--k-3) var(--k-4);
  border-left-width:3px}
.hh-duoi{border-left-color:var(--c-duoi);background:#FEF7F7}
.hh-tren{border-left-color:var(--c-tren);background:#FAF8FE}
.hh-ten{font-size:var(--co-2);color:var(--mo);font-weight:600}
.hh-gt{font-size:var(--co-6);font-weight:640;font-variant-numeric:tabular-nums;
  margin:var(--k-1) 0;letter-spacing:-.02em}
.hh-phu{font-size:var(--co-2);color:var(--muc2);line-height:1.5}

.he-thong{border:1px solid var(--vien);border-left:3px solid var(--muc);border-radius:var(--bo-2);
  padding:var(--k-3) var(--k-4);background:var(--nen);font-size:var(--co-3)}
.ht-nhan{font-size:var(--co-1);color:var(--mo);font-weight:600;margin-bottom:var(--k-1);
  text-transform:uppercase;letter-spacing:.04em}
.he-thong p{margin:0;line-height:1.6}
.trong{padding:var(--k-5);text-align:center;color:var(--mo);font-size:var(--co-3)}
.chan{color:var(--mo);font-size:var(--co-2);font-family:var(--mono);padding:var(--k-4) 0;line-height:1.7}
.ve-dau{position:fixed;right:var(--k-5);bottom:var(--k-5);background:var(--giay);
  border:1px solid var(--vien);border-radius:99px;padding:var(--k-2) var(--k-4);
  font-size:var(--co-2);color:var(--muc2);text-decoration:none;
  box-shadow:0 2px 8px rgba(17,24,32,.08);z-index:40}
.ve-dau:hover{border-color:var(--nhan);color:var(--nhan)}

:focus-visible{outline:2px solid var(--nhan);outline-offset:2px;border-radius:var(--bo-1)}
:focus:not(:focus-visible){outline:none}
::selection{background:var(--nhan-nhat)}
.bo-qua{position:absolute;left:-9999px;top:0;background:var(--muc);color:#fff;
  padding:var(--k-2) var(--k-4);border-radius:0 0 var(--bo-2) 0;z-index:99;font-size:var(--co-3)}
.bo-qua:focus{left:0}
@media (prefers-reduced-motion: reduce){
  *{transition:none !important;animation:none !important;scroll-behavior:auto !important}
}
`;

/* ===== 3. PHẦN CHẠY TRONG TRÌNH DUYỆT ==================================
 * Một nguồn trạng thái duy nhất là biến `loc`. Mọi thay đổi gọi `veLai()`.
 * Không để trạng thái nào nằm rải rác trong trang.
 * ===================================================================== */

const JS = String.raw`
(function () {
  var D = DU_LIEU, NG = D.nguong;

  function soVN(v, n) {
    if (v == null || !isFinite(v)) return '—';
    n = n == null ? 1 : n;
    var am = Number(v) < 0, x = Math.abs(Number(v)).toFixed(n).split('.');
    return (am ? '-' : '') + x[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (x[1] ? ',' + x[1] : '');
  }
  function pt(v, n) { return (v == null || !isFinite(v)) ? '—' : soVN(v, n == null ? 1 : n) + '%'; }
  // Cùng cách viết với gioDoc của lõi: KHÔNG quy đổi ra ngày — giờ ở đây là giờ cảm biến cộng
  // dồn (một phòng ba cảm biến có thể "912 giờ" trong kỳ 31 ngày) (rà soát 04/09/2026)
  function gio(g) {
    if (g == null || !isFinite(g)) return '—';
    return soVN(g, g % 1 ? 1 : 0) + ' giờ';
  }
  function nn(s) { return String(s || '').slice(8, 10) + '/' + String(s || '').slice(5, 7); }
  function nd(s) { return String(s || '').slice(0, 10).split('-').reverse().join('/'); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  var TEN_CT = { DP: 'Chênh áp', T: 'Nhiệt độ', RH: 'Độ ẩm' };
  var TEN_UT = { P1: 'Mức 1', P2: 'Mức 2', P3: 'Mức 3' };
  var TEN_HUONG = { CAO: 'vượt giới hạn trên', THAP: 'tụt dưới giới hạn dưới' };
  var TEN_KT = { HET_KY: 'còn ngoài giới hạn khi hết kỳ', TRO_LAI: 'đã trở lại trong ngưỡng',
                 MAT_DU_LIEU: 'mất dữ liệu nên không xác định được' };
  var TEN_TT = { CHUA_XU_LY: 'Chưa xử lý', DANG_XU_LY: 'Đang xử lý',
                 DA_KHAC_PHUC: 'Đã khắc phục', DONG_TU_DONG: 'Hệ thống tự đóng' };

  var loc = { khu: 'TAT_CA', ahu: 'TAT_CA', ut: 'TAT_CA', chuaDat: false, tim: '',
              xep: 'tt', chieu: 'len' };

  function locPhong() {
    var t = loc.tim.trim().toLowerCase();
    return D.phong.filter(function (p) {
      if (loc.khu !== 'TAT_CA' && p.khu !== loc.khu) return false;
      if (loc.ahu !== 'TAT_CA' && p.ahu !== loc.ahu) return false;
      if (loc.ut !== 'TAT_CA' && p.ut !== loc.ut) return false;
      if (loc.chuaDat && !(p.tt < NG)) return false;
      if (t && (p.ma + ' ' + p.ten).toLowerCase().indexOf(t) === -1) return false;
      return true;
    }).sort(function (a, b) {
      var k = loc.xep, va = a[k], vb = b[k];
      if (typeof va === 'string') {
        var r = String(va).localeCompare(String(vb), 'vi');
        return loc.chieu === 'len' ? r : -r;
      }
      va = va == null ? -1 : va; vb = vb == null ? -1 : vb;
      return loc.chieu === 'len' ? va - vb : vb - va;
    });
  }

  function dat(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }

  // Chỉ số trên đầu tính lại theo ĐÚNG bộ lọc đang bật. Không lọc thì lấy đúng con số của
  // kỳ (kpi_ky_nay) để trùng thư và bản in; đang lọc thì lấy trung bình CÂN THEO GIỜ ĐO của
  // các phòng trong nhóm — cùng cách tính với số của kỳ. Trung vị chỉ còn là dòng phụ
  // (rà soát 04/09/2026, đợt 2).
  function veChiSo(ds) {
    var gn = 0, datN = 0, tong = ds.length, maSet = {};
    ds.forEach(function (p) { gn += p.gn; if (p.tt >= NG) datN++; maSet[p.ma] = 1; });
    var soA = D.capA.filter(function (v) { return maSet[v.ma]; }).length;
    var tt = ds.map(function (p) { return p.tt; }).filter(function (v) { return v != null; })
               .sort(function (a, b) { return a - b; });
    var tv = tt.length ? (tt.length % 2 ? tt[(tt.length - 1) / 2]
              : (tt[tt.length / 2 - 1] + tt[tt.length / 2]) / 2) : null;
    var toanBo = loc.khu === 'TAT_CA' && loc.ahu === 'TAT_CA' && loc.ut === 'TAT_CA'
                 && !loc.chuaDat && !loc.tim;
    var ws = 0, wg = 0, nCan = 0;
    ds.forEach(function (p) { if (p.tt != null && p.gd) { ws += p.tt * p.gd; wg += p.gd; nCan++; } });
    var can = wg ? ws / wg : null;
    var chinh = toanBo && D.kpiTT != null ? D.kpiTT : can;
    dat('cs-tt', pt(chinh));
    dat('cs-nhan', toanBo && D.kpiTT != null ? 'thời gian trong ngưỡng, toàn nhà máy'
      : 'trung bình cân theo giờ đo của ' + nCan + ' phòng đang lọc');
    dat('cs-tv', tv == null ? '' : 'trung vị các phòng: ' + pt(tv));
    dat('cs-gn', soVN(gn, 0));
    dat('cs-a', String(soA));
    dat('cs-dat', datN + '/' + tong);
    var e = document.getElementById('cs-tt');
    if (e) e.classList.toggle('xau', chinh != null && chinh < NG);
  }

  var COT = [
    { k: 'ma',  t: 'Mã phòng' }, { k: 'ten', t: 'Tên phòng' },
    { k: 'khu', t: 'Khu' }, { k: 'ahu', t: 'Cụm' }, { k: 'ut', t: 'Ưu tiên' },
    { k: 'tt',  t: 'Thời gian trong ngưỡng %', so: 1 },
    { k: 'gn',  t: 'Giờ vượt giới hạn hành động', so: 1 },
    // (rà soát 04/09/2026, mục 12) bỏ cột dq_pct: đó là chất lượng điểm đo trong giờ có số đo, không phải độ phủ.
  ];

  function spark(ch, w, h) {
    w = w || 92; h = h || 22;
    var pts = (ch || []).filter(function (v) { return v != null; });
    if (pts.length < 2) return '<span class="mo">—</span>';
    var x = function (i) { return (i / (pts.length - 1)) * (w - 2) + 1; };
    var y = function (v) { return h - 2 - (Math.max(0, Math.min(100, v)) / 100) * (h - 4); };
    var d = pts.map(function (v, i) {
      return (i ? 'L' : 'M') + Math.round(x(i)) + ' ' + Math.round(y(v)); }).join(' ');
    var c = pts[pts.length - 1];
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '">'
      + '<line x1="1" x2="' + (w - 1) + '" y1="' + Math.round(y(NG)) + '" y2="' + Math.round(y(NG))
      + '" stroke="#9AA6B2" stroke-width="1" stroke-dasharray="2 2"/>'
      + '<path d="' + d + '" fill="none" stroke="#1D4ED8" stroke-width="1.6" stroke-linejoin="round"/>'
      + '<circle cx="' + Math.round(x(pts.length - 1)) + '" cy="' + Math.round(y(c))
      + '" r="2.2" fill="' + (c < NG ? '#DC2626' : '#1D4ED8') + '"/></svg>';
  }

  function veBang(ds) {
    var th = COT.map(function (c) {
      return '<th class="xep' + (c.so ? ' so' : '') + '" data-cot="' + c.k + '"'
        + (loc.xep === c.k ? ' data-chieu="' + loc.chieu + '"' : '')
        + ' tabindex="0" role="button" title="Bấm để xếp theo cột này">' + c.t + '</th>';
    }).join('') + '<th>Diễn biến</th>';
    var tr = ds.map(function (p) {
      return '<tr class="bam" data-ma="' + esc(p.ma) + '" tabindex="0" '
        + 'title="Bấm để mở chi tiết phòng này">'
        + '<td><span class="ma">' + esc(p.ma) + '</span></td>'
        + '<td>' + esc(p.ten) + (p.ut === 'P1' ? ' <span class="the-nho the-p1">Mức 1</span>' : '') + '</td>'
        + '<td>' + esc(p.khu) + '</td><td>' + esc(p.ahu) + '</td>'
        + '<td>' + (TEN_UT[p.ut] || p.ut) + '</td>'
        + '<td class="so' + (p.tt < NG ? ' tang-xau' : '') + '">' + soVN(p.tt) + '</td>'
        + '<td class="so">' + soVN(p.gn, 0) + '</td>'

        + '<td>' + spark(p.ch) + '</td></tr>';
    }).join('');
    return '<div class="cuon-ngang"><table><thead><tr>' + th + '</tr></thead><tbody>'
      + (tr || '<tr><td colspan="9" class="trong">Không phòng nào khớp bộ lọc đang bật.</td></tr>')
      + '</tbody></table></div>';
  }

  // Biểu đồ dải giới hạn, vẽ khi mở chi tiết một phòng
  function veDai(o) {
    var pts = (o.ch || []).filter(function (c) { return c[1] != null; });
    if (pts.length < 2) return '<p class="mo">Không đủ điểm để vẽ.</p>';
    var W = 700, H = 170, Lx = 46, R = 62, T = 12, B = 24;
    var iw = W - Lx - R, ih = H - T - B, lo = Infinity, hi = -Infinity;
    pts.forEach(function (c) {
      [c[1], c[2], c[3]].forEach(function (v) {
        if (v != null && isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      });
    });
    if (o.ghd != null) lo = Math.min(lo, o.ghd);
    if (o.ght != null) hi = Math.max(hi, o.ght);
    var dem = (hi - lo) * 0.12 || 1; lo -= dem; hi += dem;
    var x = function (i) { return Lx + (i / (pts.length - 1)) * iw; };
    var y = function (v) { return T + ih - ((v - lo) / (hi - lo)) * ih; };
    var s = '';
    if (o.ghd != null && o.ght != null) {
      s += '<rect x="' + Lx + '" y="' + y(o.ght).toFixed(1) + '" width="' + iw + '" height="'
        + Math.max(0, y(o.ghd) - y(o.ght)).toFixed(1) + '" fill="#DBEAFE" fill-opacity="0.55"/>'
        + '<text x="' + (W - R + 6) + '" y="' + (y(o.ght) + 4).toFixed(1)
        + '" class="svg-nhan-gh">trên ' + soVN(o.ght) + '</text>'
        + '<text x="' + (W - R + 6) + '" y="' + (y(o.ghd) + 4).toFixed(1)
        + '" class="svg-nhan-gh">dưới ' + soVN(o.ghd) + '</text>';
    }
    var dDai = '';
    pts.forEach(function (c, i) {
      if (c[2] == null || c[3] == null) return;
      dDai += 'M' + x(i).toFixed(1) + ' ' + y(c[3]).toFixed(1) + 'V' + y(c[2]).toFixed(1);
    });
    s += '<path d="' + dDai + '" stroke="#9AA6B2" stroke-width="' + (pts.length > 20 ? 2 : 4)
      + '" stroke-linecap="round" opacity="0.5" fill="none"/>';
    s += '<path d="' + pts.map(function (c, i) {
        return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(c[1]).toFixed(1); }).join(' ')
      + '" fill="none" stroke="#1D4ED8" stroke-width="1.8" stroke-linejoin="round"/>';
    var buoc = Math.max(1, Math.ceil(pts.length / 12));
    pts.forEach(function (c, i) {
      var ngoai = (o.ghd != null && c[1] < o.ghd) || (o.ght != null && c[1] > o.ght);
      s += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(c[1]).toFixed(1) + '" r="'
        + (pts.length > 20 ? 2.4 : 3.6) + '" fill="' + (ngoai ? '#DC2626' : '#1D4ED8')
        + '" stroke="#fff" stroke-width="1.2"><title>' + nn(c[0]) + ': ' + soVN(c[1])
        + ' (' + soVN(c[2]) + '–' + soVN(c[3]) + ')'
        + (c[4] ? ', ' + c[4] + ' giờ vượt giới hạn hành động' : '') + '</title></circle>';
      if (i % buoc === 0 || i === pts.length - 1) {
        s += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 7)
          + '" text-anchor="middle" class="svg-truc">' + nn(c[0]) + '</text>';
      }
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="bieu-do">' + s + '</svg>';
  }

  function moPhong(ma, ngayChon) {
    var p = null;
    D.phong.forEach(function (x) { if (x.ma === ma) p = x; });
    if (!p) return;
    var h = '';

    var ca = D.capA.filter(function (v) { return v.ma === ma; })[0];
    if (ca) {
      h += '<div class="canh-bao-a"><div class="tieu">Phòng này nằm trong danh sách phải xử lý</div>'
        + ca.cc.map(function (x) { return '<div class="can-cu">' + esc(x) + '</div>'; }).join('')
        + ca.viec.map(function (x) { return '<div class="lam">' + esc(x) + '</div>'; }).join('')
        + '</div>';
    }

    if (ngayChon) {
      var dong = '';
      ['DP', 'T', 'RH'].forEach(function (loai) {
        var cb = D.cb[ma + '|' + loai];
        if (!cb) return;
        cb.ch.forEach(function (c) {
          if (c[0] !== ngayChon) return;
          dong += '<tr><td>' + TEN_CT[loai] + '</td><td class="so">' + soVN(c[1]) + '</td>'
            + '<td class="so">' + soVN(c[2]) + '</td><td class="so">' + soVN(c[3]) + '</td>'
            + '<td class="so">' + c[4] + '</td><td class="so">' + c[5] + '</td>'
            + '<td class="so">' + soVN(cb.ghd) + ' – ' + soVN(cb.ght) + '</td></tr>';
        });
      });
      if (dong) {
        h += '<div class="khoi-ct"><div class="khoi-ct-ten">Số đo ngày ' + nd(ngayChon) + '</div>'
          + '<div class="cuon-ngang"><table style="margin-top:8px"><thead><tr><th>Chỉ tiêu</th>'
          + '<th class="so">Trung bình</th><th class="so">Thấp nhất</th><th class="so">Cao nhất</th>'
          + '<th class="so">Giờ vượt giới hạn hành động</th><th class="so">Giờ cảnh báo</th>'
          + '<th class="so">Dải cho phép</th></tr></thead><tbody>' + dong + '</tbody></table></div></div>';
      }
    }

    ['DP', 'T', 'RH'].forEach(function (loai) {
      var cb = D.cb[ma + '|' + loai];
      if (!cb) return;
      var cs = D.chiSo[ma + '|' + loai] || {};
      h += '<div class="khoi-ct"><div class="khoi-ct-dau">'
        + '<div><span class="khoi-ct-ten">' + TEN_CT[loai] + '</span>'
        + '<span class="mo" style="font-size:12px"> · dải cho phép ' + soVN(cb.ghd) + ' – '
        + soVN(cb.ght) + '</span></div>'
        + '<span class="khoi-ct-so' + (cs.tt != null && cs.tt < NG ? ' tang-xau' : '') + '">'
        + pt(cs.tt) + '</span></div>'
        + veDai(cb)
        + '<div class="dong-so">'
        + '<span>Giờ ngoài giới hạn: <b>' + gio(cs.gl) + '</b></span>'
        + (cs.gn ? '<span>Giờ ngoài giới hạn hướng ngược: <b>' + gio(cs.gn) + '</b></span>' : '')
        + '<span>Số đợt ngoài giới hạn: <b>' + (cs.sd == null ? '—' : cs.sd) + '</b></span>'
        + '<span>Đợt dài nhất: <b>' + (cs.dd == null ? '—' : gio(cs.dd)) + '</b></span>'
        + (cs.cl ? '<span class="tang-xau">Còn ngoài giới hạn khi hết kỳ</span>' : '')
        + '</div></div>';
    });

    var sk = D.suKien.filter(function (s) { return s.p === ma; });
    if (sk.length) {
      h += '<h3>Các đợt ngoài giới hạn trong kỳ (' + sk.length + ')</h3><div class="cuon-ngang"><table><thead><tr>'
        + '<th>Chỉ tiêu</th><th>Ra ngoài phía nào</th><th class="so">Thời gian kéo dài</th><th>Từ → đến</th>'
        + '<th class="so">Giá trị xa dải nhất</th><th>Đợt ngoài giới hạn kết thúc thế nào</th></tr></thead><tbody>'
        + sk.map(function (s) {
            return '<tr><td>' + TEN_CT[s.l] + '</td><td>' + (TEN_HUONG[s.h] || s.h) + '</td>'
              + '<td class="so">' + gio(s.g) + '</td>'
              + '<td>' + nd(s.bd) + ' ' + String(s.bd).slice(11, 16) + '<br><span class="mo">→ '
              + nd(s.kt) + ' ' + String(s.kt).slice(11, 16) + '</span></td>'
              + '<td class="so">' + soVN(s.gt) + ' ' + esc(s.dv) + '</td>'
              + '<td>' + (TEN_KT[s.kd] || s.kd) + '</td></tr>';
          }).join('') + '</tbody></table></div>';
    }

    var sc = D.suCo.filter(function (s) { return s.p === ma; });
    if (sc.length) {
      h += '<h3>Sự cố còn mở (' + sc.length + ')</h3><div class="cuon-ngang"><table><thead><tr>'
        + '<th>Số sự cố</th><th>Mức</th><th>Mở từ</th><th class="so">Đã kéo dài</th>'
        + '<th>Trạng thái</th></tr></thead><tbody>'
        + sc.map(function (s) {
            return '<tr><td><span class="ma">' + esc(s.ma) + '</span></td>'
              + '<td>' + (s.mc === 'CRITICAL' ? 'nghiêm trọng' : 'cảnh báo') + '</td>'
              + '<td>' + esc(s.bd)   // đã là dd/mm/yyyy giờ VN từ lúc nhúng (rà soát 04/09/2026)
              + (s.nk ? ' <span class="the-ngoai-ky">ngoài kỳ</span>' : '') + '</td>'
              + '<td class="so">' + gio(s.kd) + '</td>'
              + '<td>' + (TEN_TT[s.tt] || s.tt) + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        + (sc.some(function (s) { return s.nk; })
            ? '<p class="chu-thich">Sự cố đánh dấu <b>ngoài kỳ</b> mở sau ngày chốt kỳ nên '
              + 'không tính vào kết quả kỳ này; số giờ kéo dài đo tới lúc lấy dữ liệu.</p>' : '');
    }

    dat('ngan-ten', p.ma === p.ten || !p.ten ? p.ma : p.ma + ' · ' + p.ten);
    dat('ngan-phu', 'Khu ' + p.khu + ' · cụm ' + p.ahu + ' · ' + (TEN_UT[p.ut] || p.ut)
      + ' · thời gian trong ngưỡng ' + pt(p.tt) + ' · ' + gio(p.gn) + ' ngoài giới hạn');
    document.getElementById('ngan-than').innerHTML = h || '<p class="mo">Không có số liệu chi tiết.</p>';
    document.getElementById('ngan').classList.add('mo');
    document.getElementById('dong').classList.add('mo');
    document.getElementById('nut-dong').focus();
  }
  function dongNgan() {
    document.getElementById('ngan').classList.remove('mo');
    document.getElementById('dong').classList.remove('mo');
  }

  // Xuất đúng phạm vi đang lọc. Dấu chấm phẩy vì máy dùng dấu phẩy làm dấu
  // thập phân; thêm dấu nhận dạng đầu tệp để bảng tính đọc đúng tiếng Việt.
  function xuatCSV(ds) {
    var dau = ['Mã phòng', 'Tên phòng', 'Khu', 'Cụm', 'Mức ưu tiên',
               'Thời gian trong ngưỡng %', 'Giờ vượt giới hạn hành động'];
    var dong = ds.map(function (p) {
      return [p.ma, p.ten, p.khu, p.ahu, TEN_UT[p.ut] || p.ut, p.tt, p.gn];
    });
    var csv = [dau].concat(dong).map(function (h) {
      return h.map(function (o) {
        var s = String(o == null ? '' : o);
        return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(';');
    }).join('\r\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'phong-' + D.ky + '-' + D.den + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function veLai() {
    var ds = locPhong();
    veChiSo(ds);
    var b = document.getElementById('bang-phong');
    if (b) b.innerHTML = veBang(ds);
    var e = document.getElementById('dem-loc');
    if (e) e.innerHTML = 'đang xem <b>' + ds.length + '</b>/' + D.phong.length + ' phòng';
    [].slice.call(document.querySelectorAll('[data-loc]')).forEach(function (n) {
      n.setAttribute('aria-pressed', String(loc[n.dataset.loc] === n.dataset.gt));
    });
    var cd = document.getElementById('nut-chua-dat');
    if (cd) cd.setAttribute('aria-pressed', String(loc.chuaDat));
  }

  document.addEventListener('click', function (e) {
    var n = e.target.closest('[data-loc]');
    if (n) { loc[n.dataset.loc] = n.dataset.gt; veLai(); return; }
    if (e.target.closest('#nut-chua-dat')) { loc.chuaDat = !loc.chuaDat; veLai(); return; }
    if (e.target.closest('#nut-xoa-loc')) {
      loc.khu = 'TAT_CA'; loc.ahu = 'TAT_CA'; loc.ut = 'TAT_CA';
      loc.chuaDat = false; loc.tim = '';
      document.getElementById('o-tim').value = '';
      document.getElementById('chon-ahu').value = 'TAT_CA';
      veLai(); return;
    }
    if (e.target.closest('#nut-csv')) { xuatCSV(locPhong()); return; }
    var th = e.target.closest('th.xep');
    if (th) {
      if (loc.xep === th.dataset.cot) loc.chieu = loc.chieu === 'len' ? 'xuong' : 'len';
      else { loc.xep = th.dataset.cot; loc.chieu = 'len'; }
      veLai(); return;
    }
    var tr = e.target.closest('tr.bam');
    if (tr) { moPhong(tr.dataset.ma); return; }
    var o = e.target.closest('rect.bam-duoc');
    if (o) { moPhong(o.getAttribute('data-ma'), o.getAttribute('data-ngay')); return; }
    if (e.target.closest('#nut-dong') || e.target.id === 'dong') { dongNgan(); return; }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { dongNgan(); return; }
    if (e.key === 'Enter' || e.key === ' ') {
      var n = e.target.closest && (e.target.closest('th.xep') || e.target.closest('tr.bam'));
      if (n) { e.preventDefault(); n.click(); }
    }
  });

  var oTim = document.getElementById('o-tim');
  if (oTim) oTim.addEventListener('input', function () { loc.tim = this.value; veLai(); });
  var cAhu = document.getElementById('chon-ahu');
  if (cAhu) cAhu.addEventListener('change', function () { loc.ahu = this.value; veLai(); });

  var nutThe = [].slice.call(document.querySelectorAll('.the-nut'));
  var noiDung = [].slice.call(document.querySelectorAll('.the-noi-dung'));
  function chonThe(nut, dayFocus) {
    nutThe.forEach(function (n) {
      var la = n === nut;
      n.setAttribute('aria-selected', String(la)); n.tabIndex = la ? 0 : -1;
    });
    noiDung.forEach(function (o) { o.classList.toggle('hien', o.id === nut.dataset.the); });
    if (dayFocus) nut.focus();
    var giam = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: giam ? 'auto' : 'smooth' });
  }
  nutThe.forEach(function (nut, i) {
    nut.tabIndex = i === 0 ? 0 : -1;
    nut.addEventListener('click', function () { chonThe(nut, false); });
    nut.addEventListener('keydown', function (e) {
      var b = { ArrowRight: 1, ArrowLeft: -1, Home: 'dau', End: 'cuoi' }[e.key];
      if (b === undefined) return;
      e.preventDefault();
      var j = b === 'dau' ? 0 : b === 'cuoi' ? nutThe.length - 1
            : (i + b + nutThe.length) % nutThe.length;
      chonThe(nutThe[j], true);
    });
  });

  veLai();
})();
`;

/* ===== 4. RÁP TRANG ===================================================== */

function rapDashboard(d, duBao, cfg) {
  const c = cfg || {};
  const k = d.kpi_ky_nay || {};
  const cap = L.phanCap(d);
  const cay = L.dungCay(d);
  const chuoi = (d.chuoi_ngay && d.chuoi_ngay.total) || [];
  const ngays = chuoi.map((x) => x.ngay);
  const ctDP = L.tongHopChiTieu(d, 'DP');
  const ctT = L.tongHopChiTieu(d, 'T');
  const ctRH = L.tongHopChiTieu(d, 'RH');
  const ht = cap.heThong;
  const tenKy = dich(L.TEN_KY, String(d.ky).toUpperCase(), String(d.ky).toLowerCase());
  const nhung = duLieuNhung(d);

  const khus = cay.map((x) => x.khu);
  const ahus = [];
  cay.forEach((x) => x.cum.forEach((cc) => { if (ahus.indexOf(cc.ahu) === -1) ahus.push(cc.ahu); }));

  function mucChiTieu(ct) {
    if (!ct.so_phong_do) {
      return '<div class="o"><h2>' + esc(ct.ten_day_du) + '</h2><p class="mo">Kỳ này không có phòng nào đo '
        + esc(String(ct.ten).toLowerCase()) + '.</p></div>';
    }
    const capCT = L.gomChiTieuTheoCap(ct);
    const hh = ct.hai_huong || {};
    const xep = ct.xep_hang.slice()
      .sort((a, b) => (b.gio_lech_tong || 0) - (a.gio_lech_tong || 0)).slice(0, 15);
    return '<div class="o"><h2>' + esc(ct.ten_day_du) + '</h2>'
      + '<p class="mota">' + esc(ct.y_nghia) + '</p>'
      + (hh.nguoc
          ? '<div class="hai-huong">'
            + '<div class="hh-o hh-duoi"><div class="hh-ten">'
            +   esc(hh.chinh.ngan === 'tụt dưới' ? hh.chinh.ten : hh.nguoc.ten) + '</div>'
            +   '<div class="hh-gt">' + L.gioTyLe(ct.tong_gio_duoi, ct.tong_gio_do) + '</div>'
            +   '<div class="hh-phu">' + ct.so_phong_lech_duoi + '/' + ct.so_phong_do + ' phòng · '
            +   esc(hh.chinh.ngan === 'tụt dưới' ? hh.chinh.he_qua : hh.nguoc.he_qua) + '</div></div>'
            + '<div class="hh-o hh-tren"><div class="hh-ten">'
            +   esc(hh.chinh.ngan === 'vượt trên' ? hh.chinh.ten : hh.nguoc.ten) + '</div>'
            +   '<div class="hh-gt">' + L.gioTyLe(ct.tong_gio_tren, ct.tong_gio_do) + '</div>'
            +   '<div class="hh-phu">' + ct.so_phong_lech_tren + '/' + ct.so_phong_do + ' phòng · '
            +   esc(hh.chinh.ngan === 'vượt trên' ? hh.chinh.he_qua : hh.nguoc.he_qua) + '</div></div>'
            + '</div>'
          : '')
      + '<h3>So sánh các khu</h3>'
      + '<p class="mota">So bằng <b>tỉ lệ</b> thời gian ngoài giới hạn của từng nhóm, không bằng số giờ cộng dồn: '
      + 'nhóm đông phòng luôn nhiều giờ hơn dù chất lượng có khi còn tốt hơn. Mẫu số là thời gian có '
      + 'số đo của chính nhóm đó; số giờ cộng dồn xem khi rê chuột.</p>'
      + (hh.nguoc
          ? L.svgThanhHaiChieu(capCT.khu.map((x) => Object.assign({ nhan: 'Khu ' + x.khu }, x)),
              'nhan', 'tong_gio_duoi', 'tong_gio_tren')
          : L.svgSoSanhCap(capCT.khu.map((x) => Object.assign({ nhan: 'Khu ' + x.khu }, x)), 'nhan'))
      + '<h3>So sánh các cụm xử lý không khí</h3>'
      + (hh.nguoc
          ? L.svgThanhHaiChieu(capCT.cum.slice(0, 10), 'nhan', 'tong_gio_duoi', 'tong_gio_tren')
          : L.svgSoSanhCap(capCT.cum.slice(0, 10), 'nhan'))
      + '<h3>Xếp hạng phòng ra ngoài giới hạn nhiều nhất</h3>'
      + L.svgThanhXepHang(xep, hh.nguoc ? 'gio_lech_tong' : 'gio_lech', 'giờ', true)
      + '<p class="chu-thich">Muốn xem chuỗi ngày và các đợt ngoài giới hạn của riêng một phòng thì sang thẻ '
      + '“Tra cứu phòng” rồi bấm vào phòng đó.</p></div>';
  }

  // Bản đồ phòng × ngày: mỗi ô bấm được để mở đúng ngày đó của đúng phòng đó
  function banDoBamDuoc(phongs, ds) {
    if (!phongs.length || !ds.length) return '';
    const oW = ds.length > 15 ? 17 : 30, oH = 15, Lx = 122, T = 20;
    const W = Lx + ds.length * oW + 8, H = T + phongs.length * oH + 6;
    const buoc = Math.max(1, Math.ceil(ds.length / 16));
    let s = '';
    ds.forEach((n, j) => {
      if (j % buoc === 0 || j === ds.length - 1) {
        s += '<text x="' + (Lx + j * oW + oW / 2) + '" y="' + (T - 7)
          + '" text-anchor="middle" class="svg-truc">' + ngayNgan(n) + '</text>';
      }
    });
    phongs.forEach((p, i) => {
      const y = T + i * oH;
      s += '<text x="' + (Lx - 6) + '" y="' + (y + oH - 4) + '" text-anchor="end" class="svg-hang-nho">'
        + esc(p.ma_phong) + (p.muc_uu_tien === 'P1' ? ' ◆' : '') + '</text>';
      const map = {};
      (p.chuoi || []).forEach((cc) => { map[cc.ngay] = cc.ty_le; });
      ds.forEach((n, j) => {
        const v = map[n];
        const lop = v == null ? 'k0' : v >= NGUONG_HANH_DONG ? 'k1'
                  : v >= 50 ? 'k2' : v >= 20 ? 'k3' : 'k4';
        s += '<rect x="' + (Lx + j * oW) + '" y="' + y + '" width="' + (oW - 2) + '" height="' + (oH - 2)
          + '" class="' + lop + ' bam-duoc" data-ma="' + esc(p.ma_phong) + '" data-ngay="' + esc(n) + '">'
          + '<title>' + esc(p.ma_phong) + ' ' + ngayNgan(n) + ': '
          + (v == null ? 'không có số đo' : phanTram(v, 0))
          + ' — bấm để xem số đo ngày này</title></rect>';
      });
    });
    return '<div class="cuon-ngang o-bd"><svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W
      + '" height="' + H + '" class="bieu-do">' + s + '</svg></div>';
  }

  const phongDuBanDo = (d.tat_ca_phong || [])
    .filter((p) => p.muc_uu_tien === 'P1' || p.muc_uu_tien === 'P2' || p.ty_le_tuan_thu < NGUONG_HANH_DONG)
    .sort((a, b) => a.ty_le_tuan_thu - b.ty_le_tuan_thu);
  const phongBanDo = phongDuBanDo.slice(0, 30);
  // Nói rõ khi bị cắt (rà soát 04/09/2026)
  const chuBanDo = phongDuBanDo.length > phongBanDo.length
    ? 'Hiện ' + phongBanDo.length + '/' + phongDuBanDo.length + ' phòng kém nhất trong số phòng theo dõi đặc biệt, '
      + 'mức 2 hoặc dưới ngưỡng; các phòng còn lại xem ở thẻ “Tra cứu phòng”. ' : '';

  const THE = [
    { id: 'the-tong-quan', ten: 'Tổng quan' },
    { id: 'the-tra-cuu',   ten: 'Tra cứu phòng' },
    { id: 'the-chenh-ap',  ten: 'Chênh áp' },
    { id: 'the-nhiet',     ten: 'Nhiệt độ' },
    { id: 'the-am',        ten: 'Độ ẩm' },
    { id: 'the-dot-lech',  ten: 'Đợt ngoài giới hạn' },
    { id: 'the-cay',       ten: 'Khu · cụm · phòng' }
  ];

  const hangDotLech = ['DP', 'T', 'RH'].map((loai) => {
    const ct = L.tongHopChiTieu(d, loai);
    return ct.su_kien.map((s) => ''
      + '<tr class="bam" data-ma="' + esc(s.ma_phong) + '" tabindex="0">'
      + '<td><span class="ma">' + esc(s.ma_phong) + '</span><br><span class="mo">'
      +   esc(s.ten_phong) + '</span></td>'
      + '<td>' + esc(dich(L.TEN_CHI_TIEU, s.loai_cam_bien)) + '</td>'
      + '<td>' + esc(s.khu_vuc) + ' · ' + esc(s.ahu) + '</td>'
      + '<td>' + esc(dich(L.TEN_HUONG, s.huong)) + '</td>'
      + '<td class="so">' + gioDoc(s.so_gio) + '</td>'
      + '<td>' + ngayDai(s.bat_dau) + ' ' + gioPhut(s.bat_dau) + '<br><span class="mo">→ '
      +   ngayDai(s.ket_thuc) + ' ' + gioPhut(s.ket_thuc) + '</span></td>'
      + '<td class="so">' + soVN(s.huong === 'CAO' ? s.gia_tri_max : s.gia_tri_min, 1)
      +   ' ' + esc(s.don_vi) + '</td>'
      + '<td>' + esc(dich(L.TEN_KET_THUC, s.ket_thuc_do)) + '</td></tr>');
  }).reduce((a, b) => a.concat(b), []).join('');

  return '<!doctype html>\n<html lang="vi"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>' + esc(c.tieu_de || 'Bảng theo dõi môi trường phòng sạch') + '</title>'
    + '<style>' + CSS + '</style></head><body>'
    + '<a class="bo-qua" href="#the-tong-quan">Bỏ qua phần đầu, vào thẳng nội dung</a>'
    + '<div class="khung">'

    + '<div class="dinh"><div class="dinh-tren"><div>'
    + '<h1>' + esc(c.tieu_de || 'Bảng theo dõi môi trường phòng sạch') + '</h1>'
    + '<div class="phu">' + esc(c.don_vi || 'Hệ quản lý toà nhà') + ' · báo cáo ' + esc(tenKy)
    + ' · ' + ngayDai(d.tu_ngay) + ' → ' + ngayDai(d.den_ngay) + ' · ' + (k.so_ngay_co_du_lieu || 0)
    + ' ngày có số đo</div></div>'
    + '<div class="chi-so-nhanh">'
    + '<div class="csn csn-chinh"><div class="gt" id="cs-tt">—</div>'
    +   '<div class="ten" id="cs-nhan">thời gian trong ngưỡng, toàn nhà máy</div>'
    +   '<div class="ten" id="cs-tv"></div></div>'
    + '<div class="csn"><div class="gt" id="cs-gn">—</div>'
    +   '<div class="ten">giờ cảm biến vượt giới hạn hành động</div></div>'
    + '<div class="csn"><div class="gt" id="cs-a">—</div>'
    +   '<div class="ten">phòng phải xử lý</div></div>'
    + '<div class="csn"><div class="gt" id="cs-dat">—</div>'
    +   '<div class="ten">phòng đạt ngưỡng</div></div>'
    + '</div></div>'
    + '<div class="thanh-the" role="tablist">'
    + THE.map((t, i) => '<button class="the-nut" role="tab" data-the="' + t.id + '" aria-selected="'
        + (i === 0 ? 'true' : 'false') + '">' + esc(t.ten) + '</button>').join('')
    + '</div></div>'

    + '<div class="loc">'
    + '<span class="loc-nhom"><span class="loc-nhan">Khu</span>'
    +   '<button class="loc-nut" data-loc="khu" data-gt="TAT_CA" aria-pressed="true">Tất cả</button>'
    +   khus.map((x) => '<button class="loc-nut" data-loc="khu" data-gt="' + esc(x)
          + '" aria-pressed="false">' + esc(x) + '</button>').join('') + '</span>'
    + '<span class="loc-nhom"><span class="loc-nhan">Ưu tiên</span>'
    +   '<button class="loc-nut" data-loc="ut" data-gt="TAT_CA" aria-pressed="true">Tất cả</button>'
    +   ['P1', 'P2', 'P3'].map((x) => '<button class="loc-nut" data-loc="ut" data-gt="' + x
          + '" aria-pressed="false">' + dich(L.TEN_UU_TIEN_NGAN, x) + '</button>').join('') + '</span>'
    + '<select class="o-tim" id="chon-ahu" aria-label="Lọc theo cụm xử lý không khí">'
    +   '<option value="TAT_CA">Tất cả cụm</option>'
    +   ahus.map((x) => '<option value="' + esc(x) + '">' + esc(x) + '</option>').join('') + '</select>'
    + '<button class="loc-nut" id="nut-chua-dat" aria-pressed="false">Chỉ phòng chưa đạt</button>'
    + '<input class="o-tim" id="o-tim" type="search" placeholder="Tìm mã hoặc tên phòng…" '
    +   'aria-label="Tìm phòng theo mã hoặc tên">'
    + '<button class="nut-phu" id="nut-xoa-loc">Bỏ lọc</button>'
    + '<button class="nut-phu" id="nut-csv">Tải bảng (.csv)</button>'
    + '<span class="dem-loc" id="dem-loc"></span>'
    + '</div>'

    + '<main>'

    + '<div class="the-noi-dung hien" id="the-tong-quan" role="tabpanel" tabindex="0">'
    + '<div class="o"><h2>Thời gian trong ngưỡng theo ngày · toàn nhà máy</h2>'
    + '<p class="mota">Đường đậm là tỉ lệ thời gian số đo nằm trong ngưỡng mỗi ngày. Vạch đỏ đứt là '
    + 'ngưỡng hành động ' + NGUONG_HANH_DONG + '%; vùng hồng là phần còn thiếu so với ngưỡng đó.</p>'
    + '<div class="khung-bd">' + L.svgDuongNgay(chuoi, 'Thời gian trong ngưỡng theo ngày') + '</div></div>'
    + ((duBao || {}).chuoi && duBao.chuoi.length >= 3
        ? '<div class="o"><h2>Xu hướng dài</h2>'
          + '<p class="mota">' + duBao.chuoi.length + ' ngày đã đo nối tiếp phần ngoại suy 7 ngày. '
          + 'Đường liền là số đã đo, đường đứt là phần ngoại suy.</p>'
          + '<div class="khung-bd">' + L.svgXuHuongDai(duBao.chuoi, duBao.du_bao) + '</div></div>'
        : '')
    + (ht ? '<div class="o"><div class="he-thong"><div class="ht-nhan">Mức độ tin cậy của số đo</div>'
        + '<p><b>' + esc(ht.ket_luan) + '.</b> '
        + (ht.do_phu_pct != null ? 'Thu được ' + phanTram(ht.do_phu_pct) + ' số giờ so với kỳ vọng, còn '
            + soVN(ht.gio_rong || 0, 0) + ' giờ không có số đo. ' : '')
        + soVN(ht.tong_ngoai_le, 0) + ' lượt trục trặc khi lấy dữ liệu.</p></div></div>' : '')
    + '<div class="o"><h2>Bản đồ thời gian trong ngưỡng theo phòng và ngày</h2>'
    + '<p class="mota">Ô trắng là ngày đạt ngưỡng. Chỉ ngày dưới ngưỡng mới tô màu, càng đậm càng nặng. '
    + chuBanDo
    + '<b>Bấm vào một ô để xem số đo của đúng phòng đó trong đúng ngày đó.</b></p>'
    + banDoBamDuoc(phongBanDo, ngays) + '</div>'
    + '<div class="o"><h2>So sánh các khu</h2>'
    + L.svgSmallMultiples(cay.map((x) => ({ ten: 'Khu ' + x.khu, ty_le: x.ty_le_tb, chuoi: x.chuoi })),
        'ten', 'ty_le') + '</div>'
    + '</div>'

    + '<div class="the-noi-dung" id="the-tra-cuu" role="tabpanel" tabindex="0">'
    + '<div class="o"><h2>Tra cứu phòng</h2>'
    + '<p class="mota">Dùng thanh lọc phía trên để thu hẹp phạm vi — bốn bộ lọc chồng nhau được. '
    + 'Bấm tiêu đề cột để đổi cách xếp. Bấm một dòng để mở chi tiết phòng đó: chuỗi ngày của cả ba '
    + 'chỉ tiêu kèm dải cho phép, danh sách đợt ngoài giới hạn và sự cố còn mở. Bốn chỉ số trên đầu trang tính '
    + 'lại theo đúng phạm vi đang lọc. Nút “Tải bảng” xuất đúng phạm vi đó ra tệp mở được bằng bảng tính.</p>'
    + '<div id="bang-phong"></div></div></div>'

    + '<div class="the-noi-dung" id="the-chenh-ap" role="tabpanel" tabindex="0">' + mucChiTieu(ctDP) + '</div>'
    + '<div class="the-noi-dung" id="the-nhiet" role="tabpanel" tabindex="0">' + mucChiTieu(ctT) + '</div>'
    + '<div class="the-noi-dung" id="the-am" role="tabpanel" tabindex="0">' + mucChiTieu(ctRH) + '</div>'

    + '<div class="the-noi-dung" id="the-dot-lech" role="tabpanel" tabindex="0"><div class="o">'
    + '<h2>Các đợt ngoài giới hạn kéo dài trong kỳ</h2>'
    + '<p class="mota">Mỗi dòng là một đợt số đo ra ngoài dải cho phép liên tục từ '
    + L.DOT_LECH_DANG_KE + ' giờ trở lên. Bấm một dòng để mở chi tiết phòng.</p>'
    + '<div class="cuon-ngang"><table><thead><tr><th>Phòng</th><th>Chỉ tiêu</th><th>Khu · cụm</th>'
    + '<th>Ra ngoài phía nào</th><th class="so">Thời gian kéo dài</th><th>Từ → đến</th>'
    + '<th class="so">Giá trị xa dải nhất</th><th>Đợt ngoài giới hạn kết thúc thế nào</th></tr></thead><tbody>'
    + (hangDotLech || '<tr><td colspan="8" class="trong">Kỳ này không có đợt ngoài giới hạn nào đủ dài.</td></tr>')
    + '</tbody></table></div></div></div>'

    + '<div class="the-noi-dung" id="the-cay" role="tabpanel" tabindex="0">'
    + '<div class="o"><h2>' + (c.khu ? 'Khu ' + esc(String(c.khu).toUpperCase()) + ' → cụm xử lý không khí → phòng' : 'Toàn nhà máy → khu → cụm xử lý không khí → phòng') + '</h2>'
    + '<p class="mota">Xếp từ kém nhất lên, để thấy vấn đề nằm ở một phòng riêng lẻ hay ở cả cụm.</p></div>'
    + cay.map((k2) => '<div class="o">'
        + '<h2>Khu ' + esc(k2.khu) + ' <span class="mo" style="font-weight:400;font-size:13px">— '
        + phanTram(k2.ty_le_tb) + ' trong ngưỡng · ' + k2.so_phong_dat + '/' + k2.so_phong
        + ' phòng đạt · ' + L.gioTyLe(k2.gio_nghiem_trong, k2.gio_do) + ' số giờ vượt giới hạn hành động</span></h2>'
        + '<div class="cuon-ngang"><table><thead><tr><th>Cụm</th>'
        + '<th class="so">Thời gian trong ngưỡng</th><th class="so">Phòng đạt</th>'
        + '<th class="so">Giờ vượt giới hạn hành động</th><th>Diễn biến</th></tr></thead><tbody>'
        + k2.cum.map((cc) => '<tr><td>' + esc(cc.ahu) + '</td>'
            + '<td class="so' + (cc.ty_le_tb < NGUONG_HANH_DONG ? ' tang-xau' : '') + '">'
            +   phanTram(cc.ty_le_tb) + '</td>'
            + '<td class="so">' + cc.so_phong_dat + '/' + cc.so_phong + '</td>'
            + '<td class="so">' + L.gioTyLe(cc.gio_nghiem_trong, cc.gio_do) + '</td>'
            + '<td>' + L.svgSpark(cc.chuoi, 92, 20) + '</td></tr>').join('')
        + '</tbody></table></div></div>').join('')
    + '</div>'

    + '</main>'

    + '<div class="dong" id="dong"></div>'
    + '<aside class="ngan" id="ngan" role="dialog" aria-modal="true" aria-labelledby="ngan-ten">'
    + '<div class="ngan-dau"><div><div class="ngan-ten" id="ngan-ten"></div>'
    + '<div class="ngan-phu" id="ngan-phu"></div></div>'
    + '<button class="nut-dong" id="nut-dong" aria-label="Đóng chi tiết phòng">×</button></div>'
    + '<div class="ngan-than" id="ngan-than"></div></aside>'

    + '<a class="ve-dau" href="#the-tong-quan">↑ Về đầu</a>'
    + '<footer class="chan">Nguồn số liệu: ' + esc(d.nguon || 'rpc_bao_cao_tong_hop') + ' (' + esc(d.ky)
    + ', ' + ngayDai(d.tu_ngay) + ' – ' + ngayDai(d.den_ngay) + ') · lập lúc '
    + esc(L.gioVietNam(d.tao_luc)) + ' giờ Việt Nam'   // tao_luc là UTC (rà soát 04/09/2026)
    + '<br>Dùng chung số liệu, từ ngữ và luật xếp hạng với bản in. Số liệu nhúng sẵn trong tệp nên '
    + 'mở được không cần mạng; vì thế tệp nặng, nên để trên Drive và gửi đường dẫn thay vì đính kèm thư.'
    + '</footer>'

    + '</div>'
    + '<script>var DU_LIEU = ' + JSON.stringify(nhung) + ';</script>'
    + '<script>' + JS + '</script></body></html>';
}

module.exports = { rapDashboard: rapDashboard, duLieuNhung: duLieuNhung };
