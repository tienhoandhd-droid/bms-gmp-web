'use strict';
/* ===========================================================================
 * RÁP BÁO CÁO BẢN IN (scorecard A4 → PDF)
 *
 * Trình tự trình bày đi từ LỚN TỚI NHỎ:
 *   toàn nhà máy → so sánh các khu → trong mỗi khu so sánh các cụm xử lý
 *   không khí → trong mỗi cụm liệt kê từng phòng.
 *
 * Chênh áp là mục lớn nhất và đứng trước, vì đây là hàng rào ngăn nhiễm chéo.
 * Nhiệt độ và độ ẩm có mục riêng, chỉ tính trên các phòng thực sự có đo.
 *
 * Mọi từ ngữ, luật xếp hạng và biểu đồ lấy từ bao-cao-loi.js để bản in và
 * bản xem trên máy không nói hai giọng khác nhau.
 * ========================================================================= */

const L = require('./bao-cao-loi.js');
const { esc, so, soVN, phanTram, ngayDai, ngayNgan, gioDoc, gioPhut, delta, dich, NGUONG_HANH_DONG, TOI_DA_CAP_A } = L;

/* ===== CSS ============================================================== */

const CSS = `
/* ── Thang cỡ chữ và khoảng cách ──────────────────────────────────────────
   Mỗi bậc cách nhau đủ để mắt nhận ra ngay thứ bậc, không cần đọc mới biết
   cái nào lớn hơn. Khoảng cách dùng bội số của 4 để mọi khối thẳng hàng.  */
:root{
  --muc:${L.MAU.muc}; --muc2:${L.MAU.muc2}; --mo:${L.MAU.mo}; --nhat:${L.MAU.nhat};
  --vien:${L.MAU.vien}; --vien2:${L.MAU.vien2}; --giay:${L.MAU.giay}; --nen:${L.MAU.nen};
  --nhan:${L.MAU.nhan}; --nhan-nhat:${L.MAU.nhanNhat};
  --cap1:${L.MAU.cap1}; --cap2:${L.MAU.cap2}; --cap3:${L.MAU.cap3};
  --c-duoi:${L.MAU.lechDuoi}; --c-tren:${L.MAU.lechTren};

  /* Thang cỡ chữ cho MÀN HÌNH. Chuẩn đọc trên màn hình hiện nay là 16px cho
     thân bài; 14px nhét được nhiều thông tin hơn nhưng đó là ưu tiên sai khi
     người đọc là quản lý. Bản in ra giấy vẫn giữ cỡ nhỏ hơn ở khối @media print
     vì giấy đọc gần hơn màn hình. */
  --co-1: 12px;  --co-2: 13px;  --co-3: 14px;  --co-4: 16px;
  --co-5: 18px;  --co-6: 22px;  --co-7: 28px;  --co-8: 58px;
  --k-1: 4px;  --k-2: 8px;  --k-3: 12px;  --k-4: 16px;
  --k-5: 24px; --k-6: 32px; --k-7: 44px;
  --le: 40px;
  /* Ba tầng bề mặt. Trang phẳng lì thì mắt không biết cái gì thuộc cái gì;
     nhưng đây là tài liệu chất lượng nên bóng phải rất nhẹ, đủ để tách tầng
     chứ không thành trang trí. Khi in thì bỏ hết bóng. */
  --nen-0:#F4F5F7;     /* nền ngoài cùng */
  --bong-1:0 1px 2px rgba(17,24,32,.04);
  --bong-2:0 2px 8px rgba(17,24,32,.06), 0 1px 2px rgba(17,24,32,.04);
  --bo-1: 4px;  --bo-2: 6px;  --bo-3: 8px;   /* ba bậc bo góc, không dùng giá trị lẻ */                       /* lề trái phải chung cho mọi mục */
  --mono: ui-monospace,'SF Mono','Cascadia Code',Consolas,monospace;
}
*{box-sizing:border-box}
body{margin:0;background:var(--nen-0);color:var(--muc);
  font:var(--co-4)/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Arial,sans-serif;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.trang{max-width:1000px;margin:0 auto;background:var(--giay);
  box-shadow:0 0 0 1px rgba(17,24,32,.05), 0 8px 32px rgba(17,24,32,.06)}

/* ── Đầu trang ───────────────────────────────────────────────────────── */
.dau{display:flex;justify-content:space-between;align-items:flex-end;gap:var(--k-5);
  padding:var(--k-6) var(--le) var(--k-4);border-bottom:2px solid var(--muc)}
.dau h1{margin:0 0 var(--k-1);font-size:var(--co-7);line-height:1.25;letter-spacing:-.015em;font-weight:640}
.dau .phu{color:var(--mo);font-size:var(--co-3)}
.ma-tl{text-align:right;font-family:var(--mono);font-size:var(--co-1);color:var(--muc2);
  line-height:1.9;white-space:nowrap}
.ma-tl b{color:var(--muc)}

/* ── Mục lục ─────────────────────────────────────────────────────────── */
.muc-luc{padding:var(--k-5) var(--le);border-bottom:1px solid var(--vien);background:var(--nen)}
.ml-nhan{font-size:var(--co-1);color:var(--mo);letter-spacing:.09em;text-transform:uppercase;
  font-weight:600;margin-bottom:var(--k-3)}
.muc-luc ol{margin:0;padding:0;list-style:none;
  display:grid;grid-template-columns:repeat(3,1fr);gap:var(--k-2) var(--k-5)}
.muc-luc li{font-size:var(--co-3);color:var(--muc2);display:flex;gap:var(--k-2);align-items:baseline}
.ml-so{font-family:var(--mono);font-size:var(--co-1);color:var(--mo);min-width:14px}
.ml-phu{color:var(--mo);font-size:var(--co-2);margin-left:var(--k-1)}
.ml-cuoi{margin-top:var(--k-3);font-size:var(--co-2);color:var(--mo)}

/* ── Mục ─────────────────────────────────────────────────────────────── */
section{padding:var(--k-7) var(--le);border-bottom:1px solid var(--vien)}
h2{margin:0 0 var(--k-3);font-size:20px;font-weight:650;letter-spacing:-.015em;
  display:flex;align-items:baseline;gap:var(--k-3);line-height:1.3}
h2 .dem{color:var(--mo);font-weight:400;font-size:var(--co-3)}
.so-muc{font-family:var(--mono);font-size:var(--co-3);color:var(--nhan);font-weight:700;
  background:var(--nhan-nhat);border-radius:var(--bo-1);padding:2px 8px;flex:none;
  line-height:1.4;align-self:center}
/* Tầng con trong mục dài: có vạch mảnh phía trên để mắt biết đã sang phần mới,
   không phải cuộn mãi một khối chữ liền. */
h3{margin:var(--k-6) 0 var(--k-3);padding-top:var(--k-3);font-size:17px;font-weight:640;
  display:flex;align-items:baseline;gap:var(--k-2);border-top:1px solid var(--vien2)}
h3:first-of-type{border-top:none;padding-top:0;margin-top:var(--k-5)}
.so-muc-phu{font-family:var(--mono);font-size:var(--co-1);color:var(--mo);font-weight:600;flex:none}
.nhan-phu{margin:var(--k-4) 0 var(--k-1);font-size:var(--co-2);color:var(--mo);
  letter-spacing:.04em;text-transform:uppercase;font-weight:600}
.mota{margin:0 0 var(--k-4);color:var(--muc2);font-size:var(--co-3);max-width:76ch;line-height:1.65}
.mo{color:var(--mo)}
.chinh{border-top:3px solid var(--muc)}


/* ── Kết luận và số dẫn ──────────────────────────────────────────────── */
.ket-luan{display:flex;gap:var(--k-3);align-items:baseline;padding:var(--k-3) var(--k-4);
  border-radius:var(--bo-3);background:#FEF2F2;border:1px solid #FCA5A5;margin:0 0 var(--k-6)}
.ket-luan.dat{background:var(--nen);border-color:var(--vien)}
.ket-luan .nhan-tt{font-weight:650;white-space:nowrap;font-size:var(--co-3)}
.ket-luan p{margin:0;font-size:var(--co-4)}

.hero{display:grid;grid-template-columns:200px 1fr;gap:var(--k-6);align-items:center}
.hero .so-lon{font-size:var(--co-8);line-height:.95;font-weight:650;letter-spacing:-.035em;
  font-variant-numeric:tabular-nums}
.hero .don-vi{font-size:var(--co-6);color:var(--mo);font-weight:400;letter-spacing:0}
.hero .nhan-hero{font-size:var(--co-2);color:var(--mo);margin-top:var(--k-2);line-height:1.4;max-width:22ch}
.hero .delta{margin-top:var(--k-2);font-size:var(--co-3)}

.kpi-hang{display:grid;grid-template-columns:repeat(4,1fr);gap:0;
  border:1px solid var(--vien);border-radius:var(--bo-3);overflow:hidden;margin-top:var(--k-6);
  box-shadow:var(--bong-1)}
.kpi{background:var(--giay);padding:var(--k-3) var(--k-4);border-left:1px solid var(--vien)}
.kpi:first-child{border-left:none}
.kpi .ten{font-size:var(--co-1);color:var(--mo);letter-spacing:.03em}
.kpi .gt{font-size:var(--co-6);font-weight:640;font-variant-numeric:tabular-nums;
  margin-top:var(--k-1);line-height:1.15;letter-spacing:-.02em}
.kpi .ct{font-size:var(--co-2);color:var(--mo);margin-top:var(--k-1);line-height:1.45}
.tang{font-size:var(--co-3);font-variant-numeric:tabular-nums}
.tang-xau{color:var(--cap2);font-weight:600}
/* Số giờ đi kèm tỉ lệ: giờ thô không cho biết nặng nhẹ khi các phòng có
   số giờ đo khác nhau. */
.phu-ty-le{font-size:var(--co-1);color:var(--mo);font-weight:400}
.phu-th{font-weight:400;text-transform:none;letter-spacing:0;color:var(--nhat)}
.tang-tot{color:var(--muc2)}
.ls-tot{color:#15803D;font-weight:600}.ls-xau{color:var(--cap2);font-weight:600}
.dong-nhan td{background:#F3F6FA;font-weight:700}.ket-luan-nho{font-weight:700;margin-top:8px}

/* ── Bảng: bỏ viền dọc, dùng khoảng trắng và một đường ngang mảnh ────── */
table{width:100%;border-collapse:collapse;font-size:var(--co-3)}
/* Tiêu đề cột ĐƯỢC phép xuống dòng. Ép nowrap thì bảng mười cột tự giãn rộng ra
   quá khung và sinh thanh cuộn ngang dù nội dung vẫn vừa. Chỉ cột số mới cần
   giữ nguyên một dòng. */
th{text-align:left;font-size:var(--co-1);color:var(--mo);font-weight:600;letter-spacing:.03em;
  padding:var(--k-2);border-bottom:1px solid var(--muc2);vertical-align:bottom;line-height:1.35}
th.so{white-space:nowrap}
td{padding:var(--k-2);border-bottom:1px solid var(--vien2);vertical-align:top;line-height:1.5}
/* Hàng chẵn tô rất nhạt: bảng mười cột mà không có gì dẫn mắt thì rất dễ lạc dòng. */
tbody tr:nth-child(even){background:#FCFCFD}
tbody tr:hover{background:var(--nhan-nhat)}
tbody tr:last-child td{border-bottom:none}
td.so,th.so{text-align:right;font-variant-numeric:tabular-nums}
.ma{font-family:var(--mono);font-size:var(--co-2)}

/* ── Việc phải xử lý ─────────────────────────────────────────────────── */
.viec{border-left:3px solid var(--cap2);background:#FEF8F8}
.viec td{padding:var(--k-3) var(--k-2)}
.viec .tieu{font-weight:640;font-size:var(--co-3)}
.viec .can-cu{color:var(--muc2);font-size:var(--co-2);margin-top:var(--k-1);line-height:1.55}
.viec .lam{color:var(--muc2);font-size:var(--co-2);margin-top:var(--k-2);padding-left:var(--k-3);
  border-left:2px solid var(--vien);line-height:1.55}
.the{display:inline-block;font-size:11px;padding:1px 6px;border-radius:99px;border:1px solid var(--vien);
  color:var(--muc2);background:var(--giay);vertical-align:middle;font-weight:600;white-space:nowrap}
.the-p1{border-color:var(--cap2);color:var(--cap2)}
.the-gt{font-weight:400;color:var(--mo)}
.the-loai{background:var(--nen)}
.stt-a{font-family:var(--mono);font-size:var(--co-2);color:var(--mo);font-weight:600}

.he-thong{border:1px solid var(--vien);border-left:3px solid var(--muc);border-radius:var(--bo-2);
  padding:var(--k-3) var(--k-4);margin:0 0 var(--k-4);background:var(--nen)}
.ht-nhan{font-size:var(--co-1);color:var(--mo);font-weight:600;letter-spacing:.04em;
  text-transform:uppercase;margin-bottom:var(--k-1)}
.he-thong p{margin:0;font-size:var(--co-3);line-height:1.6}
.ht-viec{color:var(--muc2);font-size:var(--co-2);margin-top:var(--k-2) !important;
  padding-left:var(--k-3);border-left:2px solid var(--vien)}

/* ── Hai phía ra ngoài giới hạn ──────────────────────────────────────────────────── */
.hai-huong{display:grid;grid-template-columns:1fr 1fr;gap:var(--k-3);margin:0 0 var(--k-5)}
.hh-o{border:1px solid var(--vien);border-radius:var(--bo-3);padding:var(--k-3) var(--k-4);border-left-width:3px}
.hh-duoi{border-left-color:var(--c-duoi);background:#FEF7F7}
.hh-tren{border-left-color:var(--c-tren);background:#FAF8FE}
.hh-ten{font-size:var(--co-2);color:var(--mo);font-weight:600}
.hh-gt{font-size:var(--co-6);font-weight:640;font-variant-numeric:tabular-nums;
  margin:var(--k-1) 0;letter-spacing:-.02em}
.hh-phu{font-size:var(--co-2);color:var(--muc2);line-height:1.5}
.svg-nhan-duoi{font-size:11.5px;fill:var(--c-duoi);font-weight:600}
.svg-nhan-tren{font-size:11.5px;fill:var(--c-tren);font-weight:600}
td.o-duoi,b.o-duoi{color:var(--c-duoi);font-weight:600}
td.o-tren,b.o-tren{color:var(--c-tren);font-weight:600}

/* ── Biểu đồ ─────────────────────────────────────────────────────────── */
/* Biểu đồ đặt trong khung riêng, có nền và khoảng thở — để nó là một đối tượng
   nhìn được, không lẫn vào dòng chữ phía trên. */
.bieu-do{width:100%;height:auto;display:block}
.khung-bd{background:var(--nen);border:1px solid var(--vien2);border-radius:var(--bo-3);
  padding:var(--k-3) var(--k-4);margin:var(--k-2) 0}
.spark{display:inline-block;vertical-align:middle}
.svg-truc{font-size:11px;fill:var(--mo)}
.svg-hang{font-size:12px;fill:var(--muc2)}
.svg-hang-nho{font-size:10.5px;fill:var(--muc2);font-family:var(--mono)}
.svg-nhan{font-size:12px;fill:var(--muc);font-weight:600}
.svg-nhan-nguong{font-size:11px;fill:var(--cap2)}
.svg-nhan-gh{font-size:10.5px;fill:var(--nhan)}
.svg-o{font-size:9.5px;fill:#7F1D1D}
.svg-o-dam{fill:#fff}
.chu-thich{font-size:var(--co-2);color:var(--mo);margin:var(--k-2) 0 0;line-height:1.55;max-width:76ch}
.cuon-ngang{overflow-x:auto}
.hop-luu-y{margin:14px 0 0;padding:12px 16px;background:#FFFBEB;border-left:4px solid #B45309;border-radius:0 6px 6px 0;font-size:var(--co-3);line-height:1.6;}
${L.CSS_BAN_DO}

.luoi-sm{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--k-3) var(--k-4);margin-top:var(--k-2)}
.o-sm{margin:0;padding:var(--k-2) var(--k-3);border:1px solid var(--vien);border-radius:var(--bo-2)}
.o-sm figcaption{display:flex;justify-content:space-between;align-items:baseline;
  font-size:var(--co-2);margin-bottom:var(--k-1)}
.sm-ten{color:var(--muc2)}
.sm-so{font-variant-numeric:tabular-nums;font-weight:640}
.sm-xau{color:var(--cap2)}

/* ── Ô phòng theo dõi đặc biệt ───────────────────────────────────────── */
.o-phong{border:1px solid var(--vien);border-radius:var(--bo-3);padding:var(--k-4);
  margin-bottom:var(--k-3);background:var(--giay);box-shadow:var(--bong-1)}
.o-phong.lech{border-color:#FCA5A5;background:#FEFBFB}
.o-phong-dau{display:flex;justify-content:space-between;align-items:flex-start;
  gap:var(--k-4);margin-bottom:var(--k-2)}
.o-phong-ten{font-weight:640;font-size:var(--co-4)}
.o-phong-phu{font-size:var(--co-2);color:var(--mo);margin-top:2px}
.o-phong-so{text-align:right;white-space:nowrap}
.o-phong-so .lon{font-size:var(--co-6);font-weight:640;font-variant-numeric:tabular-nums;
  line-height:1.1;letter-spacing:-.02em}
.o-phong-so .nho{font-size:var(--co-2);color:var(--mo)}
.dong-so{display:flex;gap:var(--k-5);flex-wrap:wrap;font-size:var(--co-2);color:var(--muc2);
  margin-top:var(--k-2);padding-top:var(--k-2);border-top:1px solid var(--vien2)}
.dong-so b{font-variant-numeric:tabular-nums;color:var(--muc)}

/* ── Cây khu → cụm → phòng ───────────────────────────────────────────── */
.khoi-khu{border:1px solid var(--vien);border-radius:var(--bo-3);margin-bottom:var(--k-5);
  overflow:hidden;box-shadow:var(--bong-1)}
.khu-dau{display:flex;justify-content:space-between;align-items:center;gap:var(--k-4);
  padding:var(--k-3) var(--k-4);background:var(--nen);border-bottom:1px solid var(--vien)}
.khu-ten{font-weight:650;font-size:var(--co-5)}
.khu-mo-ta{font-size:var(--co-2);color:var(--mo);margin-top:2px}
.khu-so{text-align:right;font-size:var(--co-3);color:var(--muc2)}
.khu-so b{font-variant-numeric:tabular-nums;color:var(--muc)}
.khu-so-phu{font-size:var(--co-2);color:var(--mo);margin-top:2px}
.khoi-cum{padding:var(--k-3) var(--k-4);border-bottom:1px solid var(--vien2)}
.khoi-cum:last-child{border-bottom:none}
.cum-dau{display:flex;justify-content:space-between;align-items:baseline;
  gap:var(--k-3);margin-bottom:var(--k-2)}
.cum-ten{font-weight:640;font-size:var(--co-3)}
.cum-so{font-size:var(--co-2);color:var(--muc2);font-variant-numeric:tabular-nums}
.bang-phong{width:100%;font-size:var(--co-2)}
.bang-phong td{padding:var(--k-1) var(--k-2);border-bottom:1px solid var(--vien2)}

/* ── Nhận định ───────────────────────────────────────────────────────── */
.phat-hien{border:1px solid var(--vien);border-radius:var(--bo-3);padding:var(--k-4);
  margin-bottom:var(--k-3);background:var(--giay);box-shadow:var(--bong-1)}
.phat-hien h4{margin:0 0 var(--k-3);font-size:var(--co-4);font-weight:640;
  display:flex;align-items:baseline;gap:var(--k-2);line-height:1.4}
.stt{display:inline-flex;width:20px;height:20px;border-radius:99px;background:var(--muc);color:#fff;
  font-size:var(--co-1);align-items:center;justify-content:center;flex:none;font-weight:600}
.phat-hien dl{margin:0;display:grid;grid-template-columns:124px 1fr;gap:var(--k-1) var(--k-4);
  font-size:var(--co-3)}
.phat-hien dt{color:var(--mo);font-size:var(--co-1);letter-spacing:.03em;text-transform:uppercase;
  padding-top:3px;font-weight:600}
.phat-hien dd{margin:0;line-height:1.6}
.canh-bao-nhe{background:#FFFBEB;border:1px solid #FDE68A;padding:var(--k-3);border-radius:var(--bo-2);
  font-size:var(--co-3);margin:var(--k-3) 0 0;line-height:1.6}

/* ── Phụ lục ─────────────────────────────────────────────────────────── */
.pl-dau{background:var(--muc);color:#fff;padding:var(--k-4) var(--le)}
.pl-dau h2{color:#fff;margin:0;font-size:var(--co-5)}
details{border-bottom:1px solid var(--vien)}
details summary{padding:var(--k-4) var(--le);cursor:pointer;font-weight:640;font-size:var(--co-4);
  list-style:none;display:flex;justify-content:space-between;align-items:center;gap:var(--k-4)}
details summary::-webkit-details-marker{display:none}
details summary::after{content:'+';color:var(--mo);font-size:var(--co-6);font-weight:400}
details[open] summary::after{content:'−'}
details .noi-dung{padding:0 var(--le) var(--k-5)}

/* ── Kiểm soát tài liệu ──────────────────────────────────────────────── */
.canh-bao-in{border:1px solid var(--muc2);border-left:3px solid var(--muc);border-radius:var(--bo-2);
  padding:var(--k-3) var(--k-4);margin-bottom:var(--k-4);background:var(--nen);
  font-size:var(--co-3);line-height:1.6}
.bang-ksts th{width:190px;text-align:left;vertical-align:top;color:var(--muc2);font-weight:640;
  font-size:var(--co-3);text-transform:none;letter-spacing:0;border-bottom:1px solid var(--vien2);
  padding:var(--k-3) var(--k-2) var(--k-3) 0}
.bang-ksts td{font-size:var(--co-3);padding:var(--k-3) 0 var(--k-3) var(--k-2)}
.bang-ksts .mo{font-size:var(--co-2);margin-top:3px;line-height:1.55}

/* ── Ký duyệt và chân trang ──────────────────────────────────────────── */
.ky{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--k-5);margin-top:var(--k-2)}
.o-ky{border:1px solid var(--vien);border-radius:var(--bo-2);padding:var(--k-3) var(--k-4);
  min-height:112px;display:flex;flex-direction:column}
.o-ky .vt{font-size:var(--co-1);color:var(--mo);letter-spacing:.04em;text-transform:uppercase;font-weight:600}
.o-ky .ten{font-weight:640;margin-top:var(--k-1);font-size:var(--co-4)}
.o-ky .y{font-size:var(--co-2);color:var(--mo);margin-top:auto}
/* Dòng dẫn sang mục sau */
.dan-tiep{display:flex;align-items:center;gap:var(--k-3);margin-top:var(--k-6);
  padding:var(--k-3) var(--k-4);border:1px solid var(--vien);border-radius:var(--bo-3);
  background:var(--nen);text-decoration:none;color:var(--muc2);transition:border-color .12s ease}
.dan-tiep:hover{border-color:var(--nhan);background:var(--nhan-nhat)}
.dan-nhan{font-size:var(--co-1);color:var(--mo);text-transform:uppercase;letter-spacing:.05em;
  font-weight:600;white-space:nowrap}
.dan-cau{font-size:var(--co-3);flex:1}
.dan-mui{color:var(--nhan);font-size:var(--co-5)}
@media print{.dan-tiep{display:none}}

.ve-muc-luc{display:block;margin-top:var(--k-5);font-size:var(--co-2);color:var(--mo);
  text-decoration:none}
.ve-muc-luc:hover{color:var(--nhan)}
@media print{.ve-muc-luc{display:none}}
.chan{padding:var(--k-4) var(--le) var(--k-6);font-size:var(--co-1);color:var(--mo);
  font-family:var(--mono);line-height:1.8}


/* ── Tiếp cận và phản hồi tương tác ───────────────────────────────────────
   Bản báo cáo cũng là một giao diện: người đọc dùng bàn phím, rê chuột, nhảy
   mục. Thiếu những thứ dưới đây thì tài liệu vẫn đúng nhưng khó dùng.        */
:focus-visible{outline:2px solid var(--nhan);outline-offset:2px;border-radius:var(--bo-1)}
:focus:not(:focus-visible){outline:none}
::selection{background:var(--nhan-nhat)}

/* Bỏ qua phần đầu, nhảy thẳng vào nội dung — người dùng bàn phím cần nó đầu tiên */
.bo-qua{position:absolute;left:-9999px;top:0;background:var(--muc);color:#fff;
  padding:var(--k-2) var(--k-4);border-radius:0 0 6px 0;z-index:99;font-size:var(--co-3)}
.bo-qua:focus{left:0}

/* Mục lục bấm được: nhảy tới mục, chừa chỗ cho đầu trang dính */
.muc-luc a{color:inherit;text-decoration:none;display:flex;gap:var(--k-2);align-items:baseline;
  padding:2px 4px;margin:-2px -4px;border-radius:var(--bo-1)}
.muc-luc a:hover{background:var(--nhan-nhat);color:var(--nhan)}
section[id]{scroll-margin-top:var(--k-5)}

/* Hàng bảng và khối sáng lên khi rê chuột — người đọc dò theo hàng ngang
   trên bảng rộng rất dễ lạc dòng */
tbody tr{transition:background .12s ease}
tbody tr:hover{background:var(--nen)}
.o-phong,.khoi-cum,.hh-o,.phat-hien,.o-sm{transition:border-color .12s ease}
.o-phong:hover,.o-sm:hover{border-color:var(--nhat)}
details summary:hover{background:var(--nen)}

/* Ai đặt hệ thống ở chế độ giảm chuyển động thì tắt mọi hiệu ứng */
@media (prefers-reduced-motion: reduce){
  *{transition:none !important;animation:none !important;scroll-behavior:auto !important}
}

/* ── Bản in A4 ───────────────────────────────────────────────────────── */
@page{size:A4;margin:14mm 12mm 16mm}
@media print{
  /* Giấy đọc gần hơn màn hình, và mỗi bậc cỡ chữ tăng thêm là thêm mấy trang
     giấy mỗi kỳ. Trả về thang nhỏ hơn một bậc so với bản xem trên màn hình. */
  :root{
    --co-1:10.5px; --co-2:11.5px; --co-3:12px; --co-4:13px;
    --co-5:15px; --co-6:18px; --co-7:23px; --co-8:48px;
  }
  body{background:#fff;font-size:12px}
  h2{font-size:16px}
  h3{font-size:14px}
  .trang,.o-phong,.khoi-khu,.phat-hien,.kpi-hang{box-shadow:none !important}
  .khung-bd{background:none;border:none;padding:0}
  tbody tr:nth-child(even){background:none}
  .trang{max-width:none}
  section{padding:var(--k-5) 0;page-break-inside:avoid}
  .dau,.muc-luc,.pl-dau,details summary,details .noi-dung,.chan{padding-left:0;padding-right:0}
  .chinh{page-break-before:always}          /* mỗi mục lớn bắt đầu trang mới */
  /* mục lục đi liền tóm tắt điều hành trên trang đầu — người quản lý mở ra
     là thấy ngay tài liệu có gì và kết luận ra sao, không phải lật trang */
  .phat-hien,.o-sm,.o-phong,.khoi-khu,.khoi-cum,tr,.viec,.hh-o{page-break-inside:avoid}
  h2,h3{page-break-after:avoid}
  details{page-break-inside:auto}
  details summary::after{content:''}
  details .noi-dung{display:block}
  .cuon-ngang{overflow:visible}
  a{text-decoration:none;color:inherit}
  .bo-qua{display:none}
  .muc-luc a:hover{background:none}
}
`;

/* ── So với bốn kỳ trước (cuối mục 1) ──────────────────────────────────── */
function khoiLichSuBanIn(d, khuBC) {
  const ds = L.chuanHoaLichSu(d);
  if (!ds) return '';
  const dsKhu = (khuBC ? [khuBC] : ['C1', 'C4', 'Q2']).filter(function (k) {
    return ds.some(function (x) { return x.khu && x.khu[k] != null; });
  });
  const coTong = !khuBC;
  if (!coTong && !dsKhu.length) return '';
  const xh = L.xuHuongLichSu(khuBC
    ? ds.map(function (x) { return Object.assign({}, x, { ty_le: x.khu && x.khu[khuBC] != null ? Number(x.khu[khuBC]) : null }); })
    : ds);
  const o = function (v, truoc, dam) {
    const lop = v == null ? 'mo' : (v >= NGUONG_HANH_DONG ? 'ls-tot' : 'ls-xau');
    const mt = (v != null && truoc != null && v !== truoc)
      ? ' <span class="' + (v > truoc ? 'ls-tot' : 'ls-xau') + '">' + (v > truoc ? '▲' : '▼') + '</span>' : '';
    return '<td class="so' + (dam ? ' dam' : '') + '"><span class="' + lop + '">' + (v == null ? '—' : phanTram(v)) + '</span>' + mt + '</td>';
  };
  return '<h3>So với bốn kỳ trước</h3>'
    + '<p class="mota">Tỉ lệ thời gian trong ngưỡng của năm kỳ gần nhất, tính cùng một cách với con số dẫn đầu '
    + 'báo cáo; mức phải đạt ' + NGUONG_HANH_DONG + '%. Mũi tên so với kỳ liền trước. Kỳ ghi "—" là kỳ chưa có số liệu.</p>'
    + '<div class="cuon-ngang"><table><thead><tr><th>Kỳ</th>' + (coTong ? '<th class="so">Toàn nhà máy</th>' : '')
    + dsKhu.map(function (k) { return '<th class="so">Khu ' + k + '</th>'; }).join('')
    + '</tr></thead><tbody>'
    + ds.map(function (x, i) {
        const tr = i > 0 ? ds[i - 1] : null;
        return '<tr' + (x.la_ky_nay ? ' class="dong-nhan"' : '') + '><td>' + esc(x.nhan)
          + (x.la_ky_nay ? ' <span class="mo">(kỳ này)</span>' : '') + '</td>'
          + (coTong ? o(x.ty_le, tr ? tr.ty_le : null, true) : '')
          + dsKhu.map(function (k) {
              return o(x.khu[k] == null ? null : Number(x.khu[k]), tr && tr.khu[k] != null ? Number(tr.khu[k]) : null, !coTong);
            }).join('')
          + '</tr>';
      }).join('')
    + '</tbody></table></div>'
    + (xh ? '<p class="ket-luan-nho ' + (xh.huong === 'tot' ? 'ls-tot' : (xh.huong === 'xau' ? 'ls-xau' : 'mo')) + '">' + esc(xh.chu) + '</p>' : '');
}

/* ===== KHỐI NHẬN ĐỊNH — nhận JSON có cấu trúc ========================== */

const TRUONG_BAT_BUOC = ['quan_sat', 'lien_he', 'gia_thuyet', 'can_xac_minh', 'ai_lam'];

function locPhatHien(ds) {
  const dat = [], loai = [];
  (ds || []).forEach((f) => {
    const thieu = TRUONG_BAT_BUOC.filter((k) => !f[k] || !String(f[k]).trim());
    if (thieu.length) loai.push({ f: f, thieu: thieu }); else dat.push(f);
  });
  return { dat: dat, loai: loai };
}

function renderNhanDinh(khoi) {
  const kq = locPhatHien(khoi && khoi.phat_hien);
  if (!kq.dat.length) {
    return '<p class="canh-bao-nhe">Không có phát hiện nào đủ năm phần bắt buộc nên phần nhận định để trống. '
         + 'Số liệu trong báo cáo không phụ thuộc phần này.</p>';
  }
  const dong = kq.dat.map((f, i) => ''
    + '<article class="phat-hien">'
    + '<h4><span class="stt">' + (i + 1) + '</span> '
    +   esc(L.vietLai(f.tieu_de || f.doi_tuong || 'Phát hiện')) + '</h4>'
    + '<dl>'
    + '<dt>Quan sát được</dt><dd>' + esc(L.vietLai(f.quan_sat)) + '</dd>'
    + '<dt>Liên hệ</dt><dd>' + esc(L.vietLai(f.lien_he)) + '</dd>'
    + '<dt>AI đề xuất <span class="the the-gt">giả thuyết · chưa xác nhận</span></dt><dd>'
    +   esc(L.vietLai(f.gia_thuyet)) + '</dd>'
    + '<dt>Cần xác minh</dt><dd>' + esc(L.vietLai(f.can_xac_minh)) + '</dd>'
    + '<dt>Ai làm</dt><dd>' + esc(L.vietLai(f.ai_lam)) + (f.han ? ' · hạn ' + esc(f.han) : '') + '</dd>'
    + '</dl></article>').join('');
  const ghi = kq.loai.length
    ? '<p class="canh-bao-nhe">Đã loại ' + kq.loai.length + ' phát hiện vì thiếu phần bắt buộc: '
      + esc(kq.loai.map((x) => x.thieu.join(', ')).join(' | ')) + '.</p>' : '';
  return dong + ghi;
}

/* ===== MỘT MỤC CHỈ TIÊU (chênh áp / nhiệt độ / độ ẩm) ================== */

function mucChiTieu(ct, laMucLon, soMuc, cauDan) {
  const capChiTieu = L.gomChiTieuTheoCap(ct);
  const hh = ct.hai_huong || {};
  // Có ≥ 2 khu (hoặc ≥ 2 cụm) là so được; ít phòng thì vẫn so nhưng ghi rõ mang tính tham khảo
  // (góp ý 04/09/2026: nhiệt độ, độ ẩm chỉ 12 phòng nhưng vẫn phải có mục này).
  const coNhieuKhu = capChiTieu.khu.length >= 2;
  const coNhieuCum = capChiTieu.cum.length >= 2;
  const soSanhDuocTheoCap = coNhieuKhu || coNhieuCum;
  const nhomNho = ct.so_phong_do < L.DU_PHONG_DE_SO_SANH;
  const khuDong = capChiTieu.khu.slice().sort(function (a, b) { return b.so_phong - a.so_phong; });
  if (!ct.so_phong_do) {
    return '<section><h2><span class="so-muc">' + soMuc + '</span>' + esc(ct.ten)
      + '</h2><p class="mo">Kỳ này không có phòng nào đo '
      + esc(String(ct.ten).toLowerCase()) + '.</p></section>';
  }

  // Mỗi phòng một biểu đồ dải giới hạn
  function oMotPhong(p, ctx) {
    const lech = p.ty_le_trong_nguong != null && p.ty_le_trong_nguong < NGUONG_HANH_DONG;
    return '<div class="o-phong' + (lech ? ' lech' : '') + '">'
      + '<div class="o-phong-dau"><div>'
      +   '<div class="o-phong-ten">' + esc(L.tenPhongGon(p.ma_phong, p.ten_phong)) + '</div>'
      +   '<div class="o-phong-phu">Khu ' + esc(p.khu) + ' · cụm ' + esc(p.ahu)
      +     ' · giới hạn cho phép ' + soVN(p.ghd, 1) + ' – ' + soVN(p.ght, 1) + ' ' + esc(p.don_vi) + '</div>'
      + '</div><div class="o-phong-so">'
      +   '<div class="lon">' + soVN(p.ty_le_trong_nguong, 1) + '%</div>'
      +   '<div class="nho">thời gian trong ngưỡng</div></div></div>'
      + L.svgDaiGioiHan(p)
      + '<div class="dong-so">'
      // In cả hai hướng: trước chỉ in hướng nguy hiểm nên C1.R20 hiện 143,8 giờ trong khi
      // vượt trên còn 440,2 giờ nữa (rà soát 04/09/2026)
      +   (ctx.hai_huong && ctx.hai_huong.nguoc
            ? '<span>Ngoài giới hạn: <b>' + L.gioTyLe(p.gio_lech_tong, p.gio_do) + '</b>'
              + ' — tụt dưới <b class="o-duoi">' + gioDoc(p.gio_duoi) + '</b> · vượt trên <b class="o-tren">'
              + gioDoc(p.gio_tren) + '</b></span>'
            : '<span>Giờ ngoài dải: <b>' + L.gioTyLe(p.gio_lech, p.gio_do) + '</b></span>')
      +   '<span>Số đợt ngoài giới hạn: <b>' + (p.so_dot == null ? '—' : p.so_dot) + '</b></span>'
      +   '<span>Đợt dài nhất: <b>' + (p.dot_dai_nhat == null ? '—' : gioDoc(p.dot_dai_nhat)) + '</b></span>'
      +   '<span>Giờ vượt giới hạn hành động: <b>' + L.gioTyLe(p.gio_nghiem_trong, p.gio_co_du_lieu || p.gio_do) + '</b></span>'
      +   (p.con_lech_cuoi_ky ? '<span class="tang-xau">Còn đang ở ngoài giới hạn khi hết kỳ</span>' : '')
      + '</div></div>';
  }
  const oPhong = ct.dac_biet.map((p) => oMotPhong(p, ct)).join('');

  const nghiLoi = ct.dac_biet.concat(ct.them_ve || [])
    .some((p) => (p.chuoi || []).some((c) => c.nghi_loi_do));
  const oPhongThem = (ct.them_ve || []).map((p) => oMotPhong(p, ct)).join('');

  // Xếp hạng phòng ra ngoài giới hạn nhiều nhất
  // Xếp theo TỔNG cả hai hướng, không chỉ hướng nguy hiểm — nếu không, phòng
  // vượt trên rất nặng nhưng không tụt dưới sẽ không bao giờ xuất hiện.
  const bangXep = ct.xep_hang.slice()
    .sort((a, b) => (b.gio_lech_tong || 0) - (a.gio_lech_tong || 0))
    .slice(0, laMucLon ? 12 : 8);
  const hangXep = bangXep.map((r) => ''
    + '<tr><td><span class="ma">' + esc(r.ma_phong) + '</span><br><span class="mo">' + esc(r.ten_phong) + '</span></td>'
    + '<td>' + esc(r.khu_vuc) + ' · ' + esc(r.ahu) + '</td>'
    + '<td>' + esc(dich(L.TEN_UU_TIEN_NGAN, r.muc_uu_tien)) + '</td>'
    // Chuỗi gioi_han của truy vấn dùng dấu chấm kiểu Anh; viết lại từ ghd/ght (rà soát 04/09/2026)
    + '<td class="so">' + (r.ghd != null && r.ght != null
        ? soVN(r.ghd, 1) + ' – ' + soVN(r.ght, 1) : L.vietLai(r.gioi_han)) + '</td>'
    + '<td class="so' + (r.ty_le_trong_nguong < NGUONG_HANH_DONG ? ' tang-xau' : '') + '">'
    +   soVN(r.ty_le_trong_nguong, 1) + '</td>'
    + (hh.nguoc
        ? '<td class="so o-duoi">' + soVN(r.gio_duoi, 1)
          + (r.gio_do ? '<br><span class="phu-ty-le">' + phanTram(100 * r.gio_duoi / r.gio_do) + '</span>' : '')
          + '</td><td class="so o-tren">' + soVN(r.gio_tren, 1)
          + (r.gio_do ? '<br><span class="phu-ty-le">' + phanTram(100 * r.gio_tren / r.gio_do) + '</span>' : '')
          + '</td>'
        : '<td class="so">' + soVN(r.gio_lech, 1)
          + (r.gio_do ? '<br><span class="phu-ty-le">' + phanTram(100 * r.gio_lech / r.gio_do) + '</span>' : '')
          + '</td>')
    + '<td class="so">' + (r.so_dot == null ? '—' : r.so_dot) + '</td>'
    + '<td class="so">' + (r.dot_dai_nhat == null ? '—' : r.dot_dai_nhat) + '</td>'
    + '<td>' + (r.con_lech_cuoi_ky ? '<span class="tang-xau">còn ngoài giới hạn</span>' : 'đã trở lại') + '</td></tr>').join('');

  // Đợt ngoài giới hạn kéo dài
  const dotDai = ct.su_kien.slice(0, laMucLon ? 10 : 6);
  const hangDot = dotDai.map((s) => ''
    + '<tr><td><span class="ma">' + esc(s.ma_phong) + '</span><br><span class="mo">' + esc(s.ten_phong) + '</span></td>'
    + '<td>' + esc(s.khu_vuc) + ' · ' + esc(s.ahu) + '</td>'
    + '<td>' + esc(dich(L.TEN_HUONG, s.huong)) + '</td>'
    + '<td class="so">' + gioDoc(s.so_gio) + '</td>'
    + '<td>' + ngayDai(s.bat_dau) + ' ' + gioPhut(s.bat_dau) + '<br><span class="mo">→ '
    +   ngayDai(s.ket_thuc) + ' ' + gioPhut(s.ket_thuc) + '</span></td>'
    + '<td class="so">' + soVN(s.huong === 'CAO' ? s.gia_tri_max : s.gia_tri_min, 1) + ' ' + esc(s.don_vi) + '</td>'
    + '<td>' + esc(dich(L.TEN_KET_THUC, s.ket_thuc_do)) + '</td></tr>').join('');

  return '<section' + (laMucLon ? ' class="chinh"' : '') + ' id="muc-' + soMuc + '">'
    + '<h2><span class="so-muc">' + soMuc + '</span>' + esc(ct.ten_day_du)
    + ' <span class="dem">— ' + ct.so_phong_do + ' phòng có đo'
    + (laMucLon ? ', chỉ tiêu trọng tâm của kỳ' : '') + '</span></h2>'
    + '<p class="mota">' + esc(ct.y_nghia) + ' Hướng nguy hiểm của chỉ tiêu này là <b>'
    + esc(ct.huong_nguy_hiem) + '</b>.' + (hh.nguoc ? ' Cả hai hướng đều được tính: bảng xếp hạng xếp theo TỔNG số giờ ngoài giới hạn của hai hướng và tách rõ từng hướng thành hai cột, để phòng ra ngoài giới hạn nhiều ở hướng nhẹ hơn vẫn hiện ra.' : ' Truy vấn đã gộp cả hai phía cho chỉ tiêu này nên chỉ có một con số giờ ngoài giới hạn.') + '</p>'

    /* Tầng 1 — toàn nhà máy */
    + '<h3><span class="so-muc-phu">' + soMuc + '.1</span>' + tenTongThe() + '</h3>'
    + '<p class="mota">Số giờ ở đây là <b>giờ cộng dồn của ' + ct.so_phong_do + ' phòng đo</b> (mỗi phòng một '
    + 'đồng hồ riêng), nên lớn hơn số giờ của kỳ; không quy đổi ra ngày. Phần trăm đi kèm là tỉ lệ trên tổng '
    + 'thời gian THỰC SỰ CÓ SỐ ĐO của chỉ tiêu này (' + soVN(ct.tong_gio_do, 0) + ' giờ cộng dồn), không phải '
    + 'trên thời gian kỳ vọng — lấy thời gian kỳ vọng thì kỳ nào mất dữ liệu sẽ bị làm nhẹ đi một cách giả tạo.</p>'
    + '<p class="mota">' + ct.so_phong_dat_trong_bang + '/' + ct.so_phong_do + ' phòng đạt ngưỡng hành động '
    + NGUONG_HANH_DONG + '% thời gian trong ngưỡng. Con số này tính <b>riêng</b> cho ' + esc(String(ct.ten).toLowerCase())
    + ', nên khác con số ở mục 1 và mục 6 — hai chỗ đó gộp cả ba chỉ tiêu của phòng lại.</p>'
    + (hh.nguoc
        ? '<div class="hai-huong">'
          + '<div class="hh-o hh-duoi"><div class="hh-ten">' + esc(hh.chinh.ngan === 'tụt dưới'
              ? hh.chinh.ten : hh.nguoc.ten) + '</div>'
          +   '<div class="hh-gt">' + L.gioTyLe(ct.tong_gio_duoi, ct.tong_gio_do) + '</div>'
          +   '<div class="hh-phu">' + ct.so_phong_lech_duoi + '/' + ct.so_phong_do + ' phòng · '
          +   esc(hh.chinh.ngan === 'tụt dưới' ? hh.chinh.he_qua : hh.nguoc.he_qua) + '</div></div>'
          + '<div class="hh-o hh-tren"><div class="hh-ten">' + esc(hh.chinh.ngan === 'vượt trên'
              ? hh.chinh.ten : hh.nguoc.ten) + '</div>'
          +   '<div class="hh-gt">' + L.gioTyLe(ct.tong_gio_tren, ct.tong_gio_do) + '</div>'
          +   '<div class="hh-phu">' + ct.so_phong_lech_tren + '/' + ct.so_phong_do + ' phòng · '
          +   esc(hh.chinh.ngan === 'vượt trên' ? hh.chinh.he_qua : hh.nguoc.he_qua) + '</div></div>'
          + '</div>'
        : '<p class="mota">Tổng thời gian ra ngoài dải cho phép trong cả kỳ: '
          + L.gioTyLe(ct.tong_gio_lech, ct.tong_gio_do)
          + ' thời gian có số đo, cộng dồn trên ' + ct.so_phong_do + ' phòng. Truy vấn gộp chung cả hai phía cho chỉ tiêu này.</p>')

    /* Hai tầng so sánh giữa các nhóm — chỉ có nghĩa khi đủ nhiều phòng */
    + (soSanhDuocTheoCap ? (''
    /* Tầng 2 — so sánh các khu (bỏ qua khi bản báo cáo chỉ có một khu) */
      + (coNhieuKhu
        ? '<h3><span class="so-muc-phu">' + soMuc + '.2</span>' + (khuDong.length === 3 ? 'Ba khu' : khuDong.length + ' khu') + ' so với nhau</h3>'
          + '<p class="mota">So bằng <b>tỉ lệ</b> thời gian ngoài giới hạn của từng nhóm, không bằng số giờ cộng dồn: '
          + 'khu ' + esc(khuDong[0].khu) + ' có ' + khuDong[0].so_phong + ' phòng còn khu ' + esc(khuDong[khuDong.length - 1].khu)
          + ' chỉ có ' + khuDong[khuDong.length - 1].so_phong + ' phòng, so số giờ thì nhóm đông phòng luôn thua dù chất '
          + 'lượng có khi còn tốt hơn. Mẫu số là thời gian có số đo của chính nhóm đó; số giờ cộng dồn xem '
          + 'khi rê chuột. Bên phải là số phòng đạt trên tổng số phòng của nhóm.'
          + (nhomNho ? ' Chỉ tiêu này chỉ có ' + ct.so_phong_do + ' phòng đo, mỗi khu vài phòng — so sánh mang tính tham khảo.' : '')
          + '</p>'
        : '<h3><span class="so-muc-phu">' + soMuc + '.2</span>So sánh giữa các khu</h3>'
          + '<p class="mota">Bản này chỉ gồm một khu nên không có gì để so giữa các khu; xem các cụm xử lý không khí trong khu so với nhau ở mục dưới.</p>')
    // Chỉ tiêu có hai hướng thì vẽ THẲNG biểu đồ hai chiều. Trước đây vẽ thêm một
    // biểu đồ một chiều ở trên, nhưng nó chỉ cộng hướng nguy hiểm mà nhãn lại ghi
    // "tổng số giờ ngoài giới hạn" — khu C1 hiện 8878 giờ trong khi tổng thật là 14430 giờ.
    + (!coNhieuKhu ? '' : hh.nguoc
        ? L.svgThanhHaiChieu(capChiTieu.khu.map((x) => Object.assign({ nhan: 'Khu ' + x.khu }, x)),
            'nhan', 'tong_gio_duoi', 'tong_gio_tren')
        : L.svgSoSanhCap(capChiTieu.khu.map((x) => Object.assign({ nhan: 'Khu ' + x.khu }, x)), 'nhan'))

      /* Tầng 3 — so sánh các cụm xử lý không khí */
      + (coNhieuCum
        ? '<h3><span class="so-muc-phu">' + soMuc + '.3</span>Các cụm xử lý không khí so với nhau</h3>'
          + '<p class="mota">Nhiều phòng cùng một cụm cùng ra ngoài giới hạn là dấu hiệu nên nghi cụm trước khi đi '
          + 'sửa từng phòng — dấu hiệu, chưa phải kết luận: các phòng cùng cụm còn có thể giống nhau ở '
          + 'chỗ khác, như cùng khu sản xuất hay cùng ca vận hành.'
          + (nhomNho ? ' Mỗi cụm chỉ vài phòng đo chỉ tiêu này — so sánh mang tính tham khảo.' : '') + '</p>'
          + (hh.nguoc
              ? L.svgThanhHaiChieu(capChiTieu.cum.slice(0, laMucLon ? 10 : 6), 'nhan', 'tong_gio_duoi', 'tong_gio_tren')
              : L.svgSoSanhCap(capChiTieu.cum.slice(0, laMucLon ? 10 : 6), 'nhan'))
        : '')

      ) : '<p class="mota">Các phòng đo chỉ tiêu này đều thuộc một khu và một cụm xử lý không khí nên không có gì '
        + 'để so giữa các nhóm. Xem thẳng từng phòng bên dưới.</p>')

    /* Tầng 4 — từng phòng */
    + (ct.dac_biet.length
        ? '<h3><span class="so-muc-phu">' + soMuc + '.4</span>Từng phòng theo dõi đặc biệt <span class="mo">— ' + ct.dac_biet.length
          + ' phòng, xếp từ kém nhất</span></h3>'
          + '<p class="mota">Vùng xanh nhạt là dải cho phép của chính phòng đó. Đường đậm là trung bình mỗi ngày, '
          + 'thanh dọc mờ là khoảng từ thấp nhất tới cao nhất trong ngày. Chấm đỏ là ngày có trung bình nằm ngoài dải.'
          + (nghiLoi ? ' Vòng tròn rỗng nét đứt là số đo thấp bất thường, nghi do lỗi phép đo — giữ lại để đối chiếu, '
                     + 'không tính vào khoảng dao động.' : '') + '</p>'
          + oPhong
        : '<p class="mo">Không có phòng theo dõi đặc biệt nào đo chỉ tiêu này.</p>')

    + (oPhongThem
        ? '<h4>Các phòng ra ngoài giới hạn nhiều nhất còn lại <span class="mo">— ' + ct.them_ve.length
          + ' phòng, không thuộc nhóm theo dõi đặc biệt nhưng ra ngoài giới hạn nhiều hơn</span></h4>'
          + oPhongThem
        : '')

    + '<h3><span class="so-muc-phu">' + soMuc + '.5</span>Xếp hạng phòng ra ngoài giới hạn nhiều nhất</h3>'
    + L.svgThanhXepHang(bangXep, hh.nguoc ? 'gio_lech_tong' : 'gio_lech', 'giờ', true)
    + '<p class="chu-thich">Độ dài thanh là tổng số giờ ngoài giới hạn của cả hai hướng. '
    + 'Thanh xám là phòng vẫn đạt ngưỡng hành động. Hai cột số trong bảng bên dưới tách riêng từng hướng.</p>'
    + '<div class="cuon-ngang"><table style="margin-top:12px"><thead><tr><th>Phòng</th><th>Khu · cụm</th>'
    + '<th>Ưu tiên</th><th class="so">Giới hạn (' + esc(ct.don_vi) + ')</th>'
    + '<th class="so">Thời gian trong ngưỡng %</th>'
    + (hh.nguoc
        ? '<th class="so">Giờ tụt dưới<br><span class="phu-th">và % thời gian đo</span></th>'
          + '<th class="so">Giờ vượt trên<br><span class="phu-th">và % thời gian đo</span></th>'
        : '<th class="so">Giờ ra ngoài dải<br><span class="phu-th">và % thời gian đo</span></th>')
    + '<th class="so">Số đợt ngoài giới hạn</th>'
    + '<th class="so">Đợt dài nhất (giờ)</th><th>Trạng thái cuối kỳ</th></tr></thead><tbody>'
    + hangXep + '</tbody></table></div>'

    + (hangDot
        ? '<h3><span class="so-muc-phu">' + soMuc + '.6</span>Các đợt ngoài giới hạn kéo dài <span class="mo">— từ ' + L.DOT_LECH_DANG_KE + ' giờ trở lên</span></h3>'
          + '<div class="cuon-ngang"><table><thead><tr><th>Phòng</th><th>Khu · cụm</th><th>Ra ngoài phía nào</th>'
          + '<th class="so">Thời gian kéo dài</th><th>Từ → đến</th><th class="so">Giá trị xa dải nhất</th><th>Đợt ngoài giới hạn kết thúc thế nào</th>'
          + '</tr></thead><tbody>' + hangDot + '</tbody></table></div>'
        : '')
    + (cauDan || '')
    + '</section>';
}

/* ===== MỤC PHÂN CẤP: nhà máy → khu → cụm → phòng ======================= */

function mucPhanCap(cay, dayDu, soMuc, cauDan) {
  const khoi = cay.map((k) => {
    const cum = k.cum.map((c) => {
      const phong = (dayDu ? c.phong : c.phong.slice(0, 5)).map((p) => ''
        + '<tr><td><span class="ma">' + esc(p.ma_phong) + '</span></td>'
        + '<td>' + esc(p.ten_phong) + (p.muc_uu_tien === 'P1' ? ' <span class="the the-p1">Mức 1</span>' : '') + '</td>'
        + '<td class="so' + (p.ty_le_tuan_thu < NGUONG_HANH_DONG ? ' tang-xau' : '') + '">'
        +   soVN(p.ty_le_tuan_thu, 1) + '%</td>'
        + '<td class="so">' + gioDoc(p.so_gio_critical) + '</td></tr>').join('');
      const con = !dayDu && c.phong.length > 5
        ? '<tr><td colspan="4" class="mo">… và ' + (c.phong.length - 5) + ' phòng nữa, xem phụ lục.</td></tr>' : '';
      return '<div class="khoi-cum">'
        + '<div class="cum-dau"><span class="cum-ten">Cụm ' + esc(c.ahu)
        + ' <span class="mo" style="font-weight:400">cấp khí cho ' + c.so_phong + ' phòng</span> '
        + L.svgSpark(c.chuoi, 92, 20) + '</span>'
        + '<span class="cum-so">giữ trong ngưỡng ' + phanTram(c.ty_le_tb) + ' thời gian · '
        + c.so_phong_dat + '/' + c.so_phong + ' phòng đạt · '
        + L.gioTyLe(c.gio_nghiem_trong, c.gio_do) + ' số giờ vượt giới hạn hành động'
        + (c.so_phong_dac_biet ? ' · trong đó ' + c.so_phong_dac_biet
            + ' phòng thuộc nhóm theo dõi đặc biệt' : '') + '</span></div>'
        // Có tiêu đề cột: "912 giờ" đứng trơ không ai biết là giờ gì (rà soát 04/09/2026)
        + '<table class="bang-phong"><thead><tr><th colspan="2">Phòng</th>'
        + '<th class="so">Thời gian trong ngưỡng</th>'
        + '<th class="so">Giờ cảm biến vượt giới hạn hành động</th></tr></thead>'
        + '<tbody>' + phong + con + '</tbody></table></div>';
    }).join('');

    return '<div class="khoi-khu">'
      + '<div class="khu-dau"><div>'
      +   '<span class="khu-ten">Khu ' + esc(k.khu) + '</span>'
      +   '<div class="khu-mo-ta">' + k.so_phong + ' phòng, do ' + k.so_cum
      +     ' cụm xử lý không khí cấp khí</div></div>'
      + '<div class="khu-so">'
      +   '<div>Giữ được số đo trong ngưỡng <b>' + phanTram(k.ty_le_tb) + '</b> thời gian</div>'
      +   '<div class="khu-so-phu"><b>' + k.so_phong_dat + '/' + k.so_phong + '</b> phòng đạt ngưỡng '
      +     NGUONG_HANH_DONG + '% · <b>' + L.gioTyLe(k.gio_nghiem_trong, k.gio_do)
      +     '</b> ngoài giới hạn</div></div></div>'
      + cum + '</div>';
  }).join('');

  return '<section id="muc-' + soMuc + '"><h2><span class="so-muc">' + soMuc
    + '</span>' + tenMucCay() + '</h2>'
    + '<p class="mota">Xếp từ kém nhất lên. Mỗi khu hiện các cụm xử lý không khí thuộc khu đó, '
    + 'mỗi cụm hiện các phòng do cụm đó cấp khí — để thấy ngay vấn đề nằm ở một phòng riêng lẻ '
    + 'hay ở cả cụm.</p>'
    + '<h3>So sánh các khu</h3>'
    + '<div class="khung-bd">' + L.svgSmallMultiples(cay.map((k) => ({ ten: 'Khu ' + k.khu, ty_le: k.ty_le_tb, chuoi: k.chuoi })), 'ten', 'ty_le') + '</div>'
    + '<h3>Chi tiết từng khu</h3>'
    + khoi + (cauDan || '') + '</section>';
}

/* Thứ tự mục cố định — dùng cho cả mục lục lẫn số hiệu in cạnh tiêu đề, để
 * không bao giờ ngoài giới hạn nhau. Khi thêm mục mới thì sửa ở đây trước. */
const VE_ML = '<a class="ve-muc-luc" href="#muc-luc">↑ Về mục lục</a>';

/* Dòng dẫn cuối mỗi mục lớn. Báo cáo tháng dài gần bốn mươi trang; hết một mục
 * mà không có gì nối sang mục sau thì người đọc dễ dừng lại giữa chừng. Câu này
 * nói mục tiếp theo trả lời câu hỏi gì, để họ biết có đáng đọc tiếp không. */
function dan(soMuc, cau) {
  return '<a class="dan-tiep" href="#muc-' + soMuc + '">'
    + '<span class="dan-nhan">Tiếp theo · mục ' + soMuc + '</span>'
    + '<span class="dan-cau">' + cau + '</span><span class="dan-mui">→</span></a>';
}

// Tên ở đây phải TRÙNG tiêu đề thật của mục. Mục lục ghi một đằng, tiêu đề một
// nẻo thì người đọc bấm vào rồi phân vân không biết có đúng chỗ mình cần không.
const MUC_LUC = [
  { ten: 'Tóm tắt điều hành',              phu: 'kết luận và bốn chỉ số chính' },
  { ten: 'Việc phải xử lý trong kỳ này',   phu: 'do luật cố định chọn' },
  { ten: 'Chênh áp giữa các phòng',        phu: 'chỉ tiêu trọng tâm · xét cả hai phía' },
  { ten: 'Nhiệt độ trong phòng' },
  { ten: 'Độ ẩm tương đối trong phòng' },
  { ten: function () { return tenMucCay(); } },
  { ten: 'Theo dõi trước kỳ sau' },
  { ten: 'Nhận định' },
  { ten: 'Dự báo kỳ sau' }
];

/* ===== RÁP TOÀN BỘ ====================================================== */

// Bản riêng khu: đặt trước khi dựng để các hàm cấp mô-đun (mucChiTieu, MUC_LUC) cùng biết.
let KHU_BAO_CAO = null;
function tenTongThe() { return KHU_BAO_CAO ? 'Cả khu ' + KHU_BAO_CAO : 'Toàn nhà máy'; }
function tenMucCay() { return (KHU_BAO_CAO ? 'Khu ' + KHU_BAO_CAO : 'Toàn nhà máy') + ' → ' + (KHU_BAO_CAO ? '' : 'khu → ') + 'cụm xử lý không khí → phòng'; }

function rapBaoCao(d, duBao, cfg) {
  const c = cfg || {};
  KHU_BAO_CAO = c.khu ? String(c.khu).toUpperCase() : null;
  const k = d.kpi_ky_nay || {}, kt = d.kpi_ky_truoc || {};
  const cap = L.phanCap(d);
  const cay = L.dungCay(d);
  const chuoi = (d.chuoi_ngay && d.chuoi_ngay.total) || [];
  const ngays = chuoi.map((x) => x.ngay);
  const laThang = String(d.ky).toUpperCase() !== 'TUAN';

  const ctDP = L.tongHopChiTieu(d, 'DP');
  const ctT  = L.tongHopChiTieu(d, 'T');
  const ctRH = L.tongHopChiTieu(d, 'RH');

  const dTuanThu = delta(k.ty_le_tuan_thu, kt.ty_le_tuan_thu, ' điểm %', true);
  const dNghiem  = delta(k.so_gio_critical, kt.so_gio_critical, ' giờ', false);

  const dat = (k.ty_le_tuan_thu || 0) >= NGUONG_HANH_DONG && !cap.capA.length;
  const khoiLichSuIn = khoiLichSuBanIn(d, KHU_BAO_CAO);
  // Tách vé đang mở thành mở trong kỳ / mở sau ngày chốt kỳ (rà soát 04/09/2026)
  const sc = d.su_co || {};
  const soNgoaiKyMo = (cap.suCoNgoaiKy || []).length;
  const soMoTrongKy = Math.max(0, (sc.dang_mo || 0) - soNgoaiKyMo);
  // Câu kết luận phải nói thẳng ý nghĩa, không bắt người đọc tự trừ rồi tự suy
  // ra "vậy là phải làm gì". Dưới ngưỡng hành động nghĩa là PHẢI khắc phục,
  // không phải chỉ theo dõi tiếp — nói rõ điều đó ra.
  const thieu = NGUONG_HANH_DONG - (k.ty_le_tuan_thu || 0);
  const ketLuan = dat
    ? tenTongThe() + ' giữ được số đo trong ngưỡng cho phép ' + phanTram(k.ty_le_tuan_thu)
      + ' thời gian, đạt ngưỡng hành động ' + NGUONG_HANH_DONG + '%. Kỳ này không có phòng nào '
      + 'phải xử lý ngay.'
    : tenTongThe() + ' chỉ giữ được số đo trong ngưỡng cho phép ' + phanTram(k.ty_le_tuan_thu)
      + ' thời gian, trong khi ngưỡng hành động là ' + NGUONG_HANH_DONG + '% — còn thiếu '
      + soVN(thieu, 1) + ' điểm %. Dưới ngưỡng hành động nghĩa là phải khắc phục, '
      + 'không phải chỉ theo dõi tiếp. Có ' + cap.capA_tong + ' phòng cần xử lý'
      + (cap.capA_tong > TOI_DA_CAP_A
          ? ': mục 2 nêu ' + TOI_DA_CAP_A + ' phòng nặng nhất, đủ ' + cap.capA_tong
            + ' phòng ở phụ lục A.' : '.');

  const phongDuBanDo = (d.tat_ca_phong || [])
    .filter((p) => p.muc_uu_tien === 'P1' || p.muc_uu_tien === 'P2' || p.ty_le_tuan_thu < NGUONG_HANH_DONG)
    .sort((a, b) => a.ty_le_tuan_thu - b.ty_le_tuan_thu);
  const phongBanDo = phongDuBanDo.slice(0, 26);
  // Nói rõ khi bị cắt (rà soát 04/09/2026)
  const chuBanDo = phongDuBanDo.length > phongBanDo.length
    ? ' Hiện ' + phongBanDo.length + '/' + phongDuBanDo.length + ' phòng kém nhất trong số phòng theo dõi '
      + 'đặc biệt, mức 2 hoặc dưới ngưỡng.' : '';

  const hangCapA = cap.capA.map((v, i) => ''
    + '<tr class="viec"><td class="so stt-a">A' + (i + 1) + '</td>'
    + '<td>' + v.loai.map((x) => '<span class="the the-loai">' + esc(x) + '</span>').join(' ') + '</td>'
    + '<td><div class="tieu"><span class="ma">' + esc(v.ma_phong) + '</span> · ' + esc(v.ten)
    +   ' <span class="the ' + (v.uu_tien === 'P1' ? 'the-p1' : '') + '">'
    +   esc(dich(L.TEN_UU_TIEN_NGAN, v.uu_tien)) + '</span></div>'
    +   v.can_cu.map((x) => '<div class="can-cu">' + esc(x) + '</div>').join('')
    +   v.viec.map((x) => '<div class="lam">' + esc(x) + '</div>').join('') + '</td>'
    + '<td class="so">' + soVN(v.tuan_thu, 1) + '%</td>'
    + '<td class="so">' + esc(v.ahu) + '</td></tr>').join('');

  const ht = cap.heThong;
  const heThongHtml = ht
    ? '<div class="he-thong"><div class="ht-nhan">Mức độ tin cậy của số đo</div>'
      + '<p><b>' + esc(ht.ket_luan) + '.</b> '
      + (ht.do_phu_pct != null
          ? 'Hệ thống thu được ' + L.phanTram(ht.do_phu_pct) + ' số giờ so với kỳ vọng ('
            + soVN(ht.gio_co_du_lieu || 0, 0) + '/' + soVN(ht.gio_ky_vong || 0, 0) + ' giờ), còn ' + soVN(ht.gio_rong || 0, 0)
            + ' giờ không có số đo. '
          : 'Kỳ này không đọc được chỉ số độ phủ dữ liệu. ')
      + 'Trong kỳ có ' + soVN(ht.tong_ngoai_le, 0) + ' lượt trục trặc khi lấy dữ liệu: '
      + esc(ht.danh_sach.map((x) => x.ten + ' — ' + soVN(x.so_lan, 0) + ' lượt').join('; ')) + '. '
      + 'Kết luận của báo cáo chỉ áp dụng cho khoảng thời gian thực sự có số đo.</p>'
      + '<p class="ht-viec">' + esc(ht.viec) + '</p></div>'
    : '';

  const hangCapB = cap.capB.map((p) => ''
    + '<tr><td><span class="ma">' + esc(p.ma_phong) + '</span><br><span class="mo">' + esc(p.ten_phong) + '</span></td>'
    + '<td class="so">' + soVN(p.tuan_thu_ky_truoc, 1) + '%</td>'
    + '<td class="so">' + soVN(p.tuan_thu_ky_nay, 1) + '%</td>'
    + '<td class="so tang-xau">' + soVN(p.delta, 1) + '</td>'
    + '<td>' + esc(L.vietLai((p.ly_do || []).join(' · '))) + '</td></tr>').join('');

  const hangPhong = (d.tat_ca_phong || []).slice()
    .sort((a, b) => a.ty_le_tuan_thu - b.ty_le_tuan_thu).map((p) => ''
    + '<tr><td><span class="ma">' + esc(p.ma_phong) + '</span></td><td>' + esc(p.ten_phong) + '</td>'
    + '<td>' + esc(p.khu_vuc) + '</td><td>' + esc(p.ahu || '—') + '</td>'
    + '<td>' + esc(dich(L.TEN_UU_TIEN_NGAN, p.muc_uu_tien)) + '</td>'
    + '<td class="so' + (p.ty_le_tuan_thu < NGUONG_HANH_DONG ? ' tang-xau' : '') + '">' + soVN(p.ty_le_tuan_thu, 1) + '</td>'
    + '<td class="so">' + p.so_gio_critical + '</td><td class="so">' + soVN(p.dq_pct, 1) + '</td>'
    + '</tr>').join('');

  const hangGioiHan = (d.gioi_han_tham_chieu || []).map((g) => ''
    + '<tr><td>' + esc(dich(L.TEN_UU_TIEN_NGAN, g.muc_uu_tien)) + '</td>'
    + '<td>' + esc(dich(L.TEN_CHI_TIEU, g.chi_tieu)) + '</td>'
    + '<td class="so">' + soVN(g.ghd, 1) + '</td><td class="so">' + soVN(g.ght, 1) + '</td>'
    + '<td>' + esc(g.don_vi) + '</td><td class="so">' + g.so_phong + '</td></tr>').join('');

  const db = duBao || {};
  const cuoi = (db.du_bao || []).slice(-1)[0] || {};
  const duBaoHtml = db.du_bao_dang_tin
    ? '<p>Xu hướng <b>' + esc(db.huong === 'cai_thien' ? 'đang cải thiện'
        : db.huong === 'xau_di' ? 'đang xấu đi' : 'đi ngang') + '</b>, mỗi ngày thay đổi '
      + soVN(db.do_doc_ngay, 3) + ' điểm %. Mức độ tin cậy của phép ngoại suy: R² '
      + soVN(db.r2, 3) + ' trên cửa sổ ' + db.cua_so_ngay + ' ngày (đủ tin cậy để nêu số). '
      + 'Nếu giữ nguyên xu hướng, sau 7 ngày nữa thời gian trong ngưỡng vào khoảng <b>'
      + soVN(cuoi.gia_tri, 1) + '%</b> (dao động ' + soVN(cuoi.canh_duoi, 1) + '–' + soVN(cuoi.canh_tren, 1) + '%).</p>'
      + '<p class="mo">Đây là phép ngoại suy tuyến tính từ số liệu đã có, không phải cam kết. '
      + 'Nó chỉ đúng khi không có thay đổi nào về thiết bị hay cách vận hành.</p>'
    : '<p class="canh-bao-nhe">Số liệu dao động quá bất thường (R² ' + soVN(db.r2, 3)
      + ') nên chưa đủ tin cậy để nêu con số dự báo. Không trích số dự báo nào vào kết luận.</p>';

  const tenKy = dich(L.TEN_KY, String(d.ky).toUpperCase(), String(d.ky).toLowerCase());

  return '<!doctype html>\n<html lang="vi"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>' + esc(c.tieu_de || 'Báo cáo giám sát môi trường') + '</title>'
    + '<style>' + CSS + '</style></head><body>'
    + '<a class="bo-qua" href="#muc-1">Bỏ qua phần đầu, vào thẳng nội dung</a>'
    + '<div class="trang">'

    + '<header class="dau"><div>'
    + '<h1>' + esc(c.tieu_de || 'Báo cáo giám sát môi trường phòng sạch') + '</h1>'
    + '<div class="phu">' + esc(c.don_vi || 'Hệ quản lý toà nhà') + ' · báo cáo ' + esc(tenKy)
    + ' · từ ' + ngayDai(d.tu_ngay) + ' đến ' + ngayDai(d.den_ngay)
    + ' · ' + (k.so_ngay_co_du_lieu || 0) + ' ngày có số đo</div></div>'
    + '<div class="ma-tl">Mã tài liệu <b>' + esc(c.ma_tai_lieu || '—') + '</b><br>'
    + 'Phiên bản <b>' + esc(c.phien_ban || '1') + '</b><br>'
    + 'Ngày phát hành <b>' + esc(c.phat_hanh || L.gioVietNam(d.tao_luc, true)) + '</b></div></header>'   // giờ VN (rà soát 04/09/2026)

    /* Mục lục — báo cáo kỳ tháng dài, người đọc cần biết trong tay có gì */
    + '<nav class="muc-luc" id="muc-luc"><div class="ml-nhan">Nội dung</div><ol>'
    + MUC_LUC.map(function (m, i) {
        return '<li><a href="#muc-' + (i + 1) + '"><span class="ml-so">' + (i + 1) + '</span>'
          + '<span>' + esc(typeof m.ten === 'function' ? m.ten() : m.ten)
          + (m.phu ? '<span class="ml-phu">' + esc(m.phu) + '</span>' : '') + '</span></a></li>';
      }).join('')
    + '</ol><div class="ml-cuoi">Phụ lục · số liệu tra cứu &nbsp;·&nbsp; Ký duyệt</div></nav>'
    + '<main>'

    /* 1 · Tóm tắt điều hành */
    + '<section id="muc-1"><h2><span class="so-muc">1</span>Tóm tắt điều hành</h2>'
    + '<div class="ket-luan' + (dat ? ' dat' : '') + '">'
    + '<span class="nhan-tt">' + (dat ? 'Kết luận: trong kiểm soát' : 'Kết luận: cần hành động') + '</span>'
    + '<p>' + esc(ketLuan) + '</p></div>'
    + '<div class="hero"><div>'
    + '<div class="so-lon">' + soVN(k.ty_le_tuan_thu, 1) + '<span class="don-vi">%</span></div>'
    + '<div class="nhan-hero">thời gian số đo nằm trong ngưỡng cho phép</div>'
    + '<div class="delta tang tang-' + dTuanThu.huong + '">' + esc(dTuanThu.chu) + ' so với kỳ trước ('
    + soVN(kt.ty_le_tuan_thu, 1) + '%)</div></div>'
    + '<div class="khung-bd">' + L.svgDuongNgay(chuoi, 'Thời gian trong ngưỡng theo ngày')
    + '<p class="chu-thich">Tỉ lệ thời gian số đo nằm trong ngưỡng cho phép, tính theo từng ngày. '
    + 'Vạch đỏ đứt là ngưỡng hành động; vùng hồng là phần còn thiếu so với ngưỡng đó.</p></div></div>'
    + '<div class="kpi-hang">'
    + '<div class="kpi"><div class="ten">Thời gian ngoài dải cho phép</div><div class="gt">'
    +   (k.ty_le_tuan_thu == null ? '—' : soVN(Math.max(0, 100 - k.ty_le_tuan_thu), 1) + '<span class="don-vi">%</span>')
    +   '</div>'
    +   '<div class="ct">cộng với ' + soVN(k.ty_le_tuan_thu, 1) + '% trong ngưỡng là đủ 100% — cùng tính theo phút. '
    // Giờ dán nhãn không phải tập con của số phút ngoài dải — không nói "trong đó" (rà soát 04/09/2026)
    +   'Tính riêng theo giờ: <b>' + soVN(k.so_gio_critical || 0, 0) + ' giờ</b> cảm biến có lúc vượt giới hạn hành động'
    +   (ht && ht.gio_co_du_lieu
          ? ' (' + phanTram(100 * (k.so_gio_critical || 0) / ht.gio_co_du_lieu) + ' của '
            + soVN(ht.gio_co_du_lieu, 0) + ' giờ có số đo)' : '')
    +   ((k.so_gio_warning || 0) > 0 ? ', ' + soVN(k.so_gio_warning, 0) + ' giờ ở mức cảnh báo' : '')
    +   (kt.so_gio_critical != null
          ? '; <span class="tang tang-' + dNghiem.huong + '">'
            + ((k.so_gio_critical || 0) <= kt.so_gio_critical ? 'ít hơn' : 'nhiều hơn') + ' kỳ trước '
            + soVN(Math.abs((k.so_gio_critical || 0) - kt.so_gio_critical), 0) + ' giờ</span>' : '')
    +   '.</div></div>'
    // Sự cố "đang mở" là đang mở LÚC LẬP BÁO CÁO, không phải cuối kỳ. Kỳ 08 chạy ngày 03/09 thì
    // cả bốn vé đều mở từ tháng 09 — in "còn mở 4" là gán việc kỳ sau cho kỳ này (rà soát 04/09/2026)
    + '<div class="kpi"><div class="ten">' + (soMoTrongKy ? 'Sự cố còn mở lúc lập báo cáo' : 'Sự cố phát sinh trong kỳ')
    +   '</div><div class="gt">' + (soMoTrongKy ? soMoTrongKy : (sc.mo_trong_ky || 0)) + '</div>'
    +   '<div class="ct">' + (soMoTrongKy ? 'phát sinh ' + (sc.mo_trong_ky || 0) + ' · ' : '')
    +   'đã đóng ' + (sc.dong_trong_ky || 0) + ' · trung bình khắc phục ' + soVN(sc.mttr_gio, 1) + ' giờ'
    +   (soNgoaiKyMo
          ? '. ' + soNgoaiKyMo + ' sự cố đang mở lúc lập báo cáo, đều mở sau ngày chốt kỳ — không thuộc kỳ này'
          : '') + '</div></div>'
    + '<div class="kpi"><div class="ten">Phòng phải xử lý</div><div class="gt">' + cap.capA_tong + '</div>'
    // Cấp A có thể chứa phòng vẫn đạt 80% (nhiều giờ dán nhãn), nên đếm thật thay vì
    // nói "trong tổng số phòng chưa đạt" (rà soát 04/09/2026)
    +   '<div class="ct">trong đó ' + cap.capA_tat_ca.filter((v) => v.tuan_thu != null && v.tuan_thu < NGUONG_HANH_DONG).length
    +   ' phòng chưa đạt ' + NGUONG_HANH_DONG + '%; toàn nhà máy ' + (k.so_phong_khong_dat || 0) + '/'
    +   (k.tong_phong_co_du_lieu || 0) + ' phòng chưa đạt</div></div>'
    + '<div class="kpi"><div class="ten">Thời gian thu được số đo</div><div class="gt">'
    +   soVN((ht && ht.do_phu_pct) != null ? ht.do_phu_pct : k.dq_pct, 1) + '%</div>'
    +   '<div class="ct">' + (ht ? soVN(ht.gio_rong || 0, 0) + ' giờ không có số đo' : 'đầy đủ') + '</div></div>'   // rà soát 04/09/2026
    + '</div>'
    + khoiLichSuIn
    + '</section>'

    /* 2 · Việc phải xử lý */
    + '<section class="chinh" id="muc-2"><h2><span class="so-muc">2</span>Việc phải xử lý trong kỳ này '
    + '<span class="dem">— ' + cap.capA_tong + ' phòng'
    + (cap.capA_tong > TOI_DA_CAP_A ? ', hiển thị ' + TOI_DA_CAP_A + ' phòng nặng nhất' : '') + '</span></h2>'
    + '<p class="mota">Danh sách này do luật cố định chọn ra, không do máy viết nhận định quyết định. '
    + 'Một phòng vào danh sách khi: có sự cố mức nghiêm trọng mở quá ' + L.GIO_SU_CO_CAP_A
    + ' giờ mà chưa xử lý; hoặc là phòng theo dõi đặc biệt mà thời gian trong ngưỡng dưới ' + NGUONG_HANH_DONG + '%; '
    + 'hoặc từ ' + L.TI_LE_GIO_VUOT_A + '% số giờ có số đo của phòng trở lên vượt giới hạn hành động. '   // luật theo tỉ lệ (rà soát 04/09/2026, đợt 2)
    + 'Thứ tự ưu tiên: mức ưu tiên của phòng, rồi tới có sự cố quá hạn hay không, '
    + 'rồi tới mức thiếu hụt so với ngưỡng, cuối cùng là số giờ vượt giới hạn hành động.</p>'
    + heThongHtml
    + (hangCapA
        ? '<div class="cuon-ngang"><table><thead><tr><th class="so" style="width:34px">#</th>'
          + '<th style="width:150px">Vì sao vào danh sách</th><th>Phòng · căn cứ · việc cần làm</th>'
          + '<th class="so" style="width:76px">Thời gian trong ngưỡng</th><th class="so" style="width:88px">Cụm</th>'
          + '</tr></thead><tbody>' + hangCapA + '</tbody></table></div>'
        : '<p class="mo">Kỳ này không có phòng nào phải xử lý ngay.</p>')
    /* Sự cố mở sau ngày chốt kỳ: truy vấn trả về sự cố đang mở TẠI LÚC CHẠY nên
       có cả sự việc của kỳ sau. Không đưa vào danh sách trên (sai phạm vi kỳ),
       nhưng vẫn phải báo vì đang còn treo. */
    + ((cap.suCoNgoaiKy || []).length
        ? '<div class="hop-luu-y"><b>Ngoài kỳ báo cáo.</b> ' + cap.suCoNgoaiKy.length
          + ' sự cố mở sau ngày chốt kỳ ' + L.ngayDai(d.den_ngay)
          + ' và tới lúc lập báo cáo vẫn chưa xử lý: '
          + cap.suCoNgoaiKy.map((x) => L.esc(x.phong) + ' (số ' + x.ma_su_co + ', mở '
              + L.gioVietNam(x.bat_dau, true) + ', đã ' + L.soVN(x.keo_dai_gio, 0) + ' giờ)').join('; ')   // ngày VN (rà soát 04/09/2026)
          + '. Không tính vào kết quả kỳ này — sẽ vào báo cáo kỳ sau.</div>'
        : '')
    + dan(3, 'Chênh áp — chỉ tiêu trọng tâm: hàng rào ngăn nhiễm chéo, và là nơi ra ngoài giới hạn nhiều nhất kỳ này.')
    + VE_ML + '</section>'

    /* 3 · Chênh áp — mục trọng tâm */
    + mucChiTieu(ctDP, true, 3, dan(4, 'Nhiệt độ: ' + ctT.so_phong_do + ' phòng có đo, đây là điều kiện thao tác và độ ổn định của sản phẩm.'))   // số thật, không hardcode (rà soát 04/09/2026)

    /* 4 · Nhiệt độ và độ ẩm */
    + mucChiTieu(ctT, false, 4, dan(5, 'Độ ẩm: hướng nguy hiểm là vượt trên — nguy cơ phát triển vi sinh vật.'))
    + mucChiTieu(ctRH, false, 5, dan(6, tenMucCay() + ': xem vấn đề nằm ở một phòng lẻ hay cả cụm.'))

    /* 5 · Phân cấp nhà máy → khu → cụm → phòng */
    + mucPhanCap(cay, laThang, 6, dan(7, 'Theo dõi trước kỳ sau: phòng nào tụt rõ so với kỳ trước, chưa tới mức phải xử lý ngay.'))

    /* 6 · Theo dõi trước kỳ sau */
    + '<section id="muc-7"><h2><span class="so-muc">7</span>Theo dõi trước kỳ sau</h2>'
    + '<p class="mota">Phòng tụt từ ' + L.SUT_GIAM_CAP_B + ' điểm % trở lên so với kỳ trước. '
    + 'Vòng tròn rỗng là kỳ trước, chấm đặc là kỳ này.</p>'
    + '<div class="khung-bd">' + L.svgDumbbell(cap.capB) + '</div>'
    + (hangCapB
        ? '<div class="cuon-ngang"><table style="margin-top:16px"><thead><tr><th>Phòng</th>'
          + '<th class="so">Kỳ trước</th><th class="so">Kỳ này</th><th class="so">Chênh lệch (điểm %)</th>'
          + '<th>Vì sao phát hiện</th></tr></thead><tbody>' + hangCapB + '</tbody></table></div>'
        : '')
    + '</section>'

    /* 7 · Nhận định */
    + '<section id="muc-8"><h2><span class="so-muc">8</span>Nhận định</h2>'
    + '<p class="mota">Mỗi phát hiện phải nêu đủ năm phần. Giả thuyết chỉ là giả thuyết: hệ thống không có '
    + 'dữ liệu lệnh công việc hay hành động khắc phục, nên không kết luận nguyên nhân và không xác nhận '
    + 'việc gì đã được làm.</p>'
    + renderNhanDinh(c.nhan_dinh)
    + dan(9, 'Xu hướng dài và dự báo kỳ sau: kỳ này nằm ở đâu trong mạch ba mươi ngày gần nhất.')
    + VE_ML + '</section>'

    /* 8 · Dự báo */
    + '<section id="muc-9"><h2><span class="so-muc">9</span>Xu hướng dài và dự báo kỳ sau</h2>'
    + '<p class="mota">Biểu đồ gộp ' + ((duBao || {}).chuoi || []).length + ' ngày đã đo gần nhất '
    + 'với phần ngoại suy 7 ngày tới, để thấy kỳ này nằm ở đâu trong mạch dài chứ không chỉ so với '
    + 'một kỳ liền trước.</p>'
    + '<div class="khung-bd">' + L.svgXuHuongDai((duBao || {}).chuoi, (duBao || {}).du_bao) + '</div>'
    + duBaoHtml + '</section>'

    /* Phụ lục */
    + '<div class="pl-dau"><h2>Phụ lục · số liệu tra cứu</h2></div>'

    + (cap.capA_tong > TOI_DA_CAP_A
        ? '<details><summary>Phụ lục A · Toàn bộ ' + cap.capA_tong + ' phòng phải xử lý</summary>'
          + '<div class="noi-dung"><div class="cuon-ngang"><table><thead><tr><th class="so">#</th><th>Phòng</th>'
          + '<th>Khu · cụm</th><th>Ưu tiên</th><th class="so">Thời gian trong ngưỡng %</th>'
          + '<th class="so">Giờ vượt giới hạn hành động</th><th class="so">Sự cố đã mở (giờ)</th><th>Vì sao vào danh sách</th></tr></thead><tbody>'
          + cap.capA_tat_ca.map((v, i) => '<tr><td class="so stt-a">A' + (i + 1) + '</td>'
              + '<td><span class="ma">' + esc(v.ma_phong) + '</span><br><span class="mo">' + esc(v.ten) + '</span></td>'
              + '<td>' + esc(v.khu) + ' · ' + esc(v.ahu) + '</td>'
              + '<td>' + esc(dich(L.TEN_UU_TIEN_NGAN, v.uu_tien)) + '</td>'
              + '<td class="so' + (v.tuan_thu != null && v.tuan_thu < NGUONG_HANH_DONG ? ' tang-xau' : '')
              + '">' + soVN(v.tuan_thu, 1) + '</td>'   // chỉ đỏ khi thật sự dưới ngưỡng (rà soát 04/09/2026)
              + '<td class="so">' + soVN(v.gio_nghiem_trong, 0) + '</td>'
              + '<td class="so">' + (v.su_co_qua_han ? soVN(v.su_co_qua_han, 1) : '—') + '</td>'
              + '<td>' + esc(v.loai.join(' · ')) + '</td></tr>').join('')
          + '</tbody></table></div></div></details>'
        : '')

    + '<details><summary>Phụ lục B · Bản đồ thời gian trong ngưỡng theo phòng và ngày</summary>'
    + '<div class="noi-dung"><p class="mota">Ô trắng là ngày đạt ngưỡng ' + NGUONG_HANH_DONG
    + '%. Chỉ ngày dưới ngưỡng mới tô màu, càng đậm càng nặng. Dấu ◆ sau mã phòng là phòng theo dõi đặc biệt.'
    + chuBanDo + '</p>'
    + L.svgBanDo(phongBanDo, ngays) + '</div></details>'

    + (laThang ? ''   // kỳ tháng: phần cây ở trên đã liệt kê đủ từng phòng theo cụm
        : '<details><summary>Phụ lục C · Toàn bộ ' + ((d.tat_ca_phong || []).length) + ' phòng có số đo</summary>'
    + '<div class="noi-dung"><div class="cuon-ngang"><table><thead><tr><th>Mã phòng</th><th>Tên phòng</th><th>Khu</th>'
    + '<th>Cụm</th><th>Ưu tiên</th><th class="so">Thời gian trong ngưỡng %</th><th class="so">Giờ vượt giới hạn hành động</th>'
    + '<th class="so">Thời gian có số đo %</th></tr></thead><tbody>' + hangPhong
    + '</tbody></table></div></div></details>')

    + '<details><summary>Phụ lục D · Giới hạn áp dụng trong kỳ</summary>'
    + '<div class="noi-dung"><div class="cuon-ngang"><table><thead><tr><th>Mức ưu tiên</th>'
    + '<th>Chỉ tiêu</th><th class="so">Giới hạn dưới</th><th class="so">Giới hạn trên</th>'
    + '<th>Đơn vị</th><th class="so">Số phòng</th></tr></thead><tbody>' + hangGioiHan
    + '</tbody></table></div></div></details>'

    /* Kiểm soát tài liệu — phần bên bảo đảm chất lượng soi đầu tiên khi thanh tra.
       Nguyên tắc toàn vẹn dữ liệu đòi hỏi trả lời được: ai lập, lập lúc nào, số
       liệu lấy từ đâu, ngưỡng lấy từ đâu, bản gốc lưu ở đâu, bản in này có được
       kiểm soát không. */
    + '<section id="muc-ksts"><h2>Kiểm soát tài liệu</h2>'
    + '<div class="canh-bao-in"><b>Bản in trên giấy là bản không kiểm soát.</b> '
    + 'Bản có hiệu lực là tệp gốc lưu tại nơi ghi bên dưới. Trước khi dùng bản in để ra quyết định, '
    + 'phải đối chiếu mã lần chạy với bản gốc.</div>'
    + '<div class="cuon-ngang"><table class="bang-ksts"><tbody>'
    + '<tr><th>Người lập</th><td>' + esc(c.he_thong_lap || 'Hệ thống báo cáo tự động — không có thao tác thủ công')
    +   '<div class="mo">Báo cáo do máy dựng từ số liệu đo. Người lập, người soát xét và người phê duyệt '
    +   'ký ở mục dưới; chữ ký đó mới là căn cứ phát hành.</div></td></tr>'
    // tao_luc là UTC (+00:00): in thô rồi ghi "giờ Việt Nam" là sai 7 giờ (rà soát 04/09/2026)
    + '<tr><th>Thời điểm lập</th><td>' + esc(L.gioVietNam(d.tao_luc)) + ' giờ Việt Nam</td></tr>'
    + '<tr><th>Nguồn số liệu</th><td><span class="ma">' + esc(d.nguon || 'rpc_bao_cao_tong_hop')
    +   ' (' + esc(d.ky) + ', ' + ngayDai(d.tu_ngay) + ' – ' + ngayDai(d.den_ngay) + ')</span>'
    +   '<div class="mo">Số liệu đọc trực tiếp từ kho dữ liệu đo, không qua bước nhập tay nào.</div></td></tr>'
    + '<tr><th>Nguồn ngưỡng giới hạn</th><td>' + esc(c.nguon_gioi_han || 'Bảng cấu hình giới hạn theo phòng '
    +   'trong hệ quản lý toà nhà') + '<div class="mo">Giới hạn dưới và giới hạn trên áp dụng trong kỳ được '
    +   'liệt kê đầy đủ ở phụ lục D. Bộ ráp báo cáo không tự đặt ngưỡng nào.</div></td></tr>'
    + '<tr><th>Mã lần chạy</th><td><span class="ma">' + esc(c.ma_lan_chay || '—') + '</span>'
    +   '<div class="mo">Dùng mã này để tìm lại đúng lần chạy đã sinh ra bản báo cáo.</div></td></tr>'
    + '<tr><th>Nơi lưu bản gốc</th><td>' + esc(c.noi_luu || 'Thư mục báo cáo trên Google Drive của bộ phận')
    +   (c.link_drive ? ' · <span class="ma">' + esc(c.link_drive) + '</span>' : '') + '</td></tr>'
    + '<tr><th>Quy trình áp dụng</th><td>' + esc(c.quy_trinh || 'Chưa khai báo — cần điền mã quy trình giám sát '
    +   'môi trường đang có hiệu lực') + '</td></tr>'
    + '<tr><th>Cách phân loại mức xử lý</th><td>Do luật cố định trong bộ ráp báo cáo quyết định, '
    +   'không do máy viết nhận định. Tiêu chí ghi ngay đầu mục 2.</td></tr>'
    + '</tbody></table></div>'
    + (c.lich_su && c.lich_su.length
        ? '<h3>Lịch sử sửa đổi tài liệu</h3><div class="cuon-ngang"><table><thead><tr>'
          + '<th>Phiên bản</th><th>Ngày</th><th>Nội dung thay đổi</th><th>Người sửa</th></tr></thead><tbody>'
          + c.lich_su.map(function (x) {
              return '<tr><td>' + esc(x.phien_ban) + '</td><td>' + esc(x.ngay) + '</td><td>'
                + esc(x.thay_doi) + '</td><td>' + esc(x.nguoi || '—') + '</td></tr>';
            }).join('')
          + '</tbody></table></div>'
        : '')
    + '</section>'

    + '<section id="muc-ky"><h2>Ký duyệt</h2><div class="ky">'
    + '<div class="o-ky"><div class="vt">Người lập</div><div class="ten">' + esc(c.lap_ten || '—')
    +   '</div><div class="y">' + esc(c.lap_chuc || 'Bộ phận quản lý hệ thống toà nhà') + '</div></div>'
    + '<div class="o-ky"><div class="vt">Người soát xét</div><div class="ten">' + esc(c.soat_ten || '—')
    +   '</div><div class="y">' + esc(c.soat_chuc || 'Bộ phận giám sát trong quá trình · Bộ phận cơ điện') + '</div></div>'
    + '<div class="o-ky"><div class="vt">Người phê duyệt</div><div class="ten">' + esc(c.duyet_ten || '—')
    +   '</div><div class="y">' + esc(c.duyet_chuc || 'Bộ phận bảo đảm chất lượng') + '</div></div>'
    + '</div></section>'

    + '</main><footer class="chan">Nguồn số liệu: ' + esc(d.nguon || 'rpc_bao_cao_tong_hop') + ' (' + esc(d.ky) + ', '
    + ngayDai(d.tu_ngay) + ' – ' + ngayDai(d.den_ngay) + ') · lập lúc '
    + esc(L.gioVietNam(d.tao_luc)) + ' giờ Việt Nam · mã lần chạy ' + esc(c.ma_lan_chay || '—')   // rà soát 04/09/2026
    + '<br>Số liệu do hệ thống tính. Việc phân loại mức ưu tiên xử lý do luật cố định trong bộ ráp báo cáo, '
    + 'không do máy viết nhận định quyết định.</footer>'

    + '</div></body></html>';
}

module.exports = { rapBaoCao: rapBaoCao, locPhatHien: locPhatHien, CSS: CSS };
