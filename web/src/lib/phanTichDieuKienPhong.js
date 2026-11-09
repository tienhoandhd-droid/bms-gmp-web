// phanTichDieuKienPhong.js — Phân tích tự động cho Báo cáo điều kiện phòng (09/11/2026).
// Đầu vào: kết quả RPC rpc_bao_cao_dieu_kien_phong (mỗi dòng 'gio' = tổng hợp 60 điểm/phút của 1 giờ).
// Nguyên tắc: CHỈ nêu sự thật đo được từ số liệu, KHÔNG đoán nguyên nhân (giống thư báo cáo tuần).

export const TEN_CHI_TIEU = { T: "Nhiệt độ", RH: "Độ ẩm tương đối", DP: "Chênh áp" };
export const DON_VI = { T: "°C", RH: "%", DP: "Pa" };
export const THU_TU = ["T", "RH", "DP"];

const GIO_MS = 3600000;
const NGUONG_BUOC_NHAY = 0.5;   // chênh TB 3 giờ trước/sau > 50 % dải giới hạn
const SO_BUOC_NHAY_TOI_DA = 3;
const SD_CO_DINH = 0.02;        // độ lệch chuẩn trong giờ coi như "không đổi"
const SO_GIO_CO_DINH = 6;
const SAI_SO_TRAN = 0.05;       // dung sai so sánh với giá trị trần/sàn

export const so = (x, n = 2) => (x == null || Number.isNaN(+x) ? "—" : (+x).toLocaleString("vi-VN", { minimumFractionDigits: n, maximumFractionDigits: n }));
const nguyen = (x) => (+x).toLocaleString("vi-VN");
const num = (x) => (x == null ? null : +x);
const nhanGio = (r, nhieuNgay) => (nhieuNgay ? `${r.ngay.slice(8, 10)}/${r.ngay.slice(5, 7)} ${r.gio}` : r.gio);

export function tomTatChiTieu(dong) {
  const co = dong.filter((r) => num(r.hop_le) > 0 && r.tb != null);
  const dau = dong[0] || {};
  const base = { loai: dau.loai, duoi: num(dau.duoi), tren: num(dau.tren), soGio: dong.length };
  if (!co.length) return { ...base, tong: 0, hopLe: 0, tb: null, min: null, max: null, oos: 0, oosThap: 0, oosCao: 0, oosPct: 0, gioDat: 0, ketQua: "KHONG_CO_DL" };
  const hopLe = co.reduce((a, r) => a + num(r.hop_le), 0);
  const oosThap = co.reduce((a, r) => a + (num(r.oos_thap) || 0), 0);
  const oosCao = co.reduce((a, r) => a + (num(r.oos_cao) || 0), 0);
  const oos = co.reduce((a, r) => a + (num(r.oos) || 0), 0);
  return {
    ...base,
    tong: dong.reduce((a, r) => a + (num(r.tong) || 0), 0),
    hopLe,
    tb: Math.round((co.reduce((a, r) => a + num(r.tb) * num(r.hop_le), 0) / hopLe) * 100) / 100,
    min: Math.min(...co.map((r) => num(r.min))),
    max: Math.max(...co.map((r) => num(r.max))),
    oos, oosThap, oosCao,
    oosPct: Math.round((1000 * oos) / hopLe) / 10,
    gioDat: co.filter((r) => !num(r.oos)).length,
    ketQua: oos > 0 ? "KHONG_DAT" : "DAT",
  };
}

const tbDoan = (a) => a.reduce((s, r) => s + num(r.tb), 0) / a.length;

export function phatHien(dong, tt, { soGioMongDoi = null } = {}) {
  const ra = [];
  const co = dong.filter((r) => num(r.hop_le) > 0 && r.tb != null);
  const dv = DON_VI[tt.loai] || "";
  const nhieuNgay = new Set(dong.map((r) => r.ngay)).size > 1;
  const dai = tt.tren != null && tt.duoi != null ? tt.tren - tt.duoi : null;

  if (soGioMongDoi && dong.length < soGioMongDoi) {
    ra.push({ ma: "THIEU_DU_LIEU", muc: "vua", text: `Thiếu dữ liệu: ${dong.length}/${soGioMongDoi} giờ có số liệu.` });
  } else if (tt.tong > tt.hopLe) {
    ra.push({ ma: "THIEU_DU_LIEU", muc: "vua", text: `Thiếu điểm đo: ${nguyen(tt.hopLe)}/${nguyen(tt.tong)} điểm hợp lệ.` });
  }
  if (!co.length) return ra;

  if (tt.oos > 0) {
    const huong = tt.oosCao && tt.oosThap ? `cao ${nguyen(tt.oosCao)}, thấp ${nguyen(tt.oosThap)} điểm`
      : tt.oosCao ? "toàn bộ vượt giới hạn TRÊN" : "toàn bộ dưới giới hạn DƯỚI";
    ra.push({ ma: "NGOAI_GIOI_HAN", muc: "cao", text: `${nguyen(tt.oos)}/${nguyen(tt.hopLe)} điểm (${so(tt.oosPct, 1)} %) ngoài giới hạn ${so(tt.duoi, 1)}–${so(tt.tren, 1)} ${dv} — ${huong}.` });
    const xau = [...co].sort((a, b) => num(b.oos) - num(a.oos) || Math.abs(num(b.tb) - (tt.duoi + tt.tren) / 2) - Math.abs(num(a.tb) - (tt.duoi + tt.tren) / 2))[0];
    ra.push({ ma: "GIO_XAU_NHAT", muc: "thong_tin", text: `Giờ lệch nhiều nhất: ${nhanGio(xau, nhieuNgay)} — ${xau.oos}/${xau.hop_le} điểm ngoài giới hạn, TB ${so(xau.tb)} ${dv} (min ${so(xau.min)}, max ${so(xau.max)}).` });
    // Chuỗi giờ liền kề lệch TOÀN BỘ 60/60 điểm
    let tot = { dai: 0 }, cur = null;
    co.forEach((r, i) => {
      const full = num(r.oos) >= num(r.hop_le);
      const lien = i > 0 && num(r.ts) - num(co[i - 1].ts) === GIO_MS;
      if (full) { cur = cur && lien ? { ...cur, cuoi: r, dai: cur.dai + 1 } : { dau: r, cuoi: r, dai: 1 }; if (cur.dai > tot.dai) tot = cur; }
      else cur = null;
    });
    const phutTrongGio = Math.max(...co.map((r) => num(r.lien_tuc_phut) || 0));
    if (tot.dai >= 1) {
      ra.push({ ma: "CHUOI_DAI_NHAT", muc: tot.dai >= 3 ? "cao" : "vua", text: `Lệch liên tục dài nhất: ${tot.dai} giờ (${nguyen(tot.dai * 60)} phút), từ ${nhanGio(tot.dau, nhieuNgay)} đến hết ${nhanGio(tot.cuoi, nhieuNgay)}.` });
    } else if (phutTrongGio > 0) {
      ra.push({ ma: "CHUOI_DAI_NHAT", muc: "vua", text: `Lệch liên tục dài nhất: ${so(phutTrongGio, 0)} phút (trong một giờ).` });
    }
  }

  if (tt.loai === "DP" && tt.tb < 0) {
    ra.push({ ma: "AM_AP", muc: "cao", text: `Chênh áp trung bình ÂM (${so(tt.tb)} Pa): áp suất phòng thấp hơn khu vực tham chiếu của cảm biến.` });
  }

  // Bước nhảy: TB 3 giờ trước và 3 giờ sau một mốc chênh > 50 % dải giới hạn (lấy tối đa 3 lần lớn nhất)
  if (dai && co.length >= 6) {
    const ung = [];
    for (let i = 3; i <= co.length - 3; i++) {
      const truoc = co.slice(i - 3, i), sau = co.slice(i, i + 3);
      if (num(sau[0].ts) - num(truoc[2].ts) !== GIO_MS) continue;
      const d = tbDoan(sau) - tbDoan(truoc);
      if (Math.abs(d) > NGUONG_BUOC_NHAY * dai) ung.push({ i, d, tu: tbDoan(truoc), den: tbDoan(sau) });
    }
    const chon = [];
    [...ung].sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).forEach((u) => {
      if (chon.length < SO_BUOC_NHAY_TOI_DA && !chon.some((c) => Math.abs(c.i - u.i) < 3)) chon.push(u);
    });
    chon.sort((a, b) => a.i - b.i).forEach((u) => ra.push({
      ma: "BUOC_NHAY", muc: "vua",
      text: `Thay đổi đột ngột lúc ${nhanGio(co[u.i], nhieuNgay)}: TB 3 giờ trước ${so(u.tu)} → 3 giờ sau ${so(u.den)} ${dv} (${u.d > 0 ? "+" : ""}${so(u.d)}).`,
    }));
  }

  // Nghi chạm thang đo: ≥ 2 giờ có trung vị bằng giá trị cực đại (hoặc cực tiểu) chung của cả khoảng
  const tran = Math.max(...co.map((r) => num(r.max)));
  const san = Math.min(...co.map((r) => num(r.min)));
  const gioTran = co.filter((r) => r.p50 != null && Math.abs(num(r.max) - tran) <= SAI_SO_TRAN && Math.abs(num(r.p50) - num(r.max)) <= SAI_SO_TRAN);
  const gioSan = co.filter((r) => r.p50 != null && Math.abs(num(r.min) - san) <= SAI_SO_TRAN && Math.abs(num(r.p50) - num(r.min)) <= SAI_SO_TRAN);
  [[gioTran, tran, "trần"], [gioSan, san, "sàn"]].forEach(([g, v, ten]) => {
    if (g.length >= 2) {
      ra.push({ ma: "CHAM_THANG_DO", muc: "vua", text: `Nghi chạm ${ten} thang đo: ${g.length} giờ có nửa số điểm trở lên đứng đúng ${so(v)} ${dv} (vd ${nhanGio(g[0], nhieuNgay)}) — giá trị thực có thể vượt mức này.` });
    }
  });

  // Cảm biến báo cố định: độ lệch chuẩn trong giờ ≈ 0 liên tiếp ≥ 6 giờ
  let chay = 0, chayMax = 0, dauChay = null, dauMax = null;
  co.forEach((r, i) => {
    const phang = (r.sd != null && num(r.sd) <= SD_CO_DINH) || r.dung_hinh === true;
    const lien = i > 0 && num(r.ts) - num(co[i - 1].ts) === GIO_MS;
    if (phang) { if (chay && lien) chay += 1; else { chay = 1; dauChay = r; } if (chay > chayMax) { chayMax = chay; dauMax = dauChay; } }
    else chay = 0;
  });
  if (chayMax >= SO_GIO_CO_DINH) {
    ra.push({ ma: "BAO_CO_DINH", muc: "cao", text: `Cảm biến báo gần như không đổi ${chayMax} giờ liên tiếp từ ${nhanGio(dauMax, nhieuNgay)} (độ lệch chuẩn ≤ ${so(SD_CO_DINH)}) — cần kiểm tra cảm biến trước khi dùng số liệu.` });
  }
  return ra;
}

function lyDoNgoaiPhamVi(loai, tt, phong, pv) {
  const ly = [];
  const ds = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (phong && !ds(pv.khu).includes(phong.khu_vuc)) ly.push(`Khu ${phong.khu_vuc} không thuộc phạm vi cảnh báo (chỉ ${pv.khu || "—"}).`);
  if (phong && !ds(pv.muc).includes(phong.muc_uu_tien) && !phong.canh_bao_bat_buoc) ly.push(`Phòng mức ưu tiên ${phong.muc_uu_tien} không thuộc phạm vi cảnh báo (chỉ ${pv.muc || "—"}).`);
  if (!ds(pv.loai).includes(loai)) ly.push(`Chỉ tiêu ${loai} không được cấu hình cảnh báo (chỉ ${pv.loai || "—"}).`);
  else {
    let huong = null;
    try { huong = JSON.parse(pv.huong || "{}")?.[loai]?.su_co || null; } catch (e) { console.error("[BMS] canh_bao_huong không phải JSON:", e); }
    if (huong === "DUOI" && tt.oosCao > 0) ly.push(`Cảnh báo ${loai} chỉ theo chiều dưới: ${nguyen(tt.oosCao)} điểm lệch chiều TRÊN không được báo.`);
    if (huong === "TREN" && tt.oosThap > 0) ly.push(`Cảnh báo ${loai} chỉ theo chiều trên: ${nguyen(tt.oosThap)} điểm lệch chiều DƯỚI không được báo.`);
  }
  if (!ly.length) ly.push("Không có sự cố nào được mở trong khoảng này.");
  return ly;
}

export function phanTichPhong(du, { soGioMongDoi = null } = {}) {
  const gio = du?.gio || [];
  const tomTat = {}, ph = {};
  THU_TU.forEach((loai) => {
    const dong = gio.filter((r) => r.loai === loai);
    const tt = tomTatChiTieu(dong);
    const cb = (du?.cam_bien || []).find((c) => c.loai === loai);
    if (tt.duoi == null && cb) { tt.duoi = num(cb.duoi); tt.tren = num(cb.tren); }
    tt.loai = loai;
    tomTat[loai] = tt;
    ph[loai] = phatHien(dong, tt, { soGioMongDoi });
  });
  const kq = THU_TU.map((l) => tomTat[l].ketQua);
  const ketLuan = kq.includes("KHONG_DAT") ? "KHONG_DAT" : kq.every((k) => k === "KHONG_CO_DL") ? "KHONG_CO_DL" : kq.includes("KHONG_CO_DL") ? "CHUA_DU_DL" : "DAT";
  const suCo = du?.su_co || [];
  const ngoaiPhamVi = THU_TU
    .filter((l) => tomTat[l].ketQua === "KHONG_DAT" && !suCo.some((s) => s.loai === l))
    .map((l) => ({ loai: l, lyDo: lyDoNgoaiPhamVi(l, tomTat[l], du?.phong, du?.pham_vi_canh_bao || {}) }));
  return { tomTat, phatHien: ph, ketLuan, suCo, ngoaiPhamVi };
}
