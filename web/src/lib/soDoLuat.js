// ============================================================
// soDoLuat.js — Chuẩn hoá bảng luật thành dữ liệu trình bày cho sơ đồ vận hành.
//
// `xem_nut_thao_tac` là nguồn sự thật của web. Lớp này KHÔNG gộp các luật có cùng
// cặp trạng thái: mỗi dòng vẫn giữ nguyên hành động, vai trò, điều kiện áp dụng và
// yêu cầu lý do để phần "Bảng luật đầy đủ" luôn đối chiếu được với dữ liệu gốc.
// ============================================================

const VAI_TRO_TEN = { IPC: "IPC", MEP: "Cơ điện", LOT: "Trực HSL", QA: "QA", IT: "IT", ADMIN: "Quản trị", VIEWER: "Chỉ xem", SYSTEM: "Hệ thống" };
const TT_TEN = {
  CHUA_XU_LY: "Chưa xử lý", DA_BAO_CO_DIEN: "Đã báo Cơ điện",
  CO_DIEN_DANG_XU_LY: "Cơ điện đang xử lý", CO_DIEN_CHO_XU_LY: "Cơ điện chờ xử lý",
  CO_DIEN_KHONG_XU_LY_DUOC: "Cơ điện không xử lý được", DA_KHAC_PHUC: "Đã khắc phục",
  DONG_TU_DONG: "Đóng tự động", DONG_NGOAI_PHAM_VI: "Đóng — ngoài phạm vi",
  IPC_BINH_THUONG: "IPC xác nhận bình thường", MO_LAI: "Mở lại", DA_DONG: "Đã đóng",
  __GIU__: "Giữ nguyên trạng thái",
};
const tenTT = (m) => TT_TEN[m] || m;

function chuanHoaLuat(n, index) {
  const tu = n.trang_thai_truoc || "*";
  const den = n.trang_thai_sau || (n.giu_trang_thai ? "__GIU__" : null);
  const apDungKhi = n.ap_dung_khi || "MO";
  return {
    id: `${n.hanh_dong || "luat"}-${n.vai_tro || "SYSTEM"}-${tu}-${index}`,
    hanh_dong: n.hanh_dong || "",
    vai_tro: n.vai_tro || "SYSTEM",
    bo_nut: n.bo_nut || "",
    nhan: n.nhan || "",
    tu,
    den,
    dong: !!n.dong_su_co,
    giu: !!n.giu_trang_thai || den === "__GIU__",
    moLai: !!n.mo_lai_su_co,
    batBuocLyDo: !!n.bat_buoc_ly_do,
    apDungKhi,
    thuTu: Number(n.thu_tu) || 0,
    mauNen: n.mau_nen || "",
    mauChu: n.mau_chu || "",
  };
}

export function phanTichLuat(dsNut) {
  const tatCa = (Array.isArray(dsNut) ? dsNut : [])
    .filter((n) => n && n.nhan)
    .map(chuanHoaLuat)
    .sort((a, b) => a.thuTu - b.thuTu || a.nhan.localeCompare(b.nhan, "vi"));

  const taiCho = tatCa.filter((r) => r.giu);
  const chuyen = tatCa.filter((r) => !r.giu && r.den);
  const moLai = chuyen.filter((r) => r.moLai || r.apDungKhi === "DONG");
  const idMoLai = new Set(moLai.map((r) => r.id));
  const canhBatKy = chuyen.filter((r) => r.tu === "*" && !idMoLai.has(r.id));
  const canhTuanTu = chuyen.filter((r) => r.tu !== "*" && !idMoLai.has(r.id));

  return { tatCa, canhTuanTu, canhBatKy, taiCho, moLai };
}

// Chuỗi Mermaid (giữ nút copy cho ai muốn render ngoài).
export function sinhMermaid(dsNut) {
  const { canhTuanTu, canhBatKy, moLai } = phanTichLuat(dsNut);
  const lines = ["stateDiagram-v2", "  direction LR"];
  const dinh = new Set();
  for (const c of canhTuanTu) { dinh.add(c.tu); dinh.add(c.den); }
  for (const c of canhBatKy) dinh.add(c.den);
  for (const c of moLai) dinh.add(c.den);
  for (const d of dinh) lines.push(`  ${d}: ${tenTT(d)}`);
  for (const c of canhTuanTu) lines.push(`  ${c.tu} --> ${c.den}: ${VAI_TRO_TEN[c.vai_tro] || c.vai_tro} · ${c.nhan}`);
  for (const c of canhBatKy) lines.push(`  [*] --> ${c.den}: ${VAI_TRO_TEN[c.vai_tro] || c.vai_tro} · ${c.nhan}`);
  for (const c of moLai) lines.push(`  [*] --> ${c.den}: ${VAI_TRO_TEN[c.vai_tro] || c.vai_tro} · ${c.nhan}`);
  return lines.join("\n");
}

export { tenTT, VAI_TRO_TEN };
