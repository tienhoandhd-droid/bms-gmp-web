// bao-cao-phong-html.test.mjs — Tài liệu HTML Báo cáo điều kiện phòng (09/11/2026). Dữ liệu giả lập.
import test from "node:test";
import assert from "node:assert/strict";
import { phanTichPhong } from "../src/lib/phanTichDieuKienPhong.js";
import { taoHtmlBaoCaoPhong, tenFileBaoCaoPhong } from "../src/lib/baoCaoPhongHtml.js";

const GH = { T: [18, 26], RH: [45, 65], DP: [7.5, 17.5] };
const dong = (loai, ngay, h, tb) => {
  const [duoi, tren] = GH[loai];
  const oosCao = tb > tren ? 60 : 0, oosThap = tb < duoi ? 60 : 0;
  const gio = `${String(h).padStart(2, "0")}:00`;
  return { loai, ngay, gio, ts: Date.parse(`${ngay}T${gio}:00Z`), duoi, tren, tong: 60, hop_le: 60, tb, min: tb - 1, max: tb + 1,
    p5: tb - 0.5, p50: tb, p95: tb + 0.5, sd: 0.3, oos: oosCao + oosThap, oos_thap: oosThap, oos_cao: oosCao, lien_tuc_phut: oosCao + oosThap ? 60 : 0, muc: "NORMAL", dung_hinh: false };
};
const duLieu = (ngays, giaTri, phong = {}) => ({
  tu: ngays[0], den: ngays[ngays.length - 1],
  phong: { ma_phong: "C1.RX", ten_phong: "Cân <b>thử</b>", khu_vuc: "C1", ahu: "AHU X", cap_phong_sach: "C", muc_uu_tien: "P2", canh_bao_bat_buoc: false, ...phong },
  cam_bien: ["DP", "RH", "T"].map((loai) => ({ loai, duoi: GH[loai][0], tren: GH[loai][1], han_hieu_chuan: null })),
  gio: ngays.flatMap((n) => ["DP", "RH", "T"].flatMap((l) => Array.from({ length: 24 }, (_, h) => dong(l, n, h, giaTri[l])))),
  su_co: [], pham_vi_canh_bao: { khu: "C1", muc: "P1,P2", loai: "DP", huong: '{"DP": {"su_co": "DUOI"}}' },
});

test("1 ngày, có chỉ tiêu không đạt: không có <script>, escape tên phòng, 3 biểu đồ, không có mục xu hướng ngày", () => {
  const du = duLieu(["2026-10-28"], { DP: 38, RH: 83, T: 21.5 });
  const html = taoHtmlBaoCaoPhong(du, phanTichPhong(du), { lapLuc: new Date("2026-11-09T02:00:00Z") });
  assert.ok(!/<script/i.test(html));
  assert.ok(html.includes("Cân &lt;b&gt;thử&lt;/b&gt;") && !html.includes("Cân <b>thử</b>"));
  assert.equal((html.match(/<svg /g) || []).length, 3);
  assert.match(html, /Không đạt/);
  assert.ok(!html.includes("Xu hướng theo ngày"));
  assert.match(html, /28\/10\/2026/);
  assert.match(html, /chưa nhập/);
  assert.match(html, /chiều TRÊN không được báo/);
});

test("nhiều ngày: có mục xu hướng theo ngày, tên file đúng mẫu", () => {
  const du = duLieu(["2026-10-27", "2026-10-28"], { DP: 12, RH: 55, T: 22 });
  const html = taoHtmlBaoCaoPhong(du, phanTichPhong(du));
  assert.match(html, /Xu hướng theo ngày/);
  assert.match(html, /27\/10\/2026 – 28\/10\/2026/);
  assert.ok(!/class="tile bad"/.test(html), "mọi chỉ tiêu đạt → không có thẻ đỏ");
  assert.equal(tenFileBaoCaoPhong(du), "Bao-cao-dieu-kien-phong-C1.RX-2026-10-27_2026-10-28.html");
});
