// vi.js — MỘT nguồn chữ tiếng Việt cho nhãn dùng chung (Phase F báo cáo 9).
// Nguyên tắc: giữ thuật ngữ NGHIỆP VỤ (DP, RH, AHU, GMP, CAPA, IPC, QA);
// ẩn thuật ngữ HẠ TẦNG (WF*, rpc_*, Supabase, enum) khỏi UI thường — chúng chỉ
// xuất hiện trong <TechnicalDetails> cho ADMIN/IT.
// Chưa di trú 100% chuỗi toàn app — mở rộng dần: chuỗi mới/chuỗi đổi thì thêm vào đây.

export const VI = {
  app: {
    ten: "Giám sát HVAC phòng sạch",
    donVi: "Phòng Quản lý chất lượng",
  },
  nav: {
    home: "Tổng quan",
    events: "Sự cố",
    recent: "Chênh áp",
    sensors: "Cảm biến",
    tasks: "Việc cần làm",
    trend: "Xu hướng",
    reports: "Báo cáo",
    audit: "Nhật ký & SOP",
    recipients: "Thông báo",
    settings: "Cấu hình",
    them: "Thêm",
  },
  strip: {
    thuNghiem: "Dữ liệu mẫu",
    binhThuong: "Kết nối ổn định",
    dangCapNhat: "Đang nhận dữ liệu",
    matKetNoi: "Mất kết nối dữ liệu",
    capNhat: "cập nhật",
  },
  trangThaiDuLieu: {
    chuaCapNhat: "Chưa cập nhật",
    thieuDuLieu: "Thiếu dữ liệu",
    dungTinHieu: "Đứng tín hiệu",
    khongXacDinh: "Chưa xác định được tình trạng hiện tại",
  },
};
export default VI;
