// khoang-thoi-gian.test.mjs — Bộ chọn khoảng thời gian trang Xu hướng (09/11/2026).
// Lỗi gốc: chỉ xem được "N điểm gần nhất" → không xem được một ngày cũ theo giờ (vd 28/10).
import test from "node:test";
import assert from "node:assert/strict";
import { NUT_NHANH, dichKy, homNayVN, hopLe, khoangTuNutNhanh, nhanKhoang, soNgay, thamSoTai, tuRangeCu } from "../src/lib/khoangThoiGian.js";

const HN = "2026-11-09";

test("nút nhanh ra đúng khoảng (hôm nay 09/11/2026)", () => {
  assert.deepEqual(khoangTuNutNhanh("homnay", HN), { tu: "2026-11-09", den: "2026-11-09" });
  assert.deepEqual(khoangTuNutNhanh("homqua", HN), { tu: "2026-11-08", den: "2026-11-08" });
  assert.deepEqual(khoangTuNutNhanh("7n", HN), { tu: "2026-11-03", den: "2026-11-09" });
  assert.deepEqual(khoangTuNutNhanh("30n", HN), { tu: "2026-10-11", den: "2026-11-09" });
  assert.deepEqual(khoangTuNutNhanh("thangnay", HN), { tu: "2026-11-01", den: "2026-11-09" });
  assert.deepEqual(khoangTuNutNhanh("thangtruoc", HN), { tu: "2026-10-01", den: "2026-10-31" });
  assert.deepEqual(khoangTuNutNhanh("thangtruoc", "2026-03-15"), { tu: "2026-02-01", den: "2026-02-28" });
  assert.deepEqual(khoangTuNutNhanh("thangtruoc", "2027-01-05"), { tu: "2026-12-01", den: "2026-12-31" });
  assert.equal(soNgay(khoangTuNutNhanh("180n", HN)), 180);
  assert.equal(NUT_NHANH.length, 8);
});

test("số ngày tính cả hai đầu, qua năm nhuận", () => {
  assert.equal(soNgay({ tu: "2026-10-28", den: "2026-10-28" }), 1);
  assert.equal(soNgay({ tu: "2028-02-28", den: "2028-03-01" }), 3);
});

test("tham số tải: ≤ 7 ngày theo giờ, dài hơn theo ngày; đến hôm nay thì pDen = null (hành vi cũ)", () => {
  assert.deepEqual(thamSoTai({ tu: "2026-10-28", den: "2026-10-28" }, HN), { donVi: "GIO", soDiem: 24, pDen: "2026-10-28" });
  assert.deepEqual(thamSoTai(khoangTuNutNhanh("7n", HN), HN), { donVi: "GIO", soDiem: 168, pDen: null });
  assert.deepEqual(thamSoTai(khoangTuNutNhanh("30n", HN), HN), { donVi: "NGAY", soDiem: 30, pDen: null });
  assert.deepEqual(thamSoTai(khoangTuNutNhanh("thangtruoc", HN), HN), { donVi: "NGAY", soDiem: 31, pDen: "2026-10-31" });
});

test("lùi/tiến một kỳ cùng độ dài, không vượt hôm nay", () => {
  assert.deepEqual(dichKy({ tu: "2026-10-28", den: "2026-10-28" }, 1, HN), { tu: "2026-10-29", den: "2026-10-29" });
  assert.deepEqual(dichKy({ tu: "2026-10-28", den: "2026-10-28" }, -1, HN), { tu: "2026-10-27", den: "2026-10-27" });
  assert.deepEqual(dichKy({ tu: "2026-11-03", den: "2026-11-09" }, -1, HN), { tu: "2026-10-27", den: "2026-11-02" });
  assert.deepEqual(dichKy({ tu: "2026-11-03", den: "2026-11-09" }, 1, HN), { tu: "2026-11-03", den: "2026-11-09" });
  assert.deepEqual(dichKy({ tu: "2026-11-01", den: "2026-11-07" }, 1, HN), { tu: "2026-11-03", den: "2026-11-09" });
});

test("kiểm hợp lệ", () => {
  assert.equal(hopLe({ tu: "2026-10-28", den: "2026-10-28" }, HN), "");
  assert.notEqual(hopLe({ tu: "2026-10-29", den: "2026-10-28" }, HN), "");
  assert.notEqual(hopLe({ tu: "2026-11-01", den: "2026-11-10" }, HN), "");
  assert.notEqual(hopLe({ tu: "", den: "2026-11-01" }, HN), "");
  assert.notEqual(hopLe({ tu: "2026-02-30", den: "2026-03-01" }, HN), "");
  assert.notEqual(hopLe({ tu: "2025-01-01", den: "2026-11-09" }, HN), "", "quá 366 ngày");
});

test("nhãn khoảng", () => {
  assert.equal(nhanKhoang({ tu: "2026-10-28", den: "2026-10-28" }), "28/10/2026");
  assert.equal(nhanKhoang({ tu: "2026-10-21", den: "2026-10-28" }), "21/10 – 28/10/2026");
  assert.equal(nhanKhoang({ tu: "2025-12-30", den: "2026-01-02" }), "30/12/2025 – 02/01/2026");
});

test("hôm nay theo giờ Việt Nam và chuyển lựa chọn cũ", () => {
  assert.equal(homNayVN(new Date("2026-11-08T17:30:00Z")), "2026-11-09");
  assert.equal(homNayVN(new Date("2026-11-08T16:59:00Z")), "2026-11-08");
  assert.deepEqual(tuRangeCu("1n", HN), { nut: "homnay", ...khoangTuNutNhanh("homnay", HN) });
  assert.deepEqual(tuRangeCu("90n", HN), { nut: "90n", ...khoangTuNutNhanh("90n", HN) });
  assert.deepEqual(tuRangeCu("la", HN), { nut: "30n", ...khoangTuNutNhanh("30n", HN) });
});
