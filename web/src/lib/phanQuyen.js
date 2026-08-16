// phanQuyen.js — vai trò & quyền xem tab (tách move-only từ App.jsx 17/08/2026).

/* ============ NGƯỜI DÙNG & PHÂN QUYỀN ============ */
// Danh sách người dùng + vai trò lấy từ bảng Supabase `nguoi_dung` theo email (xem lib/auth.js),
// KHÔNG hardcode ở đây (tránh lộ email nội bộ ra source công khai).
// Tên vai trò ĐẦY ĐỦ theo chức năng (yêu cầu 11/07: không dùng viết tắt trên giao diện).
export const ROLE_VI = { IPC: "Kiểm soát hiện trường", MEP: "Cơ điện", LOT: "Trực hồ sơ lô", QA: "Đảm bảo chất lượng", ADMIN: "Quản trị hệ thống", IT: "Quản trị hệ thống" };
// 31/07: khu Q2 do QC kiểm soát, không phải IPC. Chỉ đổi CHỮ HIỂN THỊ theo khu — mã vai trò,
// phân quyền và luật nút (xem_nut_thao_tac) vẫn là 'IPC'. Cùng bảng ánh xạ với node
// "Đổi tên vai trò theo khu" của WF8, để email và web không gọi hai tên khác nhau.
export const TEN_VAI_KHU = { Q2: { IPC: "QC" } };
// Nhận "Q2" hoặc mã phòng "Q2.R7" — khu là phần trước dấu chấm.
export const khuCua = (s) => String(s || "").split(".")[0];
export const tenVaiTro = (vai, khuHoacPhong) => (TEN_VAI_KHU[khuCua(khuHoacPhong)] || {})[vai] || ROLE_VI[vai] || vai;
// Chuỗi server trả về (chẩn đoán SLA, nhật ký…) vẫn chứa mã vai trò → dịch khi hiển thị.
export const docTenVaiTro = (s, khuHoacPhong) => (s == null ? s : String(s).replace(/\b(IPC|MEP|LOT|QA|ADMIN)\b/g, (m) => tenVaiTro(m, khuHoacPhong)));
export const FULL_ACCESS = ["QA", "ADMIN", "IT"];                 // QA và IT: xem TẤT CẢ các tab
export const canManageRooms = (role) => FULL_ACCESS.includes(role);
// PHÂN QUYỀN TAB (yêu cầu #5):
//   • IPC, Cơ điện (MEP): chỉ Tổng quan + Sự cố (để kích hoạt sự cố liên quan).
//   • Trực (LOT): Tổng quan + Sự cố + Xu hướng.
//   • QA, IT (ADMIN): tất cả các tab.
//   • ĐỔI MẬT KHẨU: mọi vai trò đều có (nút riêng ở góc phải, không phụ thuộc tab).
export const TAB_ROLES = {
  home:     ["IPC", "MEP", "LOT", "QA", "ADMIN", "IT"],
  events:   ["IPC", "MEP", "LOT", "QA", "ADMIN", "IT"],
  recent:   ["IPC", "MEP", "LOT", "QA", "ADMIN", "IT"],
  sensors:  ["MEP", "LOT", "QA", "ADMIN", "IT"],   // theo dõi cảm biến đứng hình — Cơ điện xử lý
  trend:    ["LOT", "QA", "ADMIN", "IT"],
  reports:  FULL_ACCESS,
  audit:    FULL_ACCESS,
  settings: FULL_ACCESS,
};
// role rỗng = chế độ xem trước cục bộ (demo, chưa Supabase) → hiện mọi tab cho tiện thử.
export const roleCanSeeTab = (role, key) => (!role ? true : (TAB_ROLES[key] || FULL_ACCESS).includes(role));
