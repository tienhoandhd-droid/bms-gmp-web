// tim-kiem-chung.test.mjs — Ô tìm chung ở đầu trang (09/11/2026). Dữ liệu giả lập.
import test from "node:test";
import assert from "node:assert/strict";
import { gonChu, timKiemChung } from "../src/lib/timKiemChung.js";

const NGUON = {
  trang: [{ k: "trend", label: "Xu hướng" }, { k: "events", label: "Sự cố" }, { k: "home", label: "Tổng quan" }],
  phong: [
    { id: "C1.R21", name: "Phòng cân", area: "C1", ahu: "AHU 1" },
    { id: "C1.R2", name: "Hành lang", area: "C1", ahu: "AHU 1" },
    { id: "C4.R10", name: "Đóng gói", area: "C4", ahu: "AHU 3" },
  ],
  suCo: [
    { id: "SC-101", room: "C1.R21", sensor: "Chênh áp", status: "Mở" },
    { id: "SC-102", room: "C4.R10", sensor: "Độ ẩm", status: "Đã đóng" },
  ],
};

test("gonChu: bỏ dấu, đ→d, bỏ dấu chấm/khoảng trắng, chữ thường", () => {
  assert.equal(gonChu("C1.R21"), "c1r21");
  assert.equal(gonChu("Đóng gói"), "donggoi");
  assert.equal(gonChu("  Xu Hướng "), "xuhuong");
});

test("ô trống → không có kết quả", () => {
  assert.deepEqual(timKiemChung("", NGUON), []);
  assert.deepEqual(timKiemChung("   ", NGUON), []);
});

test("gõ c1r21 không dấu chấm → phòng C1.R21 đứng đầu, kèm sự cố của phòng", () => {
  const kq = timKiemChung("c1r21", NGUON);
  assert.equal(kq[0].nhom, "phong");
  assert.equal(kq[0].giaTri, "C1.R21");
  assert.ok(kq.some((x) => x.nhom === "suCo" && x.giaTri === "SC-101"));
  assert.ok(!kq.some((x) => x.giaTri === "C4.R10"));
});

test("mã khớp đúng xếp trên mã chỉ bắt đầu bằng chuỗi gõ", () => {
  const phong = timKiemChung("c1.r2", NGUON).filter((x) => x.nhom === "phong");
  assert.deepEqual(phong.map((x) => x.giaTri), ["C1.R2", "C1.R21"]);
});

test("tìm theo tên không dấu: 'dong goi' → phòng C4.R10; 'xu huong' → trang Xu hướng", () => {
  assert.equal(timKiemChung("dong goi", NGUON).find((x) => x.nhom === "phong").giaTri, "C4.R10");
  const trang = timKiemChung("xu huong", NGUON).find((x) => x.nhom === "trang");
  assert.equal(trang.giaTri, "trend");
});

test("thứ tự nhóm: Phòng → Sự cố → Trang; giới hạn số dòng mỗi nhóm", () => {
  const kq = timKiemChung("c", NGUON, { phong: 2, suCo: 1, trang: 1 });
  const nhom = kq.map((x) => x.nhom);
  assert.deepEqual(nhom, [...nhom].sort((a, b) => ["phong", "suCo", "trang"].indexOf(a) - ["phong", "suCo", "trang"].indexOf(b)));
  assert.ok(kq.filter((x) => x.nhom === "phong").length <= 2);
  assert.ok(kq.filter((x) => x.nhom === "suCo").length <= 1);
});
