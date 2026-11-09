// phan-tich-dieu-kien-phong.test.mjs — Phân tích tự động của Báo cáo điều kiện phòng (09/11/2026).
// Dữ liệu GIẢ LẬP (repo public — không đưa số liệu thật), dựng theo các tình huống đã gặp thật:
// độ ẩm đứng ~83 % cả ngày, chênh áp âm, chênh áp nhảy bậc, cảm biến chạm trần thang đo.
import test from "node:test";
import assert from "node:assert/strict";
import { phanTichPhong, phatHien, tomTatChiTieu } from "../src/lib/phanTichDieuKienPhong.js";

const GH = { T: [18, 26], RH: [45, 65], DP: [7.5, 17.5] };
// tạo 24 dòng giờ ngày 2026-10-28 cho 1 chỉ tiêu; f(h) → { tb, min?, max?, p50?, sd?, oosThap?, oosCao? }
function ngay(loai, f, { ngayStr = "2026-10-28", soGio = 24 } = {}) {
  const [duoi, tren] = GH[loai];
  return Array.from({ length: soGio }, (_, h) => {
    const v = f(h);
    const tb = v.tb;
    const oosThap = v.oosThap ?? (tb < duoi ? 60 : 0);
    const oosCao = v.oosCao ?? (tb > tren ? 60 : 0);
    const gio = `${String(h).padStart(2, "0")}:00`;
    return {
      loai, ngay: ngayStr, gio, ts: Date.parse(`${ngayStr}T${gio}:00Z`), duoi, tren, tong: 60, hop_le: 60,
      tb, min: v.min ?? tb - 1, max: v.max ?? tb + 1, p5: tb - 0.8, p50: v.p50 ?? tb, p95: tb + 0.8, sd: v.sd ?? 0.4,
      oos: oosThap + oosCao, oos_thap: oosThap, oos_cao: oosCao, lien_tuc_phut: oosThap + oosCao ? 60 : 0,
      muc: "NORMAL", dung_hinh: false,
    };
  });
}
const PHAM_VI = { khu: "C1,C4,Q2", muc: "P1,P2", loai: "DP", huong: '{"T": {"su_co": "CA_HAI"}, "DP": {"su_co": "DUOI"}, "RH": {"su_co": "CA_HAI"}}' };
const baoCao = (gio, phong = {}) => ({
  tu: "2026-10-28", den: "2026-10-28",
  phong: { ma_phong: "C1.RX", ten_phong: "Phòng thử", khu_vuc: "C1", ahu: "AHU X", cap_phong_sach: "C", muc_uu_tien: "P2", canh_bao_bat_buoc: false, ...phong },
  cam_bien: ["DP", "RH", "T"].map((loai) => ({ loai, duoi: GH[loai][0], tren: GH[loai][1], han_hieu_chuan: null })),
  gio, su_co: [], pham_vi_canh_bao: PHAM_VI,
});
const ma = (ds) => ds.map((x) => x.ma);

test("độ ẩm đứng 83 % cả ngày → không đạt 100 %, chuỗi lệch 24 giờ", () => {
  const rh = ngay("RH", () => ({ tb: 83 }));
  const tt = tomTatChiTieu(rh);
  assert.equal(tt.ketQua, "KHONG_DAT");
  assert.equal(tt.oos, 1440); assert.equal(tt.oosCao, 1440); assert.equal(tt.oosThap, 0);
  assert.equal(tt.oosPct, 100); assert.equal(tt.gioDat, 0); assert.equal(tt.tb, 83);
  const ph = phatHien(rh, tt);
  const chuoi = ph.find((x) => x.ma === "CHUOI_DAI_NHAT");
  assert.ok(chuoi && /1\.440 phút|24 giờ/.test(chuoi.text), chuoi?.text);
});

test("nhiệt độ trong giới hạn → đạt, không có phát hiện mức cao", () => {
  const t = ngay("T", (h) => ({ tb: 21 + (h % 3) * 0.3 }));
  const tt = tomTatChiTieu(t);
  assert.equal(tt.ketQua, "DAT");
  assert.equal(tt.gioDat, 24);
  assert.ok(!phatHien(t, tt).some((x) => x.muc === "cao"));
});

test("chênh áp âm → AM_AP, toàn bộ lệch chiều thấp", () => {
  const dp = ngay("DP", () => ({ tb: -9 }));
  const tt = tomTatChiTieu(dp);
  assert.equal(tt.oosThap, 1440);
  assert.ok(ma(phatHien(dp, tt)).includes("AM_AP"));
});

test("chênh áp nhảy bậc 12 → 40 Pa lúc 16:00 → BUOC_NHAY", () => {
  const dp = ngay("DP", (h) => ({ tb: h < 16 ? 12 : 40 }));
  const b = phatHien(dp, tomTatChiTieu(dp)).find((x) => x.ma === "BUOC_NHAY");
  assert.ok(b, "phải phát hiện bước nhảy");
  assert.match(b.text, /16:00/);
});

test("giá trị đứng ở trần 50,18 Pa nhiều giờ → CHAM_THANG_DO", () => {
  const dp = ngay("DP", (h) => (h >= 3 && h <= 5 ? { tb: 49.9, max: 50.18, p50: 50.18 } : { tb: 40, max: 44 }));
  assert.ok(ma(phatHien(dp, tomTatChiTieu(dp))).includes("CHAM_THANG_DO"));
});

test("cảm biến báo cố định (độ lệch chuẩn ≈ 0 nhiều giờ liền) → BAO_CO_DINH", () => {
  const rh = ngay("RH", () => ({ tb: 99.97, sd: 0.005, min: 99.95, max: 99.98 }));
  assert.ok(ma(phatHien(rh, tomTatChiTieu(rh))).includes("BAO_CO_DINH"));
});

test("không có dòng nào → KHONG_CO_DL", () => {
  assert.equal(tomTatChiTieu([]).ketQua, "KHONG_CO_DL");
});

test("phân tích phòng: kết luận chung + lý do không có sự cố (ngoài phạm vi cảnh báo)", () => {
  const gio = [
    ...ngay("DP", () => ({ tb: 38 })),        // lệch CAO — cảnh báo DP chỉ chiều dưới
    ...ngay("RH", () => ({ tb: 83 })),        // RH không trong loại cảnh báo
    ...ngay("T", () => ({ tb: 21.5 })),
  ];
  const kq = phanTichPhong(baoCao(gio));
  assert.equal(kq.ketLuan, "KHONG_DAT");
  assert.equal(kq.tomTat.T.ketQua, "DAT");
  const dp = kq.ngoaiPhamVi.find((x) => x.loai === "DP");
  const rh = kq.ngoaiPhamVi.find((x) => x.loai === "RH");
  assert.ok(dp && dp.lyDo.some((s) => /chiều dưới/.test(s)), JSON.stringify(dp));
  assert.ok(rh && rh.lyDo.some((s) => /chỉ DP/.test(s)), JSON.stringify(rh));
  // phòng P3 không bắt buộc → nêu lý do mức ưu tiên
  const p3 = phanTichPhong(baoCao(gio, { muc_uu_tien: "P3" }));
  assert.ok(p3.ngoaiPhamVi.find((x) => x.loai === "DP").lyDo.some((s) => /P3/.test(s)));
});

test("phân tích phòng: độ đầy đủ dữ liệu theo số giờ mong đợi", () => {
  const gio = [...ngay("DP", () => ({ tb: 12 }), { soGio: 20 }), ...ngay("RH", () => ({ tb: 55 })), ...ngay("T", () => ({ tb: 22 }))];
  const kq = phanTichPhong(baoCao(gio), { soGioMongDoi: 24 });
  assert.ok(kq.phatHien.DP.some((x) => x.ma === "THIEU_DU_LIEU" && /20\/24/.test(x.text)));
  assert.equal(kq.ketLuan, "DAT");
});
