// ============================================================
// soDoLuat.js — Phân tích bảng luật thành LUỒNG VẬN HÀNH để vẽ
//
// Tách 3 loại (mấu chốt để sơ đồ ĐỌC ĐƯỢC):
//   canhTuanTu  — chuyển trạng thái A→B do một vai trò bấm (xương sống quy trình)
//   canhBatKy   — luật áp cho "mọi trạng thái" (Quản trị/QA đóng·mở lại, IPC bình
//                 thường): KHÔNG vẽ vào xương sống, để ra panel riêng
//   taiCho      — hành động ghi chú, không đổi trạng thái
// ============================================================

const VAI_TRO_TEN = { IPC: "IPC", MEP: "Cơ điện", LOT: "Trực HSL", QA: "QA", ADMIN: "Quản trị", SYSTEM: "Hệ thống" };
const TT_TEN = {
  CHUA_XU_LY: "Chưa xử lý", DA_BAO_CO_DIEN: "Đã báo Cơ điện",
  CO_DIEN_DANG_XU_LY: "Cơ điện đang xử lý", CO_DIEN_CHO_XU_LY: "Cơ điện chờ xử lý",
  CO_DIEN_KHONG_XU_LY_DUOC: "Cơ điện không xử lý được", DA_KHAC_PHUC: "Đã khắc phục",
  DONG_TU_DONG: "Đóng tự động", DONG_NGOAI_PHAM_VI: "Đóng — ngoài phạm vi",
  IPC_BINH_THUONG: "IPC: bình thường", MO_LAI: "Mở lại", DA_DONG: "Đã đóng",
};
const tenTT = (m) => TT_TEN[m] || m;

export function phanTichLuat(dsNut) {
  const canhTuanTu = [], canhBatKy = [], taiCho = [];
  for (const n of dsNut || []) {
    if (!n.nhan) continue;
    const chung = { vai_tro: n.vai_tro, nhan: n.nhan };
    if (n.giu_trang_thai || n.trang_thai_sau === "__GIU__") {
      taiCho.push({ ...chung, trangThai: n.trang_thai_truoc });
    } else if (n.trang_thai_sau) {
      const e = { ...chung, den: n.trang_thai_sau, dong: !!n.dong_su_co, moLai: !!n.mo_lai_su_co };
      if (n.trang_thai_truoc === "*") canhBatKy.push(e);
      else canhTuanTu.push({ ...e, tu: n.trang_thai_truoc });
    }
  }
  return { canhTuanTu, canhBatKy, taiCho };
}

// Chuỗi Mermaid (giữ nút copy cho ai muốn render ngoài).
export function sinhMermaid(dsNut) {
  const { canhTuanTu, canhBatKy } = phanTichLuat(dsNut);
  const lines = ["stateDiagram-v2", "  direction LR"];
  const dinh = new Set();
  for (const c of canhTuanTu) { dinh.add(c.tu); dinh.add(c.den); }
  for (const c of canhBatKy) dinh.add(c.den);
  for (const d of dinh) lines.push(`  ${d}: ${tenTT(d)}`);
  for (const c of canhTuanTu) lines.push(`  ${c.tu} --> ${c.den}: ${VAI_TRO_TEN[c.vai_tro] || c.vai_tro} · ${c.nhan}`);
  for (const c of canhBatKy) lines.push(`  [*] --> ${c.den}: ${VAI_TRO_TEN[c.vai_tro] || c.vai_tro} · ${c.nhan}`);
  return lines.join("\n");
}

export { tenTT, VAI_TRO_TEN };
