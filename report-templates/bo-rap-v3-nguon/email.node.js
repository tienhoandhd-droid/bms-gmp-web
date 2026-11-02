'use strict';
/* ===========================================================================
 * THÂN EMAIL BÁO CÁO
 *
 * Năm khối theo câu hỏi của người quản lý: kết luận · ở đâu kém · ai làm gì ·
 * bộ phận có phản hồi không · xem thêm. Mỗi con số chỉ nêu một lần; phân tích
 * đầy đủ nằm trong bản in đính kèm.
 *
 * RÀNG BUỘC CỦA HÒM THƯ (khác hẳn trang web):
 *   · Kiểu dáng viết THẲNG vào thẻ. Hòm thư loại bỏ tệp kiểu dáng ngoài, quy
 *     tắc nhập tệp, phông chữ nhúng, và mọi thuộc tính định vị.
 *   · Dựng bằng <table>. Hộp co giãn bị cắt phần lớn thuộc tính con nên không
 *     dùng được; lưới thì không hỗ trợ.
 *   · Không ảnh, không đồ hoạ vector — hòm thư chặn ảnh mặc định. Biểu đồ vẽ bằng ô bảng (bieu-do-thu.js).
 *   · Khối <style> chỉ dùng cho câu truy vấn phương tiện (màn hình hẹp). Mọi
 *     thứ quyết định hình thức vẫn phải nằm trong thuộc tính style.
 *
 * Từ ngữ, cách viết số và luật xếp hạng lấy từ bao-cao-loi.js — ba đầu ra của
 * cùng một kỳ mà nói hai giọng thì tệ hơn là chưa sửa gì.
 * ========================================================================= */

const L = require('./bao-cao-loi.js');
const PTD = require('./chenh-ap-phong-theo-doi.js');
const PH = require('./phan-hoi-bo-phan.js');
const BD = require('./bieu-do-thu.js');
const { esc, soVN, phanTram, ngayDai, dich, NGUONG_HANH_DONG } = L;

/* ===== Bảng màu: một màu chính, đỏ và lục cho kết quả, còn lại là mực và nền =====
 * Viết thẳng giá trị vì biến CSS không dùng được trong hòm thư.
 * ===================================================================== */
const M = {
  muc:   '#0F172A',
  muc2:  '#3E4A5B',
  mo:    '#6B7686',
  vien:  '#E3E8EF',
  giay:  '#FFFFFF',
  nen:   '#F7F9FB',
  ngoai: '#EDF0F4',
  dam:   '#17324D',   // màu chính duy nhất: dải đầu thư, tiêu đề mục
  doChu: '#B91C1C',   // đỏ chỉ dành cho số chưa đạt và mũi tên giảm
  luc:   '#15803D'
};

const F = "-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif";

/* Thang tỷ lệ vàng (mỗi bậc gấp khoảng 1,618 lần bậc trước).
 *   · Khoảng cách theo dãy Fibonacci: 3, 5, 8, 13, 21, 34.
 *   · Chữ: 13 (bảng, ghi chú), 21 (tiêu đề mục), 34 (số chính); 16 là bậc trung gian cho câu kết luận.
 *   · Bố cục hai cột 62/38, xuống một cột trên điện thoại.
 * Quy tắc mép: hàng ngoài cùng đệm LE_NGANG hai bên; bảng không viền, ô đầu bỏ đệm trái,
 * ô cuối bỏ đệm phải, để chữ trong bảng thẳng đường dọc đó. */
const K = { 1: 3, 2: 5, 3: 8, 4: 13, 5: 21, 6: 34 };
const CO = { nho: 13, than: 16, muc: 21, lon: 34 };
const LE_NGANG = K[6];
const LE_DOC = K[5];
const BANG = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">';

/* ===== Mảnh dựng sẵn ==================================================== */

function hang(noiDung, nen) {
  return '<tr><td class="pad" style="background:' + (nen || M.giay) + ';border-left:1px solid '
    + M.vien + ';border-right:1px solid ' + M.vien + ';padding:' + LE_DOC + 'px ' + LE_NGANG
    + 'px;">' + noiDung + '</td></tr>';
}

function tieuDeMuc(chu) {
  return '<div style="font-size:' + CO.muc + 'px;font-weight:700;color:' + M.dam + ';line-height:1.3;margin:0 0 ' + K[4] + 'px;">' + esc(chu) + '</div>';
}

function tieuDeNho(chu) {
  return '<div style="font-size:' + CO.nho + 'px;font-weight:700;color:' + M.dam + ';line-height:1.4;margin:0 0 ' + K[2] + 'px;">' + chu + '</div>';
}

function ghiChu(html) {
  return '<div style="font-size:' + CO.nho + 'px;color:' + M.muc2 + ';line-height:1.6;margin:' + K[3] + 'px 0 0;">' + html + '</div>';
}

/* Hai cột 62/38. Thiếu một bên thì bên còn lại chiếm cả hàng. */
function haiCot(trai, phai) {
  if (!trai || !phai) return trai || phai || '';
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
    + '<td class="cot" width="62%" style="width:62%;vertical-align:top;padding:0 ' + K[5] + 'px 0 0;">' + trai + '</td>'
    + '<td class="cot" width="38%" style="width:38%;vertical-align:top;padding:0;">' + phai + '</td></tr></table>';
}

function chiSo(nhan, gt, phu, mau) {
  return '<div style="padding:' + K[3] + 'px 0;border-bottom:1px solid ' + M.vien + ';">'
    + '<div style="font-size:' + CO.nho + 'px;color:' + M.muc2 + ';font-weight:600;line-height:1.4;">' + esc(nhan) + '</div>'
    + '<div style="font-size:' + CO.muc + 'px;font-weight:700;color:' + (mau || M.muc) + ';line-height:1.3;">' + gt + '</div>'
    + '<div style="font-size:' + CO.nho + 'px;color:' + M.mo + ';line-height:1.5;">' + phu + '</div></div>';
}

/* Máy viết nhận định có lúc ghi "51,23%": đưa về một chữ số lẻ như mọi số khác trong thư. */
function chuAI(s) {
  return L.vietLai(s)
    .replace(/(\d+),(\d{2,})(?=\s*%)/g, function (m, a, b) {
      const v = Number(a + '.' + b);
      // 99,99% không được làm tròn thành 100,0%: đọc vậy là cả kỳ, trong khi vẫn còn điểm đo khác.
      return soVN(v < 100 && Math.round(v * 10) / 10 >= 100 ? 99.9 : v, 1);
    });
}

/* ===== Ráp thân email =================================================== */

function rapEmail(d, duBao, cfg) {
  const c = cfg || {};
  // Bản riêng khu (fan-out theo người nhận): dữ liệu d đã là của khu đó, nên dòng tổng gọi là "Cả khu X".
  const khuBC = c.khu ? String(c.khu).toUpperCase() : null;
  const tenTong = khuBC ? 'Cả khu ' + khuBC : 'Toàn nhà máy';
  const k = d.kpi_ky_nay || {}, kt = d.kpi_ky_truoc || {};
  const cap = L.phanCap(d);
  const ctDP = L.tongHopChiTieu(d, 'DP');
  const ctT = L.tongHopChiTieu(d, 'T');
  const ctRH = L.tongHopChiTieu(d, 'RH');
  const cay = L.dungCay(d);
  const ht = cap.heThong;
  const maKy = String(d.ky).toUpperCase();
  const nhanKy = (maKy === 'TUAN' || maKy === 'THANG' || maKy === 'QUY') && d.tu_ngay
    ? PTD.nhanKy({ loai: maKy, tu: d.tu_ngay, den: d.den_ngay }).ten
    : dich(L.TEN_KY, maKy, String(d.ky).toLowerCase());
  const gioDoDuoc = (d.do_tin_cay_du_lieu && d.do_tin_cay_du_lieu.gio_co_du_lieu)
    || (ht && ht.gio_co_du_lieu) || 0;
  // Tỷ lệ giờ vượt giới hạn hành động trên tổng số giờ thực sự đo được.
  const pNghiem = gioDoDuoc ? 100 * (k.so_gio_critical || 0) / gioDoDuoc : null;
  const dat = (k.ty_le_tuan_thu || 0) >= NGUONG_HANH_DONG && !cap.capA_tong;
  const tdTD = PTD.tongHop(d, khuBC);
  const ttTD = PTD.tomTat(tdTD);

  function oB(n, canPhai, dam, mau, dau, cuoi) {
    return '<td class="d' + (dau ? ' dl' : '') + (cuoi ? ' dr' : '') + (canPhai ? ' dp' : '')
      + '" style="' + (dam ? 'font-weight:700;' : '') + 'color:' + (mau || M.muc) + ';">' + n + '</td>';
  }
  function thB(n, canPhai, dau, cuoi) {
    return '<th class="h' + (dau ? ' dl' : '') + (cuoi ? ' dr' : '') + (canPhai ? ' dp' : '') + '">' + n + '</th>';
  }
  const mauTyLe = function (v) { return v != null && v < NGUONG_HANH_DONG ? M.doChu : M.muc; };
  const nhoMo = function (chu) { return '<div style="font-size:' + CO.nho + 'px;font-weight:400;color:' + M.mo + ';line-height:1.4;">' + chu + '</div>'; };
  // Mũi tên so với kỳ trước; màu chỉ nằm ở mũi tên.
  const muiTen = function (v, truoc) {
    if (v == null || truoc == null || v === truoc) return '';
    return '<span style="color:' + (v > truoc ? M.luc : M.doChu) + ';">&nbsp;' + (v > truoc ? '▲' : '▼') + '</span>';
  };

  /* ===== 1. Kết luận: mọi câu rút thẳng từ số liệu, không do mô hình ngôn ngữ sinh ra ===== */
  const soSanhKyTruoc = kt.ty_le_tuan_thu != null
    ? (k.ty_le_tuan_thu > kt.ty_le_tuan_thu ? ', tăng so với ' : k.ty_le_tuan_thu < kt.ty_le_tuan_thu ? ', giảm so với ' : ', bằng ')
      + 'kỳ trước (' + phanTram(kt.ty_le_tuan_thu) + ')'
    : '';
  const chuoiNgay = ((d.chuoi_ngay || {}).total || []).filter(function (x) { return x.ty_le != null; });
  const cauTheoNgay = function (ds) {
    const soDat = ds.filter(function (x) { return Number(x.ty_le) >= NGUONG_HANH_DONG; }).length;
    const thap = ds.reduce(function (a, x) { return Number(x.ty_le) < Number(a.ty_le) ? x : a; });
    const cao = ds.reduce(function (a, x) { return Number(x.ty_le) > Number(a.ty_le) ? x : a; });
    return '<b>' + soDat + '/' + ds.length + ' ngày đạt mức yêu cầu.</b> Thấp nhất ' + ngayDai(thap.ngay).slice(0, 5) + ' (' + phanTram(thap.ty_le)
      + '), cao nhất ' + ngayDai(cao.ngay).slice(0, 5) + ' (' + phanTram(cao.ty_le) + ').';
  };
  const tcE = d.do_tin_cay_du_lieu || ht || {};
  const db = duBao || {};
  const cuoiDB = (db.du_bao || []).slice(-1)[0] || {};
  const khoiKetLuan = haiCot(
    '<div style="font-size:' + CO.than + 'px;font-weight:700;color:' + (dat ? M.luc : M.doChu) + ';">' + (dat ? 'Đạt' : 'Chưa đạt') + '</div>'
    + '<div style="font-size:' + CO.lon + 'px;font-weight:700;line-height:1.3;color:' + mauTyLe(k.ty_le_tuan_thu) + ';">' + phanTram(k.ty_le_tuan_thu) + '</div>'
    + '<div style="font-size:' + CO.than + 'px;line-height:1.6;color:' + M.muc + ';">Tỷ lệ đạt toàn bộ chỉ tiêu (chênh áp, nhiệt độ, độ ẩm) của '
    + (khuBC ? 'khu ' + esc(khuBC) : 'toàn nhà máy') + ', mức yêu cầu ' + NGUONG_HANH_DONG + '%' + soSanhKyTruoc + '.</div>'
    + (chuoiNgay.length >= 2 ? ghiChu(cauTheoNgay(chuoiNgay)) : '')
    + (tcE.do_phu_pct != null ? ghiChu('Số đo có đủ ' + phanTram(tcE.do_phu_pct) + ' số giờ dự kiến'
        + ((tcE.gio_rong || 0) > 0 ? ', thiếu ' + soVN(tcE.gio_rong, 0) + ' giờ.' : '.')) : '')
    + (db.du_bao_dang_tin ? ghiChu('Ngoại suy 7 ngày tới: khoảng ' + phanTram(cuoiDB.gia_tri) + ' (từ ' + phanTram(cuoiDB.canh_duoi) + ' đến ' + phanTram(cuoiDB.canh_tren) + '), không phải cam kết.') : ''),
    (ttTD ? chiSo('Chênh áp tại ' + ttTD.so_phong + ' phòng theo dõi', phanTram(ttTD.ty_le),
        ttTD.phong_dat + '/' + ttTD.so_phong + ' phòng đạt · ' + ttTD.so_uu_tien + ' phòng dưới ' + ttTD.nguong_uu_tien + '%',
        ttTD.ty_le < ttTD.nguong_dat ? M.doChu : null) : '')
    + chiSo('Phòng phải xử lý', soVN(cap.capA_tong, 0) + '/' + soVN(k.tong_phong_co_du_lieu || 0, 0),
        'Có ' + (k.so_phong_khong_dat || 0) + ' phòng chưa đạt', cap.capA_tong ? M.doChu : null)
    + chiSo('Giờ vượt giới hạn hành động', soVN(k.so_gio_critical || 0, 0),
        (pNghiem != null ? phanTram(pNghiem) + ' số giờ có số đo' : '')
        + (kt.so_gio_critical != null ? ' · kỳ trước ' + soVN(kt.so_gio_critical, 0) : ''))
  );

  /* ===== 2. Ở đâu kém ================================================== */
  const lichSu = L.chuanHoaLichSu(d);
  const kyTruocLS = lichSu && lichSu.length >= 2 ? lichSu[lichSu.length - 2] : null;
  const oTyLeKhu = function (v, truoc) {
    return phanTram(v) + muiTen(v, truoc)
      + '<div style="margin-top:' + K[1] + 'px;">' + BD.thanh(v, { nguong: NGUONG_HANH_DONG, cao: 5 }) + '</div>'
      + (truoc != null ? nhoMo('kỳ trước ' + phanTram(truoc)) : '');
  };
  const oGioVuot = function (gio, pct) {
    return soVN(gio || 0, 0) + '&nbsp;giờ' + (pct == null ? '' : nhoMo(phanTram(pct)));
  };
  // Khu không có số liệu (null) không phải khu 0%; bản riêng khu đã có số ở Kết luận nên không cần bảng này.
  const khoiBangKhu = khuBC ? '' : tieuDeNho('Toàn bộ chỉ tiêu theo khu') + BANG + '<thead><tr>'
    + thB('Khu', false, true) + thB('Tỷ lệ đạt', true) + thB('Phòng đạt', true) + thB('Phải xử lý', true) + thB('Giờ vượt', true, false, true)
    + '</tr></thead><tbody>'
    + cay.map(function (x) {
        const soXL = cap.capA_tat_ca.filter(function (v) { return v.khu === x.khu; }).length;
        const truoc = kyTruocLS && kyTruocLS.khu && kyTruocLS.khu[x.khu] != null ? Number(kyTruocLS.khu[x.khu]) : null;
        return '<tr>' + oB('Khu ' + esc(x.khu), false, true, null, true)
          + oB(oTyLeKhu(x.ty_le_tb, truoc), true, true, mauTyLe(x.ty_le_tb))
          + oB(x.so_phong_dat + '/' + x.so_phong, true)
          + oB(soXL + '/' + x.so_phong, true)
          + oB(oGioVuot(x.gio_nghiem_trong, x.gio_do ? 100 * (x.gio_nghiem_trong || 0) / x.gio_do : null), true, false, null, false, true) + '</tr>';
      }).join('')
    + '<tr style="background:' + M.nen + ';">' + oB(tenTong, false, true, null, true)
    + oB(oTyLeKhu(k.ty_le_tuan_thu, kt.ty_le_tuan_thu), true, true, mauTyLe(k.ty_le_tuan_thu))
    + oB((k.tong_phong_co_du_lieu - k.so_phong_khong_dat) + '/' + k.tong_phong_co_du_lieu, true, true)
    + oB(cap.capA_tong + '/' + k.tong_phong_co_du_lieu, true, true)
    + oB(oGioVuot(k.so_gio_critical, pNghiem), true, true, null, false, true) + '</tr></tbody></table>';

  // Phần trăm thời gian ra ngoài giới hạn của một dòng, tách hai phía.
  const haiPhia = function (r) {
    if (!r || !r.tong_gio_do) return null;
    return { duoi: 100 * (r.tong_gio_duoi || 0) / r.tong_gio_do, tren: 100 * (r.tong_gio_tren || 0) / r.tong_gio_do };
  };
  const oHaiPhia = function (p, canPhai, cuoi) {
    if (!p) return oB('—', canPhai, false, M.mo, false, cuoi);
    const kem = p.duoi + p.tren > 100 - NGUONG_HANH_DONG;
    const dong = [];
    if (p.duoi >= 0.05) dong.push('Thấp&nbsp;' + phanTram(p.duoi));
    if (p.tren >= 0.05) dong.push('Cao&nbsp;' + phanTram(p.tren));
    return oB(dong.length ? dong.join('<br>') : '0%', canPhai, kem, kem ? M.doChu : M.muc2, false, cuoi);
  };
  const dsChiTieu = [[ctDP, 'Chênh áp'], [ctT, 'Nhiệt độ'], [ctRH, 'Độ ẩm']].filter(function (x) { return x[0].so_phong_do; })
    .map(function (x) { return { ten: x[1], g: L.gomChiTieuTheoCap(x[0]) }; });
  // Chỉ tính phòng theo dõi: toàn khu vực đã có ở bảng chênh áp ngay bên cạnh (yêu cầu 02/11/2026).
  const maTheoDoi = {};
  (tdTD ? tdTD.phong : []).forEach(function (p) { maTheoDoi[p.ma] = true; });
  const chiTieuTD = [[ctDP, 'Chênh áp'], [ctT, 'Nhiệt độ'], [ctRH, 'Độ ẩm']].map(function (x) {
    const g = L.gomChiTieuTheoCap({ xep_hang: (x[0].xep_hang || []).filter(function (r) { return maTheoDoi[r.ma_phong]; }) });
    return { ten: x[1], g: g };
  }).filter(function (x) { return x.g.khu.length; });
  const dsKhuMT = tdTD ? tdTD.khu.slice().sort() : [];
  const khoiMaTran = chiTieuTD.length && dsKhuMT.length
    ? tieuDeNho('Phòng theo dõi: thời gian ra ngoài giới hạn') + BANG + '<thead><tr>' + thB('Khu', false, true)
      + chiTieuTD.map(function (x, i) { return thB(x.ten, true, false, i === chiTieuTD.length - 1); }).join('') + '</tr></thead><tbody>'
      + dsKhuMT.map(function (khu) {
          return '<tr>' + oB(esc(khu), false, true, null, true)
            + chiTieuTD.map(function (x, i) {
                const r = x.g.khu.find(function (y) { return y.khu === khu; });
                const cuoi = i === chiTieuTD.length - 1;
                if (!r) return oB('—', true, false, M.mo, false, cuoi);
                // Mỗi chỉ tiêu đo ở số phòng khác nhau nên ghi số phòng ngay trong ô.
                return oHaiPhia(haiPhia(r), true, cuoi).replace('</td>', nhoMo(r.so_phong + '&nbsp;phòng') + '</td>');
              }).join('') + '</tr>';
        }).join('') + '</tbody></table>'
      + '<div style="font-size:' + CO.nho + 'px;color:' + M.mo + ';line-height:1.5;margin-top:' + K[2] + 'px;">Số % là phần thời gian đo. Thấp: dưới giới hạn dưới. Cao: trên giới hạn trên. Chữ đỏ: tổng ngoài giới hạn quá ' + (100 - NGUONG_HANH_DONG) + '%.</div>'
    : '';

  const SO_CUM = 5;
  const dsCum = dsChiTieu.length && dsChiTieu[0].ten === 'Chênh áp'
    ? (dsChiTieu[0].g.cum || []).filter(function (r) { return !khuBC || r.khu === khuBC; })
        .map(function (r) { return { r: r, p: haiPhia(r) }; }).filter(function (x) { return x.p; })
        .sort(function (a, b) { return (b.p.duoi + b.p.tren) - (a.p.duoi + a.p.tren); })
    : [];
  const khoiCum = dsCum.length
    ? tieuDeNho('Chênh áp: ' + Math.min(SO_CUM, dsCum.length) + ' cụm xử lý không khí kém nhất') + BANG + '<thead><tr>'
      + thB('Cụm', false, true) + thB('Ngoài giới hạn', true) + thB('Phòng đạt', true, false, true) + '</tr></thead><tbody>'
      + dsCum.slice(0, SO_CUM).map(function (x) {
          return '<tr>' + oB('<span style="white-space:nowrap;">' + esc(x.r.ahu) + '</span>', false, true, null, true)
            + oHaiPhia(x.p, true) + oB(x.r.so_phong_dat + '/' + x.r.so_phong, true, false, null, false, true) + '</tr>';
        }).join('') + '</tbody></table>'
    : '';

  /* ===== 3. Ai làm gì: mỗi phòng một dòng, hai tỷ lệ đặt cạnh nhau =====
   * Gom phòng ưu tiên nhất và phòng theo dõi có chênh áp dưới ngưỡng vào một bảng,
   * vì trước đây hai danh sách nằm ở hai mục, nhiều phòng xuất hiện hai lần. */
  const SO_DONG_THU = 5;
  const dsA = cap.capA_tat_ca.slice(0, SO_DONG_THU);
  const conLai = cap.capA_tong - dsA.length;
  const k0TD = tdTD ? tdTD.ky[0].khoa : null;
  const phongTD = {};
  (tdTD ? tdTD.phong : []).forEach(function (p) { phongTD[p.ma] = p; });
  const dsUuTien = (tdTD ? tdTD.uu_tien : []).filter(function (p) {
    return !dsA.some(function (v) { return v.ma_phong === p.ma; });
  });
  const dsPhongGoc = d.tat_ca_phong || [];
  // Câu "Cơ điện kiểm cụm AHU02: lọc..." thành "Cơ điện: kiểm lọc..."; câu không theo mẫu giữ nguyên chữ.
  const chuViec = function (viec) {
    return String(viec).split(/\.\s+/).map(function (x) { return x.replace(/\.$/, '').trim(); }).filter(Boolean).map(function (x) {
      const m = x.match(/^(Cơ điện|IPC|QA|Trực hồ sơ lô|Trực)\s+(.+)$/);
      return m ? '<b style="color:' + M.dam + ';">' + esc(m[1]) + ':</b> ' + esc(m[2].replace(/^kiểm cụm [^:]+:\s*/, 'kiểm ')) : esc(x);
    }).join(' · ');
  };
  const dongViec = dsA.concat(dsUuTien.map(function (p) {
    const v = cap.capA_tat_ca.find(function (x) { return x.ma_phong === p.ma; });
    if (v) return v;
    const g = dsPhongGoc.find(function (x) { return x.ma_phong === p.ma; }) || {};
    return { ma_phong: p.ma, ten: p.ten, ahu: g.ahu, tuan_thu: g.ty_le_tuan_thu, gio_nghiem_trong: g.so_gio_critical, viec: [] };
  }));
  const daNeu = {};   // việc giống nhau chỉ ghi một lần, dòng sau trỏ về phòng đầu tiên
  const NGAN_HUONG = { '↓': '↓ thấp', '↑': '↑ cao', '↕': '↕ hai phía' };
  const khoiViec = dongViec.length
    ? BANG + '<thead><tr>' + thB('Phòng và việc cần làm', false, true) + thB('Toàn bộ chỉ tiêu', true) + thB('Chênh áp', true, false, true) + '</tr></thead><tbody>'
      + dongViec.map(function (v) {
          const chu = v.viec && v.viec[0] ? chuViec(v.viec[0]) : 'Cần ưu tiên kiểm tra.';
          const viecRa = daNeu[chu] ? 'Như ' + esc(daNeu[chu]) + '.' : chu;
          if (!daNeu[chu]) daNeu[chu] = v.ma_phong;
          const ptd = phongTD[v.ma_phong], cTD = ptd ? ptd.ky[k0TD] : null, h = cTD ? PTD.huong(cTD) : null;
          return '<tr>'
            + oB('<b>' + esc(v.ma_phong) + '</b> ' + esc(v.ten || '') + (v.ahu && v.ahu !== '—' ? ' · <span style="white-space:nowrap;">' + esc(v.ahu) + '</span>' : '')
              + (v.su_co_qua_han ? ' · <span style="color:' + M.doChu + ';white-space:nowrap;">sự cố mở ' + soVN(v.su_co_qua_han, 0) + ' giờ</span>' : '')
              + '<div style="color:' + M.muc2 + ';margin-top:' + K[1] + 'px;line-height:1.5;">' + viecRa + '</div>', false, false, null, true)
            + oB(v.tuan_thu == null ? '—' : phanTram(v.tuan_thu) + nhoMo(soVN(v.gio_nghiem_trong || 0, 0) + '&nbsp;giờ vượt'), true, true, mauTyLe(v.tuan_thu))
            + oB(cTD ? phanTram(cTD.v) + (h ? nhoMo(NGAN_HUONG[h.ky_hieu] || '') : '') : '—', true, !!cTD, cTD ? mauTyLe(cTD.v) : M.mo, false, true)
            + '</tr>';
        }).join('') + '</tbody></table>'
    : '';
  const dsNgoaiKy = cap.suCoNgoaiKy || [];
  const khoiNgoaiKy = dsNgoaiKy.length
    ? ghiChu('<b>' + dsNgoaiKy.length + ' sự cố mở sau ngày chốt kỳ, tính vào kỳ sau:</b> '
      + dsNgoaiKy.map(function (x) { return esc(x.phong) + ' (' + soVN(x.keo_dai_gio, 0) + '&nbsp;giờ)'; }).join(', ') + '.')
    : '';
  const pht = ((c.nhan_dinh || {}).phat_hien || []).filter(function (f) {
    return f && f.quan_sat && f.can_xac_minh && f.ai_lam
      // Nhận định chỉ nhắc lại tỷ lệ chung thì đã có ở Kết luận, bỏ để khỏi lặp.
      && String(chuAI(f.quan_sat)).indexOf(phanTram(k.ty_le_tuan_thu)) < 0;
  }).slice(0, 2);
  const khoiNhanDinh = pht.length
    ? '<div style="margin-top:' + K[5] + 'px;">' + tieuDeNho('Cần xác minh thêm (AI gợi ý, chưa kiểm chứng)')
      + pht.map(function (f) {
          return '<div style="font-size:' + CO.nho + 'px;color:' + M.muc2 + ';line-height:1.6;margin-top:' + K[2] + 'px;"><b style="color:' + M.muc + ';">' + esc(chuAI(f.tieu_de || 'Phát hiện')) + '.</b> '
            + esc(chuAI(f.quan_sat)) + '. <b>Xác minh:</b> ' + esc(chuAI(f.can_xac_minh)) + ' (' + esc(chuAI(f.ai_lam)) + (f.han ? ', hạn ' + esc(f.han) : '') + ').</div>';
        }).join('') + '</div>'
    : '';

  /* ===== 4. Bộ phận có phản hồi không ================================== */
  const sc = d.su_co || {};
  // dang_mo là sự cố đang mở LÚC LẬP BÁO CÁO: tách sự cố mở trong kỳ khỏi sự cố mở sau ngày chốt kỳ.
  const soMoTrongKy = Math.max(0, (sc.dang_mo || 0) - dsNgoaiKy.length);
  // Chia cho số ngày của kỳ (sự cố vẫn phát sinh ngày mất dữ liệu), không chia cho số ngày có số đo.
  const soNgayKy = (d.tu_ngay && d.den_ngay)
    ? Math.max(1, Math.round((Date.parse(String(d.den_ngay).slice(0, 10)) - Date.parse(String(d.tu_ngay).slice(0, 10))) / 86400000) + 1)
    : Math.max(1, k.so_ngay_co_du_lieu || 1);
  const khoiPhanHoi = PH.htmlThu(PH.tongHop(d));
  const khoiSuCo = sc.mo_trong_ky != null
    ? tieuDeNho('Sự cố trong kỳ') + BANG + '<tbody>'
      + [['Phát sinh', soVN(sc.mo_trong_ky, 0) + nhoMo(soVN(sc.mo_trong_ky / soNgayKy, 1) + ' sự cố mỗi ngày')],
         ['Đã đóng', soVN(sc.dong_trong_ky, 0)],
         ['Còn mở', soVN(soMoTrongKy, 0)],
         ['Khắc phục trung bình', soVN(sc.mttr_gio, 1) + '&nbsp;giờ']
      ].map(function (x) { return '<tr>' + oB(x[0], false, false, M.muc2, true) + oB(x[1], true, true, null, false, true) + '</tr>'; }).join('')
      + '</tbody></table>'
    : '';

  /* ===== 5. Xem thêm: định nghĩa đầy đủ nằm trong bản in =============== */
  const cachDoc = [
    ['Tỷ lệ đạt toàn bộ chỉ tiêu', 'phần thời gian số đo nằm trong giới hạn, gộp chênh áp, nhiệt độ và độ ẩm của mọi phòng.'],
    ['Tỷ lệ đạt chênh áp', 'tổng điểm đo đạt chia tổng điểm đo của cả nhóm, tính cả hai phía giới hạn; khác phạm vi nên không so trực tiếp với tỷ lệ trên.'],
    ['Phòng phải xử lý', 'phòng trúng quy tắc phân cấp cố định, không do AI quyết định; phòng chưa đạt chưa chắc phải xử lý. Quy tắc đầy đủ xem trong bản in.']
  ];
  const lienKet = function (url, chu) {
    return '<a href="' + esc(url) + '" style="color:' + M.dam + ';font-weight:700;">' + chu + '</a>';
  };
  const dsLienKet = ['<b>' + (c.co_pdf ? 'Bản in PDF' : 'Bản in') + ' đính kèm thư</b>: đủ phân tích từng chỉ tiêu, từng phòng và ô ký duyệt']
    .concat(c.link_dashboard ? [lienKet(c.link_dashboard, 'Bảng tra cứu') + ': lọc theo khu, cụm, xem từng ngày'] : [])
    .concat(c.link_drive ? [lienKet(c.link_drive, 'Thư mục lưu báo cáo')] : []);

  return nen('<!doctype html>\n<html lang="vi"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<meta name="color-scheme" content="light only">'
    + '<title>' + esc(c.tieu_de_email || ('Báo cáo ' + nhanKy)) + '</title>'
    /* Khối kiểu dáng CHỈ dùng cho ô bảng và màn hình hẹp; mọi thứ khác viết thẳng vào thẻ.
     * Lớp gốc khai TRƯỚC, lớp phụ khai SAU, nếu không .dp sẽ mất căn phải ở tiêu đề cột. */
    + '<style>'
    + '.d{padding:' + K[3] + 'px;border-bottom:1px solid ' + M.vien + ';font-size:' + CO.nho + 'px;vertical-align:top;line-height:1.45;}'
    + '.h{padding:' + K[2] + 'px ' + K[3] + 'px;color:' + M.muc2 + ';font-size:' + CO.nho + 'px;font-weight:600;text-align:left;vertical-align:bottom;border-bottom:1px solid ' + M.muc2 + ';}'
    + '.dl{padding-left:0;}.dr{padding-right:0;}.dp{text-align:right;}'
    + '@media only screen and (max-width:660px){'
    + '.cot{display:block !important;width:auto !important;padding:0 0 ' + K[5] + 'px !important;}'
    + '.pad{padding:' + K[5] + 'px ' + K[4] + 'px !important;}'
    + '.d,.h{padding-left:' + K[2] + 'px !important;padding-right:' + K[2] + 'px !important;}'
    + '.dl{padding-left:0 !important;}.dr{padding-right:0 !important;}}</style>'
    + '</head><body style="margin:0;padding:0;background:' + M.ngoai + ';">'

    + '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">'
    + (dat ? 'Đạt' : 'Chưa đạt') + ' · tỷ lệ đạt toàn bộ chỉ tiêu ' + phanTram(k.ty_le_tuan_thu) + ' · '
    + cap.capA_tong + ' phòng phải xử lý</div>'

    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:'
    + M.ngoai + ';"><tr><td align="center" class="ngoai" style="padding:' + K[5] + 'px ' + K[3] + 'px;">'
    /* Khung tối đa 987px (số Fibonacci, gần mức 1000px đã góp ý 04/09/2026 vì cột chữ bị bó trên máy tính). */
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"'
    + ' style="width:100%;max-width:987px;font-family:' + F + ';color:' + M.muc + ';">'

    + '<tr><td class="pad" style="background:' + M.dam + ';padding:' + LE_DOC + 'px ' + LE_NGANG + 'px;">'
    + '<div style="font-size:' + CO.muc + 'px;line-height:1.3;color:#ffffff;font-weight:700;">Báo cáo môi trường phòng sạch</div>'
    + '<div style="font-size:' + CO.nho + 'px;color:#DCE4EE;margin-top:' + K[2] + 'px;line-height:1.5;">' + esc(nhanKy) + ' · '
    + ngayDai(d.tu_ngay) + ' – ' + ngayDai(d.den_ngay) + ' · ' + esc(khuBC ? 'Khu ' + khuBC : 'Toàn nhà máy') + '</div></td></tr>'

    + hang(tieuDeMuc('1. Kết luận') + khoiKetLuan)

    + hang(tieuDeMuc('2. Ở đâu kém')
        + haiCot(khoiBangKhu, khoiCum)
        + '<div style="margin-top:' + K[5] + 'px;">' + haiCot(PTD.htmlThuGon(tdTD), khoiMaTran) + '</div>')

    + hang(tieuDeMuc('3. Ai làm gì')
        + (dongViec.length
            ? '<div style="font-size:' + CO.than + 'px;line-height:1.6;color:' + M.muc + ';margin-bottom:' + K[3] + 'px;"><b>' + cap.capA_tong + ' phòng phải xử lý.</b> Bảng dưới có '
              + dsA.length + ' phòng ưu tiên nhất' + (dsUuTien.length ? ' và ' + dsUuTien.length + ' phòng theo dõi khác có chênh áp dưới ' + ttTD.nguong_uu_tien + '%' : '')
              + (conLai > 0 ? '; các phòng còn lại trong bản in.' : '.') + '</div>' + khoiViec
            : '<div style="font-size:' + CO.than + 'px;line-height:1.6;color:' + M.muc + ';">Kỳ này không có phòng nào phải xử lý ngay.</div>')
        + khoiNgoaiKy + khoiNhanDinh)

    + ((khoiPhanHoi || khoiSuCo) ? hang(tieuDeMuc('4. Bộ phận có phản hồi không') + haiCot(khoiPhanHoi, khoiSuCo)) : '')

    + '<tr><td class="pad" style="background:' + M.nen + ';border:1px solid ' + M.vien + ';padding:' + LE_DOC + 'px ' + LE_NGANG + 'px;">'
    + tieuDeMuc('5. Xem thêm')
    + dsLienKet.map(function (x) { return '<div style="font-size:' + CO.nho + 'px;color:' + M.muc2 + ';line-height:1.6;">' + x + '</div>'; }).join('')
    + cachDoc.map(function (x) { return ghiChu('<b>' + x[0] + ':</b> ' + x[1]); }).join('')
    + '<div style="font-size:' + CO.nho + 'px;color:' + M.mo + ';line-height:1.6;margin-top:' + K[4] + 'px;">Lập ngày ' + esc(c.tao_luc || ngayDai(d.tao_luc))
    + ' · ' + (k.so_ngay_co_du_lieu || 0) + ' ngày có số đo · mã lần chạy ' + esc(c.ma_lan_chay || '—')
    + '. Thư tự động, vui lòng không trả lời.</div></td></tr>'

    + '</table></td></tr></table></body></html>');
}

function rapEmailGoc(d, duBao, cfg) { return rapEmail(d, duBao, cfg); }

/* Gmail cắt thư vượt quá cỡ rồi hiện dòng "Message clipped" kèm liên kết xem
 * tiếp — người đọc mất hẳn phần cuối. Ngưỡng trên máy tính khoảng 102 KB, trên
 * ứng dụng di động thấp hơn nhiều và không nhất quán. Thư này viết kiểu dáng
 * thẳng vào từng thẻ nên phình rất nhanh, vì vậy nén lại trước khi trả về:
 * bỏ khoảng trắng giữa các thẻ và trong thuộc tính kiểu dáng. Không đụng tới
 * chữ mà người đọc nhìn thấy. */
function nen(h) {
  return h
    .replace(/>\s+</g, '><')                    // khoảng trắng giữa hai thẻ
    .replace(/style="([^"]*)"/g, function (m, v) {
      return 'style="' + v.replace(/\s*;\s*/g, ';').replace(/:\s+/g, ':').trim() + '"';
    })
    .replace(/\s{2,}/g, ' ');                    // khoảng trắng lặp còn sót
}

module.exports = { rapEmail: rapEmail };
