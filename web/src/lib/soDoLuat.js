// ============================================================
// soDoLuat.js — Sinh sơ đồ máy trạng thái Mermaid TỪ bảng luật
//
// Nguồn duy nhất là live.nutThaoTac (view xem_nut_thao_tac = quy_tac_chuyen_trang_thai).
// Sơ đồ KHÔNG THỂ lệch luật vì nó CHÍNH LÀ luật được vẽ lại — mỗi cạnh là một
// dòng luật kích hoạt. Không render bằng thư viện Mermaid (nặng, CSP): sinh chuỗi
// Mermaid để copy/xem, VÀ một sơ đồ SVG-lite bằng danh sách cạnh nhóm theo vai trò.
//
// Nút "giữ trạng thái" (ghi chú, không đổi state) tách riêng — chúng không phải
// cạnh chuyển tiếp mà là hành động tại-chỗ.
// ============================================================

const VAI_TRO_TEN = { IPC: "IPC", MEP: "Cơ điện", LOT: "Trực HSL", QA: "QA", ADMIN: "Quản trị", SYSTEM: "Hệ thống" };
const TT_TEN = {
  CHUA_XU_LY: "Chưa xử lý", DA_BAO_CO_DIEN: "Đã báo Cơ điện",
  CO_DIEN_DANG_XU_LY: "Cơ điện đang xử lý", CO_DIEN_CHO_XU_LY: "Cơ điện chờ xử lý",
  CO_DIEN_KHONG_XU_LY_DUOC: "Cơ điện không xử lý được", DA_KHAC_PHUC: "Đã khắc phục",
  DONG_TU_DONG: "Đóng tự động", DONG_NGOAI_PHAM_VI: "Đóng — ngoài phạm vi",
  IPC_BINH_THUONG: "IPC bình thường", MO_LAI: "Mở lại", DA_DONG: "Đã đóng",
};
const tenTT = (m) => TT_TEN[m] || m;

// Phân tách luật thành: cạnh chuyển tiếp (đổi trạng thái) và hành động tại-chỗ (giữ).
export function phanTichLuat(dsNut) {
  const canh = [];       // { tu, den, vai_tro, nhan, dong, moLai }
  const taiCho = [];     // { trangThai, vai_tro, nhan } — giữ trạng thái
  for (const n of dsNut || []) {
    if (!n.nhan) continue;                    // dòng hệ thống không nhãn: bỏ khỏi sơ đồ người đọc
    const tu = n.trang_thai_truoc === "*" ? "«mọi trạng thái»" : n.trang_thai_truoc;
    if (n.giu_trang_thai || n.trang_thai_sau === "__GIU__") {
      taiCho.push({ trangThai: tu, vai_tro: n.vai_tro, nhan: n.nhan });
    } else if (n.trang_thai_sau) {
      canh.push({ tu, den: n.trang_thai_sau, vai_tro: n.vai_tro, nhan: n.nhan, dong: !!n.dong_su_co, moLai: !!n.mo_lai_su_co });
    }
  }
  return { canh, taiCho };
}

// Chuỗi Mermaid (stateDiagram-v2) — copy dán vào mermaid.live hoặc tài liệu.
export function sinhMermaid(dsNut) {
  const { canh } = phanTichLuat(dsNut);
  const lines = ["stateDiagram-v2", "  direction LR"];
  const dinh = new Set();
  for (const c of canh) { if (c.tu !== "«mọi trạng thái»") dinh.add(c.tu); dinh.add(c.den); }
  for (const d of dinh) lines.push(`  ${d}: ${tenTT(d)}`);
  for (const c of canh) {
    const tu = c.tu === "«mọi trạng thái»" ? "[*]" : c.tu;
    lines.push(`  ${tu} --> ${c.den}: ${VAI_TRO_TEN[c.vai_tro] || c.vai_tro} · ${c.nhan}`);
  }
  return lines.join("\n");
}

export { tenTT, VAI_TRO_TEN };
