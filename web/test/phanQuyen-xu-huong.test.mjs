// phanQuyen-xu-huong.test.mjs — 09/11/2026: mọi tài khoản đăng nhập xem được trang Xu hướng;
// nút lập nhận định (gọi AI + lưu hồ sơ) vẫn chỉ dành cho LOT/QA/Quản trị.
import test from "node:test";
import assert from "node:assert/strict";
import { roleCanSeeTab, coTheLapNhanDinh } from "../src/lib/phanQuyen.js";

test("mọi vai trò đều xem được trang Xu hướng", () => {
  for (const role of ["IPC", "MEP", "LOT", "QA", "ADMIN", "IT"]) assert.equal(roleCanSeeTab(role, "trend"), true, role);
});

test("chỉ LOT/QA/ADMIN/IT lập nhận định; IPC/MEP chỉ xem", () => {
  for (const role of ["LOT", "QA", "ADMIN", "IT"]) assert.equal(coTheLapNhanDinh(role), true, role);
  for (const role of ["IPC", "MEP"]) assert.equal(coTheLapNhanDinh(role), false, role);
  assert.equal(coTheLapNhanDinh(""), true, "demo (chưa có vai trò) giữ như cũ");
});
