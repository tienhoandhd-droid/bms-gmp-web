// nutThaoTac.js — nút thao tác sự cố theo trạng thái/vai trò (tách move-only từ App.jsx 17/08/2026).
import { TRANG_THAI_CODE_TO_LABEL } from "./supabaseData";

// Mỗi trạng thái → DANH SÁCH hành động (nút) theo vai trò. code = mã RPC; next = trạng thái hiển thị kế; dong = đóng sự cố.
export const A_TEAL = "text-teal-700 bg-teal-50 hover:bg-teal-100 ring-teal-200";
export const A_AMBER = "text-amber-700 bg-amber-50 hover:bg-amber-100 ring-amber-200";
export const A_INFO = "text-sky-700 bg-sky-50 hover:bg-sky-100 ring-sky-200";
export const A_ROSE = "text-rose-700 bg-rose-50 hover:bg-rose-100 ring-rose-200";
export const A_SLATE = "text-slate-600 bg-slate-100 hover:bg-slate-200 ring-slate-200";
// Luồng gọn: IPC (kiểm tra hiện trường) + Cơ điện (điều chỉnh). Luật DB dùng '*' nên đóng được từ mọi trạng thái.
export const A_IPC = { label: "Bình thường — đóng", code: "ipc_binh_thuong", next: "Đã khắc phục", dong: true, roles: ["IPC"], color: A_TEAL };
export const A_MEP_NHAN = { label: "Cơ điện đang xử lý", code: "mep_tiep_nhan", next: "Cơ điện đang xử lý", roles: ["MEP"], color: A_INFO };
export const A_MEP_XONG = { label: "Đã xử lý xong — đóng", code: "mep_xu_ly_xong", next: "Đã khắc phục", dong: true, roles: ["MEP"], color: A_TEAL };
export const A_MEP_KHONG = { label: "Không xử lý được", code: "mep_khong_xu_ly_duoc", next: "Không xử lý được", roles: ["MEP"], color: A_ROSE };
export const STATUS_ACTIONS = {
  "Chưa xử lý": [A_IPC, A_MEP_NHAN, A_MEP_XONG],
  "Cơ điện đang xử lý": [A_MEP_XONG, A_MEP_KHONG, A_IPC],
  "Không xử lý được": [A_MEP_XONG, A_IPC],
  // Nhãn cũ (sự cố mở trước khi đổi luồng) — vẫn đóng được
  "Đã báo cơ điện": [A_MEP_NHAN, A_MEP_XONG, A_IPC],
  "Chờ IPC kiểm lại": [A_MEP_XONG, A_IPC],
  "IPC: bất thường": [A_MEP_NHAN, A_IPC],
};
// gộp mọi vai trò có thể thao tác ở 1 trạng thái (để hiện "Chờ …")
export const rolesOfStatus = (st) => [...new Set((STATUS_ACTIONS[st] || []).flatMap((a) => a.roles))];
// CHỈ dùng ở chế độ DEMO. Ở LIVE, openApproval giải nút từ bảng luật (xem P0-2).
// Bỏ đặc quyền `role === "ADMIN"`: nó cho ADMIN nút của IPC/Cơ điện mà DB luôn từ chối.
export const firstActionFor = (st, role) => (STATUS_ACTIONS[st] || []).find((a) => a.roles.includes(role)) || null;

// ===== Bộ nút lấy TỪ BẢNG LUẬT (view xem_nut_thao_tac), không hard-code =====
// STATUS_ACTIONS phía trên chỉ còn dùng cho chế độ DEMO (không có Supabase).
// Ở LIVE, nút hiện ra phải là nút bấm được. Muốn vậy phải lọc ĐỦ BA chiều mà DB
// dùng khi từ chối: trang_thai_truoc · vai_tro · ap_dung_khi (mở/đã đóng).
//
// 10/07/2026: lọc thiếu hai chiều, và lỗi "nút hiện nhưng bấm trả KHONG_DUOC_PHEP"
// vẫn sống — chỉ là không ai gặp vì nó nấp ở vai trò ADMIN (đúng một tài khoản):
//   • `role === "ADMIN" ||` cho ADMIN thấy toàn bộ nút của IPC/MEP/LOT, trong khi
//     rpc_thao_tac_su_co tra luật theo (hanh_dong, vai_tro) nên từ chối 100%.
//   • Ngược lại ba nút thật của ADMIN có nhan = NULL nên không bao giờ hiện.
// Nay ADMIN xem như mọi vai trò khác: thấy đúng nút của mình, bấm là chạy.
export function nutKhopTrangThai(dsNut, statusCode, daDong = false) {
  if (!dsNut?.length || !statusCode) return [];
  const uu = new Map();   // ưu tiên luật khớp ĐÚNG trạng thái hơn luật '*'
  for (const n of dsNut) {
    if (n.trang_thai_truoc !== statusCode && n.trang_thai_truoc !== "*") continue;
    const apDung = n.ap_dung_khi || "MO";                 // DB mặc định 'MO'
    if (apDung === "MO" && daDong) continue;               // nút thường: sự cố đã đóng thì thôi
    if (apDung === "DONG" && !daDong) continue;            // "Mở lại": chỉ khi đã đóng
    const cu = uu.get(n.hanh_dong);
    if (!cu || (n.trang_thai_truoc === statusCode && cu.trang_thai_truoc === "*")) uu.set(n.hanh_dong, n);
  }
  return [...uu.values()].sort((a, b) => (a.thu_tu || 0) - (b.thu_tu || 0));
}
export function nutChoVaiTro(dsNut, statusCode, role, daDong = false) {
  return nutKhopTrangThai(dsNut, statusCode, daDong)
    .filter((n) => n.vai_tro === role)
    .map((n) => ({
      code: n.hanh_dong, label: n.nhan, roles: [n.vai_tro], dong: !!n.dong_su_co,
      batBuocLyDo: !!n.bat_buoc_ly_do,
      next: n.giu_trang_thai ? "(giữ nguyên)" : (TRANG_THAI_CODE_TO_LABEL[n.trang_thai_sau] || n.trang_thai_sau),
      style: { color: n.mau_chu, backgroundColor: n.mau_nen },
    }));
}
export const STATUS_DOT = { "Chưa xử lý": "bg-rose-500", "IPC: bất thường": "bg-violet-500", "Đã báo cơ điện": "bg-amber-500", "Cơ điện đang xử lý": "bg-cyan-500", "Cơ điện chờ xử lý": "bg-slate-400", "Chờ IPC kiểm lại": "bg-teal-500", "Đã khắc phục": "bg-emerald-500" };
