// trend-filter.test.mjs — Bộ lọc trang Xu hướng ở nhánh DỮ LIỆU THẬT (05/11/2026).
// Tái hiện lỗi người dùng báo: chọn cấp "Phòng" ra 0 kết quả khi nguồn FMS trễ
// (mọi phòng có du_lieu_cu=true → noData=true) trong khi chip Khu/AHU vẫn hiện.
import test from "node:test";
import assert from "node:assert/strict";
import { boDau, dungPhamViLive, locLuaChon, theoCap, timTheoTu } from "../src/lib/boLocXuHuong.js";

// Dạng y hệt layDanhSachPhong trả về (supabaseData.js)
const phong = (id, name, area, ahu, comp, { duLieuCu = false, chuaCoCamBien = false } = {}) => ({
  id, name, area, ahu, _compliance: comp, duLieuCu, noData: duLieuCu || chuaCoCamBien, _isLive: true,
});
const ROOMS = [
  phong("C1.R5", "Phòng sạch chung", "C1", "AHU02", 93),
  phong("C1.R11", "Pha chế", "C1", "AHU03", 63),
  phong("C1.R14", "Hành lang", "C1", "AHU01", null, { chuaCoCamBien: true }),
  phong("C4.R7", "Chiết rót", "C4", "AHU-K01", 55, { duLieuCu: true }),
  phong("C4.R1", "Thay đồ", "C4", "AHU-K01", 70, { duLieuCu: true }),
];
const ahuCuaKhu = (rooms, khu) => [...new Set(rooms.filter((r) => khu === "ALL" || r.area === khu).map((r) => r.ahu))].sort();

test("NGUỒN TRỄ: mọi phòng du_lieu_cu → cấp Phòng vẫn đủ danh sách (lỗi gốc ra 0)", () => {
  const treHet = ROOMS.map((r) => ({ ...r, duLieuCu: true, noData: true }));
  const sc = dungPhamViLive(treHet, [], null);
  const dsPhong = locLuaChon(theoCap(sc, "ROOM"), { level: "ROOM" });
  assert.equal(dsPhong.length, 5);
  assert.ok(dsPhong.every((o) => o.noData && o.latest.compliance === null), "không chấm % bằng số cũ");
  // Khu/AHU cũng phải còn (trước đây gộp từ danh sách phòng đã bị lọc rỗng)
  assert.deepEqual(theoCap(sc, "AREA").map((o) => o.id).sort(), ["C1", "C4"]);
  assert.equal(theoCap(sc, "AHU").length, 4);
  assert.equal(sc.find((s) => s.type === "TOTAL").latest.compliance, null);
});

test("Phòng noData KHÔNG kéo lệch % đạt gộp và xếp CUỐI danh sách", () => {
  const sc = dungPhamViLive(ROOMS, [], null);
  assert.equal(sc.find((s) => s.type === "TOTAL").latest.compliance, 78); // (93+63)/2 — bỏ 3 phòng noData
  assert.equal(sc.find((s) => s.type === "AREA" && s.id === "C1").latest.compliance, 78);
  const c4 = sc.find((s) => s.type === "AREA" && s.id === "C4");
  assert.equal(c4.noData, true, "khu mà mọi phòng đều trễ → noData");
  assert.equal(c4.duLieuCu, true);
  const ids = theoCap(sc, "ROOM").map((o) => o.id);
  assert.deepEqual(ids.slice(0, 2), ["C1.R11", "C1.R5"], "có số liệu trước, rủi ro giảm dần");
  assert.deepEqual(ids.slice(2).sort(), ["C1.R14", "C4.R1", "C4.R7"]);
  assert.equal(theoCap(sc, "AREA")[0].id, "C1", "khu chưa có số liệu không chiếm vị trí đầu");
});

test("RPC rủi ro KHÔNG che trạng thái noData bằng số đạt", () => {
  const rpc = [{ type: "ROOM", id: "C4.R7", risk: 10, compliance: 90, dat1n: 90, dat3n: 88, dat7n: 85, chuoi: [1, 2] }];
  const r = dungPhamViLive(ROOMS, rpc, null).find((s) => s.id === "C4.R7");
  assert.equal(r.latest.compliance, null);
  assert.equal(r.risk, 999);
  assert.equal(r.dat7n, 85, "số lịch sử 7 ngày vẫn giữ để tham khảo");
  const ok = dungPhamViLive(ROOMS, [{ type: "ROOM", id: "C1.R5", risk: 4, compliance: 96 }], null).find((s) => s.id === "C1.R5");
  assert.equal(ok.latest.compliance, 96);
  assert.equal(ok.risk, 4);
});

test("Chip Khu ở cấp AHU không còn ra 0 (AHU LIVE không mang trường area)", () => {
  const sc = dungPhamViLive(ROOMS, [], null);
  const ahu = theoCap(sc, "AHU");
  assert.deepEqual(locLuaChon(ahu, { level: "AHU", area: "C1", ahuList: ahuCuaKhu(ROOMS, "C1") }).map((o) => o.id).sort(), ["AHU01", "AHU02", "AHU03"]);
  assert.deepEqual(locLuaChon(ahu, { level: "AHU", area: "C4", ahu: "AHU-K01", ahuList: ahuCuaKhu(ROOMS, "C4") }).map((o) => o.id), ["AHU-K01"]);
});

test("Chip Khu + AHU ở cấp Phòng; cấp Khu; cấp Tổng bỏ qua chip", () => {
  const sc = dungPhamViLive(ROOMS, [], null);
  const p = theoCap(sc, "ROOM");
  assert.equal(locLuaChon(p, { level: "ROOM", area: "C1", ahuList: ahuCuaKhu(ROOMS, "C1") }).length, 3);
  assert.deepEqual(locLuaChon(p, { level: "ROOM", area: "C4", ahu: "AHU-K01" }).map((o) => o.id).sort(), ["C4.R1", "C4.R7"]);
  assert.deepEqual(locLuaChon(theoCap(sc, "AREA"), { level: "AREA", area: "C4" }).map((o) => o.id), ["C4"]);
  // Khu demo (moPhong.js) KHÔNG có trường area → phải khớp theo id
  assert.equal(locLuaChon([{ type: "AREA", id: "C1", name: "Khu C1" }], { level: "AREA", area: "C1" }).length, 1);
  assert.equal(locLuaChon([sc[0]], { level: "TOTAL", area: "C4", ahu: "AHU01" }).length, 1);
});

test("Tìm không dấu, khớp cả khu/AHU; bỏ dấu giữ nguyên độ dài để tô sáng đúng", () => {
  const p = theoCap(dungPhamViLive(ROOMS, [], null), "ROOM");
  assert.deepEqual(timTheoTu(p, "hanh lang").map((o) => o.id), ["C1.R14"]);
  assert.deepEqual(timTheoTu(p, "  PHA CHE ").map((o) => o.id), ["C1.R11"]);
  assert.deepEqual(timTheoTu(p, "ahu-k01").map((o) => o.id).sort(), ["C4.R1", "C4.R7"]);
  assert.deepEqual(timTheoTu(p, "thay đồ").map((o) => o.id), ["C4.R1"]);
  assert.equal(timTheoTu(p, "").length, 5);
  assert.equal(timTheoTu(p, "khong-co").length, 0);
  for (const t of ["Hành lang", "Đóng gói cấp D", "Phòng sạch chung"]) assert.equal(boDau(t).length, t.length);
  assert.equal(boDau("Đường ống"), "duong ong");
  assert.equal(boDau(null), "");
});

test("Tài khoản giới hạn khu: tên phạm vi Tổng đúng bản chất", () => {
  const sc = dungPhamViLive(ROOMS.filter((r) => r.area === "C1"), [], ["C1"]);
  assert.equal(sc[0].name, "Phạm vi được xem (khu C1)");
  assert.deepEqual(dungPhamViLive(null, null, null).map((s) => s.type), ["TOTAL"]);
});
